/**
 * Stream CORS proxy — Vercel Edge Function
 *
 * A literal port of netlify/functions/proxy.ts for Vercel. Receives a
 * request, reads the upstream target from ?url=, strips hop-by-hop headers,
 * forwards the request, and returns the response with permissive CORS
 * headers.
 *
 * Deploy by pushing this directory to a Vercel project (see README.md).
 */

export const config = { runtime: 'edge' };

const HOP_BY_HOP = new Set([
  'host', 'origin', 'referer', 'connection',
  'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

const FORWARD_RESPONSE = [
  'content-type', 'link', 'x-reader-google-bad-token',
  'cache-control', 'etag', 'last-modified',
];

const CORS_RESPONSE_HEADERS: Record<string, string> = {
  'access-control-allow-origin':  '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  'access-control-max-age':       '86400',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_RESPONSE_HEADERS });
  }

  const url     = new URL(request.url);
  const encoded = url.searchParams.get('url') ?? '';

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(encoded);
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http/https');
    }
  } catch {
    return new Response('proxy: invalid or missing ?url= parameter', {
      status:  400,
      headers: CORS_RESPONSE_HEADERS,
    });
  }

  const reqHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      reqHeaders.set(key, value);
    }
  });
  reqHeaders.set('host', new URL(targetUrl).host);

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method:  request.method,
      headers: reqHeaders,
      body:    request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.text(),
    });
  } catch (err) {
    return new Response(
      `proxy: upstream error — ${err instanceof Error ? err.message : String(err)}`,
      { status: 502, headers: CORS_RESPONSE_HEADERS },
    );
  }

  const resHeaders = new Headers(CORS_RESPONSE_HEADERS);
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) resHeaders.set(name, value);
  }

  return new Response(await upstream.text(), {
    status:  upstream.status,
    headers: resHeaders,
  });
}
