import sharp from "sharp";

// One pipeline for admin uploads and for the batch script, so every image on
// the site ends up in the same shape: EXIF orientation baked in, capped at
// IMAGE_MAX_EDGE on the long side, encoded as WebP, metadata stripped.
export const OPTIMIZED_EXTENSION = "webp";
export const OPTIMIZED_MIME = "image/webp";
export const IMAGE_MAX_EDGE = 1600;
export const WEBP_QUALITY = 78;

// Raster formats worth re-encoding. GIF is left alone (animation), SVG is
// never accepted by uploads at all.
export const OPTIMIZABLE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export function isOptimizableExtension(extension) {
  return OPTIMIZABLE_EXTENSIONS.has(String(extension || "").toLowerCase().replace(/^\./, ""));
}

/**
 * @param {Buffer} input
 * @returns {Promise<{ buffer: Buffer, width: number, height: number } | null>}
 *   `null` when the image should be kept as-is (animated, or the WebP would
 *   not be smaller than the original).
 */
export async function optimizeImage(input, {
  maxEdge = IMAGE_MAX_EDGE,
  quality = WEBP_QUALITY,
} = {}) {
  const image = sharp(input, { failOn: "none", animated: false });
  const metadata = await image.metadata();

  if ((metadata.pages ?? 1) > 1) return null;

  const { data, info } = await image
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  // An already tiny or already efficient file gains nothing from another
  // lossy pass; keep the original bytes rather than growing them.
  if (data.length >= input.length) return null;

  return { buffer: data, width: info.width, height: info.height };
}
