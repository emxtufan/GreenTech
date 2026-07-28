// Structural validation for the centralised site content document.
// Deliberately dependency-free: the project ships no validation library and
// the shape is small enough that hand-rolled checks stay readable.

export const CONTENT_VERSION = 1;

export const CONTENT_GROUPS = [
  "sections",
  "processCards",
  "horizontalGallery",
  "heroCards",
  "impactStats",
  "clientLogos",
  "credentials",
  "qualityPoints",
  "testimonials",
  "blog",
];

const REJECTED_IMAGE_PATTERNS = [
  { test: /^data:/i, reason: "base64 data URI" },
  { test: /^blob:/i, reason: "blob URL" },
  { test: /^[a-zA-Z]:[\\/]/, reason: "absolute local path" },
  { test: /^file:/i, reason: "file:// URL" },
  { test: /\\/, reason: "backslash in path" },
  { test: /\.\./, reason: "parent directory traversal" },
];

class ValidationError extends Error {
  constructor(issues) {
    super(`Content validation failed:\n- ${issues.join("\n- ")}`);
    this.name = "ValidationError";
    this.issues = issues;
    this.statusCode = 400;
  }
}

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Image fields must hold a site-relative path (or an absolute http(s) URL for
 * assets that genuinely live off-site). Everything the admin could accidentally
 * paste in — data URIs, blob URLs, `C:\Users\...` — is rejected here so it can
 * never reach the JSON file.
 */
export function validateImagePath(value, label, issues) {
  if (value === undefined || value === null || value === "") return;

  if (typeof value !== "string") {
    issues.push(`${label}: image must be a string`);
    return;
  }

  for (const { test, reason } of REJECTED_IMAGE_PATTERNS) {
    if (test.test(value)) {
      issues.push(`${label}: ${reason} is not allowed ("${value.slice(0, 40)}")`);
      return;
    }
  }

  if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) {
    issues.push(`${label}: must start with "/" or be an http(s) URL ("${value}")`);
  }
}

function validateItems(items, label, issues, validateItem) {
  if (!Array.isArray(items)) {
    issues.push(`${label}: expected an array`);
    return;
  }

  const seenIds = new Set();

  items.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;

    if (!isPlainObject(item)) {
      issues.push(`${itemLabel}: expected an object`);
      return;
    }

    if (typeof item.id !== "string" || item.id.trim() === "") {
      issues.push(`${itemLabel}: "id" must be a non-empty string`);
    } else if (seenIds.has(item.id)) {
      issues.push(`${itemLabel}: duplicate id "${item.id}"`);
    } else {
      seenIds.add(item.id);
    }

    if (item.order !== undefined && !Number.isFinite(item.order)) {
      issues.push(`${itemLabel}: "order" must be a number`);
    }

    if (item.enabled !== undefined && typeof item.enabled !== "boolean") {
      issues.push(`${itemLabel}: "enabled" must be a boolean`);
    }

    validateItem?.(item, itemLabel, issues);
  });
}

export function validateContent(content) {
  const issues = [];

  if (!isPlainObject(content)) {
    throw new ValidationError(["root: expected a JSON object"]);
  }

  if (content.version !== undefined && !Number.isInteger(content.version)) {
    issues.push('root: "version" must be an integer');
  }

  validateItems(content.sections, "sections", issues, (item, label) => {
    if (item.visible !== undefined && typeof item.visible !== "boolean") {
      issues.push(`${label}: "visible" must be a boolean`);
    }
  });

  validateItems(content.processCards?.items, "processCards.items", issues);

  validateItems(content.heroCards?.items, "heroCards.items", issues, (item, label) => {
    if (item.sourceIndex !== undefined && !Number.isInteger(item.sourceIndex)) {
      issues.push(`${label}: "sourceIndex" must be an integer`);
    }
  });

  validateItems(content.impactStats?.items, "impactStats.items", issues);

  validateItems(content.clientLogos?.items, "clientLogos.items", issues, (item, label) => {
    validateImagePath(item.image, `${label}.image`, issues);
  });

  validateItems(content.credentials?.items, "credentials.items", issues);

  validateItems(content.qualityPoints?.items, "qualityPoints.items", issues);

  validateItems(content.testimonials?.items, "testimonials.items", issues, (item, label) => {
    validateImagePath(item.image, `${label}.image`, issues);
    if (item.rating !== undefined && !Number.isFinite(item.rating)) {
      issues.push(`${label}: "rating" must be a number`);
    }
  });

  validateItems(
    content.horizontalGallery?.items,
    "horizontalGallery.items",
    issues,
    (item, label) => {
      validateImagePath(item.image, `${label}.image`, issues);

      // The detail page carries its own photo list, so those paths need the
      // same guarantees as the card image.
      if (item.gallery !== undefined) {
        if (!Array.isArray(item.gallery)) {
          issues.push(`${label}.gallery: expected an array`);
        } else {
          item.gallery.forEach((photo, index) => {
            validateImagePath(photo?.src, `${label}.gallery[${index}].src`, issues);
          });
        }
      }

      if (item.scope !== undefined && !Array.isArray(item.scope)) {
        issues.push(`${label}.scope: expected an array`);
      }
    },
  );

  const slugs = new Set();
  validateItems(content.blog?.posts, "blog.posts", issues, (item, label) => {
    validateImagePath(item.image, `${label}.image`, issues);

    if (item.slug !== undefined) {
      if (typeof item.slug !== "string" || item.slug.trim() === "") {
        issues.push(`${label}: "slug" must be a non-empty string`);
      } else if (slugs.has(item.slug)) {
        issues.push(`${label}: duplicate slug "${item.slug}"`);
      } else {
        slugs.add(item.slug);
      }
    }
  });

  if (issues.length > 0) throw new ValidationError(issues);

  return content;
}

/** Fills in the groups the site expects so a partial file cannot crash a render. */
export function withDefaults(content) {
  const source = isPlainObject(content) ? content : {};

  return {
    version: CONTENT_VERSION,
    ...source,
    sections: Array.isArray(source.sections) ? source.sections : [],
    processCards: { items: [], ...(source.processCards || {}) },
    horizontalGallery: { items: [], ...(source.horizontalGallery || {}) },
    heroCards: { items: [], ...(source.heroCards || {}) },
    impactStats: { items: [], ...(source.impactStats || {}) },
    clientLogos: { items: [], ...(source.clientLogos || {}) },
    credentials: { items: [], ...(source.credentials || {}) },
    qualityPoints: { items: [], ...(source.qualityPoints || {}) },
    testimonials: { items: [], ...(source.testimonials || {}) },
    blog: { posts: [], ...(source.blog || {}) },
  };
}

export { ValidationError };
