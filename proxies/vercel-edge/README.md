# Stream proxy — Vercel Edge Function

A minimal Vercel Edge Function that lets Stream talk to Feedbin or FreshRSS
without routing your credentials through anyone else's server. Vercel's
hobby tier gives you 100,000 invocations per day, which is plenty.

## Deploy

1. Install the Vercel CLI if you do not have it:

   ```bash
   npm install -g vercel
   ```

2. From this directory, deploy:

   ```bash
   vercel --prod
   ```

   On the first run Vercel asks a few questions: accept the defaults or
   name the project `stream-proxy`.

3. Vercel prints the deployed URL. Your proxy endpoint is that URL plus
   `/api/proxy`, for example:

   ```
   https://stream-proxy.vercel.app/api/proxy
   ```

4. Copy that endpoint URL into Stream's "Your own proxy" setup step.

## Updating

Re-run `vercel --prod` to push an updated version.

## Locking it down (optional)

Same advice as the other proxies: by default this forwards to any upstream.
For personal use it is fine. To restrict, add an allow-list of hostnames
after the `targetUrl` validation in `api/proxy.ts`.
