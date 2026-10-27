import { readFile } from 'node:fs/promises';
import { dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const root = fileURLToPath(new URL('../', import.meta.url));
const stylesheet = fileURLToPath(new URL('../src/styles/global.css', import.meta.url));
const scanner = new Scanner({
  sources: [{ base: root, pattern: 'src/**/*.{astro,tsx,jsx,ts,js,html,mdx}', negated: false }],
});
scanner.scan();

const files = await Promise.all(scanner.files.sort().map(async (file) => ({
  file,
  source: await readFile(file, 'utf8'),
})));

// Specimen themes and custom variants live in Astro's global style blocks.
const componentStyles = files
  .filter(({ file }) => file.endsWith('.astro'))
  .flatMap(({ source }) => [...source.matchAll(/<style\b[^>]*\bis:global\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1]));
const designSystem = await __unstable__loadDesignSystem([
  await readFile(stylesheet, 'utf8'),
  ...componentStyles,
].join('\n'), { base: dirname(stylesheet) });
// The shadcn registry ports run in projects that import shadcn/tailwind.css, which narrows some
// data-* variants (data-selected only matches "true"). Check them against those variants, so a
// suggestion never changes what a class matches there.
const shadcnVariants = Object.entries({
  open: '[data-state="open"]), &:where([data-open]:not([data-open="false"])',
  closed: '[data-state="closed"]), &:where([data-closed]:not([data-closed="false"])',
  checked: '[data-state="checked"]), &:where([data-checked]:not([data-checked="false"])',
  unchecked: '[data-state="unchecked"]), &:where([data-unchecked]:not([data-unchecked="false"])',
  selected: '[data-selected="true"]',
  disabled: '[data-disabled="true"]), &:where([data-disabled]:not([data-disabled="false"])',
  active: '[data-state="active"]), &:where([data-active]:not([data-active="false"])',
  horizontal: '[data-orientation="horizontal"]',
  vertical: '[data-orientation="vertical"]',
}).map(([name, selector]) => `@custom-variant data-${name} { &:where(${selector}) { @slot; } }`);
const registrySystem = await __unstable__loadDesignSystem([
  await readFile(stylesheet, 'utf8'),
  ...shadcnVariants,
].join('\n'), { base: dirname(stylesheet) });
// Tailwind still proposes `data-selected` for `[&[data-selected]]` under those variants, so a
// registry suggestion only counts when it compiles to the same selectors.
const selectors = (candidate) => [...(registrySystem.candidatesToCss([candidate])[0] ?? '')
  .replaceAll(`.${candidate.replace(/[^\w-]/g, (character) => `\\${character}`)}`, '.candidate')
  .matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim()).join('|');

let problems = 0;
for (const { file, source } of files) {
  // CSS property names can also be legacy utility names (for example flex-shrink).
  const content = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,
    (style) => style.replace(/[^\r\n]/g, ' '));
  const candidates = scanner.getCandidatesWithPositions({ content, extension: extname(file).slice(1) });
  const system = relative(root, file).startsWith('src/registry/') ? registrySystem : designSystem;
  // IntelliSense canonicalizes px against a 16px root, so `top-[17px]` becomes `top-4.25`.
  const canonical = new Map([...new Set(candidates.map(({ candidate }) => candidate))]
    .map((candidate) => [candidate, system.canonicalizeCandidates([candidate], { rem: 16 })[0]]));

  for (const { candidate, position } of candidates) {
    const suggestion = canonical.get(candidate);
    if (candidate === suggestion) continue;
    if (!system.candidatesToCss([candidate])[0]) continue;
    if (system === registrySystem && selectors(candidate) !== selectors(suggestion)) continue;

    // Oxide reports UTF-8 byte offsets; editor locations use text characters.
    const prefix = Buffer.from(content).subarray(0, position).toString('utf8');
    const lines = prefix.split('\n');
    console.error(`${relative(root, file)}:${lines.length}:${lines.at(-1).length + 1}: ${candidate} → ${suggestion}`);
    problems++;
  }
}

if (problems) {
  console.error(`\nFAIL: ${problems} non-canonical Tailwind class occurrences. Apply the suggested forms and rerun pnpm run check:tailwind.`);
  process.exitCode = 1;
} else {
  console.log(`PASS: canonical Tailwind classes in ${files.length} source files.`);
}
