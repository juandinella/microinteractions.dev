import assert from 'node:assert/strict';

const origin = process.argv[2] ?? 'http://localhost:8787';
const indexResponse = await fetch(`${origin}/markdown/index.md`);
assert.equal(indexResponse.status, 200);
const index = await indexResponse.text();
const paths = ['/', ...Array.from(index.matchAll(/^## \[.+\]\((\/[^)]+\/)\)/gm), ([, path]) => path)];
assert(paths.length > 1, 'Index must link to the studies');

for (const path of paths) {
  for (const [accept, markdown] of [
    [null, false],
    ['text/markdown', true],
    ['text/html', false],
    ['*/*', false],
    ['text/markdown;q=0, text/html', false],
    ['text/markdown;q=0.5, text/html', false],
    ['text/markdown, text/html;q=0.5', true],
  ]) {
    const response = await fetch(new URL(path, origin), { headers: accept ? { Accept: accept } : {} });
    assert.equal(response.status, 200, path);
    assert(response.headers.get('content-type').includes(markdown ? 'text/markdown' : 'text/html'), `${path}: ${accept}`);
    assert.match(response.headers.get('vary'), /Accept/i);
    assert.equal(response.headers.get('content-signal'), 'ai-train=no, search=yes, ai-input=yes');
    const body = await response.text();
    if (markdown) {
      assert(body.startsWith('# '));
      assert(!body.includes('<Implementation'));
      assert(!body.toLowerCase().includes('<!doctype'));
      if (path !== '/') {
        assert(body.includes('## Prompt\n\n```text\n'), `${path}: missing prompt`);
        assert(body.includes('## Implementation'));
        assert(body.includes('```css'));
        assert(body.includes('## References'));
        if (['/hold-confirm/', '/edge-aware-tooltip/', '/plucked-underline/'].includes(path)) {
          const tailwind = body.split('## Tailwind implementation')[1];
          assert.match(tailwind, /### JavaScript\n\n```js\n/, `${path}: Tailwind must include its script`);
        }
      }
    }
  }
  const head = await fetch(new URL(path, origin), { method: 'HEAD', headers: { Accept: 'text/markdown' } });
  assert.equal(head.status, 200);
  assert.match(head.headers.get('content-type'), /text\/markdown/);
  assert.equal(await head.text(), '');
  console.log(`PASS ${path}: negotiation, content, headers, HEAD`);
}

const missing = await fetch(`${origin}/missing/`, { headers: { Accept: 'text/markdown' } });
assert.equal(missing.status, 404);
const robots = await fetch(`${origin}/robots.txt`, { headers: { Accept: 'text/markdown' } });
assert.match(robots.headers.get('content-type'), /text\/plain/);
const redirect = await fetch(`${origin}${paths[1].slice(0, -1)}`, { redirect: 'manual', headers: { Accept: 'text/markdown' } });
assert.equal(redirect.status, 301);
assert(new URL(redirect.headers.get('location'), origin).pathname === paths[1]);
console.log('PASS missing page, robots.txt, canonical redirect');

const metadata = await fetch(`${origin}/.DS_Store`);
assert.equal(metadata.status, 404, 'Finder metadata must not be published');
console.log('PASS Finder metadata excluded from published assets');
