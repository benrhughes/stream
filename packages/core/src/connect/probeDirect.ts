/**
 * Tests whether a target origin accepts cross-origin requests from this page.
 *
 * We issue a GET with `mode: 'cors'` and watch for the two possible outcomes:
 *
 *   - The promise resolves with a Response (any status, even 401 or 404).
 *     That means the browser allowed the request to complete and read the
 *     response headers, which only happens when the server sent a matching
 *     `Access-Control-Allow-Origin`. Direct mode works.
 *
 *   - The promise rejects with a TypeError ("Failed to fetch"). That is
 *     what browsers raise when CORS is blocked, when the server is down,
 *     or when the URL is unreachable. We can't distinguish these in code
 *     (the spec deliberately hides the reason from JavaScript), so we
 *     report direct mode as unavailable and leave it to the user to decide
 *     whether the server is simply offline.
 *
 * Feedbin's API does not send CORS headers, so this probe always fails for
 * it. FreshRSS instances with CORS configured (per the README snippet) will
 * pass.
 */
export async function probeDirect(target: string): Promise<boolean> {
  try {
    await fetch(target, { method: 'GET', mode: 'cors' });
    return true;
  } catch {
    return false;
  }
}
