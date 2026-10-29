# Backend Developer Documentation

## Motivation

This backend exists to serve a personal portfolio website with full content-management capability via a simple REST API — no CMS, no database, no cloud service. The philosophy is deliberate minimalism: content lives as JSON files on disk, media lives as WebP images in a static directory, and the server is a thin Express layer that reads and writes those files.

The deployment target is **cPanel shared hosting (Namecheap)** running Phusion Passenger with Node.js. This rules out Docker, managed databases, background workers, and anything requiring root access. Every architectural choice was made with that constraint in mind.

---

## Tech Stack

- **Runtime**: Node.js (ESM, `"type": "module"`)
- **Runtime version**: Node.js 20.9 or later (required by `sharp` 0.35)
- **Framework**: Express 4 (4.22.3+, which pulls in the patched body-parser 1.20.9)
- **Language**: TypeScript 5 with `NodeNext` module resolution
- **Image processing**: `sharp` 0.35.5+ (WebP conversion, auto-orientation, metadata stripping)
- **File upload**: `multer` 2 (multipart/form-data → tmpdir)
- **Auth**: Bearer token via `API_SECRET` env var
- **Logging**: Custom buffered logger → `logs/app.log`

---

## Project Structure

```
backend/
├── src/
│   ├── app.ts                # createApp(): middleware and route mounting (no listen; tests use it)
│   ├── index.ts              # Entry point: startup checks, listen, graceful shutdown
│   ├── lib/
│   │   ├── bootstrap.ts      # Startup: create storage dirs, rebuild missing indexes, config warnings
│   │   ├── files.ts          # Path constants (env-overridable), readJSON, atomic writes, fileExists
│   │   ├── images.ts         # WebP conversion: bounded main image + 640/1280 px sizes
│   │   ├── lock.ts           # withLock(): serializes writes per content type
│   │   ├── logger.ts         # Buffered, rotating file logger
│   │   ├── paths.ts          # ID/filename rules, resolveInside(), safe media names
│   │   ├── regenerate.ts     # Index/nav regeneration (skips and reports bad records)
│   │   ├── schemas.ts        # Request/record validation, update merging, reading time
│   │   ├── site.ts           # sitemap.xml, feed.xml, and share pages (_meta/*.html)
│   │   └── types.ts          # The API contract (the frontend re-exports these types)
│   ├── middleware/
│   │   ├── auth.ts           # Bearer token authentication middleware
│   │   ├── errors.ts         # JSON 404 and error handler, CORS rejection, body limit
│   │   └── validateParams.ts # router.param validator (404 on GET, 400 on writes)
│   ├── routes/
│   │   ├── projects.ts       # CRUD for projects
│   │   ├── posts.ts          # CRUD for blog posts
│   │   ├── media.ts          # Media upload/delete
│   │   └── apps.ts           # Privacy policy + support pages for iOS apps
│   └── scripts/
│       ├── regenerate.ts     # npm run regen: rebuild indexes and site files, then exit
│       ├── check.ts          # npm run check: read-only integrity report
│       ├── derive-media.ts   # npm run media:derive: create missing 640/1280 px image sizes
│       ├── smoke.ts          # npm run smoke -- <url>: read-only checks against a deployed site
│       └── snapshot.ts       # npm run snapshot: back up the live content with GETs (lib/snapshot.ts)
├── test/                     # node:test + supertest (npm test); each file runs against temp dirs
├── data/
│   ├── projects/             # One JSON file per project + index.json + nav.json
│   ├── posts/                # One JSON file per post + index.json + nav.json
│   └── apps/
│       └── <appId>/          # privacy-policy.json and/or support.json
├── public_html/              # The web root (PUBLIC_DIR); locally only media and generated files
│   ├── media/                # Uploaded media (served statically by cPanel)
│   │   ├── projects/<id>/
│   │   └── posts/<id>/
│   ├── sitemap.xml           # Generated
│   ├── feed.xml              # Generated
│   └── _meta/                # Generated share pages
└── logs/
    ├── app.log               # Buffered log output
    └── app.log.1             # Previous log, after rotation at 5 MB
```

> **On cPanel**: Phusion Passenger requires a compiled entry point. TypeScript is compiled with `tsc` and the resulting JS files are extracted directly into `backend-server/` (there is no `dist/` folder in the repo). Passenger reads `backend-server/index.js`.

---

## Path Resolution

Path constants are defined in `src/lib/files.ts`. `import.meta.dirname` resolves to the directory of the compiled file at runtime. On the server, compiled files live at `backend-server/lib/`, so `../..` resolves to the home directory (`/home/micrjlbr/`). Locally, `../../` from `backend/src/lib/` lands at `backend/`.

| Constant | Default (relative to that root) | Override |
|----------|---------------------------------|----------|
| `dataDir` (`projects/`, `posts/`, `apps/`) | `data/` | `DATA_DIR` |
| `publicDir` (web root: sitemap, feed, share pages) | `public_html/` | `PUBLIC_DIR` |
| `mediaDir` | `$publicDir/media` | `MEDIA_DIR` |
| `siteUrl` (absolute URLs) | `https://jordan-christensen.com` | `SITE_URL` |

The values are read once, when `files.ts` is first imported, so the tests set the environment before importing anything from `src/`.

---

## Storage Model

There is no database. All content is stored as pretty-printed JSON files.

### Content files

Each piece of content has its own file, named by its `id`:
- `data/projects/my-project.json` → full `ProjectDetail` object
- `data/posts/my-post.json` → full `PostDetail` object

### Index files

List endpoints (`GET /api/projects`, `GET /api/posts`) do **not** scan the filesystem on every request. Instead, they read pre-generated `index.json` files containing only the fields needed for list views (previews). These are regenerated whenever any content is created, updated, or deleted.

### Nav files

`nav.json` files contain an even smaller shape (just `id`, `title`, `status`, and for projects `featured`) for powering the sidebar navigator on the frontend.

### Regeneration

`src/lib/regenerate.ts` exports two functions:

- `regenerateProjects()` — scans `data/projects/*.json`, sorts featured projects first then by `updatedAt ?? createdAt` descending, writes `index.json` and `nav.json`
- `regeneratePosts()` — scans `data/posts/*.json`, sorts by `createdAt` descending, writes `index.json` and `nav.json`

Both are called automatically by every write route (POST, PUT, DELETE), and at startup when either file is missing or unreadable. They can also be triggered manually:

```bash
npm run regen   # runs src/scripts/regenerate.ts; exits with 1 if any file was skipped
```

One bad file doesn't block publishing. Each record is read separately. A file that isn't valid JSON, or lacks a field the lists use (`title`, `createdAt`, plus `tagline` and a valid `status` for projects, or `tags` and `readingTime` for posts), is **skipped and logged** at error level. Everything else is still listed. If *every* record fails, the existing `index.json` and `nav.json` are kept rather than replaced with empty lists. The filename is the record's ID (it's what `GET /:id` reads), so a record whose `id` field disagrees is listed under its filename, with a warning.

A write route only fails if the record itself couldn't be saved. If the save succeeds but regeneration then fails, the response is still a success, and the error is logged with a hint to run `npm run regen`. That way a retry can't hit "already exists" for content that was actually saved.

### Integrity check

```bash
npm run check   # read-only; exits with 1 if there are errors
```

`src/scripts/check.ts` reports:
- **Errors:** unreadable records, and records left out of the lists.
- **Warnings:**
  - Records that would fail today's validation, or whose `id` doesn't match the filename.
  - Out-of-date or missing `index.json`/`nav.json`.
  - Unexpected files in `data/apps`.
  - Media referenced by content but missing from the media directory.
  - Leftover upload temp files.
- **Notes:** media files that no content references.

It never deletes anything. Use it before and after deploying, and before cleaning up media by hand.

### Writes and concurrency

- `writeJSON` writes a hidden temporary file (`.name.json.<random>.tmp`) in the same directory, then `rename`s it over the target. Readers always see a whole file, the old version or the new one.
- Every write route runs its read-merge-write-regenerate sequence inside `withLock('<projects|posts|apps|media>', …)` (`src/lib/lock.ts`), so concurrent requests to one content type run one at a time and can't lose each other's changes.
- The lock is **in-process**. If Passenger ever runs more than one Node process for the site, two processes could still interleave writes: files stay whole, but the last writer wins. With one author (Folio), that's an accepted risk; a file lock would be the next step if it ever matters.

---

## Authentication

All write operations (POST, PUT, DELETE) require a `Bearer` token:

```
Authorization: Bearer <API_SECRET>
```

`API_SECRET` is read from the environment (`.env` file locally, an environment variable on cPanel's Setup Node.js App page in production). The `authenticate` middleware in `src/middleware/auth.ts` checks the header and returns 401 if missing or incorrect. GET routes are always public.

---

## IDs and Paths

Every ID becomes part of a filesystem path, so `src/lib/paths.ts` defines the rules and each router enforces them with `router.param` (`src/middleware/validateParams.ts`) before any handler runs:

- **Project and post IDs** (and the media `id`) must be slugs, `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 100 characters, and not `index` or `nav` (those names belong to the generated files). This is the same format Folio's `slugified` produces.
- **App IDs** use the same slug format, but `index` and `nav` are allowed.
- **Media filenames** in the delete route must be a single name (letters, digits, `.`, `_`, `-`, with no separators or leading dot) ending in an image extension (`webp`, `jpg`, `jpeg`, `png`, `gif`, or `avif`).

An invalid route parameter returns **404** on a GET and **400** on a write. Because Express runs `router.param` before route middleware, an invalid ID on a write gets 400 even without a token. A create request (`POST`) with an invalid `id` in its body returns 400 with an explanation.

Paths are built with `resolveInside(root, ...segments)`, which throws if the result would land outside `root`. Use it, not `join`, for any path containing a request value.

---

## API Reference

### Authentication header (write routes only)
```
Authorization: Bearer <API_SECRET>
```

### Write semantics and validation

Every write body is validated by `src/lib/schemas.ts` before anything is saved. Folio depends on these rules:

- **POST** creates. The required fields are listed per resource below. Missing optional fields get defaults (empty strings, empty arrays, `featured: false`, `createdAt`: now), so stored records always have the full shape the frontend expects.
- **PUT** is a merge (it behaves like PATCH): omitted fields keep their stored values, and `null` on an optional field (`category`, a post's `heroImage` or `series`, `contactUrl`, `contactText`) **removes** it. `null` on a required field is a 400.
- **Server-owned fields** (`id`, `updatedAt`, `readingTime`) are ignored if sent. The ID comes from the URL (or from the body on create) and can't be changed by PUT. **Unknown fields** are dropped and logged.
- `createdAt` is editable, so content can be backdated.
- **Formats:**
  - `createdAt` is an ISO 8601 date-time (`2025-01-31T12:00:00Z`, with optional fractional seconds or offset). `lastUpdated` is a calendar date (`2025-01-31`).
  - URLs (`heroImage`, `media[].url`, link values, `contactUrl`) are a site-relative path starting with `/`, or an absolute URL. `http(s)` is accepted everywhere; `mailto:` is also accepted for links and `contactUrl`.
  - Paths may contain spaces, because older media have names like `1. Launch.webp`.
- **Limits:** title 200 characters, tagline 300, excerpt 1000, Markdown bodies 500,000, 50 tech-stack items, 30 tags, 20 links, 100 media items, and a 1 MB request body.

A validation failure returns 400 with every problem in one message, for example:
```json
{ "error": "Invalid project: title is required; status must be one of: active, in-progress, archived" }
```

### Errors

Every error response is JSON, `{ "error": "<message>" }`, without stack traces (server errors are logged with theirs):
- `400`: malformed JSON, a body that isn't an object, invalid fields, or an invalid ID on a write.
- `401`: a missing or wrong token.
- `403`: a request from an origin that isn't in the CORS allowlist.
- `404`: unknown routes, missing content, and invalid IDs on GET.
- `409`: it already exists.
- `413`: the body is over 1 MB.
- `415`: an unsupported image format.
- `500`: anything unexpected.

### Health — `GET /api/health`

Returns `200 {"status":"ok"}` when every storage directory is readable and writable, and `503` otherwise. It reveals nothing else, so it's safe for uptime monitors.

---

### Projects — `/api/projects`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/projects` | — | List all projects (preview shape) |
| GET | `/api/projects/nav` | — | List all projects (nav shape: id, title, status, featured) |
| GET | `/api/projects/:id` | — | Fetch full project detail |
| POST | `/api/projects` | ✓ | Create a new project (requires `id`, `title`, `tagline`, `status`) |
| PUT | `/api/projects/:id` | ✓ | Update a project (merges with existing, sets `updatedAt`) |
| DELETE | `/api/projects/:id` | ✓ | Delete a project |

**`ProjectDetail` shape:**
```json
{
  "id": "my-project",
  "title": "My Project",
  "tagline": "A short one-liner",
  "description": "Markdown content for the detail page",
  "heroImage": "/media/projects/my-project/hero.webp",
  "category": "iOS App",
  "status": "active",
  "featured": true,
  "techStack": ["Swift", "SwiftUI", "CloudKit"],
  "links": { "GitHub": "https://...", "App Store": "https://..." },
  "media": [
    { "type": "image", "url": "/media/projects/my-project/screen1.webp", "caption": "Main screen" }
  ],
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-06-01T00:00:00.000Z"
}
```

`status` must be one of: `"active"` | `"in-progress"` | `"archived"`.

**`ProjectPreview`** (returned by list endpoint) omits `description`, `media`, `techStack`, `links`.

**`ProjectNav`** (returned by nav endpoint) contains only `id`, `title`, `status`, `featured`.

---

### Posts — `/api/posts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts` | — | List all posts (preview shape) |
| GET | `/api/posts/nav` | — | List all posts (nav shape) |
| GET | `/api/posts/:id` | — | Fetch full post detail |
| POST | `/api/posts` | ✓ | Create a new post (requires `id`, `title`; `readingTime` auto-calculated) |
| PUT | `/api/posts/:id` | ✓ | Update a post (merges, sets `updatedAt`, recalculates `readingTime`) |
| DELETE | `/api/posts/:id` | ✓ | Delete a post |

**`PostDetail` shape:**
```json
{
  "id": "my-post",
  "title": "My Post",
  "excerpt": "A short summary shown in list views",
  "content": "Full markdown body",
  "heroImage": "/media/posts/my-post/hero.webp",
  "tags": ["Swift", "Tutorial"],
  "series": "Building in Public",
  "readingTime": 4,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-06-01T00:00:00.000Z"
}
```

`readingTime` is computed server-side at 200 words/minute on every create and update. A `readingTime` sent by the client is ignored.

**`PostNav`** contains `id`, `title`, `tags`, `createdAt`, `series`.

---

### Media — `/api/media`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/media/upload` | ✓ | Upload and convert an image to WebP |
| DELETE | `/api/media/:context/:id/:filename` | ✓ | Delete a media file |

**Upload** is `multipart/form-data` with these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✓ | The image file |
| `context` | string | ✓ | `"projects"` or `"posts"` |
| `id` | string | ✓ | The project/post id (determines subfolder) |
| `overwrite` | string | — | `"true"` to replace an existing file |

Accepted formats: JPEG, PNG, WebP, GIF, and AVIF. Maximum size: 25 MB, at most 100 megapixels, and at most 500 animation frames.

- The client's MIME type is only a first filter. The server then reads the file itself, and returns 400 if it isn't a readable image or 415 if the format isn't supported.
- **HEIC isn't supported:** the prebuilt `sharp` binaries can read a HEIC file's dimensions but can't decode HEVC, so HEIC uploads get a 415 asking for JPEG or PNG. Folio should convert HEIC before uploading.
- Videos aren't uploaded. A `video` media item's `url` points to wherever the video is hosted.

All uploads are converted to WebP at 85% quality using `sharp`. The EXIF orientation is applied (the pixels are rotated) before metadata is stripped, so phone photos come out upright. Animated GIFs and animated WebPs keep their animation (detected from the file, not the MIME type).

Conversions run one at a time, behind the `media` lock (`src/lib/images.ts`):

- **Main image:** `name.webp`, at most 2560 px on its longest side. It's never enlarged, and the original upload isn't kept.
- **Smaller sizes:** `name.w640.webp` and `name.w1280.webp`, by width. The frontend uses them in `srcset`, for cards, thumbnails, and phones. They're also never enlarged, so a small image's "1280" file is just its own size.
- **Staging:** every file is written to a hidden temporary file beside its destination. Nothing is renamed into place until all of them succeeded, and the smaller sizes go first, so a failed conversion (or a failed overwrite) never leaves a damaged or partial set.
- **Deleting:** deleting `name.webp` through the API also deletes its smaller sizes.
- **Older images:** `npm run media:derive` (on the server, `node scripts/derive-media.js`) creates any missing sizes. It never changes originals. Until it runs, the frontend falls back to the full image.

The output filename is made URL-safe from the original name: the extension is replaced with `.webp`, accents are removed, any run of characters other than letters, digits, `_`, and `-` becomes a single `-`, and case is kept. For example, `Screenshot 2026-10-29 at 1.05.33 PM.jpg` becomes `Screenshot-2026-10-29-at-1-05-33-PM.webp`, and `4D7E28F0-….heic` becomes `4D7E28F0-….webp`. A name with no letters or digits returns 400. Multer reads filenames as UTF-8 (`defParamCharset: 'utf8'`). Always use the `url` in the response rather than predicting the name.

Files are stored at `public_html/media/<context>/<id>/<filename>.webp` (plus `.w640.webp` and `.w1280.webp`).

Successful response:
```json
{ "url": "/media/projects/my-project/hero.webp" }
```

Returns `409 Conflict` if the file already exists and `overwrite` is not `"true"`.

---

### Apps — `/api/apps`

For hosting privacy policy and support pages for iOS/macOS apps submitted to the App Store. These pages are publicly browsable at `/apps/:appId/privacy-policy` and `/apps/:appId/support` on the frontend.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/apps/:id/privacy-policy` | — | Fetch privacy policy |
| POST | `/api/apps/:id/privacy-policy` | ✓ | Create privacy policy (requires `appName`, `lastUpdated`, `content`) |
| PUT | `/api/apps/:id/privacy-policy` | ✓ | Update privacy policy (merges) |
| DELETE | `/api/apps/:id/privacy-policy` | ✓ | Delete privacy policy |
| GET | `/api/apps/:id/support` | — | Fetch support page |
| POST | `/api/apps/:id/support` | ✓ | Create support page (requires `appName`, `version`, `content`) |
| PUT | `/api/apps/:id/support` | ✓ | Update support page (merges) |
| DELETE | `/api/apps/:id/support` | ✓ | Delete support page |

**`AppPrivacyPolicy` shape:**
```json
{
  "id": "myapp",
  "appName": "My App",
  "lastUpdated": "2025-01-01",
  "content": "Markdown body",
  "contactUrl": "https://...",
  "contactText": "Visit support site"
}
```

**`AppSupport` shape:**
```json
{
  "id": "myapp",
  "appName": "My App",
  "version": "1.2",
  "subtitle": "Free text subtitle shown below the heading",
  "content": "Markdown body",
  "contactUrl": "https://...",
  "contactText": "Visit support site"
}
```

Files are stored at `data/apps/<id>/privacy-policy.json` and `data/apps/<id>/support.json`. No index or nav files — these pages are not listed anywhere, only directly accessed by URL.

---

## Logging

`src/lib/logger.ts` provides a simple `logger` object with `info`, `warn`, and `error` methods. All three levels write to stdout/stderr immediately and also buffer the line in memory.

Every 5 seconds, the buffer is flushed asynchronously to `logs/app.log` (relative to `process.cwd()`). On `exit` (last resort) it flushes synchronously. The interval timer uses `.unref()` so it never prevents the process from exiting naturally.

- **Rotation:** when `app.log` reaches 5 MB, it's renamed to `app.log.1` (replacing the previous one), so logs use about 10 MB at most.
- **Buffer cap:** if the disk refuses writes, at most 5,000 lines are kept in memory. A warning records how many lines were dropped.
- **Shutdown:** on `SIGTERM`/`SIGINT`, `index.ts` stops accepting connections and waits for in-flight requests (and the writes they're doing) to finish. It then flushes the log and exits, giving up after 10 seconds.

At startup, `bootstrap.ts` creates any missing storage directories, rebuilds a missing or unreadable `index.json`/`nav.json`, logs an error if storage isn't writable, and checks `API_SECRET`. A missing secret is an error, because every write would be rejected; one shorter than 32 characters is a warning. The secret itself is never logged.

Log format:
```
[2026-01-01T12:00:00.000Z] [INFO ] Server started on port 3001
[2026-01-01T12:00:01.123Z] [WARN ] Auth failed (bad token): DELETE /api/projects/foo
[2026-01-01T12:00:02.456Z] [ERROR] POST /api/projects → 500 (3ms)
```

Every HTTP request is logged on response finish via the first middleware in `index.ts`, so requests rejected by CORS or the body parser are logged too. 5xx responses log at `error`, everything else at `info`. Routes don't log successful reads themselves (that would double them), only write outcomes and failures.

---

## Site Files: sitemap, feed, and share pages

`src/lib/site.ts` writes three kinds of public files into `publicDir`. They're rebuilt after every content change (projects, posts, app pages), at startup, and by `npm run regen`. The writes are atomic, behind the `site` lock.

- **`sitemap.xml`:** the home page, both list pages, every listed project and post, and every app page, with `lastmod` dates.
- **`feed.xml`:** an RSS 2.0 feed of the 20 newest posts (title, link, date, excerpt, tags).
- **Share pages** (`_meta/<path>.html`): one per page in the sitemap except `/`. Each is the deployed `index.html` with that page's `<title>`, meta description, canonical URL, and Open Graph and Twitter tags filled in. Every value is HTML-escaped.
  - The `.htaccess` rule in `deploy/public_html.htaccess` serves `_meta/projects/<id>.html` for `/projects/<id>` (and so on) when the file exists. Link previews then get real metadata without running JavaScript, and the page still boots the app.
  - Pages for deleted content are removed.
  - If there's no `index.html` in `publicDir` (local development), no share pages are written.

Because share pages copy `index.html`, they need rewriting after a frontend deploy: restart the backend, or run `node scripts/regenerate.js`. Until then, they reference the previous build's assets.

The share images use the 1280 px size when it exists. The site's canonical host is `SITE_URL`, with no `www`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_SECRET` | ✓ | Bearer token for write operations (32+ random characters) |
| `PORT` | — | Server port (default: `3001`) |
| `FRONTEND_URL` | — | Production frontend origin added to CORS allowlist |
| `SITE_URL` | — | Public origin for absolute URLs (default `https://jordan-christensen.com`) |
| `DATA_DIR` | — | Content directory (see Path Resolution) |
| `PUBLIC_DIR` | — | Web root (see Path Resolution) |
| `MEDIA_DIR` | — | Media directory (see Path Resolution) |

Locally, set these in `backend/.env` (gitignored; template: `.env.example`). On the server, set them as environment variables on cPanel's Setup Node.js App page (see `../DEPLOY.md`). They reach the running app, not the cPanel terminal, and the scripts don't need them.

---

## Development

```bash
cd backend
npm install
npm run dev           # tsx watch — restarts on file change
npm test              # node:test + supertest, against temporary directories
npm run regen         # one-shot: regenerate indexes, sitemap, feed, and share pages, then exit
npm run check         # read-only integrity report (bad records, stale indexes, missing/orphaned media)
npm run media:derive  # create missing 640/1280 px image sizes (-- --dry-run to preview)
npm run smoke -- https://jordan-christensen.com   # read-only checks against a deployed site
npm run snapshot      # back up the live content (GETs only) to ~/Developer/portfolio-backups/<date>-live(.tgz)
npm run build         # tsc — compile to dist/ for deployment
```

The dev server runs on port 3001. The frontend Vite dev server proxies `/api` and `/media` to it.

### Tests

`test/` uses Node's built-in runner (`node:test`) with `supertest`. Each file runs in its own process: `setup()` in `test/helpers.ts` points `DATA_DIR`, `PUBLIC_DIR`, and `MEDIA_DIR` at a fresh temp directory, quiets the logger, then imports `createApp()`. The suites are:

- `unit`: ID and filename rules, containment, validation and merge semantics.
- `api`: traversal, auth, validation, Folio semantics, concurrency, corrupt records, error responses, app pages.
- `media`: orientation, names, sizes, the 2560 px cap, animation, format checks, delete containment.
- `site`: sitemap, feed, share pages, escaping.
- `bootstrap`: first run from nothing.
- `snapshot`: the content backup against a running local server (app IDs from the sitemap, legacy media names, missing files).

Add a regression test with every fix. CI (`.github/workflows/ci.yml`) runs the type-check, tests, build, and audit.

---

## Deployment (cPanel / Phusion Passenger)

See [`../DEPLOY.md`](../DEPLOY.md): the server layout, the Node app's cPanel settings, the copy of the live `.htaccess`, the step-by-step deploy, running scripts on the server (Node lives in a cPanel-managed environment), rollback, and backups. The `public_html/media/` directory is served directly by LiteSpeed/Apache as static files; the Node process doesn't serve media in production.
