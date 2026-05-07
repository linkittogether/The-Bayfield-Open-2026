"use server";

import { randomUUID } from "node:crypto";
import { supabaseStorage } from "@/lib/supabase-storage";

const BUCKET = "players";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function uploadPlayerPhoto(file: File): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image is larger than 5MB (${file.size} bytes)`);
  }

  const ext = EXT_BY_MIME[file.type];
  const path = `${randomUUID()}.${ext}`;

  const { error } = await supabaseStorage.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabaseStorage.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deletePlayerPhoto(publicUrlOrPath: string): Promise<void> {
  const path = extractPath(publicUrlOrPath);
  if (!path) return;
  const { error } = await supabaseStorage.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

function extractPath(input: string): string | null {
  // Handles both raw object paths (e.g. "abc.jpg") and full public URLs.
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = input.indexOf(marker);
  if (idx >= 0) return input.slice(idx + marker.length);
  if (!input.includes("/")) return input;
  return null;
}
