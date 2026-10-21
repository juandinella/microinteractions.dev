// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) which URLs changed.
// Run after a deploy, once the key file is live:
//   pnpm run indexnow                 every URL in the production sitemap
//   pnpm run indexnow <url> ...       only those URLs
//   pnpm run indexnow --since <sha>   studies added, edited, or removed since that commit, plus the index
// Add --dry-run to print the URLs without checking or submitting them.
// The publish workflow runs the --since form after each production deploy.
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const host = 'microinteractions.dev';
const origin = `https://${host}`;
const key = (await readdir(new URL('../public/', import.meta.url)))
  .map((file) => file.match(/^([0-9a-f]{32})\.txt$/)?.[1])
  .find(Boolean);
if (!key) throw new Error('Missing IndexNow key file: public/<32 hex characters>.txt');

const live = await fetch(`${origin}/${key}.txt`);
if (!live.ok || (await live.text()).trim() !== key) throw new Error(`The key file is not live at ${origin}/${key}.txt; deploy first.`);

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const studyUrl = (id) => `${origin}/${id}/`;

// Each study's block in specimens.ts, keyed by id, so an edit to one study only resubmits that study.
function studyBlocks(source) {
  const blocks = new Map();
  const starts = Array.from(source.matchAll(/^ {4}id: '([a-z0-9-]+)'/gm));
  // A block ends where its object closes, so appending a study doesn't change the one before it.
  starts.forEach((match, index) => {
    const block = source.slice(match.index, starts[index + 1]?.index);
    blocks.set(match[1], block.slice(0, block.indexOf('\n  }')));
  });
  return blocks;
}

function changedSince(sha) {
  const file = 'src/data/specimens.ts';
  const before = studyBlocks(git('ls-tree', '--name-only', sha, file).trim() ? git('show', `${sha}:${file}`) : '');
  const after = studyBlocks(git('show', `HEAD:${file}`));
  const ids = new Set([...before.keys(), ...after.keys()].filter((id) => before.get(id) !== after.get(id)));
  for (const path of git('diff', '--name-only', sha, 'HEAD', '--', 'src/content/studies').split('\n')) {
    const id = path.match(/^src\/content\/studies\/([a-z0-9-]+)\.mdx$/)?.[1];
    if (id) ids.add(id);
  }
  // Removed studies are submitted too, so engines drop them, but they won't answer 200.
  return { urls: [...ids].map(studyUrl), removed: new Set([...before.keys()].filter((id) => !after.has(id)).map(studyUrl)) };
}

const dryRun = process.argv.includes('--dry-run');
let urls = process.argv.slice(2).filter((arg) => arg !== '--dry-run');
let removed = new Set();
const since = urls.indexOf('--since');
if (since !== -1) {
  ({ urls, removed } = changedSince(urls[since + 1]));
  if (!urls.length) {
    console.log('No studies changed; nothing to submit.');
    process.exit(0);
  }
  urls.unshift(`${origin}/`);
} else if (!urls.length) {
  const sitemap = await (await fetch(`${origin}/sitemap-0.xml`)).text();
  urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => url);
}

if (dryRun) {
  console.log(urls.join('\n'));
  process.exit(0);
}

// A deploy can report success a moment before every edge serves it.
for (const url of urls.filter((url) => !removed.has(url))) {
  for (let attempt = 1; ; attempt++) {
    const status = (await fetch(url, { method: 'HEAD' })).status;
    if (status === 200) break;
    if (attempt === 12) throw new Error(`${url} answered ${status}; not submitting.`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: urls }),
});
if (!response.ok) throw new Error(`IndexNow answered ${response.status}: ${await response.text()}`);
console.log(`IndexNow accepted ${urls.length} URLs (${response.status}):\n${urls.join('\n')}`);
