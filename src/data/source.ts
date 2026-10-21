import tokens from '../styles/tokens.css?raw';

export type ReducedMotion = 'instant' | 'component';

function dedent(source: string) {
  const lines = source.replace(/^\n|\s+$/g, '').split('\n');
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim())
      .map((line) => line.match(/^ */)![0].length),
  );
  return lines.map((line) => line.slice(indent)).join('\n');
}

function scriptFiles(source: string) {
  const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  return script
    ? [{ id: 'js', label: 'JavaScript', lang: 'js', code: dedent(script) }]
    : [];
}

// Shown with every Tailwind variant, so study articles don't repeat the setup.
export const tailwindSetupNote = (includeScript: boolean) =>
  `Paste the CSS tab into the stylesheet that imports Tailwind CSS v4.${includeScript ? ' The JavaScript is the same as in the CSS version.' : ''}`;

// A Tailwind variant reuses the script of the CSS implementation passed as `scriptSource`.
export function tailwindSourceFiles(source: string, scriptSource = '') {
  const style = /<style is:global>([\s\S]*?)<\/style>/;
  return [
    {
      id: 'html',
      label: 'HTML',
      lang: 'html',
      code: dedent(source.replace(style, '').trimEnd()),
    },
    {
      id: 'css',
      label: 'CSS',
      lang: 'css',
      code: dedent(source.match(style)![1]),
    },
    ...scriptFiles(scriptSource),
  ];
}

export function sourceFiles(
  source: string,
  includeScript: boolean,
  reducedMotion: ReducedMotion,
) {
  const markup = dedent(
    source
      .replace(/<(script|style)>[\s\S]*?<\/\1>/g, '')
      .replace(/ data-trace-progress/g, '')
      .trimEnd(),
  );
  const root = `.${markup.match(/class="([\w-]+)/)![1]}`;
  const lightTokens = Object.fromEntries(
    [...tokens.split('@media')[0].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
      ([, name, value]) => [name, value],
    ),
  );
  const styles = dedent(source.match(/<style>([\s\S]*?)<\/style>/)![1])
    .replace(
      /\n\s*[^{}]*\[data-inspect(?:=['"][^'"]*['"])?\][^{}]*\{[^{}]*\}\n/g,
      (rule) => (rule.includes(':is(') ? rule : '\n'),
    )
    .replace(/,\s*\[data-inspect(?:=['"][^'"]*['"])?\]/g, '')
    .replace(
      /,\s*\[data-touch-active\]/g,
      includeScript ? ', [data-touch-active]' : '',
    )
    .replace(/:is\(([^(),]+)\)/g, '$1')
    .replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n*/g, '')
    .replace(/var\((--[\w-]+)\)/g, (value, name) => lightTokens[name] ?? value)
    .replace(
      new RegExp(
        `(${root.replace('.', '\\.')} \\{(?:\\n\\s*--[\\w-]+:[^;]+;)*\\n)`,
      ),
      '$1  font-family: system-ui, sans-serif;\n',
    );
  const css = [
    `${root}, ${root} * {\n  box-sizing: border-box;\n}`,
    styles,
    reducedMotion === 'instant' &&
      /transition(?:-[\w-]+)?:/.test(styles) &&
      `@media (prefers-reduced-motion: reduce) {\n  ${root}, ${root} * {\n    transition: none !important;\n  }\n}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return [
    { id: 'html', label: 'HTML', lang: 'html', code: markup },
    { id: 'css', label: 'CSS', lang: 'css', code: css },
    ...(includeScript ? scriptFiles(source) : []),
  ];
}
