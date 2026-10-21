import type { APIRoute } from 'astro';

export const prerender = true;

// RFC 9727 API catalog. The only API is the read-only Markdown view of each page.
export const GET: APIRoute = ({ site }) => new Response(`${JSON.stringify({
  linkset: [{
    anchor: new URL('/', site).href,
    'service-desc': [{ href: new URL('/openapi.json', site).href, type: 'application/vnd.oai.openapi+json' }],
    'service-doc': [{ href: new URL('/api.md', site).href, type: 'text/markdown' }],
  }],
}, null, 2)}\n`, {
  headers: { 'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"' },
});
