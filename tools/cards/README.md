# Bayfield player trading cards (MTG-style)

MTG-style trading cards for Bayfield Open players. The card is a normal app
component — **React + Tailwind + flexbox**, same patterns as the rest of the app
(`next/font`, the globals theme tokens, container queries). No absolute
positioning; the frame is a vertical flex stack so nothing overlaps.

## Where things live

```
src/components/player-card.tsx   ← the card component (Tailwind, flexbox column)
src/lib/cards.ts                 ← CardData type, FRAMES palette, loadCards()
src/app/cards/page.tsx           ← /cards gallery (renders every authored card)

tools/cards/players/<slug>.json  ← one golfer's card content  (descriptions)
public/cards/art/<slug>.webp     ← optimized golfer art       (named to match)
tools/cards/players/_template.json ← copy to start a new golfer
tools/cards/fetch_stats.ts       ← pull a player's real finishes from the DB

public/cards/frames/*.jpg        ← shared frame textures (land/blue/red/gold)
public/cards/logo.png            ← the Bayfield set symbol
```

Per golfer = **one JSON + one image, same slug** (`joe-mcculla`). The art is
served as a static asset, so the card page stays small and no `art` path is
needed in the JSON.

## Add a golfer

1. `npx tsx --env-file=.env.local tools/cards/fetch_stats.ts "Joe M"` — get their
   real per-season finishes (uses the app's `getSeasonScoring`/`getDay2Leaderboard`).
2. Optimize their art as WebP and save it at
   `public/cards/art/<slug>.webp` (quality 82 is the current target).
3. Copy `players/_template.json` to `players/<slug>.json` and fill it in.
4. `npm run dev` → open **/cards** (the card appears automatically).

### Card JSON

See `players/joe-mcculla.json`. Fields: `name`, `type`, `team`
(`truffle_hogs` | `mycelium_syndicate` → frame colour) or `frame` override,
`handicap` (mana pip), `artPosition` (CSS object-position), `abilities[]`
(rules-text lines; inline HTML ok — helper classes `.yr` `.win` `.trophy` `.dq`),
`flavor`, `collector`, `rarity`, `caption`.

## Team → frame colour

| Team | Frame |
|------|-------|
| Truffle Hogs 🐗 | `land` (earthy tan) |
| The Mycelium Syndicate 🍄 | `blue` |

Palettes for `land`/`blue`/`red`/`gold`/`green`/`black`/`white` are in
`FRAMES` (src/lib/cards.ts); textures for the bundled ones are in
`public/cards/frames/`. The title bar & type line are smooth colour-matched
plates; the art + text box get a thick beveled coloured border; the text box is
pale parchment — all driven by the per-frame `plate`/`box`/`bev` tokens.

## Figma source (community MTG Card Designer)

Frame proportions/bevels were ported from the community "Magic: the Gathering
Card Designer" Figma file (read via the Figma MCP).
- File key: `k13oe29MiXYRuBRmN8BZ9r`; assembled card = node `8:601`.
- Frame textures (solid): land `670:3`, blue `667:21`, red `667:23`, gold `670:4`,
  green `667:24`, white `667:20`, black `667:22`.
- To add a frame colour: `get_screenshot` the node (maxDimension 520), `curl` it,
  `sips -Z 460` to a jpg in `public/cards/frames/<key>.jpg`, and confirm the
  `<key>` palette exists in `FRAMES`.

Fonts: Playfair Display (titles, `font-heading`) + Merriweather (body,
`font-serif`), both loaded via `next/font` in the root layout.
