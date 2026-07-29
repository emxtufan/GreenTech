// Single content-loading layer for the public site.
//
// Components never import the JSON directly — they read through the selectors
// below. The bundled document is only a first-paint baseline; `fetchSiteContent`
// replaces it with whatever the server currently has on disk, which is what
// makes an admin save show up after a refresh in a production build.

import baseline from "../../data/site-content.json";

const CONTENT_ENDPOINT = "/api/content";

let current = baseline;

const asArray = (value) => (Array.isArray(value) ? value : []);

/** Repeatable sections share one ordering rule: drop disabled, sort by order. */
export const enabledInOrder = (items) =>
  asArray(items)
    .filter((item) => item?.enabled !== false)
    .sort((first, second) => (first?.order ?? 0) - (second?.order ?? 0));

export const selectSections = (content = current) =>
  enabledInOrder(content?.sections).filter((section) => section.visible !== false);

/**
 * Copy for one homepage section. A saved empty string is intentional and stays
 * empty; fallback copy is used only while a field is missing or malformed.
 */
export const selectSection = (id, content = current) =>
  asArray(content?.sections).find((section) => section.id === id) ?? null;

export const sectionText = (section, field, fallback = "") => {
  const value = section?.[field];
  if (typeof value !== "string") return fallback;
  return value.trim() === "" ? "" : value;
};

export const selectProcessCards = (content = current) =>
  enabledInOrder(content?.processCards?.items);

export const selectGalleryItems = (content = current) =>
  enabledInOrder(content?.horizontalGallery?.items);

export const selectHeroCards = (content = current) =>
  enabledInOrder(content?.heroCards?.items);

export const selectImpactStats = (content = current) =>
  enabledInOrder(content?.impactStats?.items);

export const selectClientLogos = (content = current) =>
  enabledInOrder(content?.clientLogos?.items);

export const selectCredentials = (content = current) =>
  enabledInOrder(content?.credentials?.items);

export const selectFootprintCountries = (content = current) =>
  enabledInOrder(content?.footprintCountries?.items);

export const selectQualityPoints = (content = current) =>
  enabledInOrder(content?.qualityPoints?.items);

export const selectTestimonials = (content = current) =>
  enabledInOrder(content?.testimonials?.items);

const blogPostTimestamp = (post) => {
  if (typeof post?.date !== "string" || !post.date.trim()) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(post.date);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

export const selectFaqs = (content = current) =>
  enabledInOrder(content?.faqs?.items);

export const selectFooter = (content = current) => content?.footer ?? {};

/** Footer links grouped by their `group` field, in declared order. */
export const selectFooterGroups = (content = current) => {
  const groups = new Map();

  for (const link of enabledInOrder(content?.footer?.links)) {
    const name = link.group?.trim() || "Links";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(link);
  }

  return [...groups].map(([title, links]) => ({ title, links }));
};

export const selectBlogPosts = (content = current) =>
  enabledInOrder(content?.blog?.posts)
    .filter((post) => post.status !== "draft")
    .sort((first, second) => (
      Number(Boolean(second.pinned)) - Number(Boolean(first.pinned))
      ||
      blogPostTimestamp(second) - blogPostTimestamp(first)
      || (first.order ?? 0) - (second.order ?? 0)
    ));

/** Synchronous access to the most recent content the app has seen. */
export const getSiteContent = () => current;

let inFlight = null;

/**
 * Several components ask for content on mount; they share one request rather
 * than each triggering their own. The `signal` only detaches this caller —
 * it does not cancel the shared request for everyone else.
 */
export function fetchSiteContent({ signal } = {}) {
  inFlight ??= fetch(CONTENT_ENDPOINT, { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`Content request failed (${response.status})`);
      return response.json();
    })
    .then((content) => {
      current = content;
      return content;
    })
    .finally(() => {
      inFlight = null;
    });

  const request = inFlight;

  if (!signal) return request;

  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export { baseline };
