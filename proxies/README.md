# Stream proxies

Stream is a browser frontend. When it talks to Feedbin or FreshRSS it has to go
through a tiny reverse proxy, because browsers will not let JavaScript make
authenticated cross-origin requests to APIs that do not send CORS headers. The
canonical proxy is `netlify/functions/proxy.ts` in this repository — 90-odd
lines of TypeScript that forward the request, strip hop-by-hop headers, and
stamp a CORS response back.

This directory contains literal ports of that proxy for three other cloud
platforms you can deploy under your own account. Each subfolder has its own
README walking through the deploy. Once your proxy is up, paste its URL into
Stream's "Your own proxy" setup step and you are done.

## Why would I deploy my own proxy?

The hosted Stream at `stream.dynamicskillset.com` offers a shared proxy as one
of the setup modes, but using it means your Feedbin or FreshRSS credentials
pass through a Netlify function run by the site's operator. The operator's
Netlify log history includes every proxy invocation, so an operator with bad
intent (or a compromised account) could read your credentials.

If that bothers you, deploy your own proxy under your own cloud account. You
control the logs, the operator never sees your credentials, and the proxy
costs nothing on the free tiers listed below.

## Which platform should I pick?

| Platform            | Setup time | Free tier              | Best if                                     |
|---------------------|------------|------------------------|---------------------------------------------|
| Cloudflare Workers  | 2 min      | 100k requests / day    | You want the fastest cold starts            |
| Deno Deploy         | 2 min      | 1M requests / month    | You prefer TypeScript-native, zero config   |
| Vercel Edge         | 3 min      | 100k invocations / day | You already use Vercel for other projects   |

All three are equivalent in behaviour — they implement the same `?url=` query
contract and stamp the same CORS headers. Pick whichever is easiest.

## Security note

These proxies are **open** — anything on the public internet can use them to
forward requests to arbitrary URLs. In practice this is fine for a personal
deployment: the proxy is essentially a CORS-shaped hole in the browser wall,
not a privileged endpoint, and Feedbin / FreshRSS both require authentication
of their own. If you are worried about someone else running up your free tier
by using your proxy, either restrict the set of allowed upstream hosts (edit
the `ALLOWED_HOSTS` array in the proxy source) or bind access to your own IP
range via the platform's firewall features.
