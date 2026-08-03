import { randomUUID } from "node:crypto";
import path from "node:path";
import { createDocumentStore } from "./persistence.js";
import { DATA_DIR, SEED_DATA_DIR } from "./storagePaths.js";

const SUBSCRIBERS_FILE = path.join(DATA_DIR, "newsletter-subscribers.json");
const SUBSCRIBERS_BACKUP_FILE = path.join(DATA_DIR, "newsletter-subscribers.backup.json");
const SUBSCRIBERS_SEED_FILE = path.join(SEED_DATA_DIR, "newsletter-subscribers.json");
const SUBSCRIBER_STATUSES = new Set(["active", "unsubscribed"]);
const MAX_SUBSCRIBERS = 20000;

export class SubscriberError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "SubscriberError";
    this.statusCode = statusCode;
  }
}

function normaliseEmail(input) {
  const email = String(input?.email ?? "").replace(/\s+/g, "").toLowerCase();

  // Permissive on purpose: the goal is catching typos, not refusing addresses
  // that a stricter pattern would wrongly reject.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    throw new SubscriberError("Please enter a valid email address.");
  }

  return email;
}

function validateDocument(document) {
  if (!document || !Array.isArray(document.items)) {
    throw new SubscriberError("The subscriber store is not valid.", 500);
  }

  const ids = new Set();
  for (const subscriber of document.items) {
    if (!subscriber?.id || ids.has(subscriber.id)) {
      throw new SubscriberError("The subscriber store has an invalid or duplicate ID.", 500);
    }
    ids.add(subscriber.id);

    if (!SUBSCRIBER_STATUSES.has(subscriber.status)) {
      throw new SubscriberError(`Subscriber ${subscriber.id} has an invalid status.`, 500);
    }
  }
}

const sortNewestFirst = (items) => [...items].sort((first, second) => (
  Date.parse(second.subscribedAt || 0) - Date.parse(first.subscribedAt || 0)
));

export class JsonSubscriberRepository {
  #store;
  #writeQueue = Promise.resolve();

  constructor({
    file = SUBSCRIBERS_FILE,
    backup = SUBSCRIBERS_BACKUP_FILE,
    seedFile = file === SUBSCRIBERS_FILE ? SUBSCRIBERS_SEED_FILE : undefined,
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

  async subscribe(input) {
    const email = normaliseEmail(input);

    return this.#mutate((document) => {
      const existing = document.items.find((item) => item.email === email);

      // Re-subscribing simply reactivates, and an already-active address is
      // reported as success so the form cannot be used to probe the list.
      if (existing) {
        if (existing.status === "unsubscribed") {
          existing.status = "active";
          existing.subscribedAt = new Date().toISOString();
        }
        return { id: existing.id, status: existing.status };
      }

      if (document.items.length >= MAX_SUBSCRIBERS) {
        throw new SubscriberError("The subscriber list is currently full.", 503);
      }

      const subscriber = {
        id: `subscriber-${randomUUID()}`,
        email,
        status: "active",
        subscribedAt: new Date().toISOString(),
        source: "footer",
      };

      document.items.unshift(subscriber);
      return { id: subscriber.id, status: subscriber.status };
    });
  }

  async setStatus(id, status) {
    if (!SUBSCRIBER_STATUSES.has(status)) {
      throw new SubscriberError("Status must be active or unsubscribed.");
    }

    return this.#mutate((document) => {
      const subscriber = document.items.find((item) => item.id === id);
      if (!subscriber) throw new SubscriberError("Subscriber not found.", 404);

      subscriber.status = status;
      subscriber.statusChangedAt = new Date().toISOString();
      return { ...subscriber };
    });
  }

  async remove(id) {
    return this.#mutate((document) => {
      const index = document.items.findIndex((item) => item.id === id);
      if (index === -1) throw new SubscriberError("Subscriber not found.", 404);
      const [removed] = document.items.splice(index, 1);
      return removed;
    });
  }
}

export const subscriberRepository = new JsonSubscriberRepository();
export { SUBSCRIBERS_FILE, SUBSCRIBERS_BACKUP_FILE, SUBSCRIBER_STATUSES };
