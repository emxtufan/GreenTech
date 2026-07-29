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
  credentials, footprintCountries, qualityPoints, testimonials, footerLinks, faqs,
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
    readJson("footprint-countries.json"),
    readJson("quality-points.json"),
    readJson("testimonials.json"),
    readJson("footer-links.json"),
    readJson("faqs.json"),
  ]);

const content = withDefaults({
  sections,
  processCards: { items: processCards },
  horizontalGallery: { items: gallery },
  heroCards: { items: heroCards },
  impactStats: { items: impactStats },
  clientLogos: { items: clientLogos },
  credentials: { items: credentials },
  footprintCountries: { items: footprintCountries },
  qualityPoints: { items: qualityPoints },
  testimonials: { items: testimonials },
  faqs: { items: faqs },
  footer: {
    tagline: "Electrical, mechanical and construction capability for renewable energy projects across Europe.",
    email: "office@greentechpro.ro",
    phone: "",
    address: "194 Floreasca Way, District 1, Bucharest",
    mapUrl: "https://maps.app.goo.gl/4B6ZvpVcABLVJL5DA",
    copyright: "GreenTech Professionals SRL",
    creditLabel: "Sun model: Wr_titan, CC BY 4.0",
    creditUrl: "https://sketchfab.com/3d-models/space-sun-9dc16d37e8224fe9923f68de0149fcab",
    // Blank lines become separate paragraphs in the legal modal.
    privacyTitle: "Privacy policy",
    privacyBody: [
      "GreenTech Professionals SRL processes the personal data you submit through this website solely to answer your request and to deliver the services you ask for.",
      "We collect only the details you provide in our contact and review forms: name, phone number, email address and the content of your message. This data is stored on our own infrastructure and is never sold or shared with third parties for marketing purposes.",
      "You may request access to, correction of, or deletion of your personal data at any time by writing to office@greentechpro.ro.",
    ].join("\n\n"),
    termsTitle: "Terms & conditions",
    termsBody: [
      "This website and its content are published by GreenTech Professionals SRL for information purposes.",
      "Project figures, capacities and photographs describe work already delivered and do not constitute a commercial offer. Any commercial engagement is governed by the signed contract between GreenTech Professionals SRL and the client.",
      "All text, images and 3D assets on this site remain the property of their respective owners and may not be reproduced without written permission.",
    ].join("\n\n"),
    links: footerLinks,
  },
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
  footprintCountries: content.footprintCountries.items.length,
  qualityPoints: content.qualityPoints.items.length,
  testimonials: content.testimonials.items.length,
  faqs: content.faqs.items.length,
  footerLinks: content.footer.links.length,
});
