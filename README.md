<img src="packages/web/public/favicon.svg" width="48" alt="Stream icon" />

# Stream

A velocity-based RSS reader. Articles arrive, linger, and fade — they are not tasks to be cleared.

---

## The problem

Every mainstream RSS reader inherits the same foundational assumption from Brent Simmons' NetNewsWire (2002): feeds are an inbox, articles are items to be processed, and falling behind is a failure state. Unread counts, mark-as-read buttons, and three-pane layouts all reinforce what Terry Godier calls **phantom obligation** — guilt for something no one asked you to do.

Stream is a different kind of frontend for the same backends. It does not fetch or store feeds. It connects to FreshRSS or Feedbin via their existing APIs and presents what it finds as a river: things that arrived, each fading at a rate appropriate to its source. A breaking news feed fades in hours. A personal essay lingers for days. A prolific source cannot drown out a thoughtful one.

There are no unread counts. There is no mark-as-read. **You are not behind.**

---

## Inspiration

Stream is directly inspired by **[Current](https://www.terrygodier.com/current)** by Terry Godier — an RSS reader for iPhone, iPad, and Mac built around the same philosophy. Current's tagline is *"An RSS reader that doesn't count."* Its core argument: *"Every interface is an argument about how you should feel."*

Current is Apple-only. Stream exists to bring the same ideas to self-hosted RSS users on any platform, via a web app that connects to an existing backend without replacing it.

**Stream is a frontend only.** It requires an active FreshRSS or Feedbin account — it does not fetch or store feeds itself.

---

## Getting a backend

You need one of the following before Stream will work:

**[Feedbin](https://feedbin.com)** — a polished hosted RSS service. $5/month, no setup required. Sign up, add your feeds, then connect Stream.

**[FreshRSS](https://freshrss.net)** — open-source RSS aggregator with a free hosted option at [freshrss.net](https://freshrss.net), or self-host on your own server. FreshRSS requires a separate API password: set one under Settings → Profile → API management. Your regular login password will not work.

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

## Architecture

Two packages in an npm workspace monorepo:

```
packages/
  core/   Preact components, river engine, backend adapters
  web/    Vite SPA — deploy to Netlify or any static host
```

`stream-core` is framework-agnostic. The web shell imports the same `App` component and adapter classes.

**Tech:** Preact · Vite · CSS Modules

---

## Getting started with Netlify

The quickest way to run Stream is to deploy it to [Netlify](https://netlify.com) for free:

1. Fork or clone this repo to your GitHub account.
2. In Netlify, click **Add new site → Import an existing project** and connect your repo.
3. Build settings are read from `netlify.toml` automatically — leave everything as-is and click **Deploy**.
4. Once deployed, open your Netlify URL, enter your FreshRSS or Feedbin credentials, and you're done.

A serverless proxy function is bundled with the build so Stream can reach self-hosted backends without any CORS configuration on your server.

---

## Running locally

```bash
npm install
npm run dev   # → http://localhost:5173
```

The dev server includes a reverse proxy that forwards API requests server-side, so CORS is handled automatically.

---

## Deployment — other static hosts

```bash
npm run build:web
# deploy packages/web/dist/ to your host
```

For self-hosted FreshRSS, your backend must send CORS headers. Add to your nginx config:

```nginx
add_header Access-Control-Allow-Origin  "*";
add_header Access-Control-Allow-Headers "Authorization, Content-Type";
add_header Access-Control-Allow-Methods "GET, POST";
```

Feedbin users need no extra configuration — Feedbin supports CORS natively.

---

## Licence

[AGPL-3.0](LICENSE.md)
