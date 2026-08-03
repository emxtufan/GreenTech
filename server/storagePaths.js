import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
export const SEED_DATA_DIR = path.join(ROOT_DIR, "data");
export const SEED_UPLOADS_DIR = path.join(ROOT_DIR, "public", "uploads");

function configuredDirectory(environmentKey, fallback) {
  const configured = String(process.env[environmentKey] || "").trim();
  return path.resolve(ROOT_DIR, configured || fallback);
}

// Runtime files live outside tracked seed directories so `git pull` remains
// conflict-free after content edits, form submissions, or admin uploads.
export const DATA_DIR = configuredDirectory("DATA_DIR", "storage/data");
export const UPLOADS_DIR = configuredDirectory("UPLOADS_DIR", "storage/uploads");
export const TRANSLATIONS_DIR = configuredDirectory(
  "TRANSLATIONS_DIR",
  "storage/translations",
);
