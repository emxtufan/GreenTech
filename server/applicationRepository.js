import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDocumentStore } from "./persistence.js";
import { DATA_DIR, SEED_DATA_DIR } from "./storagePaths.js";

const APPLICATIONS_FILE = path.join(DATA_DIR, "career-applications.json");
const APPLICATIONS_BACKUP_FILE = path.join(DATA_DIR, "career-applications.backup.json");
const APPLICATIONS_SEED_FILE = path.join(SEED_DATA_DIR, "career-applications.json");

// CVs are personal documents from the public internet. They are deliberately
// stored outside `public/` so they are never served as static files: the only
// way to read one is the authenticated download route. Putting them under
// public/uploads/ would turn an open upload form into a file host for anyone.
const CV_DIR = path.join(DATA_DIR, "applications");

const APPLICATION_STATUSES = new Set(["new", "reviewing", "shortlisted", "rejected"]);
const MAX_APPLICATIONS = 5000;
const MAX_CV_BYTES = 6 * 1024 * 1024;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export class ApplicationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ApplicationError";
    this.statusCode = statusCode;
  }
}

/**
 * Document formats are identified by magic bytes, not by the declared MIME type
 * or extension, so an executable renamed `cv.pdf` is rejected.
 */
const CV_SIGNATURES = [
  { extension: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  // Legacy .doc — OLE2 compound file.
  { extension: "doc", mime: "application/msword", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
];

function detectCvFormat(buffer) {
  for (const signature of CV_SIGNATURES) {
    if (signature.bytes.every((byte, index) => buffer[index] === byte)) return signature;
  }

  // .docx is a ZIP container; require the OOXML marker so arbitrary archives
  // cannot be smuggled through as a CV.
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b
    && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);

  if (isZip && buffer.subarray(0, Math.min(buffer.length, 4096)).includes(Buffer.from("word/"))) {
    return {
      extension: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  return null;
}

const compactText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const messageText = (value) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\t\f\v]+/g, " ")
  .trim();

const safeStem = (name) => {
  const stem = path.basename(String(name || "cv"), path.extname(String(name || "")));
  const cleaned = stem
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
  return cleaned || "cv";
};

function normaliseSubmission(input) {
  const name = compactText(input?.name);
  const position = compactText(input?.position);
  const email = compactText(input?.email).toLowerCase();
  const phone = compactText(input?.phone);
  const experience = messageText(input?.experience);

  if (name.length < 2 || name.length > 80) {
    throw new ApplicationError("Please enter a full name of 2 to 80 characters.");
  }

  if (position.length < 2 || position.length > 80) {
    throw new ApplicationError("Please enter the position you are applying for.");
  }

  // Deliberately permissive: the aim is to catch typos, not to police valid
  // addresses that an over-strict pattern would wrongly refuse.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    throw new ApplicationError("Please enter a valid email address.");
  }

  if (!/^[0-9+() .-]{7,24}$/.test(phone)) {
    throw new ApplicationError("Please enter a valid phone number.");
  }

  if (experience.length < 20 || experience.length > 2000) {
    throw new ApplicationError("Describe your experience in between 20 and 2000 characters.");
  }

  if (input?.consent !== true) {
    throw new ApplicationError("GDPR consent is required before sending the application.");
  }

  return { name, position, email, phone, experience };
}

/** Decodes the base64 CV, proves it is a document, and writes it to disk. */
async function storeCv(input) {
  const base64 = String(input?.cvData ?? "").replace(/^data:[^;]*;base64,/, "");

  if (base64.trim() === "") {
    throw new ApplicationError("A CV file is required.");
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    throw new ApplicationError("The CV file could not be read.");
  }

  if (buffer.length === 0) throw new ApplicationError("The CV file is empty.");

  if (buffer.length > MAX_CV_BYTES) {
    throw new ApplicationError(
      `The CV must be smaller than ${Math.round(MAX_CV_BYTES / 1024 / 1024)} MB.`,
      413,
    );
  }

  const format = detectCvFormat(buffer);
  if (!format) {
    throw new ApplicationError("The CV must be a PDF, DOC or DOCX file.");
  }

  const filename = `${safeStem(input?.cvName)}-${randomBytes(8).toString("hex")}.${format.extension}`;
  const destination = path.join(CV_DIR, filename);

  if (!destination.startsWith(CV_DIR + path.sep)) {
    throw new ApplicationError("Resolved CV path escaped the applications directory.", 400);
  }

  await mkdir(CV_DIR, { recursive: true });
  await writeFile(destination, buffer, { flag: "wx" });

  return {
    cvFile: filename,
    cvName: compactText(input?.cvName).slice(0, 160) || filename,
    cvMime: format.mime,
    cvBytes: buffer.length,
  };
}

function validateDocument(document) {
  if (!document || !Array.isArray(document.items)) {
    throw new ApplicationError("The career application store is not valid.", 500);
  }

  const ids = new Set();
  for (const application of document.items) {
    if (!application?.id || ids.has(application.id)) {
      throw new ApplicationError(
        "The career application store contains an invalid or duplicate ID.",
        500,
      );
    }
    ids.add(application.id);

    if (!APPLICATION_STATUSES.has(application.status)) {
      throw new ApplicationError(`Application ${application.id} has an invalid status.`, 500);
    }
  }
}

const sortNewestFirst = (items) => [...items].sort((first, second) => (
  Date.parse(second.submittedAt || 0) - Date.parse(first.submittedAt || 0)
));

export class JsonApplicationRepository {
  #store;
  #writeQueue = Promise.resolve();

  constructor({
    file = APPLICATIONS_FILE,
    backup = APPLICATIONS_BACKUP_FILE,
    seedFile = file === APPLICATIONS_FILE ? APPLICATIONS_SEED_FILE : undefined,
    store,
  } = {}) {
    this.#store = store || createDocumentStore({
      file,
      backup,
      seedFile,
      defaultValue: { version: 1, items: [] },
    });
  }

  async #read() {
    const document = await this.#store.read();
    validateDocument(document);
    return document;
  }

  async #write(document) {
    validateDocument(document);
    await this.#store.write(document);
  }

  async #mutate(mutation) {
    const run = this.#writeQueue.then(async () => {
      const document = await this.#read();
      const result = mutation(document);
      document.version = 1;
      document.updatedAt = new Date().toISOString();
      await this.#write(document);
      return result;
    });

    this.#writeQueue = run.catch(() => {});
    return run;
  }

  async getAll() {
    await this.#writeQueue;
    return sortNewestFirst((await this.#read()).items);
  }

  async submit(input) {
    const submission = normaliseSubmission(input);
    const cv = await storeCv(input);

    try {
      return await this.#mutate((document) => {
        const now = Date.now();
        const duplicate = document.items.some((application) => (
          application.email === submission.email
          && application.position.toLowerCase() === submission.position.toLowerCase()
          && now - Date.parse(application.submittedAt || 0) < DUPLICATE_WINDOW_MS
        ));

        if (duplicate) {
          throw new ApplicationError("This application has already been sent.", 409);
        }

        if (document.items.length >= MAX_APPLICATIONS) {
          throw new ApplicationError("The career inbox is currently full.", 503);
        }

        const submittedAt = new Date().toISOString();
        const application = {
          id: `application-${randomUUID()}`,
          status: "new",
          ...submission,
          ...cv,
          submittedAt,
          consentAt: submittedAt,
          statusChangedAt: null,
        };

        document.items.unshift(application);
        return { id: application.id, status: application.status };
      });
    } catch (error) {
      // The CV landed on disk before the record was accepted; do not leave it
      // orphaned when validation or a duplicate check rejects the submission.
      await unlink(path.join(CV_DIR, cv.cvFile)).catch(() => {});
      throw error;
    }
  }

  /** Resolves an application's CV to an absolute path for the download route. */
  async getCvPath(id) {
    const application = (await this.#read()).items.find((item) => item.id === id);
    if (!application?.cvFile) throw new ApplicationError("CV not found.", 404);

    const resolved = path.join(CV_DIR, path.basename(application.cvFile));
    if (!resolved.startsWith(CV_DIR + path.sep)) {
      throw new ApplicationError("CV not found.", 404);
    }

    return { path: resolved, name: application.cvName, mime: application.cvMime };
  }

  async setStatus(id, status) {
    if (!APPLICATION_STATUSES.has(status)) {
      throw new ApplicationError(
        "Application status must be new, reviewing, shortlisted or rejected.",
      );
    }

    return this.#mutate((document) => {
      const application = document.items.find((item) => item.id === id);
      if (!application) throw new ApplicationError("Application not found.", 404);

      application.status = status;
      application.statusChangedAt = new Date().toISOString();
      return { ...application };
    });
  }

  async remove(id) {
    const removed = await this.#mutate((document) => {
      const index = document.items.findIndex((item) => item.id === id);
      if (index === -1) throw new ApplicationError("Application not found.", 404);
      const [entry] = document.items.splice(index, 1);
      return entry;
    });

    // Deleting the record deletes the personal document with it.
    if (removed.cvFile) {
      await unlink(path.join(CV_DIR, path.basename(removed.cvFile))).catch(() => {});
    }

    return removed;
  }
}

export const applicationRepository = new JsonApplicationRepository();
export {
  APPLICATIONS_FILE,
  APPLICATIONS_BACKUP_FILE,
  APPLICATION_STATUSES,
  CV_DIR,
  MAX_CV_BYTES,
};
