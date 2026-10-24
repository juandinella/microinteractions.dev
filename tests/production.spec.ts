import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { specimens } from '../src/data/specimens';

test('source formats and languages work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8791/hold-confirm/');
  for (const format of ['CSS', 'Tailwind']) {
    await page.getByRole('radio', { name: format, exact: true }).first().check();
    const variant = page.locator(`[data-source-variant="${format.toLowerCase()}"]`);
    await variant.getByRole('radio', { name: 'CSS', exact: true }).check();
    await expect(variant.getByRole('region', { name: 'CSS source' })).toBeVisible();
    await variant.getByRole('radio', { name: 'JavaScript', exact: true }).check();
    await expect(variant.getByRole('region', { name: 'JavaScript source' })).toContainText('HOLD_DURATION');
    await expect(variant.getByRole('button', { name: 'Edit on CodePen (opens in a new tab)' })).toBeVisible();
    await expect(variant.getByRole('button', { name: /^Copy/ })).toBeHidden();
  }
  await context.close();
});

test('source survives failed island hydration', async ({ page }) => {
  await page.route('**/SourceTabs.*.js', (route) => route.abort());
  await page.goto('/hold-confirm/');
  await page.locator('[data-source-format][value="css"]').check();
  const variant = page.locator('[data-source-variant="css"]');
  await variant.getByRole('radio', { name: 'JavaScript', exact: true }).check();
  await expect(variant.getByRole('region', { name: 'JavaScript source' })).toContainText('HOLD_DURATION');
});

test('delayed hydration preserves implementation geometry and selection', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/SourceTabs.*.js', async (route) => { await gate; await route.continue(); });
  await page.goto('/hold-confirm/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-source-format][value="css"]').check();
  const variant = page.locator('[data-source-variant="css"]');
  await variant.getByRole('radio', { name: 'CSS', exact: true }).check();
  const before = await page.locator('[data-source]').boundingBox();
  release();
  await expect(variant.getByRole('tab', { name: 'CSS', exact: true })).toHaveAttribute('aria-selected', 'true');
  const after = await page.locator('[data-source]').boundingBox();
  expect(Math.abs(after!.height - before!.height)).toBeLessThan(2);
  await expect(variant.getByRole('tabpanel', { name: 'CSS', exact: true })).toBeVisible();
});

for (const slug of ['text-swap', 'chevron-morph']) {
  test(`${slug}: Escape restores the live demo without losing inspector focus`, async ({ page }) => {
    await page.goto(`/${slug}/`);
    const scrub = page.getByRole('slider', { name: /^Inspect/ });
    await page.mouse.move(0, 0);
    await scrub.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-specimen]')).toHaveAttribute('data-inspecting', '');
    await page.locator('[data-stage] button').first().hover();
    await page.keyboard.press('Escape');
    await expect(scrub).toBeFocused();
    await expect(page.locator('[data-specimen]')).not.toHaveAttribute('data-inspecting', '');
    expect(await page.locator('[data-stage]').evaluate((stage) => stage.getAnimations({ subtree: true }).filter((a) => a.playState === 'paused').length)).toBe(0);
    await expect.poll(() => page.locator('[data-stage] [data-trace-progress]').first().evaluate((target) => Number(getComputedStyle(target).opacity))).toBe(1);
    await page.mouse.move(0, 0);
    await expect.poll(() => page.locator('[data-stage] [data-trace-progress]').first().evaluate((target) => Number(getComputedStyle(target).opacity))).toBe(0);
  });
}

test('chevron trace follows the current button and interrupted reversals', async ({ page }) => {
  await page.goto('/chevron-morph/');
  const buttons = page.locator('[data-stage] button');
  await buttons.first().hover();
  await expect(page.locator('[data-trace-readout]')).toHaveText('190');
  // A short, controlled CSS duration extension makes handoff sampling deterministic under CI load.
  await buttons.nth(1).evaluate((button) => (button as HTMLElement).style.setProperty('--morph-duration', '1000ms'));
  await buttons.nth(1).hover();
  expect(Number(await page.locator('[data-trace-readout]').textContent())).toBeLessThan(190);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-trace-readout]')).toHaveText('0');
});

test('repeat Copy refreshes its live region and keeps keyboard tabs usable', async ({ page }) => {
  await page.goto('/hold-confirm/');
  await page.locator('[data-source-format][value="css"]').check();
  const variant = page.locator('[data-source-variant="css"]');
  await variant.getByRole('tab', { name: 'HTML', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(variant.getByRole('tab', { name: 'JavaScript', exact: true })).toBeFocused();
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => {} }));
  await variant.getByRole('button', { name: 'Copy JavaScript' }).click();
  await expect(variant.getByRole('status')).toHaveText('JavaScript copied to clipboard.');
  const announcement = await variant.getByRole('status').locator('span').elementHandle();
  await variant.getByRole('button', { name: 'Copy JavaScript' }).click();
  await expect.poll(() => announcement!.evaluate((element) => element.isConnected)).toBe(false);
  await expect(variant.getByRole('status')).toHaveText('JavaScript copied to clipboard.');
});

test('confirmation dialog locks background scroll and restores focus', async ({ page }) => {
  await page.goto('/hold-confirm/');
  const button = page.locator('.hold-button');
  await button.evaluate((button) => { button.focus(); button.click(); });
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(30, 200);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  await button.evaluate((button) => button.click());
  await page.locator('hold-to-confirm').evaluate((demo) => demo.remove());
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('narrow source targets and all content routes fit both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const path of ['/', '/text-swap/', '/chevron-morph/', '/hold-confirm/', '/edge-aware-tooltip/', '/plucked-underline/', '/resize-handle/']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
  await page.locator('[data-source-format][value="css"]').check();
  const tab = page.locator('[data-source-variant="css"]').getByRole('tab', { name: 'CSS', exact: true });
  await expect(tab).toBeVisible();
  expect((await tab.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect((await page.locator('.breadcrumb a').first().boundingBox())!.width).toBeGreaterThanOrEqual(44);
});

test('missing pages offer recovery and private assets stay unpublished', async ({ page, request }) => {
  const response = await page.goto('/missing-production-check/');
  expect(response!.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Back to index', exact: true })).toHaveAttribute('href', '/');
  expect((await request.get('/.DS_Store')).status()).toBe(404);
});

test('reduced motion keeps hold timing while removing decorative movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/hold-confirm/');
  const button = page.locator('.hold-button');
  await button.focus();
  await page.keyboard.down('Space');
  await expect(button).toHaveAttribute('data-state', 'holding');
  expect(await button.evaluate((button) => getComputedStyle(button, '::before').transform)).toBe('none');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Space');
  await expect(button).toHaveAttribute('data-state', 'idle');
  await page.goto('/text-swap/');
  await page.locator('[data-stage] button').hover();
  await expect(page.locator('[data-trace-readout]')).toHaveText('220');
});

test('Markdown content negotiation and complete Tailwind exports', () => {
  console.log(execFileSync(process.execPath, ['scripts/check-markdown.mjs', 'http://127.0.0.1:8791'], { encoding: 'utf8' }));
});

test('content routes expose valid social images', async ({ page, request }) => {
  const covers: Record<string, string> = { '/': '/social-preview.png' };
  for (const id of ['text-swap', 'chevron-morph', 'hold-confirm', 'edge-aware-tooltip', 'plucked-underline', 'gooey-radio-group', 'drag-select', 'resize-handle', 'tab-indicator', 'worm-dots']) covers[`/${id}/`] = `/social/${id}.png`;
  for (const [path, cover] of Object.entries(covers)) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `https://microinteractions.dev${cover}`);
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/png');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', `https://microinteractions.dev${cover}`);
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute('content', await page.locator('meta[property="og:image:alt"]').getAttribute('content'));
    const response = await request.get(cover);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }
});

test('studies with a recorded clip expose og:video and the others none', async ({ page, request }) => {
  for (const { id } of specimens) {
    await page.goto(`/${id}/`);
    const video = page.locator('meta[property^="og:video"]');
    if (!existsSync(`public/og/videos/${id}.mp4`)) {
      await expect(video).toHaveCount(0);
      continue;
    }
    const url = `https://microinteractions.dev/og/videos/${id}.mp4`;
    await expect(page.locator('meta[property="og:video"]')).toHaveAttribute('content', url);
    await expect(page.locator('meta[property="og:video:secure_url"]')).toHaveAttribute('content', url);
    await expect(page.locator('meta[property="og:video:type"]')).toHaveAttribute('content', 'video/mp4');
    await expect(page.locator('meta[property="og:video:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:video:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `https://microinteractions.dev/social/${id}.png`);
    const response = await request.get(`/og/videos/${id}.mp4`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('video/mp4');
  }
});

test('structured data dates studies and lists the collection', async ({ page }) => {
  const graph = async () => JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}')['@graph'];
  await page.goto('/');
  const list = (await graph()).find((node: { '@type': string }) => node['@type'] === 'ItemList');
  expect(list.itemListElement.map((item: { url: string }) => item.url)).toContain('https://microinteractions.dev/hold-confirm/');
  await page.goto('/hold-confirm/');
  const article = (await graph()).find((node: { '@type': string }) => node['@type'] === 'Article');
  expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(article.image).toBe('https://microinteractions.dev/social/hold-confirm.png');
});

test('RSS feed lists every study and is discoverable', async ({ page, request }) => {
  const feed = await request.get('/rss.xml');
  expect(feed.status()).toBe(200);
  expect(feed.headers()['content-type']).toContain('application/rss+xml');
  const body = await feed.text();
  expect(body.match(/<item>/g)).toHaveLength(10);
  expect(body).toContain('<link>https://microinteractions.dev/resize-handle/</link>');
  await page.goto('/text-swap/');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/rss.xml');
  const conventional = await request.get('/sitemap.xml', { maxRedirects: 0 });
  expect(conventional.status()).toBe(301);
  expect(conventional.headers().location).toBe('/sitemap-index.xml');
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain('<loc>https://microinteractions.dev/text-swap/</loc><lastmod>2026-09-29');
});

test('API catalog links to the OpenAPI description and docs', async ({ request }) => {
  const catalog = await request.get('/.well-known/api-catalog');
  expect(catalog.status()).toBe(200);
  expect(catalog.headers()['content-type']).toContain('application/linkset+json');
  const [entry] = (await catalog.json()).linkset;
  for (const [relation, type] of [['service-desc', 'application/vnd.oai.openapi+json'], ['service-doc', 'text/markdown']]) {
    const linked = await request.get(new URL(entry[relation][0].href).pathname);
    expect(linked.status()).toBe(200);
    expect(linked.headers()['content-type']).toContain(type);
  }
});

test('homepage advertises machine-readable resources in Link headers', async ({ request }) => {
  const home = (await request.get('/')).headers();
  expect(home['link']).toContain('</.well-known/api-catalog>; rel="api-catalog"');
  expect(home['link']).toContain('</markdown/index.md>; rel="alternate"; type="text/markdown"');
  expect(home['content-signal']).toContain('ai-input=yes');
  expect((await request.get('/text-swap/')).headers()['link']).toBe('</markdown/text-swap.md>; rel="alternate"; type="text/markdown"');
});

test('agent skill index digest matches the published skill', async ({ request }) => {
  const index = await request.get('/.well-known/agent-skills/index.json');
  expect(index.status()).toBe(200);
  const [skill] = (await index.json()).skills;
  const body = await (await request.get(skill.url)).body();
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', body)).toString('hex');
  expect(skill.digest).toBe(`sha256:${hash}`);
  const llms = await request.get('/llms.txt');
  expect(llms.status()).toBe(200);
  const text = await llms.text();
  expect(text).toContain('/markdown/text-swap.md');
  expect(text).toContain('/rss.xml');
});

test('WebMCP tools list, read, and open studies', async ({ page }) => {
  await page.addInitScript(() => {
    const registered = new Map();
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool(tool: { name: string }, { signal }: { signal?: AbortSignal } = {}) {
          registered.set(tool.name, tool);
          signal?.addEventListener('abort', () => registered.delete(tool.name));
          return Promise.resolve();
        },
      },
    });
    (window as unknown as { tools: typeof registered }).tools = registered;
  });
  await page.goto('/');
  const call = (name: string, input = {}) => page.evaluate(([name, input]) => (window as any).tools.get(name).execute(input, { signal: new AbortController().signal }), [name, input] as const);
  expect(await page.evaluate(() => [...(window as any).tools.keys()])).toEqual(['list_studies', 'get_study', 'open_study']);
  expect(JSON.parse(await call('list_studies')).map((study: { id: string }) => study.id)).toContain('hold-confirm');
  expect(await call('get_study', { id: 'hold-confirm' })).toContain('HOLD_DURATION');
  await expect(call('get_study', { id: 'nope' })).rejects.toThrow('Unknown study');
  await call('open_study', { id: 'text-swap' });
  await expect(page).toHaveURL(/\/text-swap\/$/);
});
