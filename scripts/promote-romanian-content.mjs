import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContent, withDefaults } from "../server/contentSchema.js";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.join(ROOT_DIR, ".env"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const { DATA_DIR } = await import("../server/storagePaths.js");
const SOURCE = path.join(ROOT_DIR, "data", "site-content.json");
const TARGET = path.join(DATA_DIR, "site-content.json");

if (path.resolve(SOURCE) === path.resolve(TARGET)) {
  throw new Error("DATA_DIR must not point at the tracked data seed for this promotion.");
}

const content = withDefaults(JSON.parse(await readFile(SOURCE, "utf8")));
content.updatedAt = new Date().toISOString();
validateContent(content);

await mkdir(DATA_DIR, { recursive: true });

const targetExists = await access(TARGET).then(() => true, () => false);
let archive = null;
if (targetExists) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  archive = path.join(DATA_DIR, `site-content.before-romanian-promotion.${stamp}.json`);
  await copyFile(TARGET, archive);
}

const temporary = `${TARGET}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`, "utf8");
validateContent(JSON.parse(await readFile(temporary, "utf8")));
await rename(temporary, TARGET);

console.log(`Romanian source promoted to ${TARGET}`);
if (archive) console.log(`Previous live content archived to ${archive}`);

