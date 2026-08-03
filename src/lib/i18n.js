import { useSyncExternalStore } from "react";

export const DEFAULT_LOCALE = "en";
export const LOCALE_OPTIONS = [
  { value: "en", shortLabel: "EN", label: "English" },
  { value: "ro", shortLabel: "RO", label: "Rom\u00e2n\u0103" },
  { value: "it", shortLabel: "IT", label: "Italiano" },
  { value: "es", shortLabel: "ES", label: "Espa\u00f1ol" },
];

const LOCALE_STORAGE_KEY = "greentech.locale.v1";
const CONTENT_CACHE_PREFIX = "greentech.content.v1";
const SUPPORTED = new Set(LOCALE_OPTIONS.map((locale) => locale.value));
const subscribers = new Set();

const UI_COPY = {
  en: {
    company: "Company",
    services: "Services",
    photovoltaicParks: "Photovoltaic parks",
    electricalInspections: "Electrical inspections",
    constructionServices: "Construction services",
    dataCenterConstruction: "Data center construction",
    process: "Process",
    projects: "Projects",
    credentials: "Credentials",
    reviews: "Reviews",
    journal: "Journal",
    faqs: "FAQs",
    contact: "Contact",
    apply: "Apply",
    applyRole: "Apply for a role",
    sections: "Sections",
    allSections: "All sections",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    backToStart: "GreenTech Professionals - back to start",
    language: "Language",
  },
  ro: {
    company: "Companie",
    services: "Servicii",
    photovoltaicParks: "Parcuri fotovoltaice",
    electricalInspections: "Verific\u0103ri electrice",
    constructionServices: "Servicii de construc\u021bii",
    dataCenterConstruction: "Construc\u021bii centre de date",
    process: "Proces",
    projects: "Proiecte",
    credentials: "Certific\u0103ri",
    reviews: "Recenzii",
    journal: "Jurnal",
    faqs: "\u00centreb\u0103ri frecvente",
    contact: "Contact",
    apply: "Aplic\u0103",
    applyRole: "Aplic\u0103 pentru un post",
    sections: "Sec\u021biuni",
    allSections: "Toate sec\u021biunile",
    openMenu: "Deschide meniul",
    closeMenu: "\u00cenchide meniul",
    backToStart: "GreenTech Professionals - \u00eenapoi la \u00eenceput",
    language: "Limb\u0103",
  },
  it: {
    company: "Azienda",
    services: "Servizi",
    photovoltaicParks: "Parchi fotovoltaici",
    electricalInspections: "Ispezioni elettriche",
    constructionServices: "Servizi di costruzione",
    dataCenterConstruction: "Costruzione di data center",
    process: "Processo",
    projects: "Progetti",
    credentials: "Certificazioni",
    reviews: "Recensioni",
    journal: "Diario",
    faqs: "FAQ",
    contact: "Contatti",
    apply: "Candidati",
    applyRole: "Candidati per una posizione",
    sections: "Sezioni",
    allSections: "Tutte le sezioni",
    openMenu: "Apri menu",
    closeMenu: "Chiudi menu",
    backToStart: "GreenTech Professionals - torna all'inizio",
    language: "Lingua",
  },
  es: {
    company: "Empresa",
    services: "Servicios",
    photovoltaicParks: "Parques fotovoltaicos",
    electricalInspections: "Inspecciones el\u00e9ctricas",
    constructionServices: "Servicios de construcci\u00f3n",
    dataCenterConstruction: "Construcci\u00f3n de centros de datos",
    process: "Proceso",
    projects: "Proyectos",
    credentials: "Certificaciones",
    reviews: "Rese\u00f1as",
    journal: "Actualidad",
    faqs: "Preguntas frecuentes",
    contact: "Contacto",
    apply: "Postularse",
    applyRole: "Postularse a un puesto",
    sections: "Secciones",
    allSections: "Todas las secciones",
    openMenu: "Abrir men\u00fa",
    closeMenu: "Cerrar men\u00fa",
    backToStart: "GreenTech Professionals - volver al inicio",
    language: "Idioma",
  },
};

export function normaliseLocale(value) {
  const locale = String(value || "")
    .trim()
    .toLowerCase()
    .replace("_", "-")
    .split("-")[0];
  return SUPPORTED.has(locale) ? locale : DEFAULT_LOCALE;
}

function readStorage(key) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Safari private mode and full storage quotas must not block the site.
  }
}

function detectInitialLocale() {
  const saved = readStorage(LOCALE_STORAGE_KEY);
  const savedBase = String(saved || "").trim().toLowerCase().replace("_", "-").split("-")[0];
  if (SUPPORTED.has(savedBase)) return savedBase;
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const languages = [...(navigator.languages || []), navigator.language];
  for (const language of languages) {
    const base = String(language || "").trim().toLowerCase().replace("_", "-").split("-")[0];
    if (SUPPORTED.has(base)) return base;
  }
  return DEFAULT_LOCALE;
}

let currentLocale = detectInitialLocale();

function applyDocumentLanguage(locale) {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

applyDocumentLanguage(currentLocale);

export function getLocale() {
  return currentLocale;
}

export function setLocale(value) {
  const locale = normaliseLocale(value);
  writeStorage(LOCALE_STORAGE_KEY, locale);
  applyDocumentLanguage(locale);
  if (locale === currentLocale) return;
  currentLocale = locale;
  subscribers.forEach((notify) => notify());
}

export function subscribeLocale(notify) {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE);
}

export function uiText(key, locale = currentLocale) {
  return UI_COPY[normaliseLocale(locale)]?.[key] ?? UI_COPY.en[key] ?? key;
}

function contentCacheKey(locale) {
  return `${CONTENT_CACHE_PREFIX}.${normaliseLocale(locale)}`;
}

export function readCachedContent(locale) {
  const stored = readStorage(contentCacheKey(locale));
  if (!stored) return null;

  try {
    const cached = JSON.parse(stored);
    if (
      typeof cached?.revision !== "string"
      || !cached.content
      || typeof cached.content !== "object"
    ) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

export function writeCachedContent(locale, revision, content) {
  if (!revision || !content) return;
  writeStorage(contentCacheKey(locale), JSON.stringify({
    revision,
    savedAt: Date.now(),
    content,
  }));
}
