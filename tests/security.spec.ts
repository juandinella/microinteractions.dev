import { expect, test, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { usagePoint } from '../src/lib/usage';

declare global {
  interface Window {
    cspViolations: string[];
    beaconSent: boolean;
  }
}

test('security headers cover Worker responses, static assets, redirects, and errors', async ({ request }) => {
  const home = await request.get('/');
  const script = (await home.text()).match(/<script[^>]+src="([^"]+)"/)![1];
  for (const path of ['/', '/hold-confirm/', '/markdown/index.md', '/openapi.json', '/.well-known/api-catalog', '/missing-security-check/', '/text-swap', '/social-preview.png', '/fonts/martian-grotesk.woff2', '/social/text-swap.png', '/og/videos/text-swap.mp4', '/favicon.svg', script]) {
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
  expect(home.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  for (const font of ['martian-grotesk', 'martian-mono']) {
    expect((await request.get(`/fonts/${font}.woff2`)).headers()['cache-control'], font).toBe('public, max-age=2592000');
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

test('analytics stay off outside production, and the CSP permits Cloudflare Web Analytics', async ({ page, context }) => {
  const contacted: string[] = [];
  await context.route(/cloudflareinsights\.com|umami\.is/, (route) => {
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
  await expect(page.locator('script[data-cf-beacon], script[data-website-id]')).toHaveCount(0);
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

// Serves the local build on the production host, the only one where analytics report.
async function serveProduction(context: BrowserContext) {
  await context.route('https://microinteractions.dev/**', async (route) => {
    const { pathname, search } = new URL(route.request().url());
    await route.fulfill({ response: await context.request.get(`${pathname}${search}`) });
  });
}

test('production reports page views and code actions to Umami within the CSP', async ({ page, context }) => {
  const sent: { name: string; data: Record<string, string> }[] = [];
  await serveProduction(context);
  await context.route(/cloudflareinsights\.com/, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await context.route('https://codepen.io/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Export received</title>' }));
  await context.route('https://cloud.umami.is/script.js', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `const { websiteId, excludeHash } = document.currentScript.dataset;
      const send = (name, data) => fetch('https://gateway.umami.is/api/send', { method: 'POST', body: JSON.stringify({ name, data }) });
      window.umami = { track: send };
      send('loaded', { websiteId, excludeHash });`,
  }));
  await context.route('https://gateway.umami.is/api/send', (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: {}, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`));
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => {} });
  });
  await page.goto('https://microinteractions.dev/hold-confirm/');
  await expect.poll(() => sent).toEqual([{ name: 'loaded', data: { websiteId: '9df4379f-e6e7-4121-a0d8-0a6932f04ced', excludeHash: 'true' } }]);

  await page.getByRole('button', { name: 'Add with shadcn' }).click();
  await page.getByRole('tab', { name: 'pnpm', exact: true }).click();
  await page.getByRole('button', { name: 'Copy install command' }).click();
  await expect.poll(() => sent.at(-1)).toEqual({ name: 'copy_install', data: { study: 'hold-confirm', manager: 'pnpm' } });
  await page.keyboard.press('Escape');

  await page.locator('[data-source-format][value="tailwind"]').check();
  const variant = page.locator('[data-source-variant="tailwind"]');
  await variant.getByRole('tab', { name: 'JavaScript', exact: true }).click();
  await variant.getByRole('button', { name: 'Copy JavaScript' }).click();
  await expect.poll(() => sent.at(-1)).toEqual({ name: 'copy_code', data: { study: 'hold-confirm', format: 'tailwind', file: 'js' } });

  const popup = page.waitForEvent('popup');
  await variant.getByRole('button', { name: 'Edit on CodePen (opens in a new tab)', exact: true }).click();
  await (await popup).close();
  await expect.poll(() => sent.at(-1)).toEqual({ name: 'open_codepen', data: { study: 'hold-confirm', format: 'tailwind' } });
  expect(sent).toHaveLength(4);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);

  await page.goto('https://microinteractions.dev/');
  await expect.poll(() => sent).toHaveLength(5);
  await page.getByRole('button', { name: 'Copy skill install command' }).click();
  await expect.poll(() => sent.at(-1)).toEqual({ name: 'copy_skill' });
  expect(sent).toHaveLength(6);
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});

test('a browser can opt out of analytics and back in', async ({ page, context }) => {
  let contacted: string[] = [];
  await serveProduction(context);
  await context.route(/cloudflareinsights\.com|umami\.is/, (route) => {
    contacted.push(new URL(route.request().url()).hostname);
    return route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  const visit = async (path: string) => {
    contacted = [];
    await page.goto(`https://microinteractions.dev${path}`, { waitUntil: 'networkidle' });
    return contacted.sort();
  };
  const both = ['cloud.umami.is', 'static.cloudflareinsights.com'];
  expect(await visit('/')).toEqual(both);
  expect(await visit('/hold-confirm/?utm_source=x&analytics=off#implementation')).toEqual([]);
  expect(page.url()).toBe('https://microinteractions.dev/hold-confirm/?utm_source=x#implementation');
  expect(await visit('/text-swap/')).toEqual([]);
  expect(await visit('/?analytics=on')).toEqual(both);
  expect(page.url()).toBe('https://microinteractions.dev/');
});

test('usage points cover installs and Markdown reads in production only', () => {
  const point = (url: string, { method = 'GET', status = 200, type = 'text/html', slug }: { method?: string; status?: number; type?: string; slug?: string } = {}) =>
    usagePoint(new Request(new URL(url, 'https://microinteractions.dev'), { method, headers: { 'User-Agent': 'shadcn' } }), new Response(null, { status, headers: { 'Content-Type': type } }), slug)?.blobs;
  expect(point('/r/hold-confirm.json')).toEqual(['registry', 'hold-confirm', 'shadcn']);
  expect(point('/markdown/hold-confirm.md', { status: 304 })).toEqual(['markdown', 'hold-confirm', 'shadcn']);
  expect(point('/.well-known/agent-skills/microinteractions/SKILL.md')).toEqual(['skill', 'microinteractions', 'shadcn']);
  expect(point('/hold-confirm/', { type: 'text/markdown; charset=utf-8', slug: 'hold-confirm' })).toEqual(['negotiated-markdown', 'hold-confirm', 'shadcn']);
  expect(point('/hold-confirm/', { slug: 'hold-confirm' })).toBeUndefined();
  expect(point('/r/missing.json', { status: 404 })).toBeUndefined();
  expect(point('/r/hold-confirm.json', { method: 'HEAD' })).toBeUndefined();
  expect(point('https://preview.workers.dev/r/hold-confirm.json')).toBeUndefined();
});

test('external links open isolated; only the author link sends a referrer', async ({ page }) => {
  await page.goto('/');
  const author = page.locator('.byline a');
  await expect(author).toHaveAttribute('rel', 'noopener');
  await expect(author).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('link', { name: 'on GitHub' })).toHaveAttribute('rel', 'noopener noreferrer');
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
