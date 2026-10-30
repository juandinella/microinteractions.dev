import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { author } from '../../data/author';
import { collectionDescription } from '../../data/collection';
import { previews } from '../../data/previews';
import { buildPrompt } from '../../data/prompt';
import { registryItems } from '../../data/registry';
import { repository } from '../../data/repository';
import { sourceFiles, tailwindSetupNote, tailwindSourceFiles } from '../../data/source';
import { durationLabel, specimens } from '../../data/specimens';

export const prerender = true;

function codeBlock(lang: string, code: string) {
  const fence = '`'.repeat(Math.max(3, ...Array.from(code.matchAll(/`+/g), ([run]) => run.length + 1)));
  return `${fence}${lang}\n${code}\n${fence}`;
}

function codeBlocks(files: { label: string; lang: string; code: string }[]) {
  return files.map((file) => `### ${file.label}\n\n${codeBlock(file.lang, file.code)}`).join('\n\n');
}

export const getStaticPaths = (async () => {
  const site = import.meta.env.SITE;
  const studies = await getCollection('studies');
  const index = [
    '# Microinteractions',
    `${collectionDescription} The site is open source [on GitHub](${repository.url}).`,
    `A project by [${author.name}](${author.url}).`,
    `For React projects, each study's Markdown includes its shadcn install command. [Browse the registry](${new URL('/r/registry.json', site).href}).`,
    ...specimens.map((specimen) => `## [${specimen.title}](/${specimen.id}/)\n\n${specimen.summary}\n\nCategory: ${specimen.category}. Trigger: ${specimen.triggerLabel}. Duration: ${durationLabel(specimen)}.`),
  ].join('\n\n');

  return [
    { params: { slug: 'index' }, props: { markdown: index } },
    ...specimens.map((specimen) => {
      const study = studies.find((entry) => entry.id === specimen.id);
      if (!study?.body) throw new Error(`Missing study article: ${specimen.id}`);
      const preview = previews[specimen.id];
      const registryItem = registryItems.find(({ name }) => name === specimen.id);
      const { prompt } = study.data;
      // Same order as the page: the prompt leads, then the code formats.
      const implementation = [
        ...(prompt ? ['## Prompt', codeBlock('text', buildPrompt(specimen, prompt))] : []),
        '## Implementation',
        codeBlocks(sourceFiles(preview.source, preview.includeScript, preview.reducedMotion)),
        ...(preview.tailwindSource ? ['## Tailwind implementation', tailwindSetupNote(preview.includeScript), codeBlocks(tailwindSourceFiles(preview.tailwindSource, preview.includeScript ? preview.source : ''))] : []),
      ].join('\n\n');
      const markdown = [
        `# ${specimen.title}`,
        specimen.summary,
        `Category: ${specimen.category}. Trigger: ${specimen.triggerLabel}. Duration: ${durationLabel(specimen)}. Easing: ${specimen.easingName}.`,
        ...(specimen.durationNote ? [specimen.durationNote] : []),
        ...(registryItem ? [
          '## React component',
          'Install the React component into your project with shadcn. It uses your project\'s shadcn theme tokens.',
          codeBlock('sh', `npx shadcn@latest add ${new URL(`/r/${registryItem.name}.json`, site).href}`),
        ] : []),
        ...(study.data.observe ? [`## What to observe\n\n${study.data.observe}`] : []),
        study.body.replace('<Implementation specimen={props.specimenId} />', () => implementation),
        ...(study.data.references.length ? ['## References', study.data.references.map((reference) => `- [${reference.title}](${reference.url})${reference.author ? ` — ${reference.author}` : ''}`).join('\n')] : []),
      ].join('\n\n');
      return { params: { slug: specimen.id }, props: { markdown } };
    }),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(`${props.markdown}\n`, {
  headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
});
