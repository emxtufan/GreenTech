import { createHmac, randomBytes, timingSafeEqual, scryptSync } from "node:crypto";

const COOKIE_NAME = "gtp_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const production = process.argv.includes("--production")
  || process.env.NODE_ENV === "production";

// A per-boot secret is fine for a single-instance deployment: the only cost of
// rotating it is that existing admin sessions end when the server restarts.
// Set SESSION_SECRET to keep sessions alive across restarts or to run replicas.
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

let adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  if (production) {
    throw new Error(
      "ADMIN_PASSWORD is required in production. Set it before starting the server.",
    );
  }

  adminPassword = randomBytes(9).toString("base64url");
  console.log(`\n  Admin password for this session: ${adminPassword}`);
  console.log("  Set ADMIN_PASSWORD in the environment to choose your own.\n");
}

// Compare against a fixed-length derived key so the check cost does not depend
// on how much of the supplied password happened to be correct.
const PASSWORD_SALT = randomBytes(16);
const expectedKey = scryptSync(adminPassword, PASSWORD_SALT, 32);

export function verifyPassword(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const candidateKey = scryptSync(candidate, PASSWORD_SALT, 32);
  return timingSafeEqual(candidateKey, expectedKey);
}

const sign = (value) =>
  createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");

export function createSessionToken() {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  return `${expiresAt}.${sign(expiresAt)}`;
}

function isValidSessionToken(token) {
  if (typeof token !== "string") return false;

  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;

  const expected = Buffer.from(sign(expiresAt));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  if (!timingSafeEqual(expected, received)) return false;

  return Number(expiresAt) > Date.now();
}

function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }

  return null;
}

export function sessionCookie(token) {
  const attributes = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];

  if (production) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearedSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(request) {
  return isValidSessionToken(readCookie(request, COOKIE_NAME));
}

/** Guards every write endpoint. Reads stay public. */
export function requireAdmin(request, response, next) {
  if (isAuthenticated(request)) {
    next();
    return;
  }

  response.status(401).json({ success: false, error: "Authentication required." });
}
