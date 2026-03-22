# Stream

A velocity-based RSS reader. Articles arrive, linger, and fade — they are not tasks to be cleared.

---

## The problem

Every mainstream RSS reader inherits the same foundational assumption from Brent Simmons' NetNewsWire (2002): feeds are an inbox, articles are items to be processed, and falling behind is a failure state. Unread counts, mark-as-read buttons, and three-pane layouts all reinforce what Terry Godier calls **phantom obligation** — guilt for something no one asked you to do.

Stream is a different kind of frontend for the same backends. It does not fetch or store feeds. It connects to FreshRSS, Miniflux, Feedbin, or NewsBlur via their existing APIs and presents what it finds as a river: things that arrived, each fading at a rate appropriate to its source. A breaking news feed fades in hours. A personal essay lingers for days. A prolific source cannot drown out a thoughtful one.

There are no unread counts. There is no mark-as-read. **You are not behind.**

---

## Inspiration

Stream is directly inspired by **[Current](https://www.terrygodier.com/current)** by Terry Godier — an RSS reader for iPhone, iPad, and Mac built around the same philosophy. Current's tagline is *"An RSS reader that doesn't count."* Its core argument: *"Every interface is an argument about how you should feel."*

Current is Apple-only. Stream exists to bring the same ideas to self-hosted RSS users on any platform, via a web app and browser extension that connect to existing backends without replacing them.

---

## How it works

Each source is assigned a velocity tier with a half-life in hours:

| Tier | Label | Half-life | Example |
|------|-------|-----------|---------|
| 1 | Breaking | 3h | BBC News, Reuters |
| 2 | News | 12h | Ars Technica, The Verge |
| 3 | Article | 24h | Most blogs (default) |
| 4 | Essay | 72h | Aeon, Craig Mod |
| 5 | Evergreen | 168h (7 days) | Tutorials, references |

Visibility score: `0.5 ^ (elapsed / halfLife)`. Articles below 0.05 disappear. Fresh articles are fully opaque; aging articles dim and their left border recedes. The river is what is here right now.

---

## Status

Phase 1 — in development.

- [x] River engine with velocity-based aging
- [x] FreshRSS adapter (Google Reader API)
- [x] Web app (Vite SPA)
- [x] Browser extension shell (Firefox + Chrome, MV3)
- [x] Light / dark themes
- [x] Keyboard navigation
- [ ] Feedbin adapter
- [ ] Velocity configuration UI
- [ ] Onboarding flow polish
- [ ] Firefox Add-ons publication

---

## Architecture

Three packages in an npm workspace monorepo:

```
packages/
  core/       Preact components, river engine, backend adapters
  web/        Vite SPA — deploy alongside your RSS backend (same-origin)
  extension/  Browser extension — Firefox and Chrome from one codebase (MV3)
```

`stream-core` knows nothing about where it runs. Both shells import the same `App` component and adapter classes.

**Tech:** Preact · Vite · CSS Modules · IndexedDB (`idb`) · `webextension-polyfill`

---

## Development

```bash
npm install
npm run dev          # web app at http://localhost:5173
npm run build:web    # production build → packages/web/dist/
npm run build:extension  # extension build → packages/extension/dist/
```

The dev server includes a reverse proxy at `/dev-proxy` that forwards API requests server-side, bypassing browser CORS restrictions during development. Enter your FreshRSS server root URL (e.g. `https://freshrss.example.com`) — not the API path.

**FreshRSS note:** the Google Reader API uses a separate API password, set under Settings → Profile → API management. Your regular login password will not work.

---

## Deployment (web app)

Drop the contents of `packages/web/dist/` into a directory served by the same web server as your RSS backend. Same-origin requests need no CORS configuration.

Alternatively, host on any static server (Netlify, Cloudflare Pages, GitHub Pages) and enable CORS headers on your backend. The README will include a copy-paste nginx snippet once this is tested.

---

## Licence

[AGPL-3.0](LICENSE.md)
