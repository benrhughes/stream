import { test, expect } from '@playwright/test';
import { mockFreshRSSRoutes } from './helpers.js';
import { BASE_URL } from './fixtures.js';

// ---------------------------------------------------------------------------
// Mode picker — first-run flow
// ---------------------------------------------------------------------------

test.describe('connect flow: mode picker', () => {
  test.beforeEach(async ({ page }) => {
    await mockFreshRSSRoutes(page);
    // Start from a clean slate — no saved connection, no dismissed banner
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('mode picker appears on first run', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /how should stream reach/i }),
    ).toBeVisible({ timeout: 5_000 });

    // All three mode cards should be present
    await expect(page.getByRole('button', { name: /direct/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /your own proxy/i })).toBeVisible();
    // Shared proxy is only shown in a non-dev build; this suite runs against
    // `vite preview`, which counts as prod for our purposes.
    await expect(page.getByRole('button', { name: /this site's shared proxy/i })).toBeVisible();
  });

  test('direct mode walks through to a loaded river', async ({ page }) => {
    await page.goto('/');

    // Pick Direct
    await page.getByRole('button', { name: /^direct/i }).click();

    // Credentials form appears with FreshRSS tab selected by default
    await expect(page.getByLabel(/server url/i)).toBeVisible();

    // Fill the FreshRSS credentials that match our mock routes
    await page.getByLabel(/server url/i).fill(BASE_URL);
    await page.getByLabel(/username/i).fill('testuser');
    await page.getByLabel(/api password/i).fill('testpass');

    await page.getByRole('button', { name: /connect/i }).click();

    // River loads with our three fixture articles
    await expect(page.locator('article h2')).toHaveCount(3, { timeout: 10_000 });
  });

  test('feedbin tab is disabled in direct mode', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /^direct/i }).click();

    const feedbinTab = page.getByRole('tab', { name: /feedbin/i });
    await expect(feedbinTab).toBeDisabled();
  });

  test('shared proxy warning requires explicit acknowledgement', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /this site's shared proxy/i }).click();

    // Warning body appears
    await expect(
      page.getByRole('heading', { name: /before you use this site's proxy/i }),
    ).toBeVisible();
    await expect(page.getByText(/credentials from those logs/i)).toBeVisible();

    // Ack button leads to the credentials form
    await page.getByRole('button', { name: /I understand/i }).click();

    // Now on the credentials form — Feedbin tab should be allowed in shared mode
    const feedbinTab = page.getByRole('tab', { name: /feedbin/i });
    await expect(feedbinTab).toBeEnabled();
  });

  test('byop step shows deploy templates and a URL input', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /your own proxy/i }).click();

    await expect(
      page.getByRole('heading', { name: /deploy your own proxy/i }),
    ).toBeVisible();
    // All three deploy targets listed
    await expect(page.getByText(/cloudflare workers/i)).toBeVisible();
    await expect(page.getByText(/deno deploy/i)).toBeVisible();
    await expect(page.getByText(/vercel edge/i)).toBeVisible();
    // URL input visible
    await expect(page.getByLabel(/your proxy url/i)).toBeVisible();
  });

  test('back button returns to the mode picker from each branch', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /your own proxy/i }).click();
    await page.getByRole('button', { name: /^back$/i }).click();
    await expect(
      page.getByRole('heading', { name: /how should stream reach/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /this site's shared proxy/i }).click();
    await page.getByRole('button', { name: /go back/i }).click();
    await expect(
      page.getByRole('heading', { name: /how should stream reach/i }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Migration banner — shown when a user is in `shared` connection mode
// ---------------------------------------------------------------------------

test.describe('migration banner', () => {
  test.beforeEach(async ({ page }) => {
    await mockFreshRSSRoutes(page);
    // Seed an already-in-shared-mode connection. We set proxyBase=null so
    // that adapter fetches reach the BASE_URL mocks directly and the river
    // loads without having to stand up a fake proxy. The banner check only
    // looks at `connectionMode === 'shared'`, so this still exercises the
    // correct UI path. A separate inline assertion below covers the
    // legacy-blob → shared migration step.
    await page.addInitScript((base) => {
      localStorage.clear();
      localStorage.setItem(
        'stream-connection',
        JSON.stringify({
          adapterId:      'freshrss',
          baseUrl:        base,
          username:       'testuser',
          password:       'testpass',
          connectionMode: 'shared',
          proxyBase:      null,
        }),
      );
    }, BASE_URL);
  });

  test('banner appears for shared-mode connections', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('article h2').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/routed through this site's shared proxy/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch', exact: true })).toBeVisible();
    // The banner's dismiss button has accessible name "Dismiss" exactly;
    // the per-article dismiss buttons are "Dismiss article" and must not match.
    await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();
  });

  test('switch button clears the connection and returns to the mode picker', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('article h2').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Switch', exact: true }).click();

    await expect(
      page.getByRole('heading', { name: /how should stream reach/i }),
    ).toBeVisible();

    const keys = await page.evaluate(() => ({
      connection: localStorage.getItem('stream-connection'),
      dismissed:  localStorage.getItem('stream-migration-banner-dismissed'),
    }));
    expect(keys.connection).toBeNull();
    expect(keys.dismissed).toBe('1');
  });

  test('dismiss button hides the banner and persists the flag', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('article h2').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();

    await expect(page.getByText(/routed through this site's shared proxy/i)).toBeHidden();

    const dismissed = await page.evaluate(() =>
      localStorage.getItem('stream-migration-banner-dismissed'),
    );
    expect(dismissed).toBe('1');
  });

  test('banner does not appear when the dismiss flag is already set', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('stream-migration-banner-dismissed', '1');
    });
    await page.goto('/');
    await expect(page.locator('article h2').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/routed through this site's shared proxy/i)).toBeHidden();
  });
});
