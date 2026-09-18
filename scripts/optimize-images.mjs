#!/usr/bin/env node
// Re-encodes every JPEG/PNG photo the site references as capped-size WebP,
// rewrites the URLs in every content JSON (seeds, live data, translation
// snapshots), then removes the originals. Idempotent: run it again and it
// finds nothing left to do.
//
//   npm run optimize:images              versioned assets + live runtime data,
//                                        then rebuilds dist/ (run locally)
//   npm run optimize:images -- --live    live runtime data only (run on the server)
//   npm run optimize:images -- --dry-run report without touching anything
//   npm run optimize:images -- --no-build skip the dist/ rebuild
//
// Reads DATA_DIR / UPLOADS_DIR / TRANSLATIONS_DIR from .env exactly like the
// server does, so it works both on a local checkout and on the live box.

import { spawn } from "node:child_process";
import { readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DATA_DIR,
  ROOT_DIR,
  SEED_DATA_DIR,
  SEED_UPLOADS_DIR,
  TRANSLATIONS_DIR,
  UPLOADS_DIR,
} from "../server/storagePaths.js";
import { OPTIMIZED_EXTENSION, optimizeImage } from "../server/imageOptimizer.js";

const args = new Set(process.argv.slice(2));
const LIVE_ONLY = args.has("--live");
const DRY_RUN = args.has("--dry-run");
const SKIP_BUILD = args.has("--no-build");

const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const CONVERTIBLE = new Set([".jpg", ".jpeg", ".png"]);

// Image folders owned by content. Logos, favicons, social cards and the
// hero's WebGL textures under public/ are deliberately not in this list.
const VERSIONED_IMAGE_ROOTS = [
  { dir: path.join(PUBLIC_DIR, "projects"), urlPrefix: "/projects" },
  { dir: path.join(PUBLIC_DIR, "gallery"), urlPrefix: "/gallery" },
  { dir: path.join(PUBLIC_DIR, "clients"), urlPrefix: "/clients" },
  { dir: SEED_UPLOADS_DIR, urlPrefix: "/uploads" },
];
const LIVE_IMAGE_ROOTS = [{ dir: UPLOADS_DIR, urlPrefix: "/uploads" }];

const VERSIONED_JSON_DIRS = [SEED_DATA_DIR, path.join(ROOT_DIR, "storage", "data"), path.join(ROOT_DIR, "storage", "translations")];
const LIVE_JSON_DIRS = [DATA_DIR, TRANSLATIONS_DIR];

const imageRoots = dedupeByDir(LIVE_ONLY ? LIVE_IMAGE_ROOTS : [...VERSIONED_IMAGE_ROOTS, ...LIVE_IMAGE_ROOTS]);
const jsonDirs = [...new Set((LIVE_ONLY ? LIVE_JSON_DIRS : [...VERSIONED_JSON_DIRS, ...LIVE_JSON_DIRS]).map((dir) => path.resolve(dir)))];

function dedupeByDir(roots) {
  const seen = new Set();
  return roots.filter((root) => {
    const key = path.resolve(root.dir);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const relative = (file) => path.relative(ROOT_DIR, file).split(path.sep).join("/");

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

// The public URL a file is served at, as the content JSON stores it.
function publicUrl(root, file) {
  const rest = path.relative(root.dir, file).split(path.sep).join("/");
  return `${root.urlPrefix}/${rest}`;
}

async function writeAtomic(file, data) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, file);
}

/* ------------------------------------------------------------- images */

async function convertImages() {
  const urlMap = new Map(); // old URL -> new URL
  const converted = []; // { original, webp }
  const skipped = [];
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const root of imageRoots) {
    const files = (await walk(root.dir))
      .filter((file) => CONVERTIBLE.has(path.extname(file).toLowerCase()));

    for (const file of files) {
      const target = file.replace(/\.[^.]+$/, `.${OPTIMIZED_EXTENSION}`);
      const oldUrl = publicUrl(root, file);
      const newUrl = publicUrl(root, target);
      const originalSize = (await stat(file)).size;

      // A .webp already sitting next to the original means an earlier run
      // converted it but was interrupted before cleanup: finish that job.
      if (await exists(target)) {
        const size = (await stat(target)).size;
        bytesBefore += originalSize;
        bytesAfter += size;
        urlMap.set(oldUrl, newUrl);
        converted.push({ original: file, webp: target, resumed: true });
        continue;
      }

      let result = null;
      try {
        result = await optimizeImage(await readFile(file));
      } catch (error) {
        skipped.push(`${relative(file)} (${error.message})`);
        continue;
      }

      if (!result) {
        skipped.push(`${relative(file)} (WebP would not be smaller)`);
        continue;
      }

      bytesBefore += originalSize;
      bytesAfter += result.buffer.length;
      if (!DRY_RUN) await writeAtomic(target, result.buffer);
      urlMap.set(oldUrl, newUrl);
      converted.push({ original: file, webp: target });
      process.stdout.write(
        `  ${relative(file)}  ${megabytes(originalSize)} -> ${megabytes(result.buffer.length)}\n`,
      );
    }
  }

  return { urlMap, converted, skipped, bytesBefore, bytesAfter };
}

/* --------------------------------------------------------------- JSON */

// Content stores URLs as plain strings, sometimes percent-encoded, sometimes
// inside HTML in a blog body. A text-level replacement of every spelling
// covers all of them and leaves formatting untouched; the parse afterwards
// guarantees the file is still valid JSON before it is written back.
function spellings(url) {
  const variants = new Set([url, encodeURI(url)]);
  try {
    variants.add(decodeURI(url));
  } catch {
    // Not a decodable URL; the raw spelling is enough.
  }
  return [...variants];
}

async function rewriteJson(urlMap) {
  const updated = [];
  if (urlMap.size === 0) return updated;

  const replacements = [...urlMap.entries()].flatMap(([oldUrl, newUrl]) => (
    spellings(oldUrl).map((spelling) => [spelling, newUrl])
  ));

  for (const dir of jsonDirs) {
    const files = (await walk(dir)).filter((file) => file.endsWith(".json"));

    for (const file of files) {
      const original = await readFile(file, "utf8");
      let text = original;
      for (const [from, to] of replacements) {
        if (text.includes(from)) text = text.split(from).join(to);
      }
      if (text === original) continue;

      JSON.parse(text);
      if (!DRY_RUN) await writeAtomic(file, text);
      updated.push(file);
    }
  }

  return updated;
}

/* ---------------------------------------------------------------- run */

async function removeOriginals(converted) {
  let removed = 0;
  for (const { original, webp } of converted) {
    if (!(await exists(webp))) continue;
    await unlink(original);
    removed += 1;
  }
  return removed;
}

function rebuildDist() {
  return new Promise((resolve, reject) => {
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(npx, ["vite", "build"], { cwd: ROOT_DIR, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`vite build exited with ${code}`))));
  });
}

async function main() {
  console.log(`Scope: ${LIVE_ONLY ? "live runtime data only" : "versioned assets + live runtime data"}${DRY_RUN ? " (dry run)" : ""}`);
  console.log("Image folders:");
  imageRoots.forEach((root) => console.log(`  ${root.dir}`));
  console.log("Content JSON:");
  jsonDirs.forEach((dir) => console.log(`  ${dir}`));
  console.log("");

  const { urlMap, converted, skipped, bytesBefore, bytesAfter } = await convertImages();
  const updatedJson = await rewriteJson(urlMap);
  const removed = DRY_RUN ? 0 : await removeOriginals(converted);

  console.log("");
  console.log(`Converted: ${converted.length} images, ${megabytes(bytesBefore)} -> ${megabytes(bytesAfter)}`);
  console.log(`Originals removed: ${removed}`);
  console.log(`Content files updated: ${updatedJson.length}`);
  updatedJson.forEach((file) => console.log(`  ${relative(file)}`));
  if (skipped.length) {
    console.log(`Left as-is: ${skipped.length}`);
    skipped.forEach((entry) => console.log(`  ${entry}`));
  }

  if (converted.length === 0) {
    console.log("\nNothing to optimise.");
    return;
  }

  if (LIVE_ONLY || DRY_RUN || SKIP_BUILD) {
    if (!LIVE_ONLY && !DRY_RUN) console.log("\nRemember to run `npm run build` so dist/ picks up the new files.");
    return;
  }

  // public/ is copied into dist/ by the build; the old JPEGs disappear from
  // dist/ with it, and that is what the server serves.
  console.log("\nRebuilding dist/ ...");
  await rebuildDist();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
