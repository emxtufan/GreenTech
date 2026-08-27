import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "..");
const manifestPath = path.resolve(
  workspaceRoot,
  process.argv[2] || ".tmp-project-photo-import/manifest.json",
);
const contentPaths = [
  path.join(workspaceRoot, "storage/data/site-content.json"),
  path.join(workspaceRoot, "data/site-content.json"),
];

function readJson(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(source);
}

function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, filePath);
}

const manifest = readJson(manifestPath);
const manifestProjects = Array.isArray(manifest.projects) ? manifest.projects : [];
if (manifestProjects.length !== 22) {
  throw new Error(`Expected 22 projects in the manifest, found ${manifestProjects.length}.`);
}

const manifestsById = new Map(manifestProjects.map((project) => [project.id, project]));
const allImagePaths = new Set();
for (const project of manifestProjects) {
  if (!project.id || !project.cover || !Array.isArray(project.gallery) || project.gallery.length === 0) {
    throw new Error(`Incomplete photo manifest for project ${project.id || "unknown"}.`);
  }

  for (const image of project.gallery) {
    if (!image?.src || allImagePaths.has(image.src)) {
      throw new Error(`Duplicate or missing gallery path: ${image?.src || "empty"}.`);
    }
    allImagePaths.add(image.src);
  }
}

const updatedAt = new Date().toISOString();
for (const contentPath of contentPaths) {
  const content = readJson(contentPath);
  const projects = content?.horizontalGallery?.items;
  if (!Array.isArray(projects) || projects.length !== manifestProjects.length) {
    throw new Error(`Project collection mismatch in ${contentPath}.`);
  }

  const seen = new Set();
  for (const project of projects) {
    const photoManifest = manifestsById.get(project.id);
    if (!photoManifest) {
      throw new Error(`No photo manifest found for ${project.id} in ${contentPath}.`);
    }

    project.image = photoManifest.cover;
    project.gallery = photoManifest.gallery;
    seen.add(project.id);
  }

  const coverByProjectId = new Map(
    projects.map((project) => [project.id, project.image]),
  );
  for (const post of content?.blog?.posts ?? []) {
    const projectCover = coverByProjectId.get(post?.relatedProjectId);
    if (projectCover && String(post?.image || "").startsWith("/projects/portfolio-2026/")) {
      post.image = projectCover;
    }
  }

  if (seen.size !== manifestProjects.length) {
    throw new Error(`Not every photo manifest was applied to ${contentPath}.`);
  }

  content.updatedAt = updatedAt;
  writeJsonAtomic(contentPath, content);
  console.log(`Updated ${path.relative(workspaceRoot, contentPath)} (${allImagePaths.size} photos).`);
}
