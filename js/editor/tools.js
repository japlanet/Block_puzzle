// Tool palette wiring: buttons in the left panel set state.tool.

import {
  state, setTool, startNewBlock, finishPendingBlock, cancelPendingBlock, COLORS, ANIMAL_EMOJI,
} from './state.js';

export function buildPalette() {
  const grid = document.getElementById('colorPalette');
  grid.innerHTML = '';
  const labels = {
    red: 'Fox', blue: 'Whale', green: 'Frog', yellow: 'Chick',
    purple: 'Unicorn', orange: 'Lion', pink: 'Pig', teal: 'Turtle',
  };
  for (const c of COLORS) {
    const btn = document.createElement('button');
    btn.className = 'colorTool';
    btn.dataset.color = c;
    btn.textContent = `${ANIMAL_EMOJI[c]} ${labels[c]}`;
    btn.addEventListener('click', () => {
      const t = state.tool;
      // Toggle off if same color already active and no pending cells.
      if (t && t.type === 'block' && t.color === c && !t.pendingCells.size) {
        setTool(null);
        return;
      }
      const dir = document.getElementById('blockDir').value || 'free';
      startNewBlock(c, dir, {
        ice: +document.getElementById('blockIce').value || 0,
        key: document.getElementById('blockKey').checked,
        lock: document.getElementById('blockLock').checked,
      });
    });
    grid.appendChild(btn);
  }

  // Gate color dropdown populated with the same palette.
  const gateColor = document.getElementById('gateColor');
  gateColor.innerHTML = '';
  for (const c of COLORS) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = `${ANIMAL_EMOJI[c]} ${c}`;
    gateColor.appendChild(opt);
  }
}

export function wireToolButtons() {
  document.getElementById('blockDir').addEventListener('change', () => {
    if (state.tool && state.tool.type === 'block') {
      state.tool.dir = document.getElementById('blockDir').value;
    }
  });

  document.getElementById('blockIce').addEventListener('change', () => {
    if (state.tool && state.tool.type === 'block') state.tool.ice = +document.getElementById('blockIce').value || 0;
  });
  // An animal either carries the key or is padlocked, not both.
  for (const [id, other] of [['blockKey', 'blockLock'], ['blockLock', 'blockKey']]) {
    document.getElementById(id).addEventListener('change', () => {
      const on = document.getElementById(id).checked;
      if (on) document.getElementById(other).checked = false;
      if (state.tool && state.tool.type === 'block') {
        state.tool.key = document.getElementById('blockKey').checked;
        state.tool.lock = document.getElementById('blockLock').checked;
      }
    });
  }
  document.getElementById('gateLock').addEventListener('change', () => {
    if (state.tool && state.tool.type === 'gate') state.tool.lock = document.getElementById('gateLock').checked;
  });

  document.getElementById('finishBlock').addEventListener('click', () => {
    finishPendingBlock();
  });
  document.getElementById('cancelBlock').addEventListener('click', () => {
    cancelPendingBlock();
  });

  for (const btn of document.querySelectorAll('.tool')) {
    btn.addEventListener('click', () => {
      const name = btn.dataset.tool;
      if (name === 'gate') {
        const color = document.getElementById('gateColor').value || 'red';
        const size = +document.getElementById('gateSize').value || 1;
        // Toggle off if gate tool with same color+size already active.
        if (state.tool && state.tool.type === 'gate' &&
            state.tool.color === color && state.tool.size === size) {
          setTool(null);
          return;
        }
        setTool({ type: 'gate', color, size, lock: document.getElementById('gateLock').checked });
      } else if (name === 'hole') {
        if (state.tool && state.tool.type === 'hole') { setTool(null); return; }
        setTool({ type: 'hole' });
      } else if (name === 'wall') {
        if (state.tool && state.tool.type === 'wall') { setTool(null); return; }
        setTool({ type: 'wall' });
      } else if (name === 'eraser') {
        if (state.tool && state.tool.type === 'eraser') { setTool(null); return; }
        setTool({ type: 'eraser' });
      }
    });
  }

  document.getElementById('gateColor').addEventListener('change', () => {
    if (state.tool && state.tool.type === 'gate') {
      state.tool.color = document.getElementById('gateColor').value;
    }
  });
  document.getElementById('gateSize').addEventListener('change', () => {
    if (state.tool && state.tool.type === 'gate') {
      state.tool.size = +document.getElementById('gateSize').value;
    }
  });
}

/** Apply visual `active` class to whichever tool button matches the current tool. */
export function syncToolUI() {
  const t = state.tool;
  for (const btn of document.querySelectorAll('.colorTool')) {
    const on = t && t.type === 'block' && t.color === btn.dataset.color;
    btn.classList.toggle('active', on);
  }
  for (const btn of document.querySelectorAll('.tool')) {
    const on = t && t.type === btn.dataset.tool;
    btn.classList.toggle('active', on);
  }
  document.getElementById('blockOptions').hidden = !(t && t.type === 'block');
  document.getElementById('gateOptions').hidden  = !(t && t.type === 'gate');
  if (t && t.type === 'block') {
    document.getElementById('blockDir').value = t.dir || 'free';
    document.getElementById('blockIce').value = String(t.ice || 0);
    document.getElementById('blockKey').checked = !!t.key;
    document.getElementById('blockLock').checked = !!t.lock;
  }
  if (t && t.type === 'gate') document.getElementById('gateLock').checked = !!t.lock;
}
