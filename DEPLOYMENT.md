# Vercel + Supabase deployment

## 1. Create Supabase first

Create a Supabase project near your intended Vercel function region. Use separate production and preview databases. Save the database password securely. Disable the **Data API** in Supabase settings: application tables use backend authorization and do not have browser-facing RLS policies. Storage uses a separate API. Keep the existing admin/teacher login; Supabase Auth is not required.

Migration `003_backend_only_access.sql` also revokes application table/sequence access from `PUBLIC`, `anon`, and `authenticated` before initial accounts are inserted. The dedicated application role receives its own grants through `db:role`.

Under **Connect**, copy the **transaction pooler** URL (runtime, port 6543) and **direct** URL (migrations, port 5432). If the direct IPv6 endpoint is unreachable from your computer, use the **session pooler** for migrations. Retain the exact host and project reference shown in the dashboard.

## 2. Configure your computer

Use Node.js 22 and run `npm ci`. Copy `.env.production.example` into `.env.local`. If `.env.local` already exists, back it up and merge entries instead of replacing it. Replace all placeholders. URL-encode special characters in connection-string passwords. In Next.js env files escape literal dollar signs as `\$`.

The admin login password, Supabase database password, dedicated application role password, and Storage service role key are different secrets. Use the **legacy service_role JWT** from Supabase API Keys as `SUPABASE_SERVICE_ROLE_KEY`. Keep `MIGRATION_DATABASE_URL`, `ADMIN_PASSWORD`, and `APP_DATABASE_PASSWORD` on your computer only.

Remote PostgreSQL uses TLS with certificate verification. If the endpoint needs a project CA, download it from Supabase and set its PEM contents as `DATABASE_SSL_CA` (literal `\n` works). Do not disable verification. Transaction pooling requires `DATABASE_SCHEMA=public`; it does not send session `search_path` startup options. Use session pooling for other schemas.

## 3. Choose initial data, then initialize

For a **fresh database**, run locally:

```powershell
npm run db:bootstrap -- --content seed
npm run db:role
npm run storage:setup
```

`seed` initializes the default public profile, gallery, posts, and agenda. Teacher materials, assessments, questions, and grades start empty. Edit the public content through the admin after deployment. Creating the first admin requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12–128 characters). Rerunning bootstrap preserves existing admin credentials and skips initialized content. It refuses to import into populated content tables without an import marker.

`db:role` creates the dedicated `APP_DATABASE_ROLE` using `APP_DATABASE_PASSWORD` (at least 24 characters), then grants access to application tables/sequences/functions. It does not grant migration privileges or reset existing passwords. Change the transaction-pooler username to `sdn_bangah_app.PROJECT_REF` and password to the URL-encoded app role password. Keep the dashboard's host/database. Use this as `DATABASE_URL` locally and on Vercel. The pooler may need a short period to recognize a newly created role.

`storage:setup` creates a **public** `school-images` bucket with a 4 MiB image-only limit. It verifies existing bucket settings without modifying them. Use it only for public website images, never student answer sheets/private files. Admins obtain a signed upload URL from the backend, upload directly from the browser, and save the resulting public URL. Keep default Storage write restrictions; no anonymous write policy is required. Replacing/removing a CMS image leaves the old Storage object; periodically remove unused objects.

For the old JSON snapshot, explicitly use `--content legacy`. This does **not** transfer edits saved in local PostgreSQL. To preserve **current SQL data**, stop before seeding and prepare a scoped export/import of application tables; do not restore a whole cluster into Supabase. `--content none` applies migrations and creates/keeps an admin without importing content; it is not a SQL transfer workflow.

For later schema changes, run `npm run db:migrate` locally with `MIGRATION_DATABASE_URL`, then `npm run db:role` to update grants. Never run migrations/bootstrap in a Vercel build.

## 4. Prepare AI and books

Set a trusted HTTPS `AI_BASE_URL`, provider key, and supported text/vision/embedding model IDs. There is no default tunnel endpoint. The app can run without AI, but AI/OCR/indexing require valid configuration.

Point local `DATABASE_URL` at the Supabase application role and run:

```powershell
npm run books:sync
npm run books:index -- --grade 4 --curriculum merdeka
```

Start with the books you need and keep the indexer running until it finishes. Use the **same embedding provider, model, and dimensions** locally and on Vercel. Indexes persist in PostgreSQL. On Vercel, web indexing is disabled and its controls hidden; administrators prepare books locally. PDF routes redirect to the allowlisted official source to avoid function payload limits; inline/download behavior then depends on that server. Temporary cache files automatically use `/tmp` on Vercel; leave `BOOKS_CACHE_DIR` unset on Windows.

OCR photos remain transient and go through the backend to your configured AI provider without being stored in Storage. Both OCR clients check the **complete encoded JSON request** against 4,000,000 bytes before sending; the API enforces the same cap. Reduce pages/resolution if needed. AI routes have a 300-second maximum duration in `vercel.json`; ensure your Vercel plan supports it and configure provider timeouts/fallback attempts within that budget.

## 5. Deploy preview, then production

Push the prepared code to GitHub. Import the repository in Vercel with **Next.js**, repository root, install command `npm ci`, build command `npm run build`, default output directory, and **Node.js 22.x**. Use `master` as production branch if that is your production branch. Choose a function region near Supabase.

Set these **server-only** Vercel environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Dedicated app role transaction-pooler URL |
| `DATABASE_SCHEMA` | `public` |
| `DATABASE_POOL_MODE` | `transaction` |
| `DATABASE_POOL_MAX` | `2` |
| `DATABASE_SSL_CA` | Project CA PEM, if needed |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy service_role JWT |
| `SUPABASE_STORAGE_BUCKET` | `school-images` |
| `AUTH_COOKIE_SECURE` | `true` |
| `APP_ORIGIN` | Exact HTTPS origin for this deployment |
| `AI_API_KEY`, `AI_BASE_URL` | Trusted provider configuration |
| `AI_MODEL`, `AI_VISION_MODEL`, `AI_EMBEDDING_MODEL` | Supported provider model IDs |
| `AI_EMBEDDING_DIMENSIONS` | Same as indexer, e.g. `768` |
| `AI_TIMEOUT_MS` | `120000` |
| `AI_FALLBACK_MODELS`, `AI_VISION_FALLBACK_MODELS` | Empty initially or tested fallback IDs |

Do not use a `NEXT_PUBLIC_` prefix for secrets. Omit `MIGRATION_DATABASE_URL`, all `ADMIN_*`/`APP_DATABASE_*` setup variables, and `POSTGRES_ADMIN_PASSWORD` from Vercel. Do not set `VERCEL` yourself. Use separate Supabase project/database and bucket for Preview variables. Redeploy after changing variables. Create a preview branch to test before production; promote only after verification.

## 6. Verify

Run `npm test`, `npm run test:deployment`, and `npm audit` locally. Tests use disposable **local** PostgreSQL (`PG_BIN` or local `TEST_DATABASE_URL`), never production.

On the deployed preview, `/api/health` must return HTTP 200 and `ok: true`. Log in at `/login` as Admin and create two teachers. Check login/logout, secure cookies, teacher data isolation, CMS editing/image upload, materials, assessments, grading, CSV/printing, OCR failure/size handling, indexed-book retrieval, and PDF access. Redeploy and verify saved records/images remain. Open protected previews through your Vercel account.

Before production configure database backups, separate backups of Storage objects, error/usage alerts, and retain a working deployment for rollback. Database backups do not include Storage object bytes.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Data API security](https://supabase.com/docs/guides/api/securing-your-api), [signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [Vercel limits](https://vercel.com/docs/functions/limitations).
