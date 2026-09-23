# CRUD App — Next.js + PostgreSQL (Vercel-ready)

A simple **Users CRUD** application:

- **Frontend + API**: Next.js App Router with API Routes
- **Database**: PostgreSQL, reached through a **PostgREST** HTTPS API at
  `https://api-central_db.shajibbd.online` (table `shajibbd`)
- **Deployment**: Vercel (via GitHub)

> Why HTTPS instead of a direct Postgres connection? The host sits behind
> Cloudflare, which only proxies HTTP(S) — Postgres' port 5432 is blocked.
> PostgREST exposes the same table over HTTPS, so the app calls it with `fetch`.

## API endpoints (this app)

| Method | Endpoint         | Description            |
| ------ | ---------------- | ---------------------- |
| GET    | `/api/health`    | Test database API      |
| GET    | `/api/users`     | List all users         |
| POST   | `/api/users`     | Create a user          |
| GET    | `/api/users/:id` | Get one user           |
| PUT    | `/api/users/:id` | Update a user          |
| DELETE | `/api/users/:id` | Delete a user          |

Body for POST/PUT: `{ "name": "John Doe", "email": "john@example.com" }`

Under the hood each route maps to PostgREST:

| App action | Upstream request                                              |
| ---------- | ------------------------------------------------------------- |
| List       | `GET  /shajibbd?order=id.asc`                                 |
| Read one   | `GET  /shajibbd?id=eq.1`                                      |
| Create     | `POST /shajibbd` (`Prefer: return=representation`)            |
| Update     | `PATCH /shajibbd?id=eq.1`                                     |
| Delete     | `DELETE /shajibbd?id=eq.1`                                    |

Existing table schema:

```sql
CREATE TABLE shajibbd (
  id BIGINT PRIMARY KEY,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Auth (login / registration)

Pages:

| Page           | URL           | Behaviour                                       |
| -------------- | ------------- | ----------------------------------------------- |
| Registration   | `/register`   | On success **auto-redirects to `/login`**       |
| Login          | `/login`      | On success redirects to `/dashboard`            |
| Dashboard      | `/dashboard`  | Shows "Welcome, {name}" + account info          |

API:

| Method | Endpoint             | Description                          |
| ------ | -------------------- | ------------------------------------ |
| POST   | `/api/auth/register` | Create account (name, email, password) |
| POST   | `/api/auth/login`    | Verify credentials, set session cookie |
| POST   | `/api/auth/logout`   | Clear session cookie                 |
| GET    | `/api/auth/me`       | Current logged-in user (401 if none) |

**How it works**

- Passwords are hashed with **scrypt** (`scrypt$16384$salt$hex`) — never stored or
  returned in plain text. `password_hash` is stripped from every API response, and
  a password packed into `name` is unpacked before responding.
- Sessions are **persistent signed cookies** (30 days, `httpOnly`, `SameSite=Lax`,
  `Secure` in production). Each signature is keyed by the user's own password hash,
  so a token cannot be forged without knowing it, and changing the password
  invalidates existing sessions.
- Login returns the same error for unknown email and wrong password.

### How passwords are stored

Two modes, chosen automatically:

| Mode | When | Where the hash lives |
| --- | --- | --- |
| `column` | after the migration SQL below | real `password_hash` column (preferred) |
| `packed-name` | no schema change available | appended to the `name` column after a `␟` separator |

`GET /api/health` reports the active mode as `"passwordStorage"`.

Because the exposed PostgREST endpoint has no password column yet, the app packs
`displayName␟scrypt$…` into `name`. The API never returns it: `sanitizeUser()`
strips `password_hash` **and** unpacks the display name from every response.
The moment the migration SQL is run, existing packed accounts self-upgrade into
the column on their next login.

### Recommended database migration

Run this **once** in your PostgreSQL client (pgAdmin, DBeaver, Docker, hosting panel).
**Include the `COMMIT;`** — GUI clients such as DBeaver keep DDL in an open
transaction until committed, which is why an earlier attempt silently did nothing:

```sql
ALTER TABLE shajibbd ADD COLUMN IF NOT EXISTS password_hash text;
COMMIT;

NOTIFY pgrst, 'reload schema';   -- PostgREST < v10: restart the container instead
```

Verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'shajibbd' ORDER BY ordinal_position;
```

Expected: `id, name, email, password_hash, created_at` — and
`https://api-central_db.shajibbd.online/shajibbd?select=password_hash` should
return `200` instead of `400`.

> Existing rows have no password, so those accounts cannot log in until a
> password is set (e.g. `UPDATE shajibbd SET password_hash = 'scrypt$...' WHERE id = 1;`).

Optional: add `AUTH_SECRET` in Vercel (see `.env.example`) to sign session cookies
with your own secret.



```bash
npm install
npm run dev
```

`.env.local` (already present locally, **not** committed) holds:

```
API_BASE_URL=https://api-central_db.shajibbd.online
API_TABLE=shajibbd
# API_KEY=            # only if the endpoint is secured later
```

Open http://localhost:3000

## Deploy to Vercel from GitHub

1. Push this folder to a GitHub repository:

   ```bash
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
   Framework preset: **Next.js** (auto-detected). No build settings needed.

3. Add the environment variables (**Settings → Environment Variables**), then redeploy:

   | Name          | Value                                    |
   | ------------- | ---------------------------------------- |
   | `API_BASE_URL`| `https://api-central_db.shajibbd.online` |
   | `API_TABLE`   | `shajibbd`                               |
   | `AUTH_SECRET` | *random 64-char hex string* (optional but recommended) |

   > `https://` is optional — the app adds the scheme automatically if the value
   > was saved as a bare hostname.

4. Click **Deploy**. Every push to `main` redeploys automatically.

5. Verify: open `https://<your-app>.vercel.app/api/health`
   → should return `{"ok":true,"table":"shajibbd","rows":N}`.

## Notes

- All DB traffic is server-side only (Next.js API routes), so the endpoint and
  any future `API_KEY` are never exposed to the browser.
- The app talks plain HTTPS to port 443, so it works on Vercel's serverless
  runtime with no special configuration.
