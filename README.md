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

## Run locally

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
