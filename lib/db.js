// Data layer for the PostgREST API at api-central_db.shajibbd.online
// Postgres port 5432 is blocked (Cloudflare), so we talk to the DB over HTTPS.

const BASE_URL = (process.env.API_BASE_URL || "https://api-central_db.shajibbd.online").replace(/\/+$/, "");
const TABLE = process.env.API_TABLE || "shajibbd";

function url(path = "") {
  return `${BASE_URL}/${TABLE}${path}`;
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
    // PostgREST error shape: { code, message, details, hint }
    if (body?.message) message = body.message;
  } catch {
    /* keep fallback */
  }
  const status = res.status === 409 ? 409 : res.status === 404 ? 404 : 500;
  throw new ApiError(message, status);
}

export function isValidId(id) {
  return Number.isInteger(id) && id > 0;
}

// GET / -> list all rows
export async function listUsers() {
  const res = await fetch(url("?order=id.asc"), { headers: headers(), cache: "no-store" });
  if (!res.ok) await parseError(res, "Failed to fetch users");
  return res.json();
}

// GET /?id=eq.N -> one row
export async function getUser(id) {
  const res = await fetch(url(`?id=eq.${id}&limit=1`), {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to fetch user");
  const rows = await res.json();
  if (!rows.length) throw new ApiError("User not found", 404);
  return rows[0];
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
  return rows[0];
}

// PATCH /?id=eq.N -> update
export async function updateUser(id, { name, email }) {
  const res = await fetch(url(`?id=eq.${id}`), {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ name, email }),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to update user");
  const rows = await res.json();
  if (!rows.length) throw new ApiError("User not found", 404);
  return rows[0];
}

// DELETE /?id=eq.N -> delete
export async function deleteUser(id) {
  const res = await fetch(url(`?id=eq.${id}`), {
    method: "DELETE",
    headers: headers({ Prefer: "return=representation" }),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "Failed to delete user");
  const rows = await res.json();
  if (!rows.length) throw new ApiError("User not found", 404);
  return rows[0];
}
