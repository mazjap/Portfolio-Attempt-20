# Frontend Developer Documentation

## Motivation

This frontend is the public face of a personal portfolio — a place to showcase software projects, publish blog posts, and host legal/support pages for App Store submissions. The design language is deliberately Xcode-inspired: monospace fonts, IDE-style syntax colors, a navigator sidebar, and a minimap. The goal is for the site itself to feel like the product of a developer rather than a generic portfolio template.

The stack is intentionally conventional: React with Vite, Tailwind for styling, and React Router for navigation. No state management library, no component library, no unnecessary abstraction. It's designed to be easy to understand cold and cheap to maintain.

---

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build tool**: Vite
- **Routing**: React Router v7 (`BrowserRouter`)
- **Styling**: Tailwind CSS v3 with a custom `xcode` color palette
- **Markdown**: `react-markdown` + `remark-gfm` + `rehype-highlight` (syntax highlighting)
- **Deployment**: Vite builds a static SPA; output goes into `public_html/` on cPanel

---

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx                  # Router, lazy imports, skip link, layout shell, error boundary
│   ├── main.tsx                 # React DOM entry point (top-level error boundary)
│   ├── index.css                # Global styles, theme color variables, reduced motion, hljs overrides
│   ├── lib/
│   │   ├── api.ts               # Typed fetch wrappers for all backend endpoints (ApiError)
│   │   ├── cache.ts             # Shared list cache: versioned, validated, de-duplicated
│   │   ├── category.ts          # Category → fake file extension and color
│   │   ├── dates.ts             # Calendar-date formatting (no time-zone shift)
│   │   ├── media.ts             # srcset for uploaded images
│   │   └── motion.ts            # prefers-reduced-motion check
│   ├── types/
│   │   └── index.ts             # Type-only re-exports of the backend's API types
│   ├── hooks/
│   │   ├── useResource.ts       # Load one item by key: abortable, stale-safe, retryable
│   │   ├── useCachedList.ts     # Load a list through the shared cache
│   │   ├── useProjects.ts       # useProjects / useProjectNav hooks
│   │   ├── usePosts.ts          # usePosts / usePostNav hooks
│   │   └── useDocumentTitle.ts  # Per-page <title> and meta description
│   ├── test/
│   │   └── setup.ts             # Vitest setup (jsdom shims, cleanup)
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Projects.tsx         # Project grid listing
│   │   ├── ProjectDetailPage.tsx
│   │   ├── Blog.tsx             # Post list with tag filtering
│   │   ├── BlogPost.tsx
│   │   ├── AppPage.tsx          # Privacy policy / support pages for iOS apps
│   │   └── NotFound.tsx
│   └── components/
│       ├── layout/
│       │   ├── Navbar.tsx
│       │   ├── RouteChangeHandler.tsx # Scroll to top and move focus on navigation
│       │   └── Sidebar.tsx      # Navigator sidebar (projects + posts)
│       ├── projects/
│       │   ├── ProjectCard.tsx
│       │   ├── ProjectGrid.tsx
│       │   ├── ProjectDetail.tsx
│       │   └── MediaCarousel.tsx
│       ├── blog/
│       │   ├── PostCard.tsx
│       │   ├── PostList.tsx
│       │   └── PostDetail.tsx
│       └── shared/
│           ├── Minimap.tsx          # Decorative seeded minimap (used on project cards)
│           ├── ScrollMinimap.tsx    # Live DOM-scanning minimap (used on detail pages)
│           ├── MarkdownRenderer.tsx # react-markdown with custom component overrides
│           ├── StatusBadge.tsx
│           ├── CrashReport.tsx      # Decorative "crash log" shown when a list fails to load
│           ├── LoadProblem.tsx      # Not-found and load-error messages for detail pages
│           ├── ErrorBoundary.tsx    # Catches render errors (class component)
│           ├── ErrorFallback.tsx    # Route-level and top-level fallback screens
│           ├── ListError.tsx        # Crash report + explanation + Try Again for failed lists
│           ├── ResponsiveImage.tsx  # <img> with srcset, lazy loading, and a fallback
│           └── Console.tsx
├── public/robots.txt            # Points crawlers at the backend-generated sitemap
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Design System

The entire site uses a custom Tailwind color palette under the `xcode` namespace, defined in `tailwind.config.js`. Dark mode is enabled via the `'class'` strategy — toggled by adding/removing the `dark` class on `<html>`.

### Color tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `xcode-bg` / `xcode-bg-light` | `#F5F5F0` | `#1E1E1E` | Page background |
| `xcode-surface` / `xcode-surface-light` | `#E8E8E3` | `#2D2D2D` | Cards, code blocks, input backgrounds |
| `xcode-border` / `xcode-border-light` | `#D1D1D1` | `#3C3C3C` | All borders |
| `xcode-text` / `xcode-text-light` | `#1C1C1E` | `#D4D4D4` | Body text |
| `xcode-accent` | `#0B69B5` | `#4EB8FA` | Interactive elements, links, active states |
| `xcode-muted` | `#636366` | `#9C9CA1` | Subdued labels, metadata |
| `xcode-green` | `#1B7A35` | `#28C840` | Active status, hardware accent |
| `xcode-yellow` | `#8A5A00` | `#FFB340` | In-progress status |
| `xcode-red` | `#C4271D` | `#FF6961` | Errors |
| `xcode-orange` | `#AD4A00` | `#FF7B29` | Swift category accent |
| `xcode-pink` | `#B5226A` | `#FC5FA3` | Inline code, `import` keywords |
| `xcode-teal` | `#006E8A` | `#5DD8FF` | |

The accent colors are theme-aware without a `dark:` prefix. They're CSS variables of RGB channels, set in `index.css` (`:root` for light, `.dark` for dark), and Tailwind reads them as `rgb(var(--xcode-accent) / <alpha-value>)`, so opacity modifiers like `bg-xcode-accent/10` still work.

- **Light values** are darker, to meet WCAG AA (4.5:1) for small text on both light backgrounds (`#F5F5F0` and `#E8E8E3`). The original Xcode colors scored 1.6–3.0:1 there.
- **Dark values** are Xcode's, except muted and red, which are slightly lighter so they pass on the dark surface too.
- **Always-dark panels** (the console) add `xcode-dark-tokens`, which applies the dark values in either theme.
- **On an accent background**, use `text-white dark:text-[#1C1C1E]`.

### Typography

- **Mono**: SF Mono → JetBrains Mono → Fira Code → Menlo → monospace
- **Sans**: Inter → system-ui → -apple-system → sans-serif

### Animations

- `animate-fade-in` — 0.25s opacity fade, used when content loads
- `animate-slide-up` — 0.25s slide + fade, used for modals/drawers
- `animate-blink` — cursor blink

---

## Routing

All routes are defined in `App.tsx`. The heavier pages are lazy-loaded:

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `Home` | Eagerly loaded |
| `/projects` | `Projects` | Eagerly loaded |
| `/projects/:id` | `ProjectDetailPage` (lazy) | Loads `ProjectDetail` component |
| `/blog` | `Blog` (lazy) | Tag filtering via `?tag=` query param |
| `/blog/:id` | `BlogPost` (lazy) | |
| `/apps/:appId/:pageType` | `AppPage` (lazy) | `pageType` must be `privacy-policy` or `support` |
| `*` | `NotFound` | |

The routes sit inside a route-level `ErrorBoundary` (see Error Handling), inside `Suspense` for the lazy pages. React Router's `BrowserRouter` handles all client-side navigation. The `.htaccess` on the server has a catch-all `RewriteRule` that serves `index.html` for any path not matching a real file or the `/api`/`/media` prefixes.

---

## API Client

`src/lib/api.ts` is a thin typed wrapper around `fetch`. All requests resolve relative to `VITE_API_BASE_URL` (defaults to `""`, meaning same-origin), which allows the Vite dev proxy to forward to the backend without changing any call sites. IDs are URL-encoded, and every function takes an optional `AbortSignal`:

```typescript
api.projects.list(signal?)        api.posts.list(signal?)        api.apps.privacyPolicy(id, signal?)
api.projects.nav(signal?)         api.posts.nav(signal?)         api.apps.support(id, signal?)
api.projects.get(id, signal?)     api.posts.get(id, signal?)
```

A non-OK response throws an `ApiError` with a numeric `status`; its message is still `"<status> <statusText>"` (like `"404 Not Found"`). Use `isNotFound(err)` rather than parsing the message.

---

## Data Fetching Patterns

### Detail items: `useResource`

Detail pages (`ProjectDetail`, `PostDetail`, `AppPage`) load their item with `useResource(key, load)` from `src/hooks/useResource.ts`:

```typescript
const { state, retry } = useResource(id, api.projects.get);
// state: { status: 'loading' } | { status: 'ok'; data } | { status: 'not-found' } | { status: 'error' }
```

It guarantees the state belongs to the *current* key:
- When the key changes (navigating between projects), `state` is `loading` immediately, so the previous item never shows under the new URL.
- The superseded request is aborted, and a late result is ignored. A slow response can't overwrite a newer page, or trigger a stale "not found".
- `retry()` loads the same key again (the **Try Again** button).

`load` must be a stable function, like a module-level `api.*` function. An inline arrow function would reload on every render. State is only set in the request's callbacks, never synchronously in the effect, which keeps the `react-hooks/set-state-in-effect` lint rule happy.

A missing item renders `NotFoundMessage` ("cannot find project '…' in scope", with a link back), and a failed load renders `LoadErrorMessage` with **Try Again** (both in `components/shared/LoadProblem.tsx`). Detail pages no longer redirect to the list on a 404.

`AppPage` calls `useResource` once per page type, so the requested page shows as soon as it arrives. The sidebar link to the other page appears whenever that one loads. A missing page waits for the other only to decide which message to show.

### List hooks and the shared cache

Lists and nav (`useProjects`, `usePosts`, `useProjectNav`, `usePostNav`) load through `useCachedList` (`src/hooks/useCachedList.ts`) and the shared cache in `src/lib/cache.ts`:

- Successes are stored in `localStorage` for 5 minutes under versioned keys (`cache:v1:projects`, …). They're validated when read back (an array of items with string `id` and `title`), so old or malformed entries are ignored. Entries from older versions of the site are deleted.
- A fresh entry renders immediately with no request. A stale one renders while a new copy loads (stale-while-revalidate). With no entry, there's a loading state.
- Failures are never cached. A list that fails with nothing cached shows the decorative `CrashReport` plus a plain explanation and **Try Again** (`ListError`).
- Identical requests in flight share one fetch: the sidebar and the console both use the nav.
- Every `localStorage` access is in `try`/`catch`, since it throws in some private modes.

`useCachedList(key, load, isValid, { enabled })` takes stable, module-level `load` and `isValid` functions. With `enabled: false` it only reads the cache. The console passes `enabled: open`, so it fetches nothing until it's opened. Like `useResource`, it only sets state in request callbacks.
---

## Error Handling

React's `Suspense` only handles loading, so render errors are caught by `ErrorBoundary` (`components/shared/ErrorBoundary.tsx`) at two levels:

- **Route level** (`App.tsx`), around the routes. The navbar and console stay usable. Its `resetKey` is the path, so navigating anywhere clears the error. `RouteErrorFallback` shows "Thread 1: Fatal error" with **Try Again** (re-render), **Reload Page**, **Home**, and the raw message collapsed under **Details** (production React messages are minified links).
- **Top level** (`main.tsx`), around `App`, for errors in the navbar, console, or router. `AppErrorFallback` offers Reload and Home.

A lazy page whose chunk failed to load (usually a new deploy while the tab was open) is detected by its error message, and gets "this page is out of date" with **Reload Page** only. React caches the failed import, so re-rendering wouldn't help.

Error boundaries are a backstop, not validation. Components should still guard against unexpected data: `StatusBadge` shows an unknown status neutrally, and arrays like `tags`, `techStack`, and `media` are checked with `Array.isArray` before mapping.

---

## Layout Structure

The detail page layout is a three-column flex row:

```
┌──────────────────────────────────────────────────────────┐
│ Navbar (sticky top-0, h-12)                              │
├──────────────┬───────────────────────────┬───────────────┤
│ Sidebar      │ Main content (flex-1)     │ ScrollMinimap │
│ w-52         │ max-w-2xl centered        │ w-14          │
│ hidden lg:   │                           │ hidden xl:    │
└──────────────┴───────────────────────────┴───────────────┘
```

- The sidebar is hidden below `lg` breakpoint (1024px). Below that, project and post pages show a "← All projects/posts" link, and app pages show Privacy/Support tabs above the content instead.
- The scroll minimap is hidden below `xl` breakpoint (1280px)
- Both are `sticky top-12` with `h-[calc(100vh-3rem)]` to fill the viewport below the navbar
- The routed content sits in `#main-content` (`tabIndex={-1}`), the target of the "Skip to content" link. On each new path, `RouteChangeHandler` scrolls to the top (or to the `#fragment`) and moves focus there. Detail pages render their own `<main>` beside the sidebar, so the wrapper is a plain `<div>`.

---

## Navigator Sidebar (`Sidebar.tsx`)

The sidebar is shared between projects and posts. It accepts a `type` prop (`'projects'` | `'posts'`) and an `items` array. For projects it shows a `StatusBadge` and a `★` for featured items. The active item is determined by matching `item.id` against `:id` from `useParams`, and gets `aria-current="page"`. Status dots have screen-reader text (`StatusBadge` without `showLabel` renders a visually hidden label).

---

## Scroll Minimap (`ScrollMinimap.tsx`)

The minimap on detail pages is a live, DOM-scanning document map — not decorative filler. It:

1. **Scans the real DOM** via a `querySelectorAll` against the `contentRef` element for: `h1–h4`, `p`, `ul`, `ol`, `pre`, `img`, `figure`, `blockquote`, `hr`, `table`
2. **Filters nested elements** — a `<p>` inside a `<li>` inside a `<ul>` is skipped; only the `<ul>` block is rendered (prevents double-counting)
3. **Positions each element proportionally**: `top = absTop × (sidebarHeight / documentHeight)`
4. **Renders each type differently**:
   - Headings: blue bars, width varies by level (h1 80% → h4 42%)
   - Paragraphs: rows of 2px grey bars simulating text lines
   - Lists: same as paragraph but slightly indented
   - Code blocks: light blue background with blue left border
   - Images/figures: grey outlined rectangle
   - Blockquotes: grey left-border block
   - `<hr>`: 1px full-width grey rule
   - Tables: alternating row fills (header row is blue)
5. **Viewport highlight**: a translucent rectangle tracking scroll position
6. **Click to scroll**: clicking the minimap jumps to the proportional position in the document

Props: `contentRef` (the article) and `contentKey` (the item's ID, or `null` while nothing is shown). The scan runs when `contentKey` changes, after React has committed the article, so it also rescans when one article replaces another of the same height. A `ResizeObserver` on the article rescans when the layout changes (images load, code wraps).

- **Document height:** re-measured with every scan, not just on scroll or resize, so content that loads after the first render doesn't leave the bars squashed at the old height.
- **Hidden below 1280 px:** a `useSyncExternalStore` media query turns off the observers and scroll handlers entirely.
- **Scrolling:** updates at most once per animation frame, and only the viewport highlight re-renders; the bars are a memoized child.
- **Click to scroll:** uses smooth scrolling unless the visitor prefers reduced motion.

---

## Markdown Rendering (`MarkdownRenderer.tsx`)

All markdown is rendered via `ReactMarkdown` with custom component overrides for every block element. Key decisions:

- **`pre`** owns the block background, padding, and `overflow-x-auto` (not `code`). It provides a context so `code` knows it's a block, which catches fences without a language too (no `language-` class).
- **`code`** for block code adds `block w-full` so highlight colors extend to the full line width rather than only the text content width
- Inline `code` renders as a pink-tinted pill with the `xcode-pink` color
- **Links:**
  - `#fragments` stay in the page.
  - Links to pages of this site use the router (no reload, same tab).
  - Real files (`/feed.xml`, `/media/…`) and non-web links (`mailto:`) are plain links.
  - Other sites open in a new tab.
- **Headings** get IDs from `rehype-slug` and a `#` link on hover or focus (`scroll-mt-16` keeps them clear of the sticky navbar).
- `ol` keeps its `start` attribute.
- Tables sit in a horizontally scrolling box.
- Images use `ResponsiveImage` (lazy, with `srcset`).
- Raw HTML stays disabled.

Syntax highlighting is via `rehype-highlight` with Xcode-flavored token colors defined in `index.css`. The `.hljs` base sets `background: transparent` so the `pre` component's background shows through cleanly.

---

## Project Cards (`ProjectCard.tsx`)

Each project card determines a "file extension" from its category:
- `"Web"` → `.ts` (blue)
- `"iOS App"`, `"macOS App"`, etc. → `.swift` (orange)
- `"Hardware"` → `.phys` (green)
- Anything else → no extension

The extension drives both the color accent and a small decorative `Minimap` (seeded from the project ID) shown in the top-right of the hero image area for code projects. Featured projects show a `★` in the top-left, so the two don't overlap. The mapping lives in `src/lib/category.ts` and is shared with `ProjectDetail`.

The card is one real link: the title's `<Link>` stretches over the whole card with an `::after` overlay. It's keyboard-focusable (with a ring on the card) and supports open-in-new-tab and copy-link. Hero images use `ResponsiveImage` with `sizes` matching the grid.

---

## Project Sort Order

Projects are sorted by `regenerateProjects()` on the backend at write time:
1. Featured projects first
2. Within each group, sorted by `updatedAt ?? createdAt` descending (most recently touched first)

The frontend receives them pre-sorted in `index.json` and renders them as-is.

---

## Apps Feature (`AppPage.tsx`)

The `/apps/:appId/:pageType` route serves privacy policy and support pages intended for App Store compliance. Both pages for a given `appId` are loaded independently with `useResource`. The requested page renders as soon as it arrives, and the sidebar only shows links for pages that exist (404 → omitted).

Error states:
- Server error on the requested page → `LoadErrorMessage` with **Try Again**
- Requested page not found, other page exists → message with link to the other page
- Both pages not found → message with link back to projects

Below `lg`, where the sidebar is hidden, the same links appear as tabs above the content. `lastUpdated` is a calendar date, formatted with `formatCalendarDate` (`src/lib/dates.ts`) so it doesn't show as the previous day in western time zones.

A hardcoded contact email (`jordan.c4922@gmail.com`) is always shown at the bottom. Optional `contactText`/`contactUrl` fields add a secondary link.

Legacy URL redirects (`/:appId-privacy` → `/apps/:appId/privacy-policy`, etc.) are handled in the server `.htaccess` before hitting the SPA, so old links shared before the routing change still work.

---

## Images (`ResponsiveImage.tsx`)

The backend stores each upload as `name.webp` (≤ 2560 px) plus `name.w640.webp` and `name.w1280.webp`. `mediaSrcSet()` (`src/lib/media.ts`) builds a `srcset` from those names for `/media/….webp` URLs. Other URLs (external images, legacy `.jpg`) get none. `ResponsiveImage` adds it with a `sizes` hint, lazy-loads by default (pass `loading="eager"` for images visible on first paint), and decodes asynchronously.

If a smaller size is missing (older uploads, before `derive-media` has run on the server), its `onError` removes the `srcset`, and the browser loads `src` instead. So a missing size costs one 404, not a broken image.

---

## Accessibility and Motion

- **Contrast:** theme-aware tokens (see Color tokens) meet 4.5:1 for small text in both themes.
- **Keyboard:**
  - "Skip to content" is the first Tab stop.
  - Project cards, gallery thumbnails, and the console are all reachable and show focus rings.
  - The console's Tab completes only when something is typed, so Shift+Tab (and Tab on an empty line) move focus normally.
  - Escape closes the console and returns focus to its button.
- **Navbar shortcuts:** ⌘B and ⌘⇧K show the fake build toasts. They're ignored while typing in a field. ⌘R isn't intercepted, so the browser's reload still works.
- **Names and states:**
  - Gallery thumbnails are named ("Show TrekPoint screenshot 2 (2 of 5)"), the current one has `aria-current`, and arrow keys move through the gallery.
  - Tag filters use `aria-pressed`.
  - The console is a labeled dialog whose output is a live log.
  - The navbar toast is a status message.
- **Titles:** `useDocumentTitle(title, description)` sets `<title> · Jordan Christensen` and the meta description per page. Link previews use the backend's share pages, since crawlers don't run JavaScript.
- **Reduced motion:** a global `prefers-reduced-motion` rule turns off the animations, transitions, and smooth scrolling. The home page shows the name without typing it out.

---

## Development

```bash
cd frontend
npm install
npm run dev       # Vite dev server on http://localhost:5173
npm test          # Vitest + Testing Library on jsdom (npm run test:watch to watch)
npm run lint
npm run build     # Type-check (strict), then production build → dist/
npm run preview   # Preview production build locally
```

The Vite dev server proxies `/api` and `/media` to `http://localhost:3001`, so the backend must be running for data to load. The proxy is dev-only; in production the frontend is served from the same cPanel account so both resolve to the same origin.

### Tests

Tests sit next to what they cover (`*.test.ts(x)` under `src/`). The setup is in `vitest.config.ts`, which merges the Vite config, and `src/test/setup.ts`, which has the jsdom shims for `matchMedia` and `ResizeObserver`, plus cleanup. The tests run with `TZ=America/Denver`, so date bugs reproduce.

They cover:
- request races and retry (`useResource`);
- gallery bounds, names, and keys;
- the error boundary (reset on navigation, Try Again, the chunk-failure message);
- the project card as a link;
- console focus behavior;
- the Markdown fixes;
- the cache (sharing requests, no cached failures, validation);
- the helpers.

Add a test with every fix. CI runs lint, tests, build, and audit.

### Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Base URL for API requests. Defaults to `""` (same-origin). Set to the backend URL in dev if not using the proxy. |

---

## Deployment

`npm run build`, then upload the contents of `dist/` into `public_html/` on cPanel. See [`../DEPLOY.md`](../DEPLOY.md) for the full steps, the `.htaccess` template (HTTPS, legacy app-link redirects, share pages, SPA fallback, caching), and refreshing the share pages after a frontend upload.
