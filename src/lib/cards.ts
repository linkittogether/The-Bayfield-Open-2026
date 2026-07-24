import { promises as fs } from "fs";
import path from "path";

/**
 * One golfer's trading-card content. Authored per golfer under tools/cards/:
 *   tools/cards/players/<slug>.json   ← this data
 *   tools/cards/art/<slug>.jpg        ← their art (inlined into `artSrc` on load)
 */
export interface CardData {
  slug: string;
  name: string;
  type: string;
  team?: "truffle_hogs" | "mycelium_syndicate";
  /** Override the team->frame mapping (e.g. "gold" for a pre-franchise player). */
  frame?: string;
  handicap?: string;
  artPosition?: string;
  abilities: string[];
  flavor?: string;
  collector?: string;
  rarity?: string;
  caption?: string;
  /** Data URI of the golfer's art, filled in by loadCards() from art/<slug>.jpg. */
  artSrc?: string;
}

const TEAM_FRAME: Record<string, string> = {
  truffle_hogs: "land",
  mycelium_syndicate: "blue",
};

/**
 * Per-frame colour palette. `plate` = the smooth title/type bars (hi/mid/lo),
 * `box` = the parchment text box (hi/lo), `bev` = the thick beveled border
 * around the art + text box (dark/light shades of the frame colour).
 */
export interface FramePalette {
  plate: [string, string, string];
  box: [string, string];
  bev: [string, string];
}

export const FRAMES: Record<string, FramePalette> = {
  land: { plate: ["#efe8d6", "#dccfb0", "#c4b58d"], box: ["#f4eedd", "#e6dbc2"], bev: ["#6b5029", "#f1e7ce"] },
  blue: { plate: ["#dbe7f4", "#a7c1de", "#7c9ec1"], box: ["#eef4fb", "#d9e6f2"], bev: ["#20406a", "#d3e3f4"] },
  red: { plate: ["#f1d8d0", "#d6998c", "#b46a5a"], box: ["#fbeee9", "#f2d9cf"], bev: ["#5e2519", "#f1d2c8"] },
  gold: { plate: ["#f2e6c0", "#dcc98a", "#bfa65e"], box: ["#fbf3da", "#efe0b8"], bev: ["#7c5f1e", "#f7edc6"] },
  green: { plate: ["#dfe9d3", "#adc79f", "#84a06f"], box: ["#eef4e6", "#dde9cf"], bev: ["#3a5a2c", "#dcecc9"] },
  black: { plate: ["#d7d2cb", "#9a938a", "#6f685f"], box: ["#e9e6df", "#cfcabf"], bev: ["#2c2822", "#d8d3ca"] },
  white: { plate: ["#f7f3e6", "#e5dcc4", "#cdbf9c"], box: ["#faf7ee", "#ece5d2"], bev: ["#8a7c55", "#faf5e6"] },
};

export function frameKey(c: Pick<CardData, "frame" | "team">): string {
  return c.frame ?? (c.team ? TEAM_FRAME[c.team] : undefined) ?? "land";
}

const CARDS_DIR = path.join(process.cwd(), "tools/cards");

/** Read art/<slug>.jpg (or .png) as a data URI, or undefined if absent. */
async function artDataUri(slug: string): Promise<string | undefined> {
  for (const [ext, mime] of [["jpg", "jpeg"], ["png", "png"]] as const) {
    try {
      const buf = await fs.readFile(path.join(CARDS_DIR, "art", `${slug}.${ext}`));
      return `data:image/${mime};base64,${buf.toString("base64")}`;
    } catch {
      /* try next extension */
    }
  }
  return undefined;
}

/** Load one authored card by slug (JSON + inlined art). */
export async function loadCard(slug: string): Promise<CardData> {
  const raw = JSON.parse(
    await fs.readFile(path.join(CARDS_DIR, "players", `${slug}.json`), "utf8"),
  );
  return { slug, ...raw, artSrc: await artDataUri(slug) } as CardData;
}

/** Load all authored cards (skips _-prefixed files like the template). */
export async function loadCards(): Promise<CardData[]> {
  const dir = path.join(CARDS_DIR, "players");
  const slugs = (await fs.readdir(dir))
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""));
  const cards = await Promise.all(slugs.map(loadCard));
  return cards.sort((a, b) =>
    (a.collector ?? a.name).localeCompare(b.collector ?? b.name),
  );
}
