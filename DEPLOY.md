# Deploying

The site runs on Namecheap cPanel shared hosting: LiteSpeed/Apache serves the frontend and media as static files, and Phusion Passenger runs the backend (Node 20.9+). Deployment is manual. There are no secrets in this repository; they live in the server's `.htaccess`.

## Server layout

```
~/
├── backend-server/        # contents of backend/dist + package.json + package-lock.json + node_modules
│   ├── index.js           # Passenger's entry point
│   ├── lib/ routes/ middleware/ scripts/
├── data/                  # content JSON (projects/, posts/, apps/); not in git, so back it up
├── logs/app.log           # backend log (rotates to app.log.1 at 5 MB)
└── public_html/           # contents of frontend/dist, plus:
    ├── .htaccess          # see deploy/public_html.htaccess
    ├── media/             # uploaded images; not in git, so back it up
    ├── sitemap.xml        # written by the backend
    ├── feed.xml           # written by the backend
    └── _meta/             # share pages, written by the backend
```

The backend finds `data/` and `public_html/` relative to its own files (`~/backend-server/lib/../..` = `~`). `DATA_DIR`, `PUBLIC_DIR`, and `MEDIA_DIR` override this if the layout ever differs.

## First-time setup (or when reconciling the server)

1. Check Node: cPanel → Setup Node.js App should run **Node 20.9 or later** (sharp 0.35 needs it).
2. Merge `deploy/public_html.htaccess` into `~/public_html/.htaccess`. Keep cPanel's Passenger block exactly as it is. The template adds:
   - the legacy app-link redirects (both forms the live site supports today);
   - the `_meta` share-page rule;
   - caching headers.
3. Set the backend's environment with `SetEnv` (template: `deploy/backend.htaccess`). Use a long random `API_SECRET`, and the same value in Folio's Prod settings.
4. The old hand-written `public_html/sitemap.xml` (it lists `www.` URLs from the previous site) gets replaced by the generated one the first time the backend starts. `robots.txt` comes with the frontend build and points at the new sitemap.

## Every deploy

Run the checks locally first:

```sh
cd backend && npm ci && npm test && npm run build
cd ../frontend && npm ci && npm run lint && npm test && npm run build
```

Then:

1. **Backend:**
   - Upload the *contents* of `backend/dist/` into `~/backend-server/` (no `dist/` folder), plus `backend/package.json` and `backend/package-lock.json`.
   - In `~/backend-server`, run `npm ci --omit=dev`. Use the cPanel terminal, or the "Run NPM Install" button in Setup Node.js App. This installs sharp's Linux binary.
   - Restart the app (Setup Node.js App → Restart, or `touch ~/backend-server/tmp/restart.txt`). At startup it rebuilds any missing indexes and rewrites `sitemap.xml`, `feed.xml`, and the share pages.
2. **Frontend:** upload the contents of `frontend/dist/` into `~/public_html/`. Don't delete `media/`, `_meta/`, `sitemap.xml`, `feed.xml`, or `.htaccess`.
3. **Refresh the share pages:** they're copies of `index.html`, so they need rewriting after a frontend upload. Restart the backend again, or run `node scripts/regenerate.js` in `~/backend-server`. Until then, they keep loading the previous build's files, which still work as long as the old `/assets` files aren't deleted.
4. **Smoke test** from your Mac:

   ```sh
   cd backend && npm run smoke -- https://jordan-christensen.com
   ```

   It only sends GETs. Every line should say PASS. A WARN says what to do next.

## Commands on the server

Run these in `~/backend-server` (compiled JavaScript; `tsx` isn't installed there):

| Command | What it does |
|---------|--------------|
| `node scripts/check.js` | Read-only integrity report: bad records, stale indexes, missing or orphaned media. |
| `node scripts/regenerate.js` | Rebuilds `index.json`/`nav.json`, `sitemap.xml`, `feed.xml`, and the share pages. |
| `node scripts/derive-media.js` | Creates the 640/1280 px sizes for images uploaded before sizes existed. Run once after the first deploy that includes it; add `--dry-run` to preview. Originals aren't touched. |

## Rolling back

Keep the previous `backend/dist` and `frontend/dist` (zip them before uploading). To roll back, upload the old files the same way and restart.

Content in `~/data` isn't affected by code deploys. Phase 2 changed write behavior but not the stored format, so older code can still read data written by newer code.

## Backups

`~/data/` and `~/public_html/media/` aren't in git. Confirm that the hosting plan's backups (JetBackup or similar) include both, and how often they run. Download a copy before risky changes:

```sh
tar czf portfolio-content-$(date +%F).tgz data public_html/media
```
