import type { APIRoute, GetStaticPaths } from 'astro';
import { registryItems, registryName } from '../../data/registry';

export const prerender = true;

export const getStaticPaths = (() => [
  { params: { name: 'registry' } },
  ...registryItems.map((item) => ({ params: { name: item.name } })),
]) satisfies GetStaticPaths;

const json = (body: object) => new Response(`${JSON.stringify(body, null, 2)}\n`, {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

export const GET: APIRoute = ({ params, site }) => {
  if (params.name === 'registry') {
    return json({
      $schema: 'https://ui.shadcn.com/schema/registry.json',
      name: registryName,
      homepage: new URL('/', site).href,
      items: registryItems.map(({ files, ...item }) => ({
        ...item,
        files: files.map(({ content, ...file }) => file),
      })),
    });
  }
  const item = registryItems.find(({ name }) => name === params.name)!;
  return json({ $schema: 'https://ui.shadcn.com/schema/registry-item.json', ...item });
};
