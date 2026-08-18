// Structural validation for the centralised site content document.
// Deliberately dependency-free: the project ships no validation library and
// the shape is small enough that hand-rolled checks stay readable.

export const CONTENT_VERSION = 1;

export const CONTENT_GROUPS = [
  "sections",
  "processCards",
  "horizontalGallery",
  "photoGallery",
  "heroCards",
  "impactStats",
  "clientLogos",
  "credentials",
  "footprintCountries",
  "qualityPoints",
  "testimonials",
  "faqs",
  "footer",
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
  validateAssetPath(value, label, issues, "image");
}

function validateAssetPath(value, label, issues, assetName) {
  if (value === undefined || value === null || value === "") return;

  if (typeof value !== "string") {
    issues.push(`${label}: ${assetName} URL must be a string`);
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

export function validateVideoPath(value, label, issues) {
  validateAssetPath(value, label, issues, "video");
}

function validateActionUrl(value, label, issues) {
  if (value === undefined || value === null || value === "") return;

  if (typeof value !== "string") {
    issues.push(`${label}: action URL must be a string`);
    return;
  }

  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return;
  if (url.startsWith("#") || url.startsWith("?")) return;

  try {
    const parsed = new URL(url);
    if (["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) return;
  } catch {
    // Fall through to the common validation message below.
  }

  issues.push(
    `${label}: use a site path beginning with "/", "#" or "?", or a valid http(s), mailto or tel URL`,
  );
}

function validateSectionAction(section, label, issues) {
  const modes = new Set(["builtin", "link", "modal"]);
  if (section.actionMode !== undefined && !modes.has(section.actionMode)) {
    issues.push(`${label}.actionMode: must be "builtin", "link" or "modal"`);
  }

  validateActionUrl(section.actionUrl, `${label}.actionUrl`, issues);

  if (section.actionModal === undefined) return;
  if (!isPlainObject(section.actionModal)) {
    issues.push(`${label}.actionModal: expected an object`);
    return;
  }

  for (const key of ["eyebrow", "title", "description", "ctaLabel", "ctaUrl"]) {
    const value = section.actionModal[key];
    if (value !== undefined && typeof value !== "string") {
      issues.push(`${label}.actionModal.${key}: must be a string`);
    }
  }

  validateActionUrl(
    section.actionModal.ctaUrl,
    `${label}.actionModal.ctaUrl`,
    issues,
  );
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

function validateCoordinate(value, label, minimum, maximum, issues) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${label}: must be a number`);
    return;
  }

  if (value < minimum || value > maximum) {
    issues.push(`${label}: must be between ${minimum} and ${maximum}`);
  }
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

    if (item.id === "company-video") {
      validateVideoPath(item.videoUrl, `${label}.videoUrl`, issues);
    }

    validateSectionAction(item, label, issues);
  });

  validateItems(content.processCards?.items, "processCards.items", issues);

  validateItems(content.photoGallery?.items, "photoGallery.items", issues, (item, label) => {
    validateImagePath(item.src, `${label}.src`, issues);
    if (item.originalName !== undefined && typeof item.originalName !== "string") {
      issues.push(`${label}.originalName: must be a string`);
    }
  });

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

  const footprintCodes = new Set();
  validateItems(
    content.footprintCountries?.items,
    "footprintCountries.items",
    issues,
    (country, label) => {
      if (country.enabled === false) return;

      if (typeof country.name !== "string" || country.name.trim() === "") {
        issues.push(`${label}.name: must be a non-empty string`);
      }

      const code = typeof country.code === "string" ? country.code.trim().toUpperCase() : "";
      if (!/^[A-Z]{2}$/.test(code)) {
        issues.push(`${label}.code: must be a two-letter ISO country code`);
      } else if (footprintCodes.has(code)) {
        issues.push(`${label}.code: duplicate country code "${code}"`);
      } else {
        footprintCodes.add(code);
      }

      if (
        country.iso3 !== undefined
        && country.iso3 !== ""
        && !/^[A-Z]{3}$/.test(String(country.iso3).trim().toUpperCase())
      ) {
        issues.push(`${label}.iso3: must be a three-letter ISO country code`);
      }

      if (
        country.atlasId !== undefined
        && country.atlasId !== ""
        && !/^\d{1,3}$/.test(String(country.atlasId))
      ) {
        issues.push(`${label}.atlasId: must be a numeric ISO country ID`);
      }

      if (!Array.isArray(country.cities) || country.cities.length === 0) {
        issues.push(`${label}.cities: add at least one project location`);
        return;
      }

      validateItems(country.cities, `${label}.cities`, issues, (city, cityLabel) => {
        if (typeof city.name !== "string" || city.name.trim() === "") {
          issues.push(`${cityLabel}.name: must be a non-empty string`);
        }
        validateCoordinate(city.longitude, `${cityLabel}.longitude`, -180, 180, issues);
        validateCoordinate(city.latitude, `${cityLabel}.latitude`, -90, 90, issues);
      });
    },
  );

  validateItems(content.qualityPoints?.items, "qualityPoints.items", issues);

  validateItems(content.faqs?.items, "faqs.items", issues, (item, label) => {
    if (typeof item.question !== "string" || item.question.trim() === "") {
      issues.push(`${label}: "question" must be a non-empty string`);
    }
    if (typeof item.answer !== "string" || item.answer.trim() === "") {
      issues.push(`${label}: "answer" must be a non-empty string`);
    }
  });

  validateItems(content.footer?.links, "footer.links", issues, (item, label) => {
    const href = typeof item.href === "string" ? item.href.trim() : "";
    if (href === "") {
      issues.push(`${label}: "href" must be a non-empty string`);
    } else if (
      !href.startsWith("#")
      && !href.startsWith("/")
      && !/^modal:(privacy|terms)$/.test(href)
      && !/^https?:\/\//i.test(href)
      && !/^(mailto|tel):/i.test(href)
    ) {
      issues.push(
        `${label}.href: use #anchor, /path, modal:privacy, modal:terms, or an http(s), mailto or tel URL`,
      );
    }
    if (typeof item.group !== "string" || item.group.trim() === "") {
      issues.push(`${label}: "group" must be a non-empty string`);
    }
  });

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
    photoGallery: { items: [], ...(source.photoGallery || {}) },
    heroCards: { items: [], ...(source.heroCards || {}) },
    impactStats: { items: [], ...(source.impactStats || {}) },
    clientLogos: { items: [], ...(source.clientLogos || {}) },
    credentials: { items: [], ...(source.credentials || {}) },
    footprintCountries: { items: [], ...(source.footprintCountries || {}) },
    qualityPoints: { items: [], ...(source.qualityPoints || {}) },
    testimonials: { items: [], ...(source.testimonials || {}) },
    faqs: { items: [], ...(source.faqs || {}) },
    footer: { links: [], ...(source.footer || {}) },
    blog: { posts: [], ...(source.blog || {}) },
  };
}

export { ValidationError };
