import {
  deletePlayerPhoto,
  uploadPlayerPhoto,
} from "../src/lib/server/photos";
import { supabaseStorage } from "../src/lib/supabase-storage";

// 1x1 transparent PNG
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  const file = new File([PNG_BYTES], "smoke.png", { type: "image/png" });

  const url = await uploadPlayerPhoto(file);
  console.log("uploaded:", url);

  const headRes = await fetch(url);
  if (!headRes.ok) throw new Error(`expected 200, got ${headRes.status}`);
  const buf = await headRes.arrayBuffer();
  if (buf.byteLength !== PNG_BYTES.length) {
    throw new Error(
      `byte mismatch: uploaded ${PNG_BYTES.length}, fetched ${buf.byteLength}`,
    );
  }
  console.log(`✓ public URL fetches ${buf.byteLength} bytes`);

  await deletePlayerPhoto(url);
  console.log("deleted");

  // CDN may still cache the public URL briefly; check the bucket directly.
  const objectPath = url.split("/players/")[1];
  const { data: list, error: listErr } = await supabaseStorage.storage
    .from("players")
    .list("", { search: objectPath });
  if (listErr) throw listErr;
  if (list && list.some((o) => o.name === objectPath)) {
    throw new Error(`object ${objectPath} still present after delete`);
  }
  console.log(`✓ object removed from bucket listing`);

  // Test reject path: bad MIME
  let rejected = false;
  try {
    const bad = new File(["text content"], "bad.txt", { type: "text/plain" });
    await uploadPlayerPhoto(bad);
  } catch (err) {
    rejected = true;
    console.log(`✓ rejected non-image: ${(err as Error).message}`);
  }
  if (!rejected) throw new Error("non-image upload should have thrown");

  console.log("\nSTORAGE SMOKE PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("STORAGE SMOKE FAILED:", err);
    process.exit(1);
  });
