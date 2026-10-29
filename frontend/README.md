# Frontend

The public site: an Xcode-themed portfolio, a Markdown blog, and the privacy and support pages for the App Store apps. React 19, Vite, Tailwind 3, and React Router 7, built as a static single-page app.

```sh
npm install
npm run dev        # http://localhost:5173 (proxies /api and /media to the backend on :3001)
npm test           # Vitest + Testing Library (jsdom)
npm run lint
npm run build      # type-check, then build to dist/
```

The backend has to be running for data to load (`npm run dev` in `../backend`).

- [`DEVDOC.md`](DEVDOC.md): how the frontend works (routing, data loading, caching, error handling, the minimap, and the design tokens).
- [`../DEPLOY.md`](../DEPLOY.md): how to deploy.
- [`../CLAUDE.md`](../CLAUDE.md): conventions for the whole repository.
