import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const clone = (value) => structuredClone(value);

export async function initialisePersistence() {
  console.log("[Storage] Using local JSON persistence.");
  return "json";
}

export function persistenceDriver() {
  return "json";
}

export async function closePersistence() {}

class JsonDocumentStore {
  #file;
  #backup;
  #seedFile;
  #defaultValue;

  constructor({ file, backup, seedFile, defaultValue }) {
    this.#file = file;
    this.#backup = backup;
    this.#seedFile = seedFile;
    this.#defaultValue = defaultValue;
  }

  async #readSeed() {
    if (this.#seedFile && path.resolve(this.#seedFile) !== path.resolve(this.#file)) {
      try {
        return JSON.parse(await readFile(this.#seedFile, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    return clone(this.#defaultValue);
  }

  async read() {
    try {
      return JSON.parse(await readFile(this.#file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return this.#readSeed();
      if (error instanceof SyntaxError && this.#backup) {
        return JSON.parse(await readFile(this.#backup, "utf8"));
      }
      throw error;
    }
  }

  async write(document) {
    await mkdir(path.dirname(this.#file), { recursive: true });
    if (this.#backup) {
      await copyFile(this.#file, this.#backup).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }

    const temporary = `${this.#file}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    JSON.parse(await readFile(temporary, "utf8"));
    await rename(temporary, this.#file);
  }
}

export function createDocumentStore(options) {
  return new JsonDocumentStore(options);
}
