/**
 * Stream CORS proxy — Netlify Function
 *
 * Forwards HTTP/HTTPS requests from the browser to the user's RSS backend,
 * bypassing browser CORS restrictions. Mirrors the Vite dev-proxy plugin.
 *
 * Usage: /.netlify/functions/proxy?url=<encodeURIComponent(targetUrl)>
 *
 * CORS note: this proxy is designed to serve both same-origin callers (the
 * Netlify deployment itself) and cross-origin callers (someone using it as
 * a BYOP endpoint). Cross-origin use triggers a browser CORS preflight, so
 * OPTIONS requests are answered locally with permissive allow-headers; they
 * are never forwarded upstream.
 */

const HOP_BY_HOP = new Set([
  'host', 'origin', 'referer', 'connection',
  'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

// Headers to forward from the proxy response back to the browser
const FORWARD_RESPONSE = [
  'content-type', 'link', 'x-reader-google-bad-token',
  'cache-control', 'etag', 'last-modified',
];

interface NetlifyEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string> | null;
  headers: Record<string, string>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const CORS_RESPONSE_HEADERS: Record<string, string> = {
  'access-control-allow-origin':  '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  'access-control-max-age':       '86400',
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  // Answer CORS preflights locally — never forward OPTIONS to upstream.
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_RESPONSE_HEADERS, body: '' };
  }

  const encoded = event.queryStringParameters?.url ?? '';

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(encoded);
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http/https');
    }
  } catch {
    return {
      statusCode: 400,
      headers:    CORS_RESPONSE_HEADERS,
      body:       'proxy: invalid or missing ?url= parameter',
    };
  }

  // Forward request headers, stripping hop-by-hop and origin-sensitive ones
  const reqHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      reqHeaders[key] = value;
    }
  }
  reqHeaders['host'] = new URL(targetUrl).host;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method:  event.httpMethod,
      headers: reqHeaders,
      body:    event.body || undefined,
    });
  } catch (err) {
    return {
      statusCode: 502,
      headers:    CORS_RESPONSE_HEADERS,
      body:       `proxy: upstream error — ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const resHeaders: Record<string, string> = { ...CORS_RESPONSE_HEADERS };
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) resHeaders[name] = value;
  }

  return {
    statusCode: upstream.status,
    headers:    resHeaders,
    body:       await upstream.text(),
  };
};
