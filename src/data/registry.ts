import { components, scripts } from 'virtual:registry-sources';
import { dedent } from './source';
import { specimens, type SpecimenId } from './specimens';

// The studies installable with the shadcn CLI. Each item is a React port of the live demo
// that themes itself with the consumer's shadcn tokens. A demo with a custom element ships
// the element's script unchanged, so the behavior keeps a single source.
const items: Partial<Record<SpecimenId, { element?: string }>> = {
  'text-swap': {},
  'hold-confirm': { element: 'HoldToConfirmButton.astro' },
};

// The demo defines its element on DOMContentLoaded; React only loads it in the browser, after rendering the markup.
function elementModule(file: string) {
  const script = scripts[file];
  const [define, tag, name] = script?.match(/\n\s*\/\/ A script in <head>[\s\S]*?customElements\.define\('([\w-]+)', (\w+)\)[\s\S]*$/) ?? [];
  if (!define) throw new Error(`${file}: the shadcn registry expects a custom element defined on DOMContentLoaded.`);
  return `${dedent(script.replace(define, ''))}\n\nif (!customElements.get('${tag}')) customElements.define('${tag}', ${name});\n\nexport {};\n`;
}

export const registryName = 'microinteractions';

export const registryItems = specimens.flatMap((specimen) => {
  const item = items[specimen.id];
  if (!item) return [];
  return [{
    name: specimen.id,
    type: 'registry:component',
    title: specimen.title,
    description: specimen.summary,
    registryDependencies: ['utils'],
    files: [
      { path: `registry/${specimen.id}.tsx`, type: 'registry:component', content: components[`${specimen.id}.tsx`] },
      ...(item.element ? [{ path: `registry/${specimen.id}-element.ts`, type: 'registry:component', content: elementModule(item.element) }] : []),
    ],
    categories: [specimen.category],
    docs: `Study: https://microinteractions.dev/${specimen.id}/`,
  }];
});
