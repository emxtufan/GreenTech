import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
export const UPLOADS_DIR = path.join(ROOT_DIR, "public", "uploads");
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Buckets mirror the content groups so uploads stay browsable on disk.
const CATEGORIES = new Set(["gallery", "blog", "sections", "misc"]);

/**
 * Formats are identified by magic bytes rather than the client-supplied
 * Content-Type, so renaming `payload.html` to `photo.png` does not get it
 * written to a public directory.
 *
 * SVG is intentionally unsupported: it is an executable document format and
 * serving it from our own origin would hand any admin-uploaded file a script
 * execution context on the live site.
 */
const SIGNATURES = [
  { extension: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { extension: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { extension: "gif", mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
];

function detectFormat(buffer) {
  for (const signature of SIGNATURES) {
    const matches = signature.bytes.every((byte, index) => buffer[index] === byte);
    if (matches) return signature;
  }

  // WebP is a RIFF container: "RIFF" then 4 size bytes then "WEBP".
  if (
    buffer.length > 12
    && buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { extension: "webp", mime: "image/webp" };
  }

  return null;
}

function safeStem(originalName) {
  const stem = path.basename(String(originalName || "image"), path.extname(String(originalName || "")));

  const cleaned = stem
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);

  return cleaned || "image";
}

export class UploadError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "UploadError";
    this.statusCode = statusCode;
  }
}

/**
 * @returns {Promise<{ url: string, bytes: number, mime: string }>}
 *   Only the public URL is ever handed back for storage in the content file.
 */
export async function saveUpload({ buffer, originalName, category = "misc" }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new UploadError("No file data received.");
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `File is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      413,
    );
  }

  const bucket = CATEGORIES.has(category) ? category : "misc";
  const format = detectFormat(buffer);

  if (!format) {
    throw new UploadError("Unsupported file type. Upload a JPEG, PNG, WebP or GIF image.");
  }

  const filename = `${safeStem(originalName)}-${randomBytes(6).toString("hex")}.${format.extension}`;
  const directory = path.join(UPLOADS_DIR, bucket);
  const destination = path.join(directory, filename);

  // Belt and braces: the filename is generated, but confirm the resolved path
  // still sits inside the uploads directory before writing anything.
  if (!destination.startsWith(UPLOADS_DIR + path.sep)) {
    throw new UploadError("Resolved upload path escaped the uploads directory.", 400);
  }

  await mkdir(directory, { recursive: true });
  await writeFile(destination, buffer, { flag: "wx" });

  return {
    url: `/uploads/${bucket}/${filename}`,
    bytes: buffer.length,
    mime: format.mime,
  };
}
