// Export helpers: copy JSON for pasting, download full levels.json,
// load existing levels into the dropdown.

import { state, loadLevel, isNonEmpty } from './state.js';
import { loadLevels } from '../levels.js';

/** Render current level to the compact style we use in data/levels.json. */
export function serializeLevel(lv) {
  const inline = o => '{ ' + Object.entries(o).map(([k, v]) => {
    if (k === 'shape') {
      return `"${k}": [` + v.map(p => '[' + p.join(',') + ']').join(',') + ']';
    }
    return `"${k}": ${JSON.stringify(v)}`;
  }).join(', ') + ' }';

  const out = [];
  out.push('{');
  out.push(`  "cols": ${lv.cols},`);
  out.push(`  "rows": ${lv.rows},`);
  out.push(`  "label": ${JSON.stringify(lv.label)},`);
  out.push('  "blocks": [');
  lv.blocks.forEach((b, i) => {
    const comma = i < lv.blocks.length - 1 ? ',' : '';
    out.push('    ' + inline(b) + comma);
  });
  out.push('  ],');
  if (lv.walls && lv.walls.length) {
    out.push('  "gates": [');
    lv.gates.forEach((g, i) => {
      const comma = i < lv.gates.length - 1 ? ',' : '';
      out.push('    ' + inline(g) + comma);
    });
    out.push('  ],');
    out.push('  "walls": [');
    lv.walls.forEach((w, i) => {
      const comma = i < lv.walls.length - 1 ? ',' : '';
      out.push('    ' + inline(w) + comma);
    });
    out.push('  ]');
  } else {
    out.push('  "gates": [');
    lv.gates.forEach((g, i) => {
      const comma = i < lv.gates.length - 1 ? ',' : '';
      out.push('    ' + inline(g) + comma);
    });
    out.push('  ]');
  }
  out.push('}');
  return out.join('\n');
}

export async function copyCurrentJson(showToast) {
  const text = serializeLevel(state.level);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied level JSON to clipboard');
  } catch (e) {
    // Fallback — put it in a textarea and select
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('Copied (fallback)'); }
    catch { showToast('Copy failed — see console'); console.log(text); }
    ta.remove();
  }
}

export async function downloadFullLevels(showToast) {
  // Fetch existing levels.json and append our edited level to it.
  let existing = [];
  try {
    const levels = await loadLevels();
    existing = levels;
  } catch (e) {
    showToast('Could not load existing levels — downloading only this level');
  }

  // Serialize as a full JSON array with our compact style.
  const parts = ['['];
  const editedSerialized = serializeLevel(state.level).split('\n').map(l => '  ' + l);
  existing.forEach((lv, i) => {
    const block = serializeLevel(lv).split('\n').map(l => '  ' + l);
    parts.push(block.join('\n') + ',');
  });
  parts.push(editedSerialized.join('\n'));
  parts.push(']');
  const blob = new Blob([parts.join('\n') + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'levels.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  showToast('Downloaded levels.json with your level appended');
}

/** Populate #loadLevel with existing levels so the user can edit them. */
export async function populateLoadDropdown() {
  const select = document.getElementById('loadLevel');
  select.innerHTML = '<option value="">Load existing…</option>';
  try {
    const levels = await loadLevels();
    levels.forEach((lv, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = lv.label;
      select.appendChild(opt);
    });
    select.dataset.loaded = '1';
    select._levels = levels;
  } catch (e) {
    console.warn('Could not load existing levels:', e);
  }
}

export function onLoadChange(showToast) {
  const select = document.getElementById('loadLevel');
  select.addEventListener('change', () => {
    const idx = +select.value;
    if (!select.value) return;
    const levels = select._levels;
    if (!levels || !levels[idx]) return;
    if (isNonEmpty() &&
        !confirm('Discard your current draft and load ' + levels[idx].label + '?')) {
      select.value = '';
      return;
    }
    loadLevel(levels[idx]);
    showToast('Loaded ' + levels[idx].label);
    select.value = '';
  });
}
