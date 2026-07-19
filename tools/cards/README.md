# Bayfield player trading cards (MTG-style)

Self-contained HTML trading cards for Bayfield Open players, built on the real
_Magic: the Gathering_ card frame. Each card inlines its fonts, frame texture,
player art, and set mark, so the output is a single file you can publish as a
Claude Artifact (or open directly in a browser).

## Layout — one file per golfer, named the same

```
tools/cards/
  art/<golfer>.jpg        ← player art (e.g. art/joe-mcculla.jpg)
  players/<golfer>.json   ← card content (e.g. players/joe-mcculla.json)
  players/_template.json  ← copy this to start a new golfer (underscore = skipped by --all)
```

The JSON and its art share a slug (`joe-mcculla`), so a card's art is found
automatically — no `art` field needed unless you want a different filename.
Build output lands next to the JSON as `players/<golfer>.html`.

## Pipeline

```
1. fetch_stats.ts        ─ pull a player's real career finishes from the DB
2. art/<g>.jpg           ─ drop the player's art in, named <g>.jpg
3. players/<g>.json      ─ author the card content (copy _template.json)
4. build_card.py         ─ render players/<g>.json -> players/<g>.html (all inlined)
   build_card.py --all   ─ ...or build every golfer at once
5. preview.sh / publish  ─ self-review PNG, then publish via the Artifact tool
```

### 1. Get the stats

```
npx tsx --env-file=.env.local tools/cards/fetch_stats.ts "Joe M"
```

Prints, per season the player was rostered: handicap index, cumulative net +
individual net rank, and the Saturday pair result (partner, combined net, rank,
DQ/incomplete). Uses the app's own `getSeasonScoring` / `getDay2Leaderboard`, so
the numbers match what the app shows. DQ'd / incomplete pairs have no net.

### 2. Author the card

Copy `players/_template.json` to `players/<golfer>.json` and edit, and drop the
player's art at `art/<golfer>.jpg` (same slug — no `art` field needed). Schema +
helper classes are documented at the top of `build_card.py`. Ability lines accept
inline HTML; helper classes: `.yr` (year), `.win` (bold win), `.trophy` (gold),
`.dq` (red italic).

### 3. Build

```
python3 tools/cards/build_card.py tools/cards/players/joe-mcculla.json
# -> tools/cards/players/joe-mcculla.html   (self-contained, ~840 KB)
```

No network needed — fonts and textures are bundled under `assets/`.

### 3b. Self-review (optional)

```
chmod +x tools/cards/preview.sh
tools/cards/preview.sh tools/cards/players/joe-mcculla.html   # -> joe.png (2x screenshot)
```

Renders the card to a PNG via headless Chrome (wraps it with a UTF-8 charset so
em-dashes/stars/emoji render right — the raw card HTML omits `<head>` since the
Artifact host supplies one). Use it to eyeball layout/seams before publishing.

## Team → frame colour

| Team | Frame | Palette key |
|------|-------|-------------|
| Truffle Hogs 🐗 | solid / **land** (earthy tan) | `land` |
| The Mycelium Syndicate 🍄 | solid / **blue** | `blue` |

Frame textures are stored in `assets/frames/`. `red`, `gold`, `green`, `black`,
`white` palettes exist in `build_card.py` too; only `land`, `blue`, `red`, `gold`
textures are bundled so far — pull more from Figma (below) as needed. Pre-2025
players who never had a franchise: pick a frame per taste (gold reads neutral).

The title bar and type line are smooth colour-matched plates with a dark outline
and bevel (NOT the mottled frame texture — that's only the border around the
art). The text box is a pale warm parchment. These are set via CSS vars
(`--plate-*`, `--box-*`) per frame in the `FRAMES` table.

## Figma source (community MTG Card Designer)

- File key: `k13oe29MiXYRuBRmN8BZ9r` (read via the Figma MCP: `get_screenshot`,
  `get_design_context`, `get_metadata`). The MCP only lists 2 of the 6 pages;
  reach the rest by node id.
- Assembled standard creature card (layout/bevels ported here): node **8:601**
  (`.base / card`) on the "Base Card Components" page.
- Frame background textures (solid): white `667:20`, blue `667:21`,
  black `667:22`, red `667:23`, green `667:24`, gold `670:4`, artifact `670:5`,
  land `670:3`. Hybrids (two-colour) `1059:0..9`.
- Mana symbols / set symbols / watermarks live on the "Symbols and Icons" page
  (`22:235`).

To add a frame colour: `get_screenshot` its node id at `maxDimension:520`,
`curl` the returned URL, `sips -Z 460` to a jpg into `assets/frames/<key>.jpg`,
and add the `<key>` palette to `FRAMES` in `build_card.py`.

## Assets & licensing

- Fonts: Merriweather + Playfair Display (SIL OFL), bundled as `.woff2` under
  `assets/fonts/`. Substitutes for MTG's Beleren/Relay; swap later if desired.
- Frame textures + the base-card layout come from the community Figma file;
  used here for a private hobby project.
