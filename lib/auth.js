import { createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getUserById, sanitizeUser } from "@/lib/db";

const COOKIE_NAME = "session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days (persistent login)

// Set AUTH_SECRET in Vercel for production. The fallback still works because every
// session signature is additionally keyed by the user's own password_hash — an
// attacker cannot forge a token without knowing it.
const SERVER_SECRET = process.env.AUTH_SECRET || "crud-app-session-secret-change-me";

const SCRYPT_N = 16384;

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, { N: SCRYPT_N, r: 8, p: 1 }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT_N}$${salt}$${key.toString("hex")}`);
    });
  });
}

export function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    if (!password || !stored) return resolve(false);
    const parts = String(stored).split("$");
    if (parts.length !== 4 || parts[0] !== "scrypt") return resolve(false);
    const [, n, salt, expectedHex] = parts;
    const expected = Buffer.from(expectedHex, "hex");
    scrypt(password, salt, expected.length, { N: Number(n), r: 8, p: 1 }, (err, key) => {
      if (err) return resolve(false);
      resolve(expected.length === key.length && timingSafeEqual(expected, key));
    });
  });
}

const b64 = (input) => Buffer.from(input).toString("base64url");

function signingKey(user) {
  return createHmac("sha256", SERVER_SECRET).update(String(user.password_hash)).digest();
}

export function createToken(user) {
  const payload = b64(JSON.stringify({ u: user.id, e: Date.now() + MAX_AGE * 1000 }));
  const sig = createHmac("sha256", signingKey(user)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function parseToken(token) {
  if (!token || !token.includes(".")) return null;
  try {
    return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  } catch {
    return null;
  }
}

export function verifyToken(token, user) {
  if (!token || !user?.password_hash) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", signingKey(user)).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const claims = parseToken(token);
  if (!claims || claims.u !== user.id || Date.now() > claims.e) return null;
  return claims;
}

export async function setSession(user) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, createToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// Returns the logged-in user (safe fields only), or null
export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const claims = parseToken(token);
  if (!claims?.u) return null;

  const user = await getUserById(claims.u);
  if (!user || !verifyToken(token, user)) return null;
  return sanitizeUser(user);
}
