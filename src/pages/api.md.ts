import type { APIRoute } from 'astro';
import { specimens } from '../data/specimens';

export const prerender = true;

export const GET: APIRoute = ({ site }) => new Response(`${[
  '# Microinteractions API',
  'Every page has a read-only Markdown version with the study notes and full source code. No authentication required.',
  '## Content negotiation',
  'Request any page with `Accept: text/markdown` to get Markdown instead of HTML.',
  `\`\`\`\ncurl -H 'Accept: text/markdown' ${new URL('/', site).href}\n\`\`\``,
  '## Fixed URLs',
  [`- \`${new URL('/markdown/index.md', site).href}\` — collection index`, ...specimens.map((specimen) => `- \`${new URL(`/markdown/${specimen.id}.md`, site).href}\` — ${specimen.title}`)].join('\n'),
  '## In-browser tools (WebMCP)',
  'Every page registers these tools with `document.modelContext` for agents running in the browser:',
  '- `list_studies` — every study with category, trigger, duration, easing, and URLs\n- `get_study` — `{ id }`; the study as Markdown, including source\n- `open_study` — `{ id }`; navigates the tab to the live demo',
  '## Machine-readable',
  `- OpenAPI description: ${new URL('/openapi.json', site).href}\n- API catalog (RFC 9727): ${new URL('/.well-known/api-catalog', site).href}\n- Agent skill index: ${new URL('/.well-known/agent-skills/index.json', site).href}\n- llms.txt: ${new URL('/llms.txt', site).href}`,
].join('\n\n')}\n`, {
  headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
});
