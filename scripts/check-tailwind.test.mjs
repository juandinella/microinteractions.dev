import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('canonical check rejects regressions and accepts custom themes, variants, and necessary underscores', async (t) => {
  const directory = await mkdtemp(join(root, 'src/tailwind-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'Fixture.astro');
  const run = () => spawnSync(process.execPath, ['scripts/check-tailwind.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  const styles = `<style is:global>
  @theme { --color-check-fixture: red; }
  @custom-variant check-fixture { &:hover { @slot; } }
  .fixture { flex-shrink: 0; }
</style>`;

  await writeFile(file, `<div title="é" class="opacity-[calc(1_-_var(--fixture))] opacity-[calc(1_-_var(--fixture))] check-fixture:[color:var(--color-check-fixture)] top-[17px]"></div>
${styles}
<script>const fill = null; if (!fill) console.info('fixture');</script>`);
  const rejected = run();
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  const diagnostics = rejected.stderr.split('\n').filter((line) => line.startsWith(relative(root, file)));
  assert.equal(diagnostics.length, 4, rejected.stderr);
  assert.ok(diagnostics[0].includes(':1:22: opacity-[calc(1_-_var(--fixture))] → opacity-[calc(1-var(--fixture))]'), diagnostics[0]);
  assert.match(diagnostics[2], /check-fixture:\[color:var\(--color-check-fixture\)\] → check-fixture:text-check-fixture/);
  // Pixel values resolve against a 16px root, as in IntelliSense.
  assert.match(diagnostics[3], /top-\[17px\] → top-4\.25/);

  await writeFile(file, `<div title="é" class="opacity-[calc(1-var(--fixture))] opacity-[calc(1-var(--fixture))] check-fixture:text-check-fixture [clip-path:inset(0_100%_0_0)] top-4.25 specimen-custom-class"></div>
${styles}
<script>const fill = null; if (!fill) console.info('fixture');</script>`);
  const accepted = run();
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  assert.match(accepted.stdout, /PASS: canonical Tailwind classes/);
});

test('registry ports keep attribute variants that shadcn narrows', async (t) => {
  const file = join(root, 'src/registry/tailwind-check-fixture.tsx');
  t.after(() => rm(file, { force: true }));
  // shadcn/tailwind.css makes data-selected match only "true", so `[&[data-selected]]` is not the same selector.
  await writeFile(file, 'export const Fixture = () => <tr className="[&[data-selected]]:*:font-bold top-[17px]" />;\n');
  const result = spawnSync(process.execPath, ['scripts/check-tailwind.mjs'], { cwd: root, encoding: 'utf8' });
  const diagnostics = result.stderr.split('\n').filter((line) => line.startsWith(relative(root, file)));
  assert.equal(diagnostics.length, 1, result.stderr);
  assert.match(diagnostics[0], /top-\[17px\] → top-4\.25/);
});
