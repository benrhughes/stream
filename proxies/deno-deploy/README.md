# Stream proxy — Deno Deploy

A minimal Deno Deploy script that lets Stream talk to Feedbin or FreshRSS
without routing your credentials through anyone else's server. Deno Deploy
gives you 1 million requests per month on the free tier.

## Deploy

There are two ways: via the web dashboard or via `deployctl`. The dashboard
is quicker for a first-time setup.

### Via the dashboard

1. Sign in at <https://dash.deno.com>.
2. Click **New Project** → **Deploy from a local file**, or point at your
   fork of this repository.
3. Upload or link `main.ts` from this directory. No environment variables
   needed.
4. Deno Deploy prints the deployed URL, something like
   `https://stream-proxy-<random>.deno.dev`.
5. Copy that URL into Stream's "Your own proxy" setup step. Done.

### Via deployctl

```bash
deno install -Arf jsr:@deno/deployctl
deployctl deploy --project=stream-proxy main.ts
```

## Updating

Re-deploy any time. Your existing Stream setup keeps using the same URL.

## Locking it down (optional)

Same advice as the Cloudflare proxy: by default `main.ts` forwards to any
upstream URL. For personal use that is fine. To restrict, add an allow-list
of hostnames after the `targetUrl` validation.
