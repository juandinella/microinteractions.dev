import type { APIRoute } from 'astro';
import { author } from '../data/author';
import { specimens } from '../data/specimens';

export const prerender = true;

export const GET: APIRoute = ({ site }) => new Response(`${[
  '# Microinteractions',
  '> Studies of small UI interactions. Each one explains how timing and easing change the way the interaction feels, and includes complete HTML, CSS, JavaScript, and Tailwind source with keyboard and reduced-motion support.',
  `A project by [${author.name}](${author.url}). Every page also returns Markdown when requested with \`Accept: text/markdown\`.`,
  '## Studies',
  specimens.map((specimen) => `- [${specimen.title}](${new URL(`/markdown/${specimen.id}.md`, site).href}): ${specimen.summary}`).join('\n'),
  '## Optional',
  [
    `- [Collection index](${new URL('/markdown/index.md', site).href}): all studies with category, trigger, and duration`,
    `- [Agent skill](${new URL('/.well-known/agent-skills/microinteractions/SKILL.md', site).href}): how to apply a study in a codebase`,
    `- [API docs](${new URL('/api.md', site).href}): content negotiation and fixed Markdown URLs`,
    `- [RSS feed](${new URL('/rss.xml', site).href}): new studies as they are published`,
  ].join('\n'),
].join('\n\n')}\n`, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
