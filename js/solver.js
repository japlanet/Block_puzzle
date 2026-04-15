// Hint engine.
//
// The original game's hint was wrong: it suggested *any* legal move when it
// couldn't find a 1-step exit, which often pointed the player backwards.
//
// This version is a tiered heuristic with correctness-preserving fallbacks:
//   1. Can any block exit its gate in one full slide? → suggest that.
//   2. For every live block, do a single-block BFS (other live blocks treated
//      as immovable walls) toward its matching gate. Pick the block whose path
//      is shortest and suggest its first slide. This mirrors how a human
//      solves the puzzle: "which animal has a clear path home right now?"
//   3. If no block has a clear path, find a block whose gate-path is blocked,
//      identify the blockers, and suggest moving a blocker out of the way.
//   4. Last resort — any legal move (never hit on the bundled 60 levels).
//
// All four tiers run in O(blocks × cells) so hint taps feel instant.

import { atGate, directionsOf } from './geometry.js';

const EMPTY = 0;
const WALL = -1;

function buildGrid(level, blocks) {
  const cols = level.cols;
  const grid = new Int8Array(cols * level.rows);
  if (level.walls) {
    for (const w of level.walls) grid[w.row * cols + w.col] = WALL;
  }
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const shape = b.shape;
    for (let j = 0; j < shape.length; j++) {
      grid[(b.row + shape[j][1]) * cols + (b.col + shape[j][0])] = i + 1;
    }
  }
  return grid;
}

/** Can a block placed at (col,row) with `shape` fit in the grid, treating `selfIdx+1` as self? */
function canPlace(shape, col, row, grid, cols, rows, self) {
  for (let j = 0; j < shape.length; j++) {
    const c = col + shape[j][0];
    const r = row + shape[j][1];
    if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
    const v = grid[r * cols + c];
    if (v !== EMPTY && v !== self) return false;
  }
  return true;
}

/** Full slide in (dc,dr). Returns the anchor (col,row) the block lands at, or null if it can't move. */
function fullSlide(block, blockIdx, dc, dr, grid, cols, rows) {
  let col = block.col, row = block.row, stepped = false;
  while (canPlace(block.shape, col + dc, row + dr, grid, cols, rows, blockIdx + 1)) {
    col += dc; row += dr; stepped = true;
  }
  return stepped ? { col, row } : null;
}

// ── Tier 1: direct exit ──────────────────────────────────────────
function tryDirectExit(level, blocks, grid) {
  for (const gate of level.gates) {
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      if (b.color !== gate.color) continue;
      const dirs = directionsOf(b);
      // Try every direction — not just the one that matches gate side — because
      // rotated free blocks can approach a side gate from any axis.
      for (const [dc, dr] of dirs) {
        const landing = fullSlide(b, bi, dc, dr, grid, level.cols, level.rows);
        if (!landing) continue;
        const probe = { ...b, col: landing.col, row: landing.row };
        if (atGate(probe, gate, level)) {
          return { id: b.id, col: landing.col, row: landing.row, exited: true };
        }
      }
    }
  }
  return null;
}

// ── Tier 2: shortest single-block path to gate ────────────────────
/**
 * Single-block BFS: given the current grid (with `block` removed), find the
 * shortest slide-path from the block's current position to a position that
 * satisfies atGate(block, gate). Returns an array of anchor positions
 * [ [c0,r0], [c1,r1], ..., [cn,rn] ] or null if unreachable.
 */
function singleBlockPath(level, block, gate, grid) {
  const cols = level.cols, rows = level.rows;
  const shape = block.shape;
  const startKey = block.col + ',' + block.row;
  const visited = new Map();
  visited.set(startKey, null);
  const queue = [[block.col, block.row]];
  let head = 0;
  const dirs = directionsOf(block);

  while (head < queue.length) {
    const [col, row] = queue[head++];
    if (atGate({ ...block, col, row }, gate, level)) {
      // Reconstruct.
      const path = [[col, row]];
      let k = col + ',' + row;
      while (visited.get(k)) {
        const [pc, pr] = visited.get(k);
        path.unshift([pc, pr]);
        k = pc + ',' + pr;
      }
      return path;
    }
    for (let d = 0; d < dirs.length; d++) {
      const dc = dirs[d][0], dr = dirs[d][1];
      let c = col, r = row;
      while (canPlace(shape, c + dc, r + dr, grid, cols, rows, 0)) {
        c += dc; r += dr;
        const k = c + ',' + r;
        if (!visited.has(k)) {
          visited.set(k, [col, row]);
          queue.push([c, r]);
        }
      }
    }
  }
  return null;
}

/** Try tier 2: pick the block with the shortest clear path to its matching gate. */
function tryClearPath(level, blocks) {
  let bestPath = null;
  let bestBlock = null;
  let bestIdx = -1;

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    // Rebuild grid per block so we can mask out that block (treat the rest as walls).
    const grid = buildGrid(level, blocks);
    const shape = b.shape;
    for (let j = 0; j < shape.length; j++) {
      grid[(b.row + shape[j][1]) * level.cols + (b.col + shape[j][0])] = EMPTY;
    }
    for (const gate of level.gates) {
      if (gate.color !== b.color) continue;
      const path = singleBlockPath(level, b, gate, grid);
      if (!path || path.length < 2) continue;
      if (bestPath === null || path.length < bestPath.length) {
        bestPath = path;
        bestBlock = b;
        bestIdx = bi;
      }
    }
  }
  if (!bestPath) return null;
  const [nc, nr] = bestPath[1];
  return { id: bestBlock.id, col: nc, row: nr, exited: bestPath.length === 2 && willExit(level, bestBlock, nc, nr) };
}

function willExit(level, block, col, row) {
  const probe = { ...block, col, row };
  return level.gates.some(g => g.color === block.color && atGate(probe, g, level));
}

// ── Tier 3: unblock someone's path (with verification) ──────────
/**
 * For each block without a clear path, compute its ideal path ignoring other
 * blocks. Then find blockers on that path and try to move each in each legal
 * direction — but only accept a move if it genuinely shortens *someone's*
 * gate-path. This prevents two-blocker deadlocks where shuffling either
 * blocker just creates a new obstruction.
 */
function tryUnblock(level, blocks) {
  const cols = level.cols, rows = level.rows;
  const wallsOnlyGrid = new Int8Array(cols * rows);
  if (level.walls) for (const w of level.walls) wallsOnlyGrid[w.row * cols + w.col] = WALL;

  // For each live block, record its current clear-path length (or Infinity if blocked).
  function pathLengthFor(blocksArr, bi, gate) {
    const g = buildGrid(level, blocksArr);
    const b = blocksArr[bi];
    for (const [dc, dr] of b.shape) g[(b.row + dr) * cols + (b.col + dc)] = EMPTY;
    const p = singleBlockPath(level, b, gate, g);
    return p ? p.length : Infinity;
  }
  const current = blocks.map((b, bi) => {
    let best = Infinity;
    for (const g of level.gates) {
      if (g.color !== b.color) continue;
      best = Math.min(best, pathLengthFor(blocks, bi, g));
    }
    return best;
  });

  // Identify blockers (same as before).
  const candidates = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    for (const gate of level.gates) {
      if (gate.color !== b.color) continue;
      const ideal = singleBlockPath(level, b, gate, wallsOnlyGrid);
      if (!ideal) continue;
      const idealCells = new Set();
      for (const [c, r] of ideal) {
        for (const [dc, dr] of b.shape) idealCells.add((c + dc) + ',' + (r + dr));
      }
      for (let oi = 0; oi < blocks.length; oi++) {
        if (oi === bi) continue;
        const o = blocks[oi];
        let hits = false;
        for (const [dc, dr] of o.shape) {
          if (idealCells.has((o.col + dc) + ',' + (o.row + dr))) { hits = true; break; }
        }
        if (hits) candidates.push(oi);
      }
    }
  }
  if (candidates.length === 0) return null;

  // For each candidate blocker and each of its legal slides, simulate the move
  // and score the resulting position: min over all blocks of path-length.
  // Pick the blocker-move that produces the largest strict improvement.
  const baselineMin = Math.min(...current.filter(n => isFinite(n)));
  let best = null;
  for (const oi of new Set(candidates)) {
    const blocker = blocks[oi];
    const grid = buildGrid(level, blocks);
    const dirs = directionsOf(blocker);
    for (const [dc, dr] of dirs) {
      const landing = fullSlide(blocker, oi, dc, dr, grid, cols, rows);
      if (!landing) continue;
      const simulated = blocks.map((b, i) =>
        i === oi ? { ...b, col: landing.col, row: landing.row } : b
      );
      // Did this strictly improve anyone's path?
      let improved = false;
      for (let bi = 0; bi < simulated.length; bi++) {
        if (bi === oi) continue;
        const b = simulated[bi];
        let best2 = Infinity;
        for (const g of level.gates) {
          if (g.color !== b.color) continue;
          best2 = Math.min(best2, pathLengthFor(simulated, bi, g));
        }
        if (isFinite(best2) && best2 < current[bi]) { improved = true; break; }
      }
      if (!improved) continue;
      // Prefer the move that leaves the smallest min-path.
      const simMin = Math.min(...simulated.map((b, bi) => {
        let best2 = Infinity;
        for (const g of level.gates) {
          if (g.color !== b.color) continue;
          best2 = Math.min(best2, pathLengthFor(simulated, bi, g));
        }
        return best2;
      }).filter(n => isFinite(n)));
      if (!best || simMin < best.score) {
        best = {
          move: { id: blocker.id, col: landing.col, row: landing.row, exited: false },
          score: simMin,
        };
      }
    }
  }
  return best ? best.move : null;
}

// ── Tier 4: bounded A* search ─────────────────────────────────────
/**
 * A* over full-slide states with heuristic h = number of live blocks
 * (admissible — every remaining block needs ≥1 move to exit). Handles puzzles
 * where greedy deadlocks (e.g. two interlocking pieces need a dance).
 * Synchronous, budget-capped. Returns the first move or null.
 */
function tryAstar(level, blocks, { budget = 40000 } = {}) {
  const cols = level.cols, rows = level.rows;

  function keyOf(bs) {
    let s = '';
    for (let i = 0; i < bs.length; i++) {
      if (i) s += '|';
      s += bs[i].id + ':' + bs[i].col + ',' + bs[i].row;
    }
    return s;
  }
  function cloneList(bs) {
    const out = new Array(bs.length);
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      out[i] = { id: b.id, col: b.col, row: b.row, color: b.color, dir: b.dir, shape: b.shape };
    }
    return out;
  }
  function succList(bs) {
    const g = buildGrid(level, bs);
    const out = [];
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      const dirs = directionsOf(b);
      for (const [dc, dr] of dirs) {
        const landing = fullSlide(b, i, dc, dr, g, cols, rows);
        if (!landing) continue;
        const moved = { ...b, col: landing.col, row: landing.row };
        let exited = false;
        for (const gate of level.gates) {
          if (gate.color === moved.color && atGate(moved, gate, level)) { exited = true; break; }
        }
        let next;
        if (exited) {
          next = cloneList(bs);
          next.splice(i, 1);
        } else {
          next = cloneList(bs);
          next[i] = moved;
        }
        out.push({ nextBlocks: next, move: { id: b.id, col: landing.col, row: landing.row, exited } });
      }
    }
    return out;
  }

  // Min-heap keyed by f = g + h. Entries: [f, tieBreaker, state, key].
  const heap = new MinHeap();
  const parents = new Map();
  const gScore = new Map();
  const startKey = keyOf(blocks);
  parents.set(startKey, { prevKey: null, move: null });
  gScore.set(startKey, 0);
  heap.push([blocks.length, 0, blocks, startKey]);

  let tieBreaker = 1;
  let expanded = 0;
  // Track the best state we've seen: lowest h (fewest blocks), then lowest g (closest to start).
  let bestH = blocks.length;
  let bestG = 0;
  let bestKey = startKey;

  function firstMoveTo(key) {
    let firstMove = null;
    while (true) {
      const node = parents.get(key);
      if (!node || !node.move) break;
      firstMove = node.move;
      key = node.prevKey;
    }
    return firstMove;
  }

  while (heap.size() > 0 && expanded < budget) {
    const [, , current, currentKey] = heap.pop();
    if (current.length === 0) {
      return firstMoveTo(currentKey);
    }
    expanded++;
    const g = gScore.get(currentKey);
    const h = current.length;
    if (h < bestH || (h === bestH && g < bestG)) {
      bestH = h; bestG = g; bestKey = currentKey;
    }
    for (const { nextBlocks, move } of succList(current)) {
      const k = keyOf(nextBlocks);
      const tentative = g + 1;
      if (gScore.has(k) && gScore.get(k) <= tentative) continue;
      parents.set(k, { prevKey: currentKey, move });
      gScore.set(k, tentative);
      heap.push([tentative + nextBlocks.length, tieBreaker++, nextBlocks, k]);
    }
  }

  // Budget hit — return the first move toward the best state we've observed,
  // provided it's genuinely better than the start (i.e. reduced block count).
  if (bestH < blocks.length) return firstMoveTo(bestKey);
  return null;
}

class MinHeap {
  constructor() { this.h = []; }
  size() { return this.h.length; }
  push(v) {
    const h = this.h;
    h.push(v);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._cmp(h[i], h[p]) < 0) { [h[i], h[p]] = [h[p], h[i]]; i = p; }
      else break;
    }
  }
  pop() {
    const h = this.h;
    if (h.length === 0) return undefined;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < h.length && this._cmp(h[l], h[s]) < 0) s = l;
        if (r < h.length && this._cmp(h[r], h[s]) < 0) s = r;
        if (s === i) break;
        [h[i], h[s]] = [h[s], h[i]]; i = s;
      }
    }
    return top;
  }
  _cmp(a, b) { return a[0] - b[0] || a[1] - b[1]; }
}

// ── Tier 5: any legal move (shouldn't happen on solvable levels) ─
function anyLegalMove(level, blocks) {
  const grid = buildGrid(level, blocks);
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    const dirs = directionsOf(b);
    for (const [dc, dr] of dirs) {
      const landing = fullSlide(b, bi, dc, dr, grid, level.cols, level.rows);
      if (landing) return { id: b.id, col: landing.col, row: landing.row, exited: false };
    }
  }
  return null;
}

// Cache: per level object, per state key → hint move.
const hintCache = new WeakMap();

function stateKey(blocks) {
  let s = '';
  for (let i = 0; i < blocks.length; i++) {
    if (i) s += '|';
    s += blocks[i].id + ':' + blocks[i].col + ',' + blocks[i].row;
  }
  return s;
}

export function nextHintMove(level, blocks) {
  if (blocks.length === 0) return null;
  let perLevel = hintCache.get(level);
  if (!perLevel) { perLevel = new Map(); hintCache.set(level, perLevel); }
  const key = stateKey(blocks);
  if (perLevel.has(key)) return perLevel.get(key);

  const grid = buildGrid(level, blocks);
  let move = tryDirectExit(level, blocks, grid);
  if (!move) move = tryClearPath(level, blocks);
  if (!move) move = tryUnblock(level, blocks);
  if (!move) move = tryAstar(level, blocks);
  if (!move) move = anyLegalMove(level, blocks);

  perLevel.set(key, move);
  return move;
}

/**
 * Best-effort solver used as a lint for level authors (main.js calls this at
 * level load and warns on null). It plays the hint engine forward move by
 * move; if the state ever loops without shrinking, it gives up.
 */
export function solve(level, startBlocks, { maxMoves = 400 } = {}) {
  const blocks = startBlocks.map(b => ({ ...b, shape: b.shape.map(p => [p[0], p[1]]) }));
  const seen = new Set();
  const moves = [];
  while (blocks.length > 0 && moves.length < maxMoves) {
    const key = stateKey(blocks);
    if (seen.has(key)) return null; // cycle — hint engine can't progress.
    seen.add(key);
    const move = nextHintMove(level, blocks);
    if (!move) return null;
    const idx = blocks.findIndex(b => b.id === move.id);
    if (idx < 0) return null;
    blocks[idx] = { ...blocks[idx], col: move.col, row: move.row };
    if (move.exited) blocks.splice(idx, 1);
    moves.push(move);
  }
  if (blocks.length === 0) return { moves, visited: moves.length };
  return null;
}
