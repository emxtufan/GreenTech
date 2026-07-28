import { readFile, writeFile, rename, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContent, withDefaults, CONTENT_VERSION } from "./contentSchema.js";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONTENT_FILE = path.join(DATA_DIR, "site-content.json");
const BACKUP_FILE = path.join(DATA_DIR, "site-content.backup.json");

/**
 * Persistence boundary for site content.
 *
 * Swapping JSON for a database means implementing this same pair of methods in
 * a `DatabaseContentRepository` and changing the export at the bottom of this
 * file — no route, hook or component needs to move.
 *
 * @typedef {object} ContentRepository
 * @property {() => Promise<object>} getContent
 * @property {(data: object) => Promise<object>} updateContent
 */

export class JsonContentRepository {
  #file;
  #backup;
  #writeQueue = Promise.resolve();

  constructor({ file = CONTENT_FILE, backup = BACKUP_FILE } = {}) {
    this.#file = file;
    this.#backup = backup;
  }

  async getContent() {
    try {
      const raw = await readFile(this.#file, "utf8");
      return withDefaults(JSON.parse(raw));
    } catch (error) {
      if (error.code === "ENOENT") return withDefaults({});
      if (error instanceof SyntaxError) {
        // A corrupt primary file must not take the site down: fall back to the
        // last known-good copy rather than serving nothing.
        const raw = await readFile(this.#backup, "utf8");
        return withDefaults(JSON.parse(raw));
      }
      throw error;
    }
  }

  /**
   * Serialised through a promise chain so two concurrent saves cannot interleave
   * their read-modify-write and lose one another's changes.
   */
  async updateContent(data) {
    const run = this.#writeQueue.then(() => this.#write(data));
    this.#writeQueue = run.catch(() => {});
    return run;
  }

  async #write(data) {
    const next = withDefaults(data);
    next.version = CONTENT_VERSION;
    next.updatedAt = new Date().toISOString();

    validateContent(next);

    await mkdir(path.dirname(this.#file), { recursive: true });

    // Keep one backup of the previous good state before overwriting.
    await copyFile(this.#file, this.#backup).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });

    const serialised = `${JSON.stringify(next, null, 2)}\n`;
    const temporary = `${this.#file}.${process.pid}.tmp`;

    // Write to a temp file, prove it parses, then rename over the target.
    // rename() is atomic on the same filesystem, so a crash mid-write can never
    // leave a half-written content file behind.
    await writeFile(temporary, serialised, "utf8");
    JSON.parse(await readFile(temporary, "utf8"));
    await rename(temporary, this.#file);

    return next;
  }
}

export const contentRepository = new JsonContentRepository();
export { CONTENT_FILE, BACKUP_FILE, DATA_DIR };
