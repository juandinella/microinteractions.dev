import type { APIRoute } from 'astro';
import { skillMarkdown } from '../../../../lib/agent-skill';

export const prerender = true;

export const GET: APIRoute = ({ site }) => new Response(skillMarkdown(site), {
  headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
});
