// Data layer for the PostgREST API at api-central_db.shajibbd.online
// Postgres port 5432 is blocked (Cloudflare), so we talk to the DB over HTTPS.

const BASE_URL = normalizeBase(process.env.API_BASE_URL);
const TABLE = process.env.API_TABLE || "shajibbd";

// Storage mode for passwords:
//  1) preferred  -> real `password_hash` column (after the migration SQL)
//  2) fallback   -> scrypt hash packed into the existing `name` column after
//                   this separator, so auth works with zero schema changes.
// Whichever exists is used automatically; rows written in mode 2 are readable
// and repaired into mode 1 as soon as the column appears.
const PACK_SEP = "\u001f";

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

// Diagnoses whether the auth migration has been applied (cached once true,
// re-checked at most once a minute while still false)
let colState = { ready: false, at: 0 };

export async function authColumnReady() {
  const now = Date.now();
  if (colState.ready) return true;
  if (colState.at && now - colState.at < 60_000) return false;
  try {
    const res = await fetch(url("?select=password_hash&limit=1"), {
      headers: headers(),
      cache: "no-store",
    });
    colState = { ready: res.ok, at: now };
    return res.ok;
  } catch {
    colState.at = now;
    return false;
  }
}

export function storageMode(hasColumn) {
  return hasColumn ? "column" : "packed-name";
}

/* ---------- password packing (fallback storage) ---------- */

export function packName(displayName, hash) {
  return hash ? `${displayName}${PACK_SEP}${hash}` : displayName;
}

export function unpackName(rawName) {
  const raw = String(rawName ?? "");
  const i = raw.indexOf(PACK_SEP);
  if (i === -1) return { name: raw, hash: null };
  return { name: raw.slice(0, i), hash: raw.slice(i + 1) || null };
}

// The password hash lives either in the real column or packed into `name`
export function credentialsOf(user) {
  if (!user) return null;
  if (user.password_hash) return user.password_hash;
  return unpackName(user.name).hash;
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

// Never leak password_hash (or a packed hash) to the client
export function sanitizeUser(user) {
  if (!user) return user;
  const { password_hash, name, ...rest } = user;
  return { ...rest, name: unpackName(name).name };
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

// POST / -> insert an account (password goes to the column, or packed in `name`)
export async function createAccount({ name, email, password_hash }) {
  const hasColumn = await authColumnReady();
  const payload = { name: hasColumn ? name : packName(name, password_hash), email };
  if (hasColumn) payload.password_hash = password_hash;

  const res = await fetch(url(), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to create account");
  const rows = await res.json();
  return sanitizeUser(rows[0]);
}

// PATCH /?id=eq.N -> update (never destroys an existing packed password)
export async function updateUser(id, { name, email }) {
  const existing = await getUserById(id);
  if (!existing) throw new ApiError("User not found", 404);

  const hasColumn = await authColumnReady();
  const currentHash = credentialsOf(existing);
  const payload = { name: hasColumn ? name : packName(name, currentHash), email };
  if (hasColumn && currentHash) payload.password_hash = currentHash;

  const res = await fetch(url(`?id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to update user");
  const rows = await res.json();
  if (!rows.length) throw new ApiError("User not found", 404);
  return sanitizeUser(rows[0]);
}

// Moves a packed-mode account onto the real password_hash column (self-healing
// after the migration SQL is run) — best effort, never blocks a login.
export async function upgradeStoredPassword(user) {
  const hash = credentialsOf(user);
  if (!hash) return;
  const unpacked = unpackName(user.name);
  if (!unpacked.hash) return; // already stored in the column
  if (!(await authColumnReady())) return;

  await fetch(url(`?id=eq.${encodeURIComponent(user.id)}`), {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ name: unpacked.name, password_hash: hash }),
    cache: "no-store",
  }).catch(() => {});
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
