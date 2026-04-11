# Stream proxy — Cloudflare Workers

A minimal Cloudflare Worker that lets Stream talk to Feedbin or FreshRSS
without routing your credentials through anyone else's server. Cloudflare
gives you 100,000 requests per day on the free tier, which is more than
enough for a personal RSS reader.

## Deploy

1. Install wrangler if you do not have it:

   ```bash
   npm install -g wrangler
   ```

2. Sign in to Cloudflare:

   ```bash
   wrangler login
   ```

3. From this directory, deploy:

   ```bash
   wrangler deploy
   ```

   Wrangler prints the deployed URL, something like
   `https://stream-proxy.<your-subdomain>.workers.dev`.

4. Copy that URL into Stream's "Your own proxy" setup step. Done.

## Updating

Any time you want to pull in a fix to the proxy, just re-run `wrangler deploy`
from this directory. Your existing Stream setup keeps using the same URL.

## Locking it down (optional)

By default the proxy will forward to any URL you point it at. That is fine for
personal use because the proxy only exposes what your Feedbin or FreshRSS
server already exposes; there is no privilege escalation. If you would rather
not let arbitrary traffic use your Worker, edit `worker.ts` and add an
`ALLOWED_HOSTS` check after the `targetUrl` validation, with your backend
hostname in the list.
