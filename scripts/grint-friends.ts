import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Scrapes your TheGrint ranking page (which lists your friends + their
 * handicaps) and writes one row per person to a txt file.
 *
 * Auth: TheGrint uses cookie-based sessions, not a bearer token. Copy the full
 * `Cookie:` header from a logged-in request (DevTools → Network → any request to
 * thegrint.com → Copy value) into GRINT_COOKIE in .env.local. The `remember`
 * and `PHPSESSID` cookies are the ones that matter.
 *
 * The ranking HTML embeds every person as an inline `allstats.push({...})` JS
 * object, so we parse those rather than the (JS-rendered, empty) <tbody>.
 *
 *   npm run grint:friends
 */

const RANKING_URL = "https://thegrint.com/ranking";
// list_filter=0 → friends list; filter=20 → stat sort; round_filter=18 → window.
// These mirror the values the website POSTs; adjust if the site changes them.
const FORM_BODY = "list_filter=0&filter=20&round_filter=18";
const OUTPUT_FILE = resolve(process.cwd(), "grint-friends.txt");

interface GrintPerson {
  userId: string;
  name: string;
  handicap: string;
  handicapRange: string;
  rankHcp: string;
  isMe: boolean;
  visible: boolean;
}

async function fetchRankingHtml(cookie: string): Promise<string> {
  const res = await fetch(RANKING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://thegrint.com",
      Referer: "https://thegrint.com/ranking",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15",
      Cookie: cookie,
    },
    body: FORM_BODY,
  });
  if (!res.ok) {
    throw new Error(`ranking fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  // A logged-out request still returns 200 but with the login page, so sniff
  // for the data we expect before trying to parse.
  if (!html.includes("allstats.push")) {
    throw new Error(
      "ranking page returned no friend data — the cookie is likely expired or invalid",
    );
  }
  return html;
}

/**
 * Each record in the page looks like:
 *
 *   var hcpOrhcpGhap = (provider==7)?'30.0':'30.0';
 *   var hcpTextOrhcpGhapText = (provider==7)?'29~31':'29~31';
 *   var rankHcpTextOrhcpGhapText = (provider==7)?'31':'31';
 *   allstats.push({ user_id: '1182626', name: 'Zac Dykstra', isme:0, hcp: hcpOrhcpGhap, ... });
 *
 * `hcp`/`hcp_text`/`rank_hcp` reference the three `var`s declared just above the
 * push, so we capture those vars and the push body together. Both ternary
 * branches (GHIN vs GHAP provider) are identical in practice; we take the first.
 */
function parsePeople(html: string): GrintPerson[] {
  const recordRe =
    /var hcpOrhcpGhap = \(provider==7\)\?'([^']*)':'[^']*';[\s\S]*?var hcpTextOrhcpGhapText = \(provider==7\)\?'([^']*)':'[^']*';[\s\S]*?var rankHcpTextOrhcpGhapText = \(provider==7\)\?'([^']*)':'[^']*';[\s\S]*?allstats\.push\(\{([\s\S]*?)\}\);/g;

  const field = (block: string, key: string): string => {
    // matches  key: 'value'  or  key:value  (numbers/unquoted)
    const m = block.match(new RegExp(`${key}\\s*:\\s*'([^']*)'`));
    if (m) return m[1];
    const n = block.match(new RegExp(`${key}\\s*:\\s*([0-9]+)`));
    return n ? n[1] : "";
  };

  const people: GrintPerson[] = [];
  for (const match of html.matchAll(recordRe)) {
    const [, hcp, hcpRange, rankHcp, block] = match;
    people.push({
      userId: field(block, "user_id"),
      name: field(block, "name"),
      handicap: hcp,
      handicapRange: hcpRange,
      rankHcp,
      isMe: field(block, "isme") === "1",
      visible: field(block, "is_visible") === "1",
    });
  }
  return people;
}

async function main() {
  const cookie = process.env.GRINT_COOKIE;
  if (!cookie) {
    throw new Error(
      "GRINT_COOKIE is not set. Add it to .env.local (the full Cookie header from a logged-in thegrint.com request).",
    );
  }

  console.log(`Fetching ${RANKING_URL} ...`);
  const html = await fetchRankingHtml(cookie);
  const people = parsePeople(html);
  if (people.length === 0) {
    throw new Error("parsed 0 people — the page structure may have changed");
  }

  // Friends only: drop your own row. Keep private/masked profiles (their names
  // come through redacted as "S**** M****" but the user_id + handicap are real).
  const friends = people.filter((p) => !p.isMe);

  const header = ["user_id", "name", "handicap", "hcp_range", "rank", "visible"].join("\t");
  const rows = friends.map((p) =>
    [p.userId, p.name, p.handicap, p.handicapRange, p.rankHcp, p.visible ? "1" : "0"].join("\t"),
  );
  await writeFile(OUTPUT_FILE, [header, ...rows].join("\n") + "\n", "utf8");

  const masked = friends.filter((p) => !p.visible).length;
  console.log(
    `✓ wrote ${friends.length} friends to ${OUTPUT_FILE}` +
      (masked ? ` (${masked} with private/masked names)` : ""),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("GRINT SCRAPE FAILED:", err);
    process.exit(1);
  });
