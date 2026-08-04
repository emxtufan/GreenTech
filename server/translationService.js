import { createHash } from "node:crypto";
import path from "node:path";
import { createDocumentStore } from "./persistence.js";
import { TRANSLATIONS_DIR } from "./storagePaths.js";

export const DEFAULT_LOCALE = "en";

const SITE_LOCALES = ["en", "ro", "it", "es"];
const DEEPL_LOCALES = new Set(SITE_LOCALES);
const configuredSourceLocale = String(process.env.CONTENT_SOURCE_LOCALE || "auto")
  .trim()
  .toLowerCase()
  .replace("_", "-")
  .split("-")[0];

// Admin content can contain both Romanian and older English copy. Automatic
// detection lets every public locale, including EN, have its own snapshot.
export const SOURCE_LOCALE = configuredSourceLocale === "auto"
  || DEEPL_LOCALES.has(configuredSourceLocale)
  ? configuredSourceLocale
  : "auto";

const hasConcreteSourceLocale = DEEPL_LOCALES.has(SOURCE_LOCALE);

const DEFAULT_TARGET_LOCALES = SITE_LOCALES.filter((locale) => (
  !hasConcreteSourceLocale || locale !== SOURCE_LOCALE
));
const BATCH_TEXT_LIMIT = 40;
const BATCH_CHARACTER_LIMIT = 80_000;
// Increment when extraction rules change so stale server snapshots and browser
// caches cannot keep a translation produced by older rules.
const CACHE_VERSION = 4;
const PROTECTED_TERMS = [
  "GreenTech Professionals SRL",
  "GreenTech Professionals",
  "GreenTech PRO",
];

const SKIPPED_KEYS = new Set([
  "id",
  "slug",
  "href",
  "url",
  "src",
  "image",
  "icon",
  "source",
  "format",
  "summary",
  "actionMode",
  "actionUrl",
  "ctaUrl",
  "sourceUrl",
  "videoUrl",
  "relatedProjectId",
  "code",
  "iso3",
  "atlasId",
  "theme",
  "status",
  "email",
  "phone",
  "number",
  "avatarText",
  "author",
  "date",
  "submittedAt",
  "updatedAt",
  "capacity",
  "capacityKw",
]);

const requestedTargets = String(
  process.env.TRANSLATION_LOCALES || DEFAULT_TARGET_LOCALES.join(","),
)
  .split(",")
  .map((locale) => locale.trim().toLowerCase().split("-")[0])
  .filter((locale, index, locales) => (
    DEEPL_LOCALES.has(locale)
    && (!hasConcreteSourceLocale || locale !== SOURCE_LOCALE)
    && locales.indexOf(locale) === index
  ));

// Add English even when an older production .env still contains
// TRANSLATION_LOCALES=ro,it,es. This makes the migration self-contained.
const configuredTargets = [...new Set([
  ...(SOURCE_LOCALE === DEFAULT_LOCALE ? [] : [DEFAULT_LOCALE]),
  ...requestedTargets,
])];

export const SUPPORTED_LOCALES = [...SITE_LOCALES];

const phraseStore = createDocumentStore({
  file: path.join(TRANSLATIONS_DIR, "phrase-cache.json"),
  backup: path.join(TRANSLATIONS_DIR, "phrase-cache.backup.json"),
  defaultValue: { version: CACHE_VERSION, locales: {} },
});

const snapshotStores = new Map();
const translationJobs = new Map();
let phraseCachePromise = null;
let phraseWriteQueue = Promise.resolve();

function snapshotStore(locale) {
  if (!snapshotStores.has(locale)) {
    snapshotStores.set(locale, createDocumentStore({
      file: path.join(TRANSLATIONS_DIR, `site-content.${locale}.json`),
      backup: path.join(TRANSLATIONS_DIR, `site-content.${locale}.backup.json`),
      defaultValue: null,
    }));
  }

  return snapshotStores.get(locale);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function contentRevision(content) {
  return hash(`${CACHE_VERSION}:${SOURCE_LOCALE}:${JSON.stringify(content)}`).slice(0, 24);
}

function phraseCacheKey(sourceText) {
  return hash(`${SOURCE_LOCALE}:${sourceText}`);
}

export function normaliseLocale(value) {
  const locale = String(value || DEFAULT_LOCALE)
    .trim()
    .toLowerCase()
    .replace("_", "-")
    .split("-")[0];

  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function translationProviderConfigured() {
  return Boolean(String(process.env.DEEPL_API_KEY || "").trim());
}

function looksLikeTechnicalValue(value) {
  return (
    /^(?:https?:\/\/|mailto:|tel:|\/|#|\?)/i.test(value)
    || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    || /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)
    // Numeric measurements are data, not prose. Keeping the complete value
    // intact also prevents DeepL from turning `1.5 GW+` into `over 15 GW`.
    || /^[€$£]?\s*-?\d[\d.,]*\s*(?:(?:[kMGT]?W(?:h)?|[kMGT]?VA|[kMGT]|V|A|m²|%)\s*)?\+?$/i.test(value)
  );
}

function shouldTranslate(key, value) {
  const text = value.trim();
  if (!text || !/\p{L}/u.test(text)) return false;
  if (SKIPPED_KEYS.has(key) || /(?:Url|Href|Path)$/i.test(key)) return false;
  return !looksLikeTechnicalValue(text);
}

function collectTextReferences(value, references = [], key = "", parent = null) {
  if (typeof value === "string") {
    if (parent && shouldTranslate(key, value)) {
      references.push({ parent, key, source: value });
    }
    return references;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTextReferences(item, references, String(index), value));
    return references;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, child]) => (
      collectTextReferences(child, references, childKey, value)
    ));
  }

  return references;
}

function protectTerms(text) {
  const replacements = [];
  let protectedText = text;

  PROTECTED_TERMS.forEach((term) => {
    if (!protectedText.includes(term)) return;
    const token = `ZXQGTP${replacements.length}QXZ`;
    protectedText = protectedText.split(term).join(token);
    replacements.push({ token, term });
  });

  return { protectedText, replacements };
}

function restoreTerms(text, replacements) {
  let restored = text;
  for (const { token, term } of replacements) {
    const tokenPattern = new RegExp(token, "gi");
    if (!tokenPattern.test(restored)) return null;
    restored = restored.replace(tokenPattern, term);
  }
  return restored;
}

function deepLApiUrl() {
  const configured = String(process.env.DEEPL_API_URL || "").trim();
  if (configured) return configured;
  return String(process.env.DEEPL_API_KEY || "").trim().endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

async function translateWithDeepL(texts, locale) {
  const apiKey = String(process.env.DEEPL_API_KEY || "").trim();
  if (!apiKey) throw new Error("DEEPL_API_KEY is not configured.");

  const requestBody = {
    text: texts,
    target_lang: locale.toUpperCase(),
    preserve_formatting: true,
    context: "GreenTech Professionals photovoltaic, electrical and construction company website.",
  };

  if (hasConcreteSourceLocale) {
    requestBody.source_lang = SOURCE_LOCALE.toUpperCase();
  }

  const response = await fetch(deepLApiUrl(), {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `DeepL translation failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
    );
  }

  const payload = await response.json();
  const translations = Array.isArray(payload?.translations)
    ? payload.translations.map((item) => item?.text)
    : [];

  if (translations.length !== texts.length || translations.some((text) => typeof text !== "string")) {
    throw new Error("DeepL returned an incomplete translation batch.");
  }

  return translations;
}

function createBatches(items) {
  const batches = [];
  let batch = [];
  let characters = 0;

  for (const item of items) {
    if (
      batch.length
      && (batch.length >= BATCH_TEXT_LIMIT || characters + item.text.length > BATCH_CHARACTER_LIMIT)
    ) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(item);
    characters += item.text.length;
  }

  if (batch.length) batches.push(batch);
  return batches;
}

async function readPhraseCache() {
  phraseCachePromise ??= phraseStore.read()
    .then((document) => ({
      version: CACHE_VERSION,
      locales: document?.version === CACHE_VERSION
        && document?.locales
        && typeof document.locales === "object"
        ? document.locales
        : {},
    }))
    .catch((error) => {
      phraseCachePromise = null;
      throw error;
    });
  return phraseCachePromise;
}

function savePhraseCache(document) {
  const run = phraseWriteQueue.then(() => phraseStore.write(document));
  phraseWriteQueue = run.catch(() => {});
  return run;
}

async function translateDocument(source, locale, translateBatch = translateWithDeepL) {
  const translated = structuredClone(source);
  const references = collectTextReferences(translated);
  const uniqueSources = [...new Set(references.map((reference) => reference.source))];
  const phraseCache = await readPhraseCache();
  phraseCache.locales[locale] ??= {};
  const localeCache = phraseCache.locales[locale];

  const missing = uniqueSources
    .map((sourceText) => {
      const cacheKey = phraseCacheKey(sourceText);
      const cached = localeCache[cacheKey];
      if (cached?.source === sourceText && typeof cached.translation === "string") return null;
      const { protectedText, replacements } = protectTerms(sourceText);
      return { cacheKey, sourceText, text: protectedText, replacements };
    })
    .filter(Boolean);

  for (const batch of createBatches(missing)) {
    const results = await translateBatch(batch.map((item) => item.text), locale);
    batch.forEach((item, index) => {
      const restored = restoreTerms(results[index], item.replacements);
      localeCache[item.cacheKey] = {
        source: item.sourceText,
        // Preserve the English phrase if a provider ever mutates a protected
        // company token; a broken brand name is worse than a local fallback.
        translation: restored ?? item.sourceText,
      };
    });
  }

  if (missing.length) await savePhraseCache(phraseCache);

  for (const reference of references) {
    const cached = localeCache[phraseCacheKey(reference.source)];
    if (cached?.source === reference.source) {
      reference.parent[reference.key] = cached.translation;
    }
  }

  return translated;
}

async function readSnapshot(locale, revision) {
  const snapshot = await snapshotStore(locale).read();
  if (
    snapshot?.version === CACHE_VERSION
    && snapshot.revision === revision
    && snapshot.content
  ) {
    return snapshot.content;
  }
  return null;
}

async function createTranslation(source, locale, revision, translateBatch) {
  const content = await translateDocument(source, locale, translateBatch);
  await snapshotStore(locale).write({
    version: CACHE_VERSION,
    locale,
    revision,
    translatedAt: new Date().toISOString(),
    content,
  });
  return content;
}

/**
 * Returns a translated public document, or the authored source when translation
 * is temporarily unavailable. Calls for the same revision share one job.
 */
export async function localiseContent(source, requestedLocale, options = {}) {
  const locale = normaliseLocale(requestedLocale);
  const revision = contentRevision(source);

  if (hasConcreteSourceLocale && locale === SOURCE_LOCALE) {
    return { content: source, locale, revision, status: "source" };
  }

  const cached = await readSnapshot(locale, revision);
  if (cached) return { content: cached, locale, revision, status: "cached" };

  if (!translationProviderConfigured() && !options.translateBatch) {
    return {
      content: source,
      locale: hasConcreteSourceLocale ? SOURCE_LOCALE : DEFAULT_LOCALE,
      requestedLocale: locale,
      revision,
      status: "fallback",
    };
  }

  const jobKey = `${revision}:${locale}`;
  if (!translationJobs.has(jobKey)) {
    const job = createTranslation(source, locale, revision, options.translateBatch)
      .finally(() => translationJobs.delete(jobKey));
    translationJobs.set(jobKey, job);
  }

  try {
    const content = await translationJobs.get(jobKey);
    return { content, locale, revision, status: "translated" };
  } catch (error) {
    console.error(`[Translation] ${locale.toUpperCase()} failed:`, error.message);
    return {
      content: source,
      locale: hasConcreteSourceLocale ? SOURCE_LOCALE : DEFAULT_LOCALE,
      requestedLocale: locale,
      revision,
      status: "fallback",
    };
  }
}

export function translationMeta(content) {
  return {
    revision: contentRevision(content),
    updatedAt: content?.updatedAt || null,
    defaultLocale: DEFAULT_LOCALE,
    sourceLocale: SOURCE_LOCALE,
    supportedLocales: SUPPORTED_LOCALES,
    providerConfigured: translationProviderConfigured(),
  };
}

export function scheduleTranslationWarmup(content) {
  if (!translationProviderConfigured()) return;

  setImmediate(() => {
    Promise.allSettled(
      configuredTargets.map((locale) => localiseContent(content, locale)),
    ).then((results) => {
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `[Translation] Warmup for ${configuredTargets[index].toUpperCase()} failed:`,
            result.reason,
          );
        }
      });
    });
  });
}

// Exposed for deterministic tests without contacting an external service.
export const translationTesting = { collectTextReferences, translateDocument };
