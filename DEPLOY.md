# Deploying

The site runs on Namecheap cPanel shared hosting (CloudLinux): LiteSpeed serves the frontend and media as static files, and Phusion Passenger runs the backend through cPanel's **Setup Node.js App** page (Node 22; anything 20.9 or later works). Deployment is manual. There are no secrets in this repository: the backend's settings, including `API_SECRET`, are environment variables set on that cPanel page.

## Server layout

```
~/
├── backend-server/        # the Node app's root: backend/dist contents + package.json + package-lock.json
│   ├── index.js           # the app's startup file
│   ├── lib/ routes/ middleware/ scripts/
│   └── node_modules       # a link into ~/nodevenv/backend-server/22/ (managed by cPanel; don't replace it)
├── nodevenv/backend-server/22/   # the app's Node environment (created by cPanel)
├── data/                  # content JSON (projects/, posts/, apps/); not in git, so back it up
├── logs/app.log           # backend log (rotates to app.log.1 at 5 MB)
└── public_html/           # contents of frontend/dist, plus:
    ├── .htaccess          # copy in deploy/public_html.htaccess
    ├── media/             # uploaded images and their .w640/.w1280 sizes; not in git, so back it up
    ├── sitemap.xml        # written by the backend
    ├── feed.xml           # written by the backend
    └── _meta/             # share pages, written by the backend
```

The backend finds `data/` and `public_html/` relative to its own files (`~/backend-server/lib/../..` = `~`). `DATA_DIR`, `PUBLIC_DIR`, and `MEDIA_DIR` override this if the layout ever differs.

## The Node app (cPanel → Setup Node.js App)

The app's page holds:

- **Node version:** 22. Anything 20.9 or later works (sharp 0.35 needs it).
- **Application root:** `backend-server`. **Startup file:** `index.js`.
- **Environment variables:**

  | Variable | Value |
  |----------|-------|
  | `API_SECRET` | Required. At least 32 random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), and the same value in Folio's Prod settings. |
  | `FRONTEND_URL` | Optional. Another origin to allow through CORS. Same-origin requests (the site itself) and Folio don't need it. |
  | `SITE_URL` | Optional. Defaults to `https://jordan-christensen.com`. Used for absolute URLs in the sitemap, feed, and share pages. |
  | `DATA_DIR`, `PUBLIC_DIR`, `MEDIA_DIR` | Only if the layout above changes. |

- **Buttons:** **Run NPM Install** (installs `package.json`'s dependencies into the app's Node environment) and **Restart**.

The startup log reports a missing or short `API_SECRET` without printing it.

### Running scripts on the server

Node isn't on the cPanel terminal's normal `PATH` (`which node` finds nothing). It's installed under `/opt/alt/alt-nodejs22/`, and each app gets its own environment. Enter it first, with the command shown at the top of the app's page:

```sh
source ~/nodevenv/backend-server/22/bin/activate && cd ~/backend-server
```

The prompt then starts with `[backend-server (22)]`. Run the compiled scripts with `node` (`tsx` isn't installed there):

| Command | What it does |
|---------|--------------|
| `node scripts/check.js` | Read-only integrity report: bad records, stale indexes, missing or unreferenced media. |
| `node scripts/regenerate.js` | Rebuilds `index.json`/`nav.json`, `sitemap.xml`, `feed.xml`, and the share pages. |
| `node scripts/derive-media.js` | Creates any missing 640/1280 px image sizes (`--dry-run` previews). Originals aren't touched. Uploads make their own sizes, so this is only for older images. |

Notes:

- **Don't run `npm ci` or `npm install` in this terminal.** `node_modules` in the app root is a link into the environment, and `npm ci` deletes it before reinstalling. Use the **Run NPM Install** button.
- The environment variables from the app's page apply to the running app, not this shell. None of these scripts need them.
- The write lock only covers one process, so don't save in Folio while `regenerate.js` or `derive-media.js` is running.

## The `.htaccess`

`deploy/public_html.htaccess` is a copy of the live `~/public_html/.htaccess` (as deployed October 29, 2026). Keep the two in step: edit the copy here, then paste it into cPanel's File Manager. It contains:

- cPanel's **AutoSSL block** (forces HTTPS). cPanel manages it, so leave it exactly as it is.
- **Legacy app-link redirects:** `/<app>-privacy` and `/<app>-support` (302), and `/<app>/privacy-policy` and `/<app>/support` (301), all to `/apps/<app>/…`. App Store listings link to these, so keep them.
- The **share-page rule:** serves `_meta/<path>.html` for `/projects`, `/blog`, `/projects/<id>`, `/blog/<id>`, and `/apps/<id>/<page>` when the backend has written one.
- The **single-page-app fallback**, which leaves `/api/` and `/media/` alone.
- **Caching:** HTML revalidates (`no-cache`), and the hashed files in `/assets` are cached for a year.

There's no Passenger block or `SetEnv` in it: the app's routing and settings are managed from the Setup Node.js App page. Both `www.` and the bare domain serve the site. A www→bare redirect is optional and not in place.

## Every deploy

Run the checks locally first:

```sh
cd backend && npm ci && npm test && npm run build
cd ../frontend && npm ci && npm run lint && npm test && npm run build
```

Then, **backend first** (the frontend's RSS link and image sizes depend on it):

1. **Backend:**
   - Upload the *contents* of `backend/dist/` into `~/backend-server/` (no `dist/` folder), plus `backend/package.json` and `backend/package-lock.json`.
   - If the dependencies changed, press **Run NPM Install** on the app's page. It installs sharp's Linux binary too.
   - Press **Restart** (or `touch ~/backend-server/tmp/restart.txt`). At startup the backend rebuilds any missing indexes and rewrites `sitemap.xml`, `feed.xml`, and the share pages.
2. **Frontend:** upload the contents of `frontend/dist/` into `~/public_html/`.
   - Don't delete `media/`, `_meta/`, `sitemap.xml`, `feed.xml`, or `.htaccess`.
   - Leave the old files in `/assets` for a couple of weeks. A browser holding an old `index.html` still needs them, and with the caching headers that window is short.
3. **Refresh the share pages:** they're copies of `index.html`, so they need rewriting after a frontend upload. Restart the app again, or run `node scripts/regenerate.js` (see Running scripts on the server).
4. **Smoke test** from your Mac:

   ```sh
   cd backend && npm run smoke -- https://jordan-christensen.com
   ```

   It only sends GETs. Every line should say PASS. A WARN says what to do next.
5. Optionally, run `node scripts/check.js` on the server.

## Rolling back

Keep the previous `backend/dist` and `frontend/dist` (zip them before uploading). To roll back, upload the old files the same way and restart.

Content in `~/data` isn't affected by code deploys. Phase 2 changed write behavior but not the stored format, so older code can still read data written by newer code.

## Backups

`~/data/` and `~/public_html/media/` aren't in git. **The live site is the source of truth for content.** Folio edits go straight to it, so your local `backend/data` copy falls behind; on October 29, 2026 it was missing the whole Hyperline app, Flask Master's support page, and some TrekPoint edits.

- **From your Mac, no server access needed:**

  ```sh
  cd backend && npm run snapshot
  ```

  This saves every project, post, and app page, plus every image the content uses, through the public site (GETs only). It writes to `~/Developer/portfolio-backups/<date>-live/` and a `.tgz` beside it, with a `MANIFEST.txt` listing what's covered and any problems. Run it before risky changes. It can't include images nothing references, the `.htaccess`, logs, or the app's settings.
- **Everything, from the server:** in the cPanel terminal, run

  ```sh
  cd ~ && tar czf portfolio-content-$(date +%F).tgz data public_html/media public_html/.htaccess
  ```

  Then download the file with File Manager.
- **The host's backups:** confirm that the plan's backups (JetBackup or similar) include `~/data/` and `~/public_html/media/`, and how often they run.
