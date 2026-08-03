import { randomUUID } from "node:crypto";
import path from "node:path";
import { createDocumentStore } from "./persistence.js";
import { DATA_DIR, SEED_DATA_DIR } from "./storagePaths.js";

const INQUIRIES_FILE = path.join(DATA_DIR, "project-inquiries.json");
const INQUIRIES_BACKUP_FILE = path.join(DATA_DIR, "project-inquiries.backup.json");
const INQUIRIES_SEED_FILE = path.join(SEED_DATA_DIR, "project-inquiries.json");
const INQUIRY_STATUSES = new Set(["new", "contacted", "closed"]);
const MAX_INQUIRIES = 5000;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export class InquiryError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "InquiryError";
    this.statusCode = statusCode;
  }
}

const compactText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const messageText = (value) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\t\f\v]+/g, " ")
  .trim();

function normaliseSubmission(input) {
  const firstName = compactText(input?.firstName);
  const lastName = compactText(input?.lastName);
  const phone = compactText(input?.phone);
  const message = messageText(input?.message);

  if (firstName.length < 1 || firstName.length > 60) {
    throw new InquiryError("Please enter a first name of up to 60 characters.");
  }

  if (lastName.length < 1 || lastName.length > 60) {
    throw new InquiryError("Please enter a last name of up to 60 characters.");
  }

  if (!/^[0-9+() .-]{7,24}$/.test(phone)) {
    throw new InquiryError("Please enter a valid phone number.");
  }

  if (message.length < 10 || message.length > 1200) {
    throw new InquiryError("The project message must contain between 10 and 1200 characters.");
  }

  if (input?.consent !== true) {
    throw new InquiryError("GDPR consent is required before sending the inquiry.");
  }

  return { firstName, lastName, phone, message };
}

function validateDocument(document) {
  if (!document || !Array.isArray(document.items)) {
    throw new InquiryError("The project inquiry store is not valid.", 500);
  }

  const ids = new Set();
  for (const inquiry of document.items) {
    if (!inquiry?.id || ids.has(inquiry.id)) {
      throw new InquiryError("The project inquiry store contains an invalid or duplicate ID.", 500);
    }
    ids.add(inquiry.id);

    if (!INQUIRY_STATUSES.has(inquiry.status)) {
      throw new InquiryError(`Inquiry ${inquiry.id} has an invalid status.`, 500);
    }
  }
}

const sortNewestFirst = (items) => [...items].sort((first, second) => (
  Date.parse(second.submittedAt || 0) - Date.parse(first.submittedAt || 0)
));

export class JsonInquiryRepository {
  #store;
  #writeQueue = Promise.resolve();

  constructor({
    file = INQUIRIES_FILE,
    backup = INQUIRIES_BACKUP_FILE,
    seedFile = file === INQUIRIES_FILE ? INQUIRIES_SEED_FILE : undefined,
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

    return this.#mutate((document) => {
      const now = Date.now();
      const duplicate = document.items.some((inquiry) => (
        inquiry.phone === submission.phone
        && inquiry.message.toLowerCase() === submission.message.toLowerCase()
        && now - Date.parse(inquiry.submittedAt || 0) < DUPLICATE_WINDOW_MS
      ));

      if (duplicate) {
        throw new InquiryError("This project inquiry has already been sent.", 409);
      }

      if (document.items.length >= MAX_INQUIRIES) {
        throw new InquiryError("The project inquiry inbox is currently full.", 503);
      }

      const submittedAt = new Date().toISOString();
      const inquiry = {
        id: `inquiry-${randomUUID()}`,
        status: "new",
        ...submission,
        submittedAt,
        consentAt: submittedAt,
        statusChangedAt: null,
      };

      document.items.unshift(inquiry);
      return { id: inquiry.id, status: inquiry.status };
    });
  }

  async setStatus(id, status) {
    if (!INQUIRY_STATUSES.has(status)) {
      throw new InquiryError("Inquiry status must be new, contacted or closed.");
    }

    return this.#mutate((document) => {
      const inquiry = document.items.find((item) => item.id === id);
      if (!inquiry) throw new InquiryError("Project inquiry not found.", 404);

      inquiry.status = status;
      inquiry.statusChangedAt = new Date().toISOString();
      return { ...inquiry };
    });
  }

  async remove(id) {
    return this.#mutate((document) => {
      const index = document.items.findIndex((item) => item.id === id);
      if (index === -1) throw new InquiryError("Project inquiry not found.", 404);
      const [removed] = document.items.splice(index, 1);
      return removed;
    });
  }
}

export const inquiryRepository = new JsonInquiryRepository();
export { INQUIRIES_FILE, INQUIRIES_BACKUP_FILE, INQUIRY_STATUSES };
