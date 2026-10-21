// Renders the index cover and one cover per study.
// Only covers whose inputs changed are rendered again; pass --all to render every one.
// Each cover's inputs are fingerprinted in src/data/social-covers.json, so
// renders from another OS don't rewrite covers that haven't changed.
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const root = new URL('..', import.meta.url);
const bundled = await build({
  stdin: {
    contents: "export { renderSocialImage } from './src/lib/social-image.ts'; export { specimens } from './src/data/specimens.ts';",
    resolveDir: fileURLToPath(root),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { renderSocialImage, specimens } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const config = JSON.parse(await readFile(new URL('src/data/social-image.json', root), 'utf8'));
const fonts = await Promise.all(['martian-grotesk', 'martian-mono'].map(async (name) => {
  const bytes = await readFile(new URL(`public/fonts/${name}.woff2`, root));
  const family = name === 'martian-grotesk' ? 'Martian Grotesk' : 'Martian Mono';
  return `@font-face { font-family: '${family}'; src: url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2'); font-weight: 300 700; size-adjust: 88.1%; }`;
}));
const logo = await readFile(new URL('public/logo.svg', root));
const logoHref = `href="data:image/svg+xml;base64,${logo.toString('base64')}"`;

// The renderer, fonts, and logo change every cover; a study's copy changes only its own.
const shared = createHash('sha256')
  .update(await readFile(new URL('src/lib/social-image.ts', root)))
  .update(JSON.stringify(config))
  .update(fonts.join(''))
  .update(logo)
  .digest('hex');
const fingerprint = (study) => createHash('sha256')
  .update(shared)
  .update(JSON.stringify(study ? [study.id, study.title, study.summary, study.category] : null))
  .digest('hex')
  .slice(0, 16);

const manifestFile = new URL('src/data/social-covers.json', root);
const manifest = await readFile(manifestFile, 'utf8').then(JSON.parse, () => ({}));
const covers = [
  { key: 'index', path: 'public/social-preview.png', study: undefined },
  ...specimens.map((study) => ({ key: study.id, path: `public/social/${study.id}.png`, study })),
];
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);
const stale = [];
for (const cover of covers) {
  cover.hash = fingerprint(cover.study);
  if (process.argv.includes('--all') || manifest[cover.key] !== cover.hash || !(await exists(cover.path))) stale.push(cover);
}

if (stale.length) {
  await mkdir(new URL('public/social/', root), { recursive: true });
  // Without hinting, Linux renders the type at the same weight as macOS.
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    for (const { path, study } of stale) {
      const image = renderSocialImage(config, study).replace('href="/logo.svg"', logoHref);
      await page.setContent(`<html><head><style>${fonts.join('\n')}body{margin:0}</style></head><body>${image}</body></html>`);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.locator('[data-social-image]').screenshot({ path: fileURLToPath(new URL(path, root)) });
    }
  } finally {
    await browser.close();
  }
}

const next = Object.fromEntries(covers.map(({ key, hash }) => [key, hash]));
await writeFile(manifestFile, `${JSON.stringify(next, null, 2)}\n`);
console.log(stale.length
  ? `Rendered ${stale.map(({ path }) => path).join(', ')} (1200×630).`
  : 'Social covers are up to date.');
