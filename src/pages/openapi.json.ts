import type { APIRoute } from 'astro';
import { specimens } from '../data/specimens';

export const prerender = true;

const markdown = { 'text/markdown': { schema: { type: 'string' } } };

export const GET: APIRoute = ({ site }) => new Response(`${JSON.stringify({
  openapi: '3.1.0',
  info: {
    title: 'Microinteractions',
    version: '1.0.0',
    description: 'Read-only Markdown versions of the collection index and each study, including notes and full source code.',
  },
  externalDocs: { url: new URL('/api.md', site).href },
  servers: [{ url: new URL('/', site).href.replace(/\/$/, '') }],
  paths: {
    '/': {
      get: {
        operationId: 'getIndex',
        summary: 'Collection index',
        description: 'Returns Markdown when the Accept header prefers text/markdown, HTML otherwise.',
        parameters: [{ $ref: '#/components/parameters/Accept' }],
        responses: { 200: { description: 'The collection index.', content: { ...markdown, 'text/html': { schema: { type: 'string' } } } } },
      },
    },
    '/{slug}/': {
      get: {
        operationId: 'getStudy',
        summary: 'Study page',
        description: 'Returns Markdown when the Accept header prefers text/markdown, HTML otherwise.',
        parameters: [{ $ref: '#/components/parameters/Slug' }, { $ref: '#/components/parameters/Accept' }],
        responses: {
          200: { description: 'The study article with its implementation.', content: { ...markdown, 'text/html': { schema: { type: 'string' } } } },
          404: { description: 'Unknown study.' },
        },
      },
    },
    '/markdown/{document}.md': {
      get: {
        operationId: 'getMarkdown',
        summary: 'Markdown document',
        description: 'The same Markdown as content negotiation, at a fixed URL.',
        parameters: [{
          name: 'document',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['index', ...specimens.map((specimen) => specimen.id)] },
        }],
        responses: { 200: { description: 'The Markdown document.', content: markdown }, 404: { description: 'Unknown document.' } },
      },
    },
  },
  components: {
    parameters: {
      Slug: { name: 'slug', in: 'path', required: true, schema: { type: 'string', enum: specimens.map((specimen) => specimen.id) } },
      Accept: { name: 'Accept', in: 'header', required: false, schema: { type: 'string', example: 'text/markdown' } },
    },
  },
}, null, 2)}\n`, {
  headers: { 'Content-Type': 'application/vnd.oai.openapi+json' },
});
