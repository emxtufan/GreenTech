// Seeds data/site-content.json from the per-section JSON files in src/data.
//
// This is a one-time seed, NOT a sync: the source files still hold the original
// wording, so re-running it discards everything edited through the admin panel.
// It therefore refuses to overwrite an existing document unless --force is
// passed, and takes a timestamped backup before it does.
//
//   node scripts/migrate-content.mjs           seed (refuses if already seeded)
//   node scripts/migrate-content.mjs --force   re-seed, backing up what is there

import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContent, withDefaults } from "../server/contentSchema.js";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIR = path.join(ROOT_DIR, "src", "data");
const TARGET = path.join(ROOT_DIR, "data", "site-content.json");

const force = process.argv.includes("--force");
const exists = await access(TARGET).then(() => true, () => false);

if (exists && !force) {
  const current = JSON.parse(await readFile(TARGET, "utf8"));
  console.error(
    [
      "",
      "  Refusing to overwrite data/site-content.json.",
      "",
      `  It already exists${current.updatedAt ? ` and was last saved ${current.updatedAt}` : ""}.`,
      "  Re-seeding would discard every change made through the admin panel,",
      "  because src/data/*.json still holds the original wording.",
      "",
      "  If that is genuinely what you want:",
      "",
      "      npm run migrate:content -- --force",
      "",
      "  A timestamped backup is written to data/ before anything is replaced.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const readJson = async (name) => {
  try {
    return JSON.parse(await readFile(path.join(SOURCE_DIR, name), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`  ! ${name} not found — skipping`);
      return [];
    }
    throw error;
  }
};

const [
  sections, processCards, gallery, posts, heroCards, impactStats, clientLogos,
  credentials, qualityPoints, testimonials,
] =
  await Promise.all([
    readJson("admin-sections.json"),
    readJson("process-cards.json"),
    readJson("horizontal-gallery.json"),
    readJson("blog-posts.json"),
    readJson("hero-cards.json"),
    readJson("impact-stats.json"),
    readJson("client-logos.json"),
    readJson("credentials.json"),
    readJson("quality-points.json"),
    readJson("testimonials.json"),
  ]);

const content = withDefaults({
  sections,
  processCards: { items: processCards },
  horizontalGallery: { items: gallery },
  heroCards: { items: heroCards },
  impactStats: { items: impactStats },
  clientLogos: { items: clientLogos },
  credentials: { items: credentials },
  qualityPoints: { items: qualityPoints },
  testimonials: { items: testimonials },
  blog: {
    // `slug` defaults to the existing id so published blog URLs do not change.
    posts: posts.map((post) => ({ slug: post.id, status: "published", ...post })),
  },
});

validateContent(content);

await mkdir(path.dirname(TARGET), { recursive: true });

// Keep the displaced document recoverable — the API's own rolling backup would
// otherwise be the only copy, and a re-seed overwrites that on the next save.
if (exists) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archive = path.join(path.dirname(TARGET), `site-content.${stamp}.json`);
  await copyFile(TARGET, archive);
  console.log(`Previous content archived to data/${path.basename(archive)}`);
}

await writeFile(TARGET, `${JSON.stringify(content, null, 2)}\n`, "utf8");

console.log("Migrated into data/site-content.json");
console.table({
  sections: content.sections.length,
  processCards: content.processCards.items.length,
  galleryItems: content.horizontalGallery.items.length,
  blogPosts: content.blog.posts.length,
  heroCards: content.heroCards.items.length,
  impactStats: content.impactStats.items.length,
  clientLogos: content.clientLogos.items.length,
  credentials: content.credentials.items.length,
  qualityPoints: content.qualityPoints.items.length,
  testimonials: content.testimonials.items.length,
});
