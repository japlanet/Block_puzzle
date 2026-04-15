# Animal Escape! 🦊

A cute sliding-block puzzle where you guide animals to their matching colored doors. Works in any modern browser; installs on iPad/iPhone as a full-screen offline app — no App Store, no developer account.

## Play locally

Modern browsers block ES modules when opened via `file://`, so you need to run a tiny server:

```sh
cd ~/Desktop/Game
python3 -m http.server 8080
```

Open <http://localhost:8080> and play.

## Install on iPad (no Apple Developer account needed)

1. **Host the folder somewhere public over HTTPS** (see "Deploy" below — GitHub Pages is free).
2. On the iPad, open the URL in **Safari** (not Chrome — Safari owns home-screen installs on iOS).
3. Tap **Share → Add to Home Screen → Add**.
4. The icon lands on the home screen. Tap it — it launches full-screen, no browser chrome, and works offline after the first load (service worker caches everything).

## Deploy to GitHub Pages

1. Create a public GitHub repo and push the contents of this folder (not the folder itself) to `main`.
2. In the repo: **Settings → Pages → Source: Deploy from a branch → Branch: main, Folder: / (root) → Save**.
3. Wait ~60 s. Your URL will be `https://<your-user>.github.io/<repo-name>/`.
4. Open that URL on the iPad and follow "Install on iPad" above.

**To update:** push a commit. After Pages redeploys (~30 s), the next launch of the app on the iPad fetches the new version in the background and serves it on the launch after that. For an immediate refresh, delete the app from the home screen and re-add it.

### Alternatives to GitHub Pages

Any static host will do. Same steps apply:

- **Netlify**: drag-and-drop the `Game` folder onto <https://app.netlify.com/drop>.
- **Cloudflare Pages**: connect to the same GitHub repo.
- **Vercel**: `vercel --prod` from the directory.

## Adding a new level

Two ways. Both end with the level in [`data/levels.json`](data/levels.json).

### Option A — Level editor (recommended)

Open [`editor.html`](editor.html) in your browser (the deployed URL also works: just add `/editor.html` to your GitHub Pages URL). It has:

- Click-to-paint block cells, one color at a time
- Gate tool with a size selector — click on any edge slot
- Wall tool for immovable cells
- Live validation (gate overlaps, orphan colors, off-board gates)
- "Test solve" — runs the game's own hint engine to confirm the puzzle is solvable
- "Play this level" — opens the game with your level so you can feel it before committing
- "Copy level JSON" — one click, paste at the end of `data/levels.json`
- "Download levels.json" — downloads a full replacement with your new level appended

Your draft autosaves to localStorage as you work.

### Option B — Hand-edit JSON

Open [`data/levels.json`](data/levels.json), copy an existing level object, paste it at the end, tweak. Reload the game to test.

### Level schema

```jsonc
{
  "cols": 7,                 // board width (cells)
  "rows": 6,                 // board height (cells)
  "label": "Level 61",       // shown in the top bar
  "blocks": [
    {
      "id": "r1",            // must be unique within the level
      "col": 1, "row": 1,    // anchor cell for the block (top-left of the shape)
      "shape": [[0,0],[1,0]],// [dc, dr] offsets from the anchor. Shorthand arrays preferred; legacy {dc,dr} objects still work.
      "color": "red",        // red | blue | green | yellow | purple | orange | pink | teal
      "dir": "free"          // free | h (horizontal only) | v (vertical only)
    }
  ],
  "gates": [
    {
      "side": "right",       // right | left | top | bottom
      "color": "red",        // must match at least one block's color
      "size": 2,              // how many cells wide the opening is
      "exit_row": 3           // for right/left gates
      // "exit_col": 4        // for top/bottom gates
    }
  ],
  "walls": [                 // optional — immovable cells
    { "col": 3, "row": 3 }
  ]
}
```

### Colors and animals

Every color has a themed animal and per-color exit jingle baked in:

| color | animal | door emoji |
|-------|--------|------------|
| red | 🦊 fox | 🦊 |
| blue | 🐳 whale | 🐳 |
| green | 🐸 frog | 🐸 |
| yellow | 🐤 chick | 🐤 |
| purple | 🦄 unicorn | 🦄 |
| orange | 🦁 lion | 🦁 |
| pink | 🐷 pig | 🐷 |
| teal | 🐢 turtle | 🐢 |

### Testing a new level

Open your browser's DevTools console before you play — the built-in solver runs at level load and logs a warning if your level is unsolvable, so it doubles as a linter:

> `[solver] Level 61 exceeded node budget; hint may fall back to greedy.`

If you see that message, simplify the level until it solves.

### Shape cookbook

Some common shapes, for reference:

```jsonc
"shape": [[0,0]]                                   // 1x1 square
"shape": [[0,0],[1,0]]                             // 1x2 horizontal domino
"shape": [[0,0],[0,1]]                             // 2x1 vertical domino
"shape": [[0,0],[1,0],[2,0]]                       // 1x3 horizontal
"shape": [[0,0],[0,1],[0,2]]                       // 3x1 vertical
"shape": [[0,0],[1,0],[0,1],[1,1]]                 // 2x2 square
"shape": [[0,0],[1,0],[2,0],[1,1]]                 // T-tetromino
"shape": [[1,0],[0,1],[1,1],[2,1],[1,2]]           // + plus
```

## Project structure

```
Game/
├── index.html                 # thin shell (UI chrome + script imports)
├── manifest.webmanifest       # PWA manifest
├── sw.js                      # service worker (cache-first, offline)
├── README.md
├── css/
│   └── style.css              # all styles
├── js/
│   ├── main.js                # entry point
│   ├── state.js               # game state + localStorage progress
│   ├── levels.js              # level loading + normalization
│   ├── geometry.js            # pure grid logic (cellsOf, canMove, atGate)
│   ├── solver.js              # BFS hint solver
│   ├── hint.js                # finger animation driven by solver
│   ├── audio.js               # synth music + SFX
│   ├── render.js              # board/block/gate rendering
│   ├── input.js               # pointer drag with smooth sub-cell motion
│   ├── effects.js             # bubbles, fireworks, exit particles
│   └── ui.js                  # tutorial, level select, win overlay, toasts
├── data/
│   └── levels.json            # 60 pretty-printed levels, ~1700 lines
└── icons/
    ├── icon.svg               # main source art
    ├── icon-maskable.svg      # Android maskable variant
    ├── icon-180.png           # apple-touch-icon
    ├── icon-192.png           # PWA manifest
    ├── icon-512.png           # PWA manifest
    ├── icon-maskable-512.png  # PWA maskable
    └── generate.html          # cross-platform fallback PNG generator
```

## Troubleshooting

- **Icons look wrong on the home screen**: delete the app from the home screen and re-add it. iOS caches the first icon it sees aggressively.
- **Changes don't appear after deploy**: bump `CACHE_VERSION` in [`sw.js`](sw.js) (e.g. `v1` → `v2`) before pushing. The service worker will invalidate the old cache on next load.
- **Audio won't play on iPad**: iOS requires a user gesture before audio can start. Tap anything once (the sound button is a good target) and the engine unlocks.
- **`fetch` errors loading levels**: make sure you're running a server (not opening `index.html` via `file://`). See "Play locally" above.

## Credits

Built as a family puzzle project. Emoji art, Fredoka font from Google Fonts, audio generated live via the Web Audio API.
