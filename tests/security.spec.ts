import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

declare global {
  interface Window {
    cspViolations: string[];
    beaconSent: boolean;
  }
}

test('security headers cover Worker responses, static assets, redirects, and errors', async ({ request }) => {
  const home = await request.get('/');
  const script = (await home.text()).match(/<script[^>]+src="([^"]+)"/)![1];
  for (const path of ['/', '/hold-confirm/', '/markdown/index.md', '/openapi.json', '/.well-known/api-catalog', '/missing-security-check/', '/text-swap', '/social-preview.png', script]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await request.fetch(path, { method, maxRedirects: 0 });
      expect(response.status(), `${method} ${path}`).toBe(path === '/text-swap' ? 301 : path === '/missing-security-check/' ? 404 : 200);
      for (const [name, value] of Object.entries({
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      })) {
        expect(response.headers()[name], `${method} ${path}: ${name}`).toBe(value);
      }
      expect(response.headers()['content-security-policy'], `${method} ${path}`).toContain("frame-ancestors 'none'");
      expect(response.headers()['content-security-policy'], `${method} ${path}`).toContain("object-src 'none'");
      expect(response.headers()['content-security-policy'], `${method} ${path}`).toContain("base-uri 'self'");
    }
  }
  const markdown = await request.get('/hold-confirm/', { headers: { Accept: 'text/markdown' } });
  expect(markdown.headers()['content-type']).toContain('text/markdown');
  expect(markdown.headers()['x-content-type-options']).toBe('nosniff');
});

test('private paths are not published', async ({ request }) => {
  for (const path of ['/.env', '/.env.local', '/.git/config', '/.dev.vars', '/package.json', '/pnpm-lock.yaml', '/__lab/test', '/drafts/', '/.DS_Store']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('environment files are ignored while examples remain versionable', () => {
  const privatePaths = ['.env', '.env.local', '.env.staging', '.env.development', '.env.production', '.dev.vars', '.dev.vars.local'];
  const examples = ['.env.example', '.dev.vars.example'];
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], {
    input: [...privatePaths, ...examples].join('\n') + '\n',
    encoding: 'utf8',
  }).trim().split('\n');
  expect(ignored).toEqual(privatePaths);
});

test('all content pages hydrate without CSP violations', async ({ page }) => {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`));
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of ['/', '/text-swap/', '/hold-confirm/', '/chevron-morph/', '/plucked-underline/', '/gooey-radio-group/', '/edge-aware-tooltip/', '/drag-select/', '/resize-handle/', '/missing-security-check/']) {
    await page.goto(path);
    if (path !== '/' && path !== '/missing-security-check/') {
      await page.locator('[data-source-format][value="css"]').check();
      await expect(page.getByRole('tab', { name: 'HTML', exact: true }).first()).toBeVisible();
    }
    expect(await page.evaluate(() => window.cspViolations), path).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('CSP blocks injected inline scripts and event handlers', async ({ page }) => {
  await page.goto('/');
  const violation = page.evaluate(() => new Promise<string>((resolve) => {
    document.addEventListener('securitypolicyviolation', (event) => resolve(event.blockedURI), { once: true });
    const script = document.createElement('script');
    script.textContent = 'window.injectedScriptRan = true';
    document.body.append(script);
    const button = document.createElement('button');
    button.setAttribute('onclick', 'window.injectedScriptRan = true');
    document.body.append(button);
    button.click();
  }));
  expect(await violation).toBe('inline');
  expect(await page.evaluate(() => 'injectedScriptRan' in window)).toBe(false);
});

test('CSP permits Cloudflare Web Analytics, which stays off outside production', async ({ page, context }) => {
  const contacted: string[] = [];
  await context.route(/cloudflareinsights\.com/, (route) => {
    contacted.push(route.request().url());
    const beacon = route.request().url().endsWith('/beacon.min.js');
    return route.fulfill(beacon
      ? { contentType: 'text/javascript', body: "fetch('https://cloudflareinsights.com/cdn-cgi/rum', { method: 'POST', mode: 'no-cors', body: '{}' }).then(() => { window.beaconSent = true; });" }
      : { status: 204 });
  });
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`));
  });
  await page.goto('/');
  await expect(page.locator('script[data-cf-beacon]')).toHaveCount(0);
  expect(contacted).toEqual([]);

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    document.body.append(script);
  });
  await page.waitForFunction(() => 'beaconSent' in window);
  expect(contacted).toEqual(['https://static.cloudflareinsights.com/beacon.min.js', 'https://cloudflareinsights.com/cdn-cgi/rum']);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});

test('mobile navigation still opens and Escape returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/hold-confirm/');
  const toggle = page.getByRole('button', { name: 'Studies', exact: true });
  await toggle.click();
  await expect(page.locator('#mobile-index')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-index')).toBeHidden();
  await expect(toggle).toBeFocused();
});

test('CSP permits CodePen exports without contacting CodePen', async ({ page, context }) => {
  await context.route('https://codepen.io/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Export received</title>' }));
  await page.goto('/hold-confirm/');
  await page.locator('[data-source-format][value="css"]').check();
  const exported = context.waitForEvent('request', (request) => request.url() === 'https://codepen.io/cpe/pen/define');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Edit on CodePen (opens in a new tab)', exact: true }).first().click();
  const request = await exported;
  expect(request.method()).toBe('POST');
  expect(request.postData()).toContain('data=');
  await (await popup).close();
});
