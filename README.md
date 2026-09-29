# Animal Escape! 🦊

A cute sliding-block puzzle where you guide animals to their matching colored doors. Works in any modern browser; installs on iPad/iPhone as a full-screen app and is fully playable offline — no App Store, no developer account.

## Play locally

Modern browsers block ES modules when opened via `file://`, so you need to run a tiny server:

```sh
cd ~/Desktop/Block_puzzle
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

**To update:** bump `CACHE_VERSION` in [`sw.js`](sw.js) (e.g. `v3` → `v4`) and push. After Pages redeploys (~30 s), the next launch of the app (or the next time it's brought to the foreground, or within half an hour while it stays open) downloads the new version, shows an "Updated!" toast, and reloads itself.

**To update an iPad right now:** open the level map (🗺️) and tap **🔄 Check for update** at the bottom. It shows "Up to date ✓" or installs the new version and reloads; the running version is shown underneath ("Version 9"). If the normal update doesn't take over within 10 seconds it clears this game's cache (only this game's) and reloads from the website. It does nothing offline, so it can't leave the game unable to start.

## Playing offline

Everything the game needs — pages, scripts, levels, icons, and the Fredoka font — is bundled in this repo and precached by the service worker ([`sw.js`](sw.js)) the first time you open the game over HTTPS or `localhost`. After that first load it runs with no network at all: the installed iPad app, a browser tab, or airplane mode all work.

- **Requirements:** one online visit per device, and a service-worker-capable origin (HTTPS or localhost — not `file://`).
- **Progress and stars** are stored in `localStorage`, so they persist offline too.
- **To verify:** load the game once, turn on airplane mode (or in DevTools → Application → Service Workers tick "Offline"), and reload. It should come up identically, Fredoka font included.
- **Storage footprint:** about 1 MB, almost all of it the icon PNGs.

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
- Wall tool for immovable cells, and a "Cut out" tool that removes cells to give the board a shape
- Frozen / key / padlock options for animals, and padlocked doors
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
      "dir": "free",         // free | h (horizontal only) | v (vertical only)
      "ice": 2,              // optional — frozen until 2 animals (any) have gone home
      "key": true            // optional — carries the key (or "lock": true — padlocked until every key is home)
    }
  ],
  "gates": [
    {
      "side": "right",       // right | left | top | bottom
      "color": "red",        // must match at least one block's color
      "size": 2,              // how many cells wide the opening is
      "exit_row": 3,          // for right/left gates
      // "exit_col": 4,       // for top/bottom gates
      "lock": true            // optional — padlocked door, opens when every key is home
    }
  ],
  "walls": [                 // optional — immovable cells (drawn as rocks)
    { "col": 3, "row": 3 }
  ],
  "holes": [                 // optional — cells cut out of the board, which gives it its shape
    { "col": 0, "row": 0 }
  ]
}
```

A gate sits on the outermost board cell of its rows (left/right) or columns (top/bottom). On a shaped board that can be an inner edge, such as the inside corner of an L; every cell the gate spans must share that same edge.

### Special animals

Picture-only, so they work for children who can't read:

- **Frozen** (`"ice": N`): the animal sits in an ice sheet with N snowflakes. Each animal that goes home melts one; when they're all gone the ice shatters and it can move. Pressing it while frozen makes it shiver and its snowflakes pulse.
- **Key and padlock** (`"key": true` on an animal, `"lock": true` on animals or gates): padlocked animals and doors stay shut until every key carrier has gone home, then the padlocks spring open. An animal already waiting at a door that opens (or thaws there) goes home by itself. Pressing a padlocked animal wiggles its padlock and makes the key glint.

Levels 11-60 bring these in gradually: frozen animals from level 20, a padlocked door from 28, a padlocked animal from 32.

### Colors and animals

Every color has a themed animal and per-color exit jingle baked in. The animals are drawn as SVG heads by `js/critters.js` (same style as the Ice Cream Shop critters: round head, shiny eyes, rosy cheeks), not emoji, so they look the same on every iPad and scale up to fill big pieces. The same head sits on the matching door. Heads blink now and then (each at its own moment) and switch to a happy ^ ^ face with a big smile as they leave through their door.

| color | animal | drawing |
|-------|--------|---------|
| red | fox | orange face, pointy ears, white lower face |
| blue | whale | periwinkle face, water spout, pale chin band |
| green | frog | eyes on top bumps, wide smile |
| yellow | chick | feather tuft, orange beak |
| purple | unicorn | white face, gold horn, purple/pink forelock |
| orange | lion | spiky two-tone mane, round ears |
| pink | pig | pointy ears, big snout |
| teal | turtle | small green head peeking out of a hex-patterned shell |

### Testing a new level

Open your browser's DevTools console before you play — the built-in solver runs at level load and logs a warning if your level is unsolvable, so it doubles as a linter:

> `[solver] Level 61 exceeded node budget; hint may fall back to greedy.`

If you see that message, simplify the level until it solves.

For a definitive check, run the audit script — it validates every level's data and runs an exhaustive search that proves each one is solvable (blocks can stop on any cell, exactly like a player's drag):

```sh
python3 tools/audit.py                 # all levels; exit code 1 if any is broken
python3 tools/audit.py --show 22,23    # also print an ASCII map of those levels
```

A level reported as `stuck` has a block that can't reach its gate even on an empty board (walled in, or a locked-direction block that isn't lined up with its gate). `invalid` means a structural problem (overlapping doors, a door off the board's edge, a padlock with no key, ...).

### Generating levels

Levels 11-60 come from `tools/generate.py`. Its `PLAN` gives each level a board shape (hand-drawn in `tools/shapes.py`: heart, house, fish, cat, butterfly, castle, ...), a mirror/flip/rotation, and which special animals to use. For each level it places random pieces from a wide set (dominoes to pentominoes and 2x3 blocks), puts doors on every side, proves the level solvable with the audit's search, and keeps a candidate whose solution length fits the difficulty curve (about 17 moves at level 11 rising to about 22 at level 60, 8-10 animals).

```sh
python3 tools/generate.py --only 23,40    # regenerate just these levels (prints maps)
python3 tools/generate.py --only 23 --seed 5 --apply   # try another draw and write it into data/levels.json
```

To change a level's shape or special animals, edit its line in `PLAN` and regenerate it.

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
├── sw.js                      # service worker (precache + cache-first, offline)
├── README.md
├── css/
│   ├── style.css              # all styles (+ self-hosted Fredoka @font-face)
│   └── editor.css             # level editor styles
├── fonts/
│   ├── fredoka-latin.woff2    # Fredoka variable font (SIL OFL), latin subset
│   └── fredoka-latin-ext.woff2
├── js/
│   ├── main.js                # entry point
│   ├── state.js               # game state + localStorage progress
│   ├── levels.js              # level loading + normalization
│   ├── geometry.js            # pure grid logic (cellsOf, canMove, atGate)
│   ├── solver.js              # BFS hint solver
│   ├── hint.js                # finger animation driven by solver
│   ├── audio.js               # synth music + SFX
│   ├── render.js              # board/block/gate rendering
│   ├── critters.js            # SVG animal heads (moods, blinking)
│   ├── badges.js              # SVG snowflake, key and padlock badges
│   ├── input.js               # pointer drag with smooth sub-cell motion
│   ├── effects.js             # bubbles, fireworks, exit particles
│   └── ui.js                  # tutorial, level select, win overlay, toasts
├── data/
│   └── levels.json            # 60 pretty-printed levels, ~2500 lines
├── tools/
│   ├── audit.py               # solvability audit for every level
│   ├── generate.py            # generates levels 11-60 (see PLAN)
│   ├── shapes.py              # board shapes and piece shapes for the generator
│   └── levelfmt.py            # writes levels.json in its compact style
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
- **Changes don't appear after deploy**: bump `CACHE_VERSION` in [`sw.js`](sw.js) (e.g. `v3` → `v4`) before pushing. The service worker will invalidate the old cache and reload the game on next load. To get it on a device straight away, tap **🔄 Check for update** in the level map; no need to delete and re-add the home-screen icon.
- **Game won't open offline**: it needs one online visit first so the service worker can cache everything. Also make sure you're on HTTPS or localhost — service workers don't run from `file://`.
- **Audio won't play on iPad**: iOS requires a user gesture before audio can start. Tap anything once (the sound button is a good target) and the engine unlocks.
- **`fetch` errors loading levels**: make sure you're running a server (not opening `index.html` via `file://`). See "Play locally" above.

## Credits

Built as a family puzzle project. Emoji art, [Fredoka](https://fonts.google.com/specimen/Fredoka) font (SIL Open Font License, bundled in `fonts/`), audio generated live via the Web Audio API.
