// Editor entry point. Wires state → tools → render → input → export.

import {
  state, subscribe, undo, redo, setTool,
  resizeGrid, setLabel, loadDraft, newLevel, stashForTestPlay, isNonEmpty,
} from './state.js';
import { renderAll } from './render.js';
import { buildPalette, wireToolButtons, syncToolUI } from './tools.js';
import { wireInput } from './input.js';
import {
  copyCurrentJson, downloadFullLevels, populateLoadDropdown, onLoadChange,
} from './export.js';
import { validateLevel } from '../levels.js';
import { solve } from '../solver.js';

// ── Toast ────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('editorToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Validation + solver panels ──────────────────────────────────
function refreshPanels() {
  const vPanel = document.getElementById('validation');
  const issues = validateLevel(state.level);
  if (!state.level.blocks.length && !state.level.gates.length && !state.level.walls.length) {
    vPanel.className = 'panel';
    vPanel.innerHTML = '<em>Empty level. Start placing blocks and gates.</em>';
  } else if (issues.length === 0) {
    vPanel.className = 'panel ok';
    vPanel.innerHTML = '✓ All integrity checks passed.';
  } else {
    vPanel.className = 'panel warn';
    vPanel.innerHTML = '<strong>⚠ ' + issues.length + ' issue(s):</strong><ul>' +
      issues.map(s => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function runSolverCheck() {
  const result = document.getElementById('solveResult');
  if (!state.level.blocks.length || !state.level.gates.length) {
    result.className = 'panel muted';
    result.textContent = 'Add at least one block and one matching gate first.';
    return;
  }
  result.className = 'panel';
  result.textContent = 'Running…';
  // Defer to yield to repaint before the (possibly slow) solve.
  setTimeout(() => {
    const t0 = performance.now();
    const blocks = state.level.blocks.map(b => ({ ...b, shape: b.shape.map(p => [p[0], p[1]]) }));
    const r = solve(state.level, blocks);
    const ms = Math.round(performance.now() - t0);
    if (r && r.moves.length) {
      result.className = 'panel ok';
      result.innerHTML = `✓ Solvable in <strong>${r.moves.length}</strong> moves <span class="muted">(${ms} ms)</span>` +
        '<br>First move: <code>' + escapeHtml(r.moves[0].id + ' → (' + r.moves[0].col + ',' + r.moves[0].row + ')') + '</code>';
    } else {
      result.className = 'panel warn';
      result.innerHTML = `⚠ Hint engine couldn't find a clearing path <span class="muted">(${ms} ms)</span>.<br>Each individual hint will still suggest a forward move — but the puzzle may be too tangled or unsolvable.`;
    }
  }, 30);
}

function openTestPlay() {
  if (!isNonEmpty()) {
    showToast('Nothing to play yet — place some blocks and gates first.');
    return;
  }
  if (!stashForTestPlay()) {
    showToast("Couldn't stash level (localStorage unavailable)");
    return;
  }
  window.open('index.html?test=1', '_blank');
}

// ── Grid size + label ───────────────────────────────────────────
function wireMeta() {
  const colsEl = document.getElementById('cols');
  const rowsEl = document.getElementById('rows');
  const labelEl = document.getElementById('levelLabel');

  const pushSize = () => {
    const c = Math.max(4, Math.min(12, +colsEl.value || 8));
    const r = Math.max(4, Math.min(12, +rowsEl.value || 8));
    if (c !== state.level.cols || r !== state.level.rows) {
      resizeGrid(c, r);
    }
  };
  colsEl.addEventListener('change', pushSize);
  rowsEl.addEventListener('change', pushSize);

  labelEl.addEventListener('change', () => setLabel(labelEl.value || 'My Level'));
  labelEl.addEventListener('input', () => setLabel(labelEl.value || 'My Level'));

  document.getElementById('newLevel').addEventListener('click', () => {
    if (isNonEmpty() && !confirm('Discard the current level and start fresh?')) return;
    const c = Math.max(4, Math.min(12, +colsEl.value || 8));
    const r = Math.max(4, Math.min(12, +rowsEl.value || 8));
    newLevel(c, r);
    showToast('Started a new level');
  });
}

function syncMetaUI() {
  document.getElementById('cols').value = state.level.cols;
  document.getElementById('rows').value = state.level.rows;
  const labelEl = document.getElementById('levelLabel');
  if (labelEl.value !== state.level.label) labelEl.value = state.level.label;
}

// ── Boot ────────────────────────────────────────────────────────
function boot() {
  buildPalette();
  wireToolButtons();
  wireInput();
  wireMeta();

  const hadDraft = loadDraft();
  if (!hadDraft) newLevel(8, 8);

  populateLoadDropdown();
  onLoadChange(showToast);

  document.getElementById('undoBtn').addEventListener('click', () => {
    if (!undo()) showToast('Nothing to undo');
  });
  document.getElementById('redoBtn').addEventListener('click', () => {
    if (!redo()) showToast('Nothing to redo');
  });

  document.getElementById('checkSolvable').addEventListener('click', runSolverCheck);
  document.getElementById('testPlay').addEventListener('click', openTestPlay);
  document.getElementById('copyJson').addEventListener('click', () => copyCurrentJson(showToast));
  document.getElementById('downloadAll').addEventListener('click', () => downloadFullLevels(showToast));

  subscribe(() => {
    renderAll();
    syncMetaUI();
    syncToolUI();
    refreshPanels();
  });

  renderAll();
  syncMetaUI();
  syncToolUI();
  refreshPanels();

  window.addEventListener('resize', () => renderAll());
}

boot();
