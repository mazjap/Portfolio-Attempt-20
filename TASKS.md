# Portfolio Tasks

Work for the site and for Folio. Most items come from [AUDIT.md](AUDIT.md) (numbers like `#7` refer to its findings) and from the review of it on October 29, 2026. Difficulty: **S** (under an hour or two), **M** (a few hours), **L** (a day or more, or needs design decisions).

The fixes follow a five-phase plan. Testing is batched: the user is testing everything at the end (after the Folio changes it needs), so every item to test or deploy is collected in **Testing and deploying** at the bottom. Add to it whenever something needs checking by hand.

1. **Security**: path validation, safe media names, dependency upgrades (backend first)
2. **Data integrity**: atomic and serialized writes, validation, bootstrap, JSON errors (backend)
3. **Frontend crashes**: gallery, request races, error boundary
4. **Usability and accessibility**: links, keyboard, mobile app pages, contrast, polish
5. **Tooling**: tests, CI, strict TypeScript, clean lint, deployment templates, docs

Features come after phase 3 at the earliest. Each section below is ordered by phase.

## Frontend

### Phase 1: Security

- [x] **Dependency fixes** (S): `npm audit fix` updated React Router (7.18.0 → 7.18.5), Vite (8.0.16 → 8.3.5), PostCSS, and the build tooling. `npm audit` now reports 0 vulnerabilities. Only `package-lock.json` changed. The build passes, and lint is unchanged (9 errors, 4 warnings, all pre-existing).

### Phase 3: Crashes

All checked items were verified on October 29, 2026 in headless Chrome against a production build, with a scratch backend and a proxy that delays or fails chosen requests (12 checks, all passing).

- [x] **Gallery crash when switching projects** (S, #7): `ProjectDetail` keys `MediaCarousel` by project ID, and the carousel keeps its index in range. Verified: third image selected, then a one-image project opened from the sidebar, and it shows that image with no error.
- [x] **Stale requests show the wrong page** (M, #8): a new `useResource(key, load)` hook (`src/hooks/useResource.ts`) loads a detail item for the current ID only.
  - It aborts superseded requests and ignores late results.
  - It shows the loading state straight away when the ID changes, so the old article disappears.
  - It offers `retry()`.
  - `ProjectDetail`, `PostDetail`, and `AppPage` use it.
  - `api.ts` now throws a typed `ApiError` (with `isNotFound()`), accepts an `AbortSignal`, and URL-encodes IDs.
  - Verified: A → slow B → A ends on A, and B's late response is ignored.
  - This removed 3 `set-state-in-effect` lint errors (now 6 errors and 4 warnings, all in the list hooks and console).
- [x] **Not found and load errors** (S, #22): a missing project or post now shows an Xcode-style "cannot find project '…' in scope" message with a link back, instead of silently redirecting to the list. Server or network errors show a message with **Try Again** (`components/shared/LoadProblem.tsx`).
- [x] **Error boundary** (S, #9): `ErrorBoundary` (`components/shared/ErrorBoundary.tsx`) has two levels.
  - **Route level** (in `App.tsx`): the navbar and console stay usable, and it resets when the path changes. It shows "Thread 1: Fatal error" with Try Again, Reload Page, Home, and collapsed details.
  - **Top level** (in `main.tsx`): catches errors outside the routes.
  - A lazy page whose chunk failed to load (a deploy while the tab was open) gets an "out of date, reload" message, because React caches the failed import.
  - Verified with a record whose title is an object, and with the project page's chunk blocked.
- [x] **Defensive rendering** (S, #5): `StatusBadge` shows an unknown status neutrally instead of crashing. Tags, tech stack, media, links, and Markdown content are guarded against missing or wrongly typed values, including stale `localStorage` caches. Verified with a project whose status is `nonsense`, and a cached post without tags.

### Phase 4: Usability and accessibility

Done October 29, 2026. Verified in headless Chrome against a production build (16 phase 4 checks, plus the 12 phase 3 checks still passing) and by the Vitest suite.

- [x] **Project cards as real links** (S, #15): the title link stretches over the card, so it's keyboard-focusable (with a ring), and supports open-in-new-tab and copy-link.
- [x] **Console keyboard** (S, #15):
  - Tab completes only when something is typed, so Shift+Tab and Tab on an empty line move focus.
  - Escape and the close buttons return focus to `>_`.
  - The panel is a labeled dialog, the output is a live log, and there are focus rings.
  - "Tab completes" is in `help`.
- [x] **Gallery and sidebar names** (S, #15):
  - Thumbnails are named and marked `aria-current`, and arrow keys move through the gallery.
  - Sidebar items use `aria-current="page"`, and status dots have hidden text.
  - Tag filters use `aria-pressed`.
- [x] **Mobile navigation** (S, #17): app pages show Privacy/Support tabs below `lg`. Project and post pages show "← All projects/posts".
- [x] **App pages load independently** (S, #14): done in phase 3.
- [x] **Dates shown a day early** (S, #20): `formatCalendarDate` (`src/lib/dates.ts`). Tested in `America/Denver`.
- [x] **Light-theme contrast** (M, #16): the accent colors are theme-aware CSS variables.
  - Light values are 4.6–5.8:1 on both light backgrounds (were 1.6–3.0).
  - Dark muted and red were nudged to pass on the dark surface.
  - The console keeps its dark colors via `xcode-dark-tokens`, and the home button text flips for contrast.
- [x] **⌘R** (S, #21): no longer intercepted (the browser reloads). ⌘B and ⌘⇧K remain, are ignored while typing, and their timers are cancelled on repeat and on unmount.
- [x] **Markdown fixes** (S, #30):
  - `ol start` is kept, and fences without a language render as blocks.
  - Site links use the router, files and `mailto:` are plain links, and other sites open in a new tab.
  - Headings get anchors (`rehype-slug`), tables scroll, and images are lazy.
  - The app page layout got `min-w-0`; no overflow at 375 px.
- [x] **Minimap stale height** (S, #19): the height is re-measured on each scan, and it rescans per `contentKey`. It does no work below `xl`, updates once per frame, and only the highlight re-renders while scrolling.
- [x] **Shared data layer** (M, #23): `src/lib/cache.ts` + `useCachedList`.
  - Entries are versioned and validated, use stale-while-revalidate, never cache failures, and share in-flight requests.
  - The console uses it (so it respects `VITE_API_BASE_URL`) and fetches nothing until opened.
  - The old `useCache` and the console's 24-hour cache are gone.
  - Failed lists get **Try Again**.
- [ ] **Show fresh content after a publish** (S, Folio AUDIT.md #24): the shared cache revalidates when a list mounts, but a page left open never shows a Folio publish. Revalidate lists and nav on window focus and `visibilitychange`.
- [x] **Polish** (S, #31):
  - Empty blog and empty project-list messages.
  - `Home` interval cleanup.
  - `localStorage` wrapped (including the theme script in `index.html`).
  - Global `prefers-reduced-motion` rule, and no typing animation with reduced motion.
  - Skip link, plus scroll-to-top and focus on navigation (`RouteChangeHandler`).
  - The home heading reads the whole name to screen readers.
- [x] **Project card overlap** (S): the ★ moved to the top-left.
- [x] **Home code background** (S): the comments now describe Mapbox and `@Observable`.
- [x] **Page titles** (M, #24): `useDocumentTitle` on every page (title and meta description). Link previews come from the backend's share pages. `index.html` has the RSS link and a real default description, and `public/robots.txt` points at the new sitemap.
- [x] **Image loading** (S, #25): `ResponsiveImage` (srcset from the backend's sizes, lazy by default, falls back to the full image if a size is missing). No `width`/`height` yet: content records don't store dimensions, and the containers have fixed aspect ratios.

### Phase 5: Tooling

- [x] **Clean lint** (M, #29): `npm run lint` reports 0 problems (was 13).
- [x] **Strict TypeScript** (S, #29): `"strict": true` in `tsconfig.app.json`; no changes were needed.
- [x] **Tests** (M): Vitest 5 + Testing Library on jsdom, 23 tests in 7 files. They cover request races, gallery bounds and keys, the error boundary, the project card link, console focus, the Markdown fixes, the cache, and the helpers. Reverting the gallery clamp or the date fix makes them fail.
- [x] **Docs** (S, #33): the README describes the project instead of the Vite template; the DEVDOC covers the cache, images, accessibility, and tests.
- [x] **Remove dead code** (S, #32): the `ScrollMinimap` `seed`/`rows`/`ready` props and `IGNORE_TAGS`, the console's `minimized` mode, the fake "Run" toast, `useCache`, and the duplicated `getCategoryExtension` (now `src/lib/category.ts`).

### Features

- [ ] **Open Quickly (⌘⇧O)** (M): a fuzzy finder over projects, posts, and app pages, with arrow keys, Enter, and Escape, styled like Xcode's. Use the nav data (shared data layer). Make it reachable from a button for touch and mouse users too.
- [ ] **Jump bar** (S): an Xcode-style breadcrumb under the navbar on detail pages (`portfolio › projects › trekpoint.swift`), using the same file extensions as the cards. Each segment links to its level, and the last opens a menu of sibling items. It doubles as mobile navigation (#17).
- [ ] **More console commands** (M):
  - `cat <id>`: print a post's or project's text in the terminal.
  - `git log`: recent commits (from the GitHub API, cached).
  - `vim`: a fake vim that `:q` won't leave, but Escape or `:q!` will.
  - `pet koda` 🐕, `man jordan`, `exit`.
  - Add the new commands to `help` and tab completion.
- [ ] **⌘R actually runs something** (L): on a project page with a runnable demo, ⌘R opens a fake Simulator window running it. Start with the NES emulator if it can build to WebAssembly. Elsewhere ⌘R reloads as normal. Add a per-project `demo` field (see Backend), and lazy-load the runner.
- [ ] **Trail map** (L): a `/hikes` page drawing GPX tracks exported from TrekPoint, with distance, elevation, and date. MapLibre GL is free; Mapbox GL matches TrekPoint but needs a public token. Needs the backend hikes API and Folio upload.

## Backend

### Phase 1: Security

- [x] **Path traversal** (S, #1–2): `src/lib/paths.ts` defines the ID rules (`isValidContentId`, `isValidSlug`, `isValidMediaFilename`) and `resolveInside()`.
  - Every router validates `:id` (and media's `:filename`) with `router.param`. Invalid IDs get 404 on GET and 400 on writes.
  - Creates check the body `id`, and the upload checks its `id` field.
  - `index` and `nav` are reserved (#11).
  - Verified in a scratch copy: encoded and literal traversal on every route returns 404 or 400, and no files were read, written, or deleted outside their folders.
- [x] **Safe media filenames** (S, #18): `safeMediaBaseName()` makes names URL-safe and keeps case (`photo#1.jpg` → `photo-1.webp`, `Café Ünïcode.png` → `Cafe-Unicode.webp`). Multer now reads filenames as UTF-8. Deletes are limited to image extensions.
- [x] **Upright photos** (S, #18): `.rotate()` applies the EXIF orientation before conversion. A 120×60 JPEG tagged "rotate 90°" now stores as 60×120. Animated GIFs keep their frames.
- [x] **Dependency upgrades** (S, #6): Express 4.22.3 (body-parser 1.20.9, proxy-addr 2.0.8, qs 6.16.2), Multer 2.5.0, sharp 0.35.5, and `@types/multer` 2.3.0. `npm audit` now reports 0 vulnerabilities.
- [x] **Constant-time token check** (S, found in review): `authenticate` compares SHA-256 digests with `timingSafeEqual`. A missing `API_SECRET` still rejects everything.

### Phase 2: Data integrity

All checked items were verified end to end in a scratch copy on October 29, 2026. Every record on the live site (21) passes the new validation, as does all local content.

- [x] **Atomic, serialized writes** (M, #3): `writeJSON` writes a hidden temp file and renames it into place. Every write route runs inside `withLock('<projects|posts|apps|media>')` (`src/lib/lock.ts`). Eight parallel updates to one project now all survive, where 3 of 8 were lost before. Twenty parallel creates all appear in the index, with no temp files left over. The lock is in-process only; revisit if Passenger runs several processes.
- [x] **Regeneration tolerates bad records** (S, #4):
  - Records are read separately. Unreadable files, or files missing fields the lists need, are skipped and logged by name.
  - If every record fails, the existing `index.json`/`nav.json` are kept.
  - A failed regeneration after a successful save is logged, not reported as a failed request.
  - `npm run regen` exits with 1 when it skips anything.
  - New `npm run check` (read-only) reports bad records, stale indexes, invalid app files, missing and unreferenced media, and leftover temp files.
- [x] **Request validation** (M, #5, #13): hand-written schemas in `src/lib/schemas.ts` (no new dependency) for projects, posts, privacy policies, and support pages.
  - Validates required fields, types, enums, ISO dates, calendar dates, URLs, and length limits, and returns 400 with every problem in `error`.
  - Folio's semantics are kept: PUT is a merge, `null` removes an optional field, and `createdAt` is editable.
  - `id`, `readingTime`, and `updatedAt` are server-owned. Unknown fields are dropped and logged.
  - Creates fill in defaults, so stored records always have the full shape.
- [x] **IDs can't change through PUT** (S, #10): `id` in an update body is ignored.
- [x] **First-run bootstrap** (S, #12): at startup the server creates missing storage directories, rebuilds a missing or unreadable `index.json`/`nav.json`, and logs an error if storage isn't writable. Tested from a completely empty data folder. The `.gitkeep` files are restored.
- [x] **JSON errors** (S, #22):
  - The request logger now runs first.
  - 404s and errors are JSON with no stack traces.
  - The body limit is an explicit 1 MB (413 when exceeded).
  - CORS rejections return 403.
- [x] **Media lifecycle** (M, #26):
  - The server checks the decoded format (a text file renamed `.jpg` gets 400), with limits of 100 MP and 500 frames.
  - Animated WebP now keeps its animation.
  - Output is staged in a temp file and renamed into place, and conversions run one at a time.
  - Video stays URL-only (documented).
  - `npm run check` is the orphaned-media report.
  - Found while testing: prebuilt sharp **can't decode HEIC** (before this, it was a 500). It's now a clear 415; see the Folio task.
- [x] **Logging and operations** (M, #27):
  - `app.log` rotates to `app.log.1` at 5 MB.
  - The memory buffer is capped at 5,000 lines.
  - Successful reads are logged once.
  - SIGTERM drains open requests, flushes the log, and exits (10-second timeout).
  - Startup reports a missing or short `API_SECRET` (without printing it).
  - `GET /api/health` returns 200 or 503.
  - `"engines": { "node": ">=20.9" }` is in `package.json`.
- [x] **Phase 1 fix** (found by `npm run check`): existing media have names with spaces and odd characters (`1. Launch.webp`, `Screenshot … 1.45.58â¯PM.webp`), so URL validation and the media delete route now accept them. The phase 1 delete rule had rejected them, which would have broken Folio's unused-image cleanup for trekpoint, portfolio, and hailey60.

- [ ] **Conditional writes** (M, Folio AUDIT.md #4): Folio's stale-draft check only compares versions when an editor opens; a save from another device or window in between is silently overwritten. Accept the `updatedAt` the client started from (an `If-Unmodified-Since`-style field or header, or an ETag) on `PUT` and `DELETE`, compare it inside the existing `withLock`, and return 409 with the current record when it doesn't match. Then Folio sends it and offers reload/compare on conflict (Folio task below).
- [ ] **`updatedAt` on app pages** (S, Folio #4, #10): privacy policies and support pages have no server version, so Folio's app-page drafts can't be detected as stale, and conditional writes have nothing to compare. Set it on create and update, like posts.
- [ ] **Media lifecycle on delete** (M, Folio #12):
  - Deleting a project or post leaves `media/<context>/<id>/`. Delete it (with its sizes), or have `npm run check` list it.
  - Folio only deletes files in an item's own folder, but another item could still embed one of them. Have the media delete route refuse (409) a file that another record references, so cleanup can't break a page.
- [ ] **Safe retry of creates** (S, Folio #16): a create that saved on the server but whose response was lost gets 409 when Folio retries. Either accept an idempotency key, or return the existing record when an identical create is retried.

### Phase 4: Usability

- [ ] **App index endpoint** (S, Folio #25): `GET /api/apps` listing app slugs and which pages exist, so Folio can stop keeping the app list in UserDefaults on each device (Folio task below).
- [x] **Bounded image sizes** (M, #25):
  - Uploads are stored at most 2560 px, plus `.w640.webp` and `.w1280.webp`, all staged and renamed together. Deleting an image deletes its sizes.
  - `npm run media:derive` backfills older images (run once on the server).
  - Dimensions aren't stored; that would need a content-format change Folio would have to know about.
- [x] **Sitemap and RSS** (S, #24): `src/lib/site.ts` writes `sitemap.xml` and `feed.xml` to the web root after every content change and at startup.
- [x] **Share metadata** (M, #24): the share pages chosen are `_meta/<path>.html`, the deployed `index.html` with per-page title, description, canonical, and Open Graph/Twitter tags, all escaped. They're served by an `.htaccess` rule when present, and removed when content is deleted. They need regenerating after a frontend deploy (see DEPLOY.md).

### Phase 5: Tooling

- [x] **Regression tests** (M, #29): `node:test` + `supertest`, 26 tests in 5 files, each against its own temp directories. They cover:
  - traversal (encoded and literal), reserved IDs, auth;
  - validation and Folio's write semantics;
  - concurrent updates, corrupt records, error responses, app pages;
  - uploads (rotation, names, sizes, the 2560 px cap, animation, format checks) and delete containment;
  - sitemap, feed, and share pages (including escaping);
  - first-run bootstrap.

  Disabling path validation or the write lock makes them fail. `src/app.ts` (`createApp()`) was split out of `index.ts` for this.
- [x] **CI** (S): `.github/workflows/ci.yml` runs on pushes to `main` and on pull requests (Node 22):
  - Backend: type-check, tests, build, and `npm audit --omit=dev`.
  - Frontend: lint, tests, build, and `npm audit`.

  It hasn't run on GitHub yet; it runs after the next push.
- [x] **Deployment templates** (S, #28):
  - `deploy/public_html.htaccess`: HTTPS, an optional www→bare redirect, both live legacy app-link forms, the `_meta` share-page rule, the SPA fallback, and caching headers.
  - `deploy/backend.htaccess` (`SetEnv` placeholders) and `backend/.env.example`.
  - `DEPLOY.md`: layout, steps, server commands, rollback, and backups.
  - `npm run smoke -- <url>`, a read-only post-deploy check. Against the live site today it confirms what's missing until this work is deployed: `/api/health`, `feed.xml`, JSON 404s, share pages, and image sizes.
- [x] **Configurable content root** (S, #28): `DATA_DIR`, `PUBLIC_DIR`, `MEDIA_DIR`, and `SITE_URL`.
- [x] **Shared types** (M, #32): `frontend/src/types/index.ts` is now type-only re-exports of `backend/src/lib/types.ts`. Folio's Swift models are still separate.

### Features

- [ ] **Project demo field** (S): an optional `demo` (a URL or a bundled WebAssembly app's path) on projects, for "⌘R actually runs something".
- [ ] **Hikes API** (M): `data/hikes/<id>.json` plus GPX files under `public_html/media/hikes/`, with the same ID rules, regeneration (`index.json` with stats), and auth as projects. Compute distance and elevation gain at upload. Strip or blur the first and last few hundred meters of each track so it doesn't reveal home locations.

## Folio

Folio's own audit is `Folio/AUDIT.md` (numbers below like "Folio #3" refer to it). Its Folio-only fixes were done on October 29, 2026, with 100 passing unit tests on macOS (also run on iOS); see `Folio/DEVDOC.md` for how each works now. None of it has been tried by hand yet (see **Testing and deploying**).

- [x] **Show server error messages** (S): `APIError.httpError` carries the server's `error` text, which the alerts show. Also, `ContentRules` copies the server's schemas, so most problems are explained before saving (required tagline, link schemes, lengths, list sizes).
- [x] **Limit slugs to 100 characters** (S): and `index` / `nav` are refused for projects and posts. New items show their public path.
- [x] **Fix the stale path in `CLAUDE.md`** (S).
- [x] **Convert HEIC before uploading** (S): `PendingImage.prepare` converts anything the server can't (HEIC, TIFF, …) to JPEG at 0.9, keeping orientation metadata, off the main actor. Unreadable or over-25 MB images now show an error instead of being silently skipped.
- [x] **Folio audit fixes** (L, Folio #1–3, #5–20, #22, #25):
  - **Environments:** lists reload when the environment changes, and editors refuse to save, upload, or delete after a switch (#1). Base URLs are checked and saved only with Save (#15). Drafts are keyed by environment; old drafts are restored once and confirmed (#2).
  - **Saving:** an item that failed to load can't be saved (it used to erase the post), edits made while saving are kept, and saves can't overlap (#3). List deletes need confirmation (#8). App pages clear contact fields with `null` (#9) and have drafts, Preview, and validation (#10).
  - **Drafts:** write and read failures are reported (unreadable drafts are kept aside) (#5); drafts include an unuploaded hero image, show offline when the item can't load, and save when the app goes to the background (#6).
  - **Media:** the ID locks when an upload starts and stays locked in drafts (#11); uploads removed before saving are deleted, and failed cleanup is reported as "saved" and retried (#12); drag reordering works in both directions, with Move Up/Down (#13); thumbnails use the server's 640 px copies (#25).
  - **Other:** cancelled first loads retry (#7), Keychain saves update in place (#17), privacy-policy dates are saved as the day picked (#18), Dynamic Type and labels (#19), Highlight Changed Lines only where it works and alt text on inserted images (#20), the incoming-network entitlement is gone (#22), and "Remove from List" for apps (#25). The duplicate macOS Settings tab is gone.
- [ ] **Send the version on save** (S, after **Conditional writes** in Backend): send the `updatedAt` the editor loaded, and on 409 keep the draft and offer to reload or compare.
- [ ] **App list from the server** (S, after **App index endpoint** in Backend): replace the UserDefaults list.
- [ ] **Left from the Folio audit** (M):
  - One new-post (and new-project) draft per environment, so two windows creating posts at once share it (Folio #2). Fixing it needs a drafts list to find several.
  - UI tests and CI for Folio (#21): the UI targets are still Xcode's templates.
  - The app icon has no artwork (#22).
  - `ProjectPreview.swift` holds `ProjectListRow`; rename it once your changes to it are committed (#22). `fetchPostNavs` / `fetchProjectNavs` have no callers (#22); remove them unless something will use them.
  - `Helpers/Image+Data.swift` is now unused (the hero preview uses a downsampled thumbnail).
- [ ] **Phase 2 compatibility** (S): the server now owns `readingTime`, `updatedAt`, and `id` (ignored if sent), drops unknown fields, and removes fields sent as `null`. Folio's payloads were checked against this and should be accepted as they are. Confirm by hand (see **Testing and deploying**), and update the Folio fakes if they echo back fields the server no longer stores.
- [ ] **Hikes tab** (M, Trail map feature): import a GPX file (from TrekPoint's share sheet or the Files app), preview it on a map, set a title and date, and upload it to the hikes API.
- [ ] **Demo field** (S, "⌘R actually runs something" feature): edit a project's `demo` in the project form.

## Testing and deploying (you)

Nothing below has been tested by hand yet. It's all batched until Folio's changes are in (at least **Convert HEIC before uploading** and **Show server error messages**). Run the backend with `npm run dev` in `backend/`, and the frontend with `npm run dev` in `frontend/`.

### Backend (phases 1–2)

- [ ] Run `npm run check` in `backend/` and read the report. Locally it should show only three things:
  - The stale `projects/nav.json` (your staged `featured` change; `npm run regen` fixes it).
  - Two `hero.jpg` files missing from your local media copy.
  - Two unreferenced keyboard-build images.
- [ ] `curl localhost:3001/api/health` returns `{"status":"ok"}`. `curl localhost:3001/api/nope` returns a JSON 404.

### Folio against the local backend (phases 1–2)

Point Folio's Dev environment at `http://localhost:3001`.

- [ ] Edit and save **trekpoint**, **portfolio**, and **hailey60**. Their media have legacy names with spaces, so this is the most important check.
- [ ] Remove an image from one of those three and save, so the unused-file cleanup deletes a legacy-named file.
- [ ] Create, edit, and delete a project and a post. Also create a project with only the required fields.
- [ ] Clear a project's category, and clear a post's series and hero image (each should disappear, not show `null`).
- [ ] Backdate a post's `createdAt`, and check that the list order changes.
- [ ] Upload a phone photo taken sideways (it should be upright), a file with spaces or accents in its name (it should get a clean name), and an animated GIF.
- [ ] Upload a HEIC (an iPhone camera photo from Photos, and a `.heic` file on macOS). It should just work, and stay upright.
- [ ] Edit both app pages, and clear a contact URL.
- [ ] Try a bad slug and an empty title. They should be impossible, or show the server's message.

### Folio audit fixes

- [ ] **Settings:** existing URLs and keys still load. Typing a URL changes nothing until **Save**. `localhost:3001`, `http://example.com`, and `https://…/api` show a message. On macOS there's no Settings tab, and ⌘, opens Settings.
- [ ] **Old drafts:** if you had drafts before this change, opening that item asks "Keep this older draft?" once.
- [ ] **Environments:** with Dev's Projects list showing, switch to Prod: the list reloads. Open a post in Dev, switch to Prod in Settings, and Publish: it should refuse ("opened from Development").
- [ ] **Deleting from lists:** the context menu (and swipe on iOS) asks first, naming the environment.
- [ ] **Offline:** edit a post so it has a draft, stop the backend, and reopen it: it shows the draft with a banner and can't be published. Start the backend and click **Try Again**: the draft stays, and Publish works. Without a draft, a failed load shows "Couldn't Load This Post" instead of an empty form.
- [ ] **Saving while typing:** against a slow server (or with a big hero image), keep typing after Publish: what you typed afterwards stays, as a draft.
- [ ] **Gallery:** drag an image onto the one below it (they swap) and onto the last one (it moves to the end). Try Move Up/Down in the row's context menu, and with VoiceOver's actions.
- [ ] **Uploads:** insert an image, delete its markdown, and Publish: the file is deleted from `public_html/media`. On a new post, the slug field locks as soon as the upload starts.
- [ ] **Privacy policy date:** the picker shows the stored date. Pick a date in the evening (Denver time) and save: the stored `lastUpdated` is the day you picked, and the site shows the same day.
- [ ] **Previews:** the Preview toggle works for project descriptions and both app pages.
- [ ] **iOS:** the editor text follows Dynamic Type (Settings → Accessibility → Larger Text), and the toolbar buttons are easy to tap.
- [ ] **⌘⌫ in the editor (macOS):** check whether ⌘⌫ (delete to the start of the line) in the markdown editor opens the Delete dialog instead, since Delete Post uses that shortcut. It wasn't changed; pick a different shortcut if it does.
- [ ] **Thumbnails:** list and gallery thumbnails show for both older images (before `npm run media:derive` gives them smaller copies) and newer ones.

### Frontend (phase 3)

With both dev servers running, open `http://localhost:5173`.

- [ ] Click through every project, post, and app page (privacy and support for `trekpoint`, `numbase`, and `flask-master`). Everything should look as before.
- [ ] On a project with several images (like trekpoint), select the last image, then open a project with fewer images from the sidebar. It should show that project's first image.
- [ ] Click quickly between several projects in the sidebar. The heading should always match the URL.
- [ ] Open `/projects/nope` and `/blog/nope`: you should see "cannot find … in scope" with a link back, not a redirect.
- [ ] Stop the backend and open a project: you should see "couldn't load this project". Start the backend and click **Try Again**.
- [ ] Open an app page: the requested page should appear without waiting for the other.
- [ ] Toggle dark mode on the new error and not-found screens.

### Frontend (phases 4–5)

- [ ] Switch to light mode: muted text, links, the status colors, and inline code should be darker and still look right. Dark mode should look as before.
- [ ] Keyboard only on `/projects`:
  - The first Tab shows "Skip to content".
  - Tab reaches each card (a ring around it), and Enter opens it.
  - Open the console with Enter on `>_`, and check that Shift+Tab leaves it and Escape returns to `>_`.
- [ ] Press ⌘R on any page: it should reload. ⌘B and ⌘⇧K still show the toasts, but not while typing in the console.
- [ ] Narrow the window below 1024 px:
  - App pages show Privacy/Support tabs.
  - Project and post pages show "← All projects/posts".
  - At phone width, nothing scrolls sideways.
- [ ] In a post or project with Markdown:
  - Internal links stay in the tab and don't flash.
  - External links open a new tab.
  - Hovering a heading shows `#`.
  - Wide tables scroll.
- [ ] Turn on Reduce Motion (System Settings → Accessibility → Display): the home page shows the name without typing it out, and nothing blinks or slides.
- [ ] Check the tab titles on a few pages ("TrekPoint · Jordan Christensen", and so on).

### Deploy (phases 1–5 together)

Follow `DEPLOY.md`. In short:

- [ ] Check the host's Node version first: sharp 0.35 needs 20.9 or later.
- [ ] Merge `deploy/public_html.htaccess` into the live `~/public_html/.htaccess`, keeping cPanel's Passenger block. Decide whether to turn on the www→bare redirect.
- [ ] **Backend:** `npm run build`, then upload `dist/` contents, `package.json`, and `package-lock.json` to `~/backend-server/`. Run `npm ci --omit=dev` there, and restart.
- [ ] **Frontend:** `npm run build`, then upload `dist/` contents to `public_html/`. Then restart the backend again (or run `node scripts/regenerate.js`), so the share pages use the new `index.html`.
- [ ] Once: run `node scripts/derive-media.js` in `~/backend-server`, to create the smaller sizes for existing images.
- [ ] The first start replaces the old hand-written `public_html/sitemap.xml` (it lists `www.` URLs from the previous site), and the new `robots.txt` points at it. Download the old one first if you want to keep it.
- [ ] Run `npm run smoke -- https://jordan-christensen.com` from `backend/`. Everything should PASS.
- [ ] After deploying:
  - Run `node scripts/check.js` in `~/backend-server`.
  - Open an old app link (`/trekpoint-privacy`).
  - Paste a project URL into iMessage or Slack and check the preview.
  - Do one Folio edit and one upload against Prod.
- [ ] Find out what Namecheap's backups (JetBackup or whatever the plan includes) cover, and how often. They should include `~/data/` and `public_html/media/`.
