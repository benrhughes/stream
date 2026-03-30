/**
 * Extract the first image URL from an HTML string.
 * Looks for <img src="..."> tags and returns the first valid http(s) URL.
 */
export function extractImageFromHtml(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return undefined;
  const src = match[1];
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  return undefined;
}
