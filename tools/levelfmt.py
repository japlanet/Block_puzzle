"""Serialize levels in the compact one-object-per-line style used by data/levels.json
(same layout the level editor's export.js produces)."""
import json

def _inline(o):
    parts = []
    for k, v in o.items():
        if k == 'shape':
            parts.append(f'"{k}": [' + ','.join('[' + ','.join(str(x) for x in p) + ']' for p in v) + ']')
        else:
            parts.append(f'"{k}": {json.dumps(v)}')
    return '{ ' + ', '.join(parts) + ' }'

def dump_level(lv, indent='  '):
    out = [indent + '{',
           f'{indent}  "cols": {lv["cols"]},',
           f'{indent}  "rows": {lv["rows"]},',
           f'{indent}  "label": {json.dumps(lv["label"])},',
           f'{indent}  "blocks": [']
    for i, b in enumerate(lv['blocks']):
        out.append(f'{indent}    ' + _inline(b) + (',' if i < len(lv['blocks']) - 1 else ''))
    out.append(f'{indent}  ],')
    lists = [(k, lv.get(k) or []) for k in ('walls', 'holes')]
    lists = [(k, v) for k, v in lists if v]
    out.append(f'{indent}  "gates": [')
    for i, g in enumerate(lv['gates']):
        out.append(f'{indent}    ' + _inline(g) + (',' if i < len(lv['gates']) - 1 else ''))
    out.append(f'{indent}  ]' + (',' if lists else ''))
    for li, (k, cells) in enumerate(lists):
        out.append(f'{indent}  "{k}": [')
        for i, w in enumerate(cells):
            out.append(f'{indent}    ' + _inline(w) + (',' if i < len(cells) - 1 else ''))
        out.append(f'{indent}  ]' + (',' if li < len(lists) - 1 else ''))
    out.append(indent + '}')
    return '\n'.join(out)

def dump(levels):
    return '[\n' + ',\n'.join(dump_level(lv) for lv in levels) + '\n]\n'
