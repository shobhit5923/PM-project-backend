# GIM Lost & Found — Backend

Express + Prisma + Supabase Postgres API.

## Local development

```bash
cp .env.example .env
# fill DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, CORS_ORIGIN

npm install
npx prisma migrate deploy
npm run dev
```

API: `http://localhost:4000` — health: `GET /health`

## Vercel deployment

1. Import the `test-backend` GitHub repo into Vercel.
2. Set **Root Directory** to the backend repo root (this project).
3. Leave **Output Directory** empty.
4. Framework: Other / Express (`src/server.ts` is the entry).
5. Add environment variables:

| Name | Required | Notes |
|------|----------|--------|
| `DATABASE_URL` | yes | Supabase Postgres URL |
| `JWT_SECRET` | yes | Strong random string (not `dev-secret`) |
| `GEMINI_API_KEY` | yes | Gemini key for matching |
| `CORS_ORIGIN` | yes | Your frontend URL(s), comma-separated |

6. After first deploy, point the frontend `VITE_API_URL` at this backend URL.

`postinstall` / Vercel `buildCommand` run `prisma generate`. Apply schema with:

```bash
npx prisma migrate deploy
```

(against Supabase, using the same `DATABASE_URL`).
