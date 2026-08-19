import { randomUUID } from "node:crypto";
import path from "node:path";
import { createDocumentStore } from "./persistence.js";
import { DATA_DIR, SEED_DATA_DIR } from "./storagePaths.js";

const REVIEWS_FILE = path.join(DATA_DIR, "customer-reviews.json");
const REVIEWS_BACKUP_FILE = path.join(DATA_DIR, "customer-reviews.backup.json");
const REVIEWS_SEED_FILE = path.join(SEED_DATA_DIR, "customer-reviews.json");
const REVIEW_STATUSES = new Set(["pending", "approved", "rejected"]);
const MAX_REVIEWS = 2000;

export class ReviewError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ReviewError";
    this.statusCode = statusCode;
  }
}

const compactText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const reviewText = (value) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\t\f\v]+/g, " ")
  .trim();

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function normaliseSubmission(input) {
  const author = compactText(input?.name);
  const email = compactText(input?.email).toLowerCase();
  const quote = reviewText(input?.quote);
  const rating = Number(input?.rating);

  if (author.length < 2 || author.length > 60) {
    throw new ReviewError("Please enter a name between 2 and 60 characters.");
  }

  if (
    email.length > 160
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new ReviewError("Please enter a valid email address.");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewError("Please select a rating from 1 to 5 stars.");
  }

  if (quote.length < 10 || quote.length > 420) {
    throw new ReviewError("The review must contain between 10 and 420 characters.");
  }

  if (input?.consent !== true) {
    throw new ReviewError("Consent is required before submitting a review.");
  }

  return { author, email, quote, rating };
}

function validateDocument(document) {
  if (!document || !Array.isArray(document.items)) {
    throw new ReviewError("The review store is not valid.", 500);
  }

  const ids = new Set();
  for (const review of document.items) {
    if (!review?.id || ids.has(review.id)) {
      throw new ReviewError("The review store contains an invalid or duplicate ID.", 500);
    }
    ids.add(review.id);

    if (!REVIEW_STATUSES.has(review.status)) {
      throw new ReviewError(`Review ${review.id} has an invalid status.`, 500);
    }
  }
}

function sortNewestFirst(items) {
  return [...items].sort((first, second) => (
    Date.parse(second.submittedAt || 0) - Date.parse(first.submittedAt || 0)
  ));
}

export function mergeApprovedReviews(content, approvedReviews) {
  const existing = Array.isArray(content?.testimonials?.items)
    ? content.testimonials.items
    : [];
  const existingIds = new Set(existing.map((review) => review.id));
  const firstOrder = existing.reduce(
    (maximum, review) => Math.max(maximum, Number(review.order) || 0),
    0,
  );
  const submitted = approvedReviews
    .filter((review) => !review.demo && !existingIds.has(review.id))
    .map((review, index) => ({
      id: review.id,
      order: firstOrder + index + 1,
      enabled: true,
      author: review.author,
      role: "Customer review",
      quote: review.quote,
      rating: review.rating,
      avatarText: initials(review.author),
      verified: false,
      submittedAt: review.submittedAt,
    }));

  return {
    ...content,
    testimonials: {
      ...(content.testimonials || {}),
      items: [...existing, ...submitted],
    },
  };
}

export class JsonReviewRepository {
  #store;
  #writeQueue = Promise.resolve();

  constructor({
    file = REVIEWS_FILE,
    backup = REVIEWS_BACKUP_FILE,
    seedFile = file === REVIEWS_FILE ? REVIEWS_SEED_FILE : undefined,
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
    const document = await this.#read();
    return sortNewestFirst(document.items);
  }

  async getApproved() {
    return (await this.getAll()).filter((review) => (
      review.status === "approved" && review.demo !== true
    ));
  }

  async submit(input) {
    const submission = normaliseSubmission(input);

    return this.#mutate((document) => {
      const duplicate = document.items.some((review) => (
        review.status !== "rejected"
        && review.email === submission.email
        && review.quote.toLowerCase() === submission.quote.toLowerCase()
      ));
      if (duplicate) {
        throw new ReviewError("This review has already been submitted.", 409);
      }

      if (document.items.length >= MAX_REVIEWS) {
        throw new ReviewError("The review queue is currently full. Please try again later.", 503);
      }

      const submittedAt = new Date().toISOString();
      const review = {
        id: `customer-${randomUUID()}`,
        status: "pending",
        author: submission.author,
        email: submission.email,
        quote: submission.quote,
        rating: submission.rating,
        submittedAt,
        consentAt: submittedAt,
        moderatedAt: null,
      };

      document.items.unshift(review);
      return { id: review.id, status: review.status };
    });
  }

  async setStatus(id, status) {
    if (!REVIEW_STATUSES.has(status)) {
      throw new ReviewError("Review status must be pending, approved or rejected.");
    }

    return this.#mutate((document) => {
      const review = document.items.find((item) => item.id === id);
      if (!review) throw new ReviewError("Review not found.", 404);
      if (review.demo === true && status === "approved") {
        throw new ReviewError("Demo reviews cannot be published.");
      }

      review.status = status;
      review.moderatedAt = status === "pending" ? null : new Date().toISOString();
      return { ...review };
    });
  }

  async remove(id) {
    return this.#mutate((document) => {
      const index = document.items.findIndex((item) => item.id === id);
      if (index === -1) throw new ReviewError("Review not found.", 404);
      const [removed] = document.items.splice(index, 1);
      return removed;
    });
  }
}

export const reviewRepository = new JsonReviewRepository();
export { REVIEWS_FILE, REVIEWS_BACKUP_FILE, REVIEW_STATUSES };
