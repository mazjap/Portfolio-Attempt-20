# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Jordan Christensen's personal site (jordan-christensen.com): an Xcode-themed developer portfolio, a Markdown blog, and the privacy policy and support pages for his App Store apps. There's no database or CMS: content is JSON files on disk, media is WebP files, and a small Express server reads and writes them. It's hosted on Namecheap cPanel shared hosting (Phusion Passenger + LiteSpeed/Apache), which rules out Docker, managed databases, background workers, and root access. Keep solutions within that constraint.

- `backend/`: Express 4 + TypeScript (ESM, `NodeNext`, `strict`). REST API for projects, posts, app pages, and media uploads (`sharp` → WebP). See `backend/DEVDOC.md`.
- `frontend/`: React 19 + Vite + Tailwind 3 + React Router 7 SPA (`BrowserRouter`). See `frontend/DEVDOC.md`.
- `Folio/`: a separate git repository (gitignored here) with the SwiftUI CMS app that edits the site through the API. It has its own `CLAUDE.md` and `DEVDOC.md`. Don't change it from this repo's tasks unless asked, but check it when you change the API (see "API contract").

The DEVDOCs are the detailed reference (API shapes, storage model, minimap, layout), and `DEPLOY.md` covers deployment. Read the relevant section before changing a subsystem, and update the DEVDOC when you change how something works. `AUDIT.md` is an October 2026 audit of the frontend and backend; it lists known defects, so check it before "discovering" a bug. `TASKS.md` is the work list (Frontend, Backend, Folio), organized by the five-phase fix plan plus planned features. Check off items as they're done. The user batches manual testing, so add anything that needs checking by hand to its **Testing and deploying** section.

## Setup

`backend/.env` (gitignored; template `backend/.env.example`) holds `API_SECRET` (the Bearer token for writes) and optional overrides: `PORT` (default 3001), `FRONTEND_URL` (CORS), `SITE_URL`, `DATA_DIR`, `PUBLIC_DIR`, and `MEDIA_DIR`. On cPanel they're `SetEnv` directives in `.htaccess` (template `deploy/backend.htaccess`). **Never commit `.env` or print the secret.** The frontend's only variable is `VITE_API_BASE_URL` (default `""`, same origin).

Content is gitignored: `backend/data/projects/*.json`, `backend/data/posts/*.json`, `backend/data/apps/*/*.json`, and `backend/public_html/media/`. The local copies are real content, not fixtures, and git can't restore them, so never delete or overwrite them. For experiments, point `DATA_DIR`, `PUBLIC_DIR`, and `MEDIA_DIR` at a scratch directory (the backend tests do this). The generated `backend/public_html/{sitemap.xml,feed.xml,_meta/}` are gitignored too.

**The live site is production.** Never send a write (`POST`, `PUT`, `DELETE`, upload) to jordan-christensen.com without asking the user and getting an explicit yes, every time. Read-only `GET`s are fine.

## Commands

```sh
# Backend (port 3001)
cd backend
npm run dev           # tsx watch src/index.ts
npm test              # node:test + supertest against temp dirs (test/*.test.ts)
npm run regen         # rebuild index.json/nav.json, sitemap.xml, feed.xml, share pages, then exit
npm run check         # read-only integrity report: bad records, stale indexes, missing/orphaned media
npm run media:derive  # create missing 640/1280 px image sizes (-- --dry-run to preview)
npm run smoke -- https://jordan-christensen.com   # read-only checks against a deployed site
npm run build         # tsc → dist/
npx tsc --noEmit      # type-check only

# Frontend (port 5173; proxies /api and /media to localhost:3001, so run the backend too)
cd frontend
npm run dev
npm test              # Vitest + Testing Library (jsdom, TZ=America/Denver)
npm run lint          # eslint (clean: keep it that way)
npm run build         # tsc -b (strict) && vite build → dist/
npm run preview
```

Before calling a change done, run both test suites, both builds, and frontend lint. CI (`.github/workflows/ci.yml`) runs the same checks plus `npm audit`. Every fix gets a regression test: backend tests in `backend/test/` (one temp data directory per file, via `setup()` in `test/helpers.ts`), and frontend tests next to the code as `*.test.ts(x)`. For behavior the tests can't show (layout, real browsers), run the built frontend against a scratch backend.

## Git workflow

`main` is the only branch. Commit only when the user asks. The user often has staged and unstaged work in progress, so commit only your own files, by explicit path (never `git add -A` or `git commit -a`), and leave changes you didn't make alone. If they would get in the way, ask instead of stashing or discarding them.

## Deployment

Deployment is manual; follow `DEPLOY.md`. The live `.htaccess` isn't in the repo, but `deploy/public_html.htaccess` is a sanitized template: HTTPS, both legacy app-link forms, the `_meta` share-page rule, the SPA fallback, and caching. The host needs Node 20.9+ (sharp 0.35). After a frontend upload, the share pages need regenerating (restart the backend or `node scripts/regenerate.js`). `npm run smoke -- https://jordan-christensen.com` checks a deploy.

## Architecture

### Backend

- `src/app.ts` builds the Express app (`createApp()`, no `listen`), and `src/index.ts` starts it: bootstrap, listen, graceful shutdown. Tests import `createApp()`.
- `src/lib/files.ts` resolves `data/` (`DATA_DIR`) and `public_html/` (`PUBLIC_DIR`, with `media/` inside unless `MEDIA_DIR` is set) relative to `import.meta.dirname/../..`. Locally that's `backend/`. On the server, compiled files live in `~/backend-server/lib/`, so it's the home directory. Moving files between `src/lib/` and other directories changes where data resolves. The values are read when `files.ts` first loads. The logger writes to `logs/app.log` relative to `process.cwd()`, not the file.
- Each project/post is `data/<kind>/<id>.json`. Every write route (POST/PUT/DELETE) then calls `regenerateProjects()`/`regeneratePosts()` (`src/lib/regenerate.ts`), which reads every record and rewrites `index.json` (list/preview shape) and `nav.json` (sidebar shape). List and nav endpoints only read those files. `index` and `nav` are therefore reserved and can't be content IDs. Regeneration skips and logs records it can't list rather than failing, and the server rebuilds missing indexes at startup (`src/lib/bootstrap.ts`). Projects sort featured-first, then by `updatedAt ?? createdAt` descending. Posts sort by `createdAt` descending.
- App pages are `data/apps/<appId>/privacy-policy.json` and `support.json`, with no index. They're only reached by URL (App Store links point at them, so their URLs must keep working).
- `authenticate` (`src/middleware/auth.ts`) guards every write route. GETs are public. Uploads authenticate before Multer runs. Keep that order.
- Any ID, appId, or filename taken from a URL or request body becomes a filesystem path. Validate it with the rules in `src/lib/paths.ts` (`isValidContentId`, `isValidSlug`, `isValidMediaFilename`), using `router.param(…, validParam(…))` for route parameters, and build the path with `resolveInside(root, …)`, never `join`. Authentication doesn't make a path safe. Uploaded filenames go through `safeMediaBaseName`. See "IDs and Paths" in `backend/DEVDOC.md`.
- Writes:
  - Always write through `writeJSON` (a temp file, then an atomic rename). Never use `writeFile` on a content file.
  - Wrap every read-merge-write(-regenerate) sequence in `withLock('<projects|posts|apps|media>', …)` (`src/lib/lock.ts`). The lock is in-process only (see "Writes and concurrency" in the DEVDOC).
- Validate every write body with `parse(schema, body, 'create' | 'update')` from `src/lib/schemas.ts`, and merge updates with `applyUpdate`. A new field needs adding to its schema, or it's silently dropped.
- Errors are JSON (`src/middleware/errors.ts`). Don't let Express's HTML error pages back in.
- Media uploads (`src/routes/media.ts`, `src/lib/images.ts`):
  - Uploads go to `os.tmpdir()`, and the server checks the decoded format (not the client's MIME type).
  - `sharp` writes `name.webp` (at most 2560 px) plus `name.w640.webp` and `name.w1280.webp`. All are staged as temp files and renamed into place together.
  - Conversions run one at a time.
  - Uploads that would overwrite an existing file get 409 unless `overwrite=true`.
  - Deleting `name.webp` also deletes its sizes.
  - HEIC gets 415, because prebuilt sharp can't decode HEVC.
- `src/lib/site.ts` writes `sitemap.xml`, `feed.xml`, and the share pages (`_meta/<path>.html`: the deployed `index.html` with per-page title and Open Graph tags) after every content change and at startup. Anything rendered into them must go through its `escape()`.

### API contract

The data shapes are defined in `backend/src/lib/types.ts`; `frontend/src/types/index.ts` only re-exports them, type-only. Folio's Swift models are a separate copy, so changing a shape means updating Folio too (ask first: Folio is out of scope unless the user says otherwise).

Folio depends on the current write semantics, so don't break them without updating Folio:
- PUT is a merge (it behaves like PATCH): omitted fields keep their stored values, and `null` on an optional field (like `category`) removes it.
- Folio sends `createdAt` on updates so posts and projects can be backdated. Keep it editable.
- `id`, `updatedAt`, and `readingTime` (200 words/min, recalculated on every write) are server-owned and ignored if sent. Unknown fields are dropped. Invalid bodies get 400 with all problems in `error`.
- Existing media URLs can contain spaces and odd characters (like `1. Launch.webp`), so URL validation and the media delete route accept them.
- Folio uses the `url` an upload returns rather than building media URLs itself.

### Frontend

- `src/lib/api.ts` is the only typed client. A non-OK response throws `ApiError` (with a numeric `status`); check `isNotFound(err)`, not the message. Every function takes an optional `AbortSignal`.
- Lists and nav (`useProjects`, `usePosts`, `useProjectNav`, `usePostNav`) go through `useCachedList` and the shared cache in `src/lib/cache.ts`: versioned, validated entries; 5-minute TTL with stale-while-revalidate; failures never cached; identical in-flight requests shared. The console uses the same nav hooks with `enabled: open`. Wrap any new `localStorage` access in `try`/`catch`. Detail pages load with `useResource(key, load)` (`src/hooks/useResource.ts`), which aborts superseded requests, ignores stale results, and returns state only for the current key. Use it for anything loaded by a route parameter, and pass a stable `load` (a module-level `api.*` function). Don't go back to `useEffect` + `setLoading(true)`: that reintroduces the race (AUDIT.md #8) and the lint error. Both hooks set state only in request callbacks.
- Routes are in `App.tsx`. `ProjectDetailPage`, `Blog`, `BlogPost`, and `AppPage` are lazy-loaded. Render errors are caught by `ErrorBoundary` at the route level (in `App.tsx`; it resets on navigation and keeps the navbar) and at the top level (`main.tsx`). Missing items show `NotFoundMessage` and failed loads show `LoadErrorMessage` (`components/shared/LoadProblem.tsx`), not redirects. Still guard against bad data in components (`Array.isArray` before mapping, fallbacks for enums): the boundary is a backstop.
- Styling uses the Tailwind `xcode` palette in `tailwind.config.js`, with class-based dark mode (`index.html` sets `dark` on `<html>` before React loads, from the `theme` value in `localStorage` or the system setting). Backgrounds, borders, and body text come in light/dark pairs (`text-xcode-text-light dark:text-xcode-text`). The accent colors (`accent`, `muted`, `green`, `yellow`, `red`, `orange`, `pink`, `teal`) are CSS variables that switch with the theme, darker in light mode for 4.5:1 contrast, so they need no `dark:` variant. Always-dark panels add `xcode-dark-tokens`. Use the tokens, not new hex values, and check contrast for new text colors. The exceptions are deliberately hardcoded colors in the decorative code views (`Home`, `NotFound`, `CrashReport`, `ScrollMinimap`).
- Uploaded images: render them with `ResponsiveImage` (srcset from the `.w640`/`.w1280` sizes, lazy by default, falls back to `src` if a size is missing) and a `sizes` hint.
- Accessibility basics to keep: real links for navigation (not `onClick` on non-interactive elements), visible focus, names on icon-only buttons, `useDocumentTitle` on every page, and reduced motion respected (`prefersReducedMotion()` from `src/lib/motion.ts` for JS motion; CSS is handled globally).
- Detail pages are three columns: `Sidebar` (hidden below `lg`), the content, and `ScrollMinimap` (hidden below `xl`). `ScrollMinimap` scans the real article DOM. Pass `contentKey` (the item's ID, or `null` while loading) so it rescans when the content changes. It does nothing below `xl`. `Minimap` is the decorative seeded one on project cards.
- `MarkdownRenderer` overrides every element with its own component (react-markdown + remark-gfm + rehype-slug + rehype-highlight). Site links go through the router, other sites open in a new tab, and fences are blocks via the `pre` context. Syntax colors are in `index.css`. Never enable raw HTML (`rehype-raw`).
- Project cards get a fake file extension from `category` (`Web` → `.ts`, `<platform> App` → `.swift`, `Hardware` → `.phys`), from `src/lib/category.ts`.

### Personality features

These are deliberate, so keep them working when you change nearby code:
- `Navbar` shortcuts: ⌘B shows "Build Succeeded" and ⌘⇧K shows "Clean Build Folder". They're ignored while typing. ⌘R deliberately isn't intercepted (browsers need it to reload); the planned "⌘R actually runs something" feature would reclaim it only on pages with a demo.
- The `>_` console offers `ls`, `cd`, `open`, `whoami`, `contact`, and tab completion.
- `CrashReport` is a joke macOS crash log shown when a list fails to load.
- `NotFound` is a fake compiler error.
- The home page has a typed-name animation over a code minimap.
