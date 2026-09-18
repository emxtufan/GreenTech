import { isMobileDevice } from "./devicePerformance.js";

// Sends one visit beacon per browser session with the utm_* tags of the
// landing URL. No cookies, no identifiers: the server only keeps counts.
const SESSION_KEY = "gtp-visit-sent";

function alreadySent() {
  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return true;
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage blocked (private mode): fall back to a per-load flag.
    if (window.__gtpVisitSent) return true;
    window.__gtpVisitSent = true;
  }
  return false;
}

export function trackVisit() {
  if (typeof window === "undefined" || window.navigator?.webdriver) return;
  if (alreadySent()) return;

  const params = new URLSearchParams(window.location.search);
  const payload = JSON.stringify({
    source: params.get("utm_source") || "",
    medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
    referrer: document.referrer || "",
    path: window.location.pathname,
    device: isMobileDevice() ? "mobile" : "desktop",
    locale: document.documentElement.lang || window.navigator.language || "",
  });

  try {
    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: payload,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    window.navigator.sendBeacon?.("/api/visits", payload);
  }
}
