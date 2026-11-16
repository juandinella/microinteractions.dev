import type { APIRoute } from 'astro';
import { author } from '../data/author';
import { collectionDescription } from '../data/collection';
import { specimens } from '../data/specimens';

export const prerender = true;

export const GET: APIRoute = ({ site }) => new Response(`${[
  '# Microinteractions',
  `> ${collectionDescription}`,
  `A project by [${author.name}](${author.url}). Every page also returns Markdown when requested with \`Accept: text/markdown\`.`,
  `For React projects, use the shadcn install command in each study's Markdown. Components use your project's shadcn theme tokens. [Registry index](${new URL('/r/registry.json', site).href}).`,
  '## Studies',
  // Every study ships a React port; the registry test fails until a new one has it.
  specimens.map((specimen) => `- [${specimen.title}](${new URL(`/markdown/${specimen.id}.md`, site).href}): ${specimen.summary} [React registry item](${new URL(`/r/${specimen.id}.json`, site).href}).`).join('\n'),
  '## Optional',
  [
    `- [Collection index](${new URL('/markdown/index.md', site).href}): all studies with category, trigger, and duration`,
    `- [Agent skill](${new URL('/.well-known/agent-skills/microinteractions/SKILL.md', site).href}): how to apply a study in a codebase`,
    `- [API docs](${new URL('/api.md', site).href}): content negotiation, fixed Markdown URLs, the React registry, and WebMCP tools`,
    `- [RSS feed](${new URL('/rss.xml', site).href}): new studies as they are published`,
  ].join('\n'),
].join('\n\n')}\n`, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
