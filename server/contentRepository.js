import path from "node:path";
import { validateContent, withDefaults, CONTENT_VERSION } from "./contentSchema.js";
import { createDocumentStore } from "./persistence.js";
import { DATA_DIR, SEED_DATA_DIR } from "./storagePaths.js";

const CONTENT_FILE = path.join(DATA_DIR, "site-content.json");
const BACKUP_FILE = path.join(DATA_DIR, "site-content.backup.json");
const CONTENT_SEED_FILE = path.join(SEED_DATA_DIR, "site-content.json");

/**
 * Persistence boundary for site content.
 *
 * Routes and components depend only on this interface; persistence details
 * remain contained in the repository and document store.
 *
 * @typedef {object} ContentRepository
 * @property {() => Promise<object>} getContent
 * @property {(data: object) => Promise<object>} updateContent
 */

export class JsonContentRepository {
  #store;
  #writeQueue = Promise.resolve();

  constructor({
    file = CONTENT_FILE,
    backup = BACKUP_FILE,
    seedFile = file === CONTENT_FILE ? CONTENT_SEED_FILE : undefined,
    store,
  } = {}) {
    this.#store = store || createDocumentStore({
      file,
      backup,
      seedFile,
      defaultValue: {},
    });
  }

  async getContent() {
    return withDefaults(await this.#store.read());
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

    await this.#store.write(next);

    return next;
  }
}

export const contentRepository = new JsonContentRepository();
export { CONTENT_FILE, BACKUP_FILE, DATA_DIR };
