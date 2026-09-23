// Data layer for the PostgREST API at api-central_db.shajibbd.online
// Postgres port 5432 is blocked (Cloudflare), so we talk to the DB over HTTPS.

const BASE_URL = normalizeBase(process.env.API_BASE_URL);
const TABLE = process.env.API_TABLE || "shajibbd";

function url(path = "") {
  return `${BASE_URL}/${TABLE}${path}`;
}

// Tolerate env values written without a scheme (e.g. "api-central_db.shajibbd.online")
function normalizeBase(raw) {
  let base = (raw || "https://api-central_db.shajibbd.online").trim();
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base.replace(/\/+$/, "");
}

export function endpointInfo() {
  return { base: BASE_URL, table: TABLE };
}

// Diagnoses whether the auth migration has been applied
export async function authColumnReady() {
  try {
    const res = await fetch(url("?select=password_hash&limit=1"), {
      headers: headers(),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function headers(extra = {}) {
  const h = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
  // Optional: set API_KEY if the PostgREST endpoint is later secured
  if (process.env.API_KEY) {
    h.apikey = process.env.API_KEY;
    h.Authorization = `Bearer ${process.env.API_KEY}`;
  }
  return h;
}

export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

async function parseError(res, fallback) {
  let message = fallback;
  try {
    const body = await res.json();
    if (body?.message) message = body.message;
    if (body?.code) {
      const e = new ApiError(message, res.status === 409 ? 409 : res.status === 404 ? 404 : 500);
      e.code = body.code;
      throw e;
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    /* keep fallback */
  }
  const status = res.status === 409 ? 409 : res.status === 404 ? 404 : 500;
  throw new ApiError(message, status);
}

export function isValidId(id) {
  return Number.isInteger(id) && id > 0;
}

// Never leak password_hash to the client
export function sanitizeUser(user) {
  if (!user) return user;
  const { password_hash, ...safe } = user;
  return safe;
}

const sanitizeAll = (rows) => rows.map(sanitizeUser);

// GET / -> list all rows
export async function listUsers() {
  const res = await fetch(url("?order=id.asc"), { headers: headers(), cache: "no-store" });
  if (!res.ok) await parseError(res, "Failed to fetch users");
  return sanitizeAll(await res.json());
}

// GET /?id=eq.N -> one row (public fields)
export async function getUser(id) {
  const user = await getUserById(id);
  if (!user) throw new ApiError("User not found", 404);
  return sanitizeUser(user);
}

// Internal: full row including password_hash (server-side only, for auth)
export async function getUserById(id) {
  const res = await fetch(url(`?id=eq.${encodeURIComponent(id)}&limit=1`), {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to fetch user");
  const rows = await res.json();
  return rows[0] || null;
}

export async function findUserByEmail(email) {
  const res = await fetch(
    url(`?email=eq.${encodeURIComponent(email)}&limit=1`),
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) await parseError(res, "Failed to fetch user");
  const rows = await res.json();
  return rows[0] || null;
}

// POST / -> insert
export async function createUser({ name, email }) {
  const res = await fetch(url(), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ name, email }),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to create user");
  const rows = await res.json();
  return sanitizeUser(rows[0]);
}

// POST / -> insert an account (with password_hash)
export async function createAccount({ name, email, password_hash }) {
  const res = await fetch(url(), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ name, email, password_hash }),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to create account");
  const rows = await res.json();
  return sanitizeUser(rows[0]);
}

// PATCH /?id=eq.N -> update
export async function updateUser(id, { name, email }) {
  const res = await fetch(url(`?id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ name, email }),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to update user");
  const rows = await res.json();
  if (!rows.length) throw new ApiError("User not found", 404);
  return sanitizeUser(rows[0]);
}

// DELETE /?id=eq.N -> delete
export async function deleteUser(id) {
  const res = await fetch(url(`?id=eq.${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: headers({ Prefer: "return=representation" }),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to delete user");
  const rows = await res.json();
  if (!rows.length) throw new ApiError("User not found", 404);
  return sanitizeUser(rows[0]);
}
