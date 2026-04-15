// Breadth-first solver over block-position states.
// The goal is "all blocks exited." Each move is: slide one block any legal distance,
// then if it now matches a gate, remove it. We return the shortest move sequence.

import { cellsOf, canMove, atGate, directionsOf } from './geometry.js';

/**
 * A state is an array of live blocks (exited blocks are removed).
 * stateKey is a deterministic string for visited-set lookup.
 */
function stateKey(blocks) {
  // id:col,row — sorted so insertion order doesn't matter.
  const parts = new Array(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    parts[i] = b.id + ':' + b.col + ',' + b.row;
  }
  parts.sort();
  return parts.join('|');
}

function cloneBlockList(bs) {
  const out = new Array(bs.length);
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    out[i] = { id: b.id, col: b.col, row: b.row, color: b.color, dir: b.dir, shape: b.shape };
  }
  return out;
}

/**
 * Try every successor of `blocks` in `level`. Returns an array of
 * { nextBlocks, move } pairs. A move is { id, col, row } — the anchor
 * position for the block after sliding. If the block exited, nextBlocks
 * doesn't contain it and the move also carries exited: true.
 */
function successors(level, blocks) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    for (const [dc, dr] of directionsOf(b)) {
      let step = 1;
      // Slide until blocked — yield every intermediate stop.
      let probe = b;
      while (canMove(probe, dc, dr, level, blocks)) {
        const moved = { ...probe, col: probe.col + dc, row: probe.row + dr };
        // Check if the block can exit here.
        let exited = false;
        for (const g of level.gates) {
          if (g.color === moved.color && atGate(moved, g, level)) { exited = true; break; }
        }
        let next;
        if (exited) {
          next = cloneBlockList(blocks);
          next.splice(i, 1);
        } else {
          next = cloneBlockList(blocks);
          next[i] = moved;
        }
        out.push({
          nextBlocks: next,
          move: { id: b.id, col: moved.col, row: moved.row, exited },
        });
        probe = moved;
        step++;
      }
    }
  }
  return out;
}

/**
 * Solve a level from the given block list. Returns:
 *   { moves: [...], visited: N } if solved
 *   null if unsolvable within node budget
 *
 * A move is { id, col, row, exited } — the anchor target and whether the
 * block exited the board as a result.
 */
export function solve(level, startBlocks, { nodeBudget = 250000 } = {}) {
  const start = cloneBlockList(startBlocks);
  if (start.length === 0) return { moves: [], visited: 0 };

  const startKey = stateKey(start);
  const parents = new Map();
  parents.set(startKey, { prev: null, move: null, blocks: start });

  const queue = [start];
  let visited = 0;

  while (queue.length > 0 && visited < nodeBudget) {
    const current = queue.shift();
    visited++;

    if (current.length === 0) {
      // Reconstruct path.
      const moves = [];
      let key = stateKey(current);
      while (true) {
        const node = parents.get(key);
        if (!node || !node.move) break;
        moves.unshift(node.move);
        key = node.prev;
      }
      return { moves, visited };
    }

    const currentKey = stateKey(current);
    for (const { nextBlocks, move } of successors(level, current)) {
      const k = stateKey(nextBlocks);
      if (parents.has(k)) continue;
      parents.set(k, { prev: currentKey, move, blocks: nextBlocks });
      queue.push(nextBlocks);
    }
  }

  return null;
}

/** Greedy fallback: the old "single-move-to-gate, else any legal move" heuristic. */
export function fallbackHint(level, blocks) {
  for (const g of level.gates) {
    for (const b of blocks) {
      if (b.color !== g.color) continue;
      const m = slideToGate(level, blocks, b, g);
      if (m) return { id: b.id, col: m.col, row: m.row, exited: true };
    }
  }
  for (const b of blocks) {
    for (const [dc, dr] of directionsOf(b)) {
      if (canMove(b, dc, dr, level, blocks)) {
        return { id: b.id, col: b.col + dc, row: b.row + dr, exited: false };
      }
    }
  }
  return null;
}

function slideToGate(level, blocks, b, g) {
  let probe = b;
  if (g.side === 'right' && (b.dir === 'h' || b.dir === 'free')) {
    while (canMove(probe, 1, 0, level, blocks)) probe = { ...probe, col: probe.col + 1 };
    return atGate(probe, g, level) ? probe : null;
  }
  if (g.side === 'left' && (b.dir === 'h' || b.dir === 'free')) {
    while (canMove(probe, -1, 0, level, blocks)) probe = { ...probe, col: probe.col - 1 };
    return atGate(probe, g, level) ? probe : null;
  }
  if (g.side === 'bottom' && (b.dir === 'v' || b.dir === 'free')) {
    while (canMove(probe, 0, 1, level, blocks)) probe = { ...probe, row: probe.row + 1 };
    return atGate(probe, g, level) ? probe : null;
  }
  if (g.side === 'top' && (b.dir === 'v' || b.dir === 'free')) {
    while (canMove(probe, 0, -1, level, blocks)) probe = { ...probe, row: probe.row - 1 };
    return atGate(probe, g, level) ? probe : null;
  }
  return null;
}

// Cache: levelDef (object identity) -> stateKey -> first move (or null).
const hintCache = new WeakMap();

/**
 * Get the next optimal move for the given live blocks.
 * Uses BFS; falls back to a greedy heuristic if BFS exceeds its budget.
 */
export function nextHintMove(level, blocks) {
  let perLevel = hintCache.get(level);
  if (!perLevel) { perLevel = new Map(); hintCache.set(level, perLevel); }
  const key = stateKey(blocks);
  if (perLevel.has(key)) return perLevel.get(key);

  const result = solve(level, blocks);
  let move;
  if (result && result.moves.length > 0) {
    move = result.moves[0];
  } else {
    move = fallbackHint(level, blocks);
  }
  perLevel.set(key, move);
  return move;
}
