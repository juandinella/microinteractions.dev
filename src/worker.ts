import server from '@astrojs/cloudflare/entrypoints/server';
import { specimens } from './data/specimens';
import { acceptsMarkdown } from './lib/accept-markdown';
import { securityHeaders } from './lib/security-headers';

const pages = new Map([
  ['/', 'index'],
  ...specimens.map((specimen) => [`/${specimen.id}/`, specimen.id] as const),
]);

const worker = {
  async fetch(...args: Parameters<typeof server.fetch>) {
    const [request, env, context] = args;
    const url = new URL(request.url);
    const slug = pages.get(url.pathname);
    if (!['GET', 'HEAD'].includes(request.method)) return server.fetch(...args);
    if (!slug) {
      const asset = await env.ASSETS.fetch(request);
      return asset.status === 404 ? server.fetch(...args) : asset;
    }

    const markdown = acceptsMarkdown(request.headers.get('Accept'));
    if (markdown) {
      url.pathname = `/markdown/${slug}.md`;
    }
    const target = markdown ? new Request(url, request) : request;
    const asset = await env.ASSETS.fetch(target);
    // Prerendered pages only exist in ASSETS after a build; `astro dev` renders them on demand.
    const response = asset.status === 404 ? await server.fetch(target, env, context) : asset;
    const headers = new Headers(response.headers);
    const vary = headers.get('Vary');
    if (!vary?.split(',').some((value) => ['accept', '*'].includes(value.trim().toLowerCase()))) {
      headers.set('Vary', vary ? `${vary}, Accept` : 'Accept');
    }
    headers.set('Content-Signal', 'ai-train=no, search=yes, ai-input=yes');
    const links = markdown ? [] : [`</markdown/${slug}.md>; rel="alternate"; type="text/markdown"`];
    if (slug === 'index') {
      links.push(
        '</.well-known/api-catalog>; rel="api-catalog"',
        '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
        '</api.md>; rel="service-doc"; type="text/markdown"',
      );
    }
    if (links.length) headers.append('Link', links.join(', '));
    if (markdown && response.ok) headers.set('Content-Type', 'text/markdown; charset=utf-8');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

export default {
  async fetch(...args: Parameters<typeof server.fetch>) {
    const response = await worker.fetch(...args);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
