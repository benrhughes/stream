<img src="packages/web/public/favicon.svg" width="48" alt="Stream icon" />

# Stream

A different kind of RSS reader. Articles arrive, linger, and fade. You are not behind.

---

## What is this?

Most RSS readers treat your feeds like an inbox: unread counts, mark-as-read, the quiet implication that falling behind is a failure. Stream does something different. It shows your feeds as a river of things that arrived, each one fading at a rate that suits its source. Breaking news fades in hours. A long essay lingers for days. A prolific source cannot drown out a thoughtful one.

There are no unread counts. **You are not behind.**

Stream is directly inspired by **[Current](https://www.terrygodier.com/current)** by Terry Godier, an RSS reader for iPhone and Mac built around the same idea.

---

## Before you start

**Stream is a frontend only.** It does not fetch or store feeds itself. You need one of the following accounts first:

**[Feedbin](https://feedbin.com)** — a hosted RSS service. $5/month, no setup required. Sign up, add your feeds, then connect Stream.

**[FreshRSS](https://freshrss.net)** — open-source RSS with a free hosted option at [freshrss.net](https://freshrss.net), or self-host on your own server. FreshRSS needs a separate API password: set one under Settings → Profile → API management. Your regular login password will not work.

---

## Getting started

The quickest way to run Stream is to deploy it to [Netlify](https://netlify.com) for free:

1. Fork this repo to your GitHub account.
2. In Netlify, click **Add new site → Import an existing project** and connect your repo.
3. Build settings are read from `netlify.toml` automatically. Click **Deploy**.
4. Open your Netlify URL, enter your Feedbin or FreshRSS credentials, and you are done.

---

## Your credentials

Your Feedbin or FreshRSS username and password are stored only in your own browser. Stream does not have a central server, and nothing is sent to anyone but your RSS service.

When you deploy to Netlify, API requests pass through a small function on your own Netlify account before reaching Feedbin or FreshRSS. That function sees your credentials on every request, so anyone with access to your Netlify account could find them in the function logs. For a personal deployment this is not a concern — it is your own account. It is worth bearing in mind if you ever share a single deployment with other people.

---

## How it works

Each feed is assigned a velocity tier. This controls how quickly articles fade:

| Tier | Label | Half-life | Good for |
|------|-------|-----------|---------|
| 1 | Breaking | 3h | BBC News, Reuters |
| 2 | News | 12h | Ars Technica, The Verge |
| 3 | Article | 24h | Most blogs (default) |
| 4 | Essay | 72h | Aeon, Craig Mod |
| 5 | Evergreen | 7 days | Tutorials, references |

You can set velocity per feed or per category from the settings screen. Fresh articles are fully visible; older ones dim gradually until they disappear. The river shows what is here right now.

Keyboard shortcuts: `j`/`k` to move, `d` to dismiss, `s` to save, `z` to undo, `?` for help.

---

<details>
<summary>Running Stream locally (for developers)</summary>

```bash
npm install
npm run dev   # → http://localhost:5173
```

The dev server includes a reverse proxy that forwards API requests server-side, so CORS is handled automatically.

</details>

<details>
<summary>Deploying to other static hosts</summary>

```bash
npm run build:web
# deploy packages/web/dist/ to your host
```

For self-hosted FreshRSS, your server must send CORS headers. Add to your nginx config:

```nginx
add_header Access-Control-Allow-Origin  "*";
add_header Access-Control-Allow-Headers "Authorization, Content-Type";
add_header Access-Control-Allow-Methods "GET, POST";
```

Feedbin users need no extra configuration beyond what is described above.

</details>

<details>
<summary>Architecture</summary>

Two packages in an npm workspace monorepo:

```
packages/
  core/   Preact components, river engine, backend adapters
  web/    Vite SPA
```

Tech: Preact · Vite · CSS Modules

</details>

---

## Licence

[AGPL-3.0](LICENSE.md)
