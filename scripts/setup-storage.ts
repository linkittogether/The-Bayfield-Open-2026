import { supabaseStorage } from "../src/lib/supabase-storage";

const BUCKET = "players";
const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];

async function main() {
  const { data: existing, error: listError } =
    await supabaseStorage.storage.listBuckets();
  if (listError) throw listError;

  const found = existing?.find((b) => b.name === BUCKET);
  if (found) {
    console.log(`bucket "${BUCKET}" already exists, updating settings...`);
    const { error } = await supabaseStorage.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: FILE_SIZE_LIMIT,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (error) throw error;
    console.log("✓ updated");
    return;
  }

  console.log(`creating bucket "${BUCKET}"...`);
  const { error } = await supabaseStorage.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: FILE_SIZE_LIMIT,
    allowedMimeTypes: ALLOWED_MIME,
  });
  if (error) throw error;
  console.log("✓ created");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
