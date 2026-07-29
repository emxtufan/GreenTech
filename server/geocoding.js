const GEOCODER_URL = process.env.GEOCODER_URL
  || "https://nominatim.openstreetmap.org/search";
const GEOCODER_USER_AGENT = process.env.GEOCODER_USER_AGENT
  || "GreenTechProfessionalsAdmin/1.0 (+https://greentechpro.ro)";
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAX_CACHE_ENTRIES = 500;

const resultCache = new Map();
const pendingRequests = new Map();
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

export class GeocodingError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "GeocodingError";
    this.statusCode = statusCode;
  }
}

function normalizeQuery(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeResult(entry) {
  const latitude = Number(entry?.lat);
  const longitude = Number(entry?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const normalizedLatitude = Number(latitude.toFixed(6));
  const normalizedLongitude = Number(longitude.toFixed(6));

  return {
    displayName: String(entry.display_name || "").trim(),
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
    // GeoJSON order is always longitude first, latitude second.
    coordinates: [normalizedLongitude, normalizedLatitude],
    osmType: String(entry.osm_type || ""),
    osmId: entry.osm_id ?? null,
  };
}

function runRateLimited(task) {
  const request = requestQueue.then(async () => {
    const waitFor = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (waitFor > 0) await sleep(waitFor);

    lastRequestAt = Date.now();
    return task();
  });

  requestQueue = request.catch(() => undefined);
  return request;
}

async function requestLocation(query, countryCode) {
  const url = new URL(GEOCODER_URL);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    layer: "address",
    countrycodes: countryCode.toLowerCase(),
  });

  let response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en,ro;q=0.9",
        "User-Agent": GEOCODER_USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error instanceof GeocodingError) throw error;
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new GeocodingError(
      timedOut
        ? "The location search timed out. Please try again."
        : "The location service is currently unavailable.",
      timedOut ? 504 : 502,
    );
  }

  if (!response.ok) {
    const unavailable = response.status === 429 || response.status >= 500;
    throw new GeocodingError(
      unavailable
        ? "The location service is busy. Please wait a moment and try again."
        : "The location service rejected this search.",
      unavailable ? 503 : 502,
    );
  }

  const payload = await response.json().catch(() => null);
  const result = Array.isArray(payload)
    ? payload.map(normalizeResult).find(Boolean)
    : null;

  if (!result) {
    throw new GeocodingError(
      `No location named "${query}" was found in ${countryCode}.`,
      404,
    );
  }

  return result;
}

export async function geocodePlace({ query, countryCode }) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedCountryCode = String(countryCode ?? "").trim().toUpperCase();

  if (normalizedQuery.length < 2 || normalizedQuery.length > 160) {
    throw new GeocodingError("Enter a location name between 2 and 160 characters.");
  }

  if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
    throw new GeocodingError("Choose a country before searching for coordinates.");
  }

  const cacheKey = `${normalizedCountryCode}:${normalizedQuery.toLowerCase()}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return { result: cached, cached: true };

  const pending = pendingRequests.get(cacheKey);
  if (pending) return pending;

  const lookup = runRateLimited(async () => {
    const result = await requestLocation(normalizedQuery, normalizedCountryCode);

    if (resultCache.size >= MAX_CACHE_ENTRIES) {
      resultCache.delete(resultCache.keys().next().value);
    }
    resultCache.set(cacheKey, result);

    return { result, cached: false };
  }).finally(() => pendingRequests.delete(cacheKey));

  pendingRequests.set(cacheKey, lookup);
  return lookup;
}
