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
 * Copy for one homepage section. Components pass their own markup as fallback,
 * so an empty admin field or a missing entry keeps the shipped wording rather
 * than rendering a blank heading.
 */
export const selectSection = (id, content = current) =>
  asArray(content?.sections).find((section) => section.id === id) ?? null;

export const sectionText = (section, field, fallback = "") => {
  const value = section?.[field];
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
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

export const selectQualityPoints = (content = current) =>
  enabledInOrder(content?.qualityPoints?.items);

export const selectTestimonials = (content = current) =>
  enabledInOrder(content?.testimonials?.items);

export const selectBlogPosts = (content = current) =>
  enabledInOrder(content?.blog?.posts).filter((post) => post.status !== "draft");

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
