import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadCard } from "./cards";

test("loadCard exposes artwork as a public URL instead of an inline data URI", async () => {
  const card = await loadCard("joe-mcculla");

  assert.equal(card.artSrc, "/cards/art/joe-mcculla.webp");
  assert.ok(!card.artSrc.startsWith("data:"));
  await access(path.join(process.cwd(), "public", card.artSrc));
});
