import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site }) => new Response(
  `User-agent: *\nContent-Signal: ai-train=no, search=yes, ai-input=yes\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
