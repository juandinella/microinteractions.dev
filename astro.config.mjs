// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { codeTheme } from './src/styles/code-theme.ts';
import { securityHeaders } from './src/lib/security-headers.ts';
import { specimens } from './src/data/specimens.ts';

import cloudflare from '@astrojs/cloudflare';
import { access, readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // No sessions: otherwise the Cloudflare adapter adds a SESSION KV binding without
  // an id, which `wrangler preview` rejects on branch builds.
  session: false,
  compressHTML: true,
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self' https://codepen.io",
        "img-src 'self' data:",
      ],
      // Shiki and the live demos use inline styles; scripts remain hash-restricted.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  site: 'https://microinteractions.dev',
  trailingSlash: 'always',
  integrations: [react(), mdx(), sitemap({
    // Editorial dates only: a study's publish date, and the newest one for the index.
    serialize(item) {
      const slug = new URL(item.url).pathname.replace(/^\/|\/$/g, '');
      const dates = slug ? specimens.filter((specimen) => specimen.id === slug).map((specimen) => specimen.published) : specimens.map((specimen) => specimen.published).sort().slice(-1);
      return dates.length ? { ...item, lastmod: dates[0] } : item;
    },
  }), {
    name: 'production-response-rules',
    hooks: {
      'astro:build:done': async ({ dir, pages }) => {
        const headersFile = new URL('_headers', dir);
        const headers = await readFile(headersFile, 'utf8');
        const securityRule = Object.entries(securityHeaders).map(([name, value]) => `  ${name}: ${value}`).join('\n');
        await writeFile(headersFile, `${headers}\n/*\n${securityRule}\n`);
        const rules = ['/index.html / 301', '/index / 301'];
        for (const { pathname } of pages) {
          const slug = pathname.replace(/^\/|\/$/g, '');
          if (!slug || slug === '404' || slug === '500' || slug.includes('.')) continue;
          for (const suffix of ['', '.html', '/index', '/index.html']) {
            rules.push(`/${slug}${suffix} /${slug}/ 301`);
          }
        }
        await writeFile(new URL('_redirects', dir), `${rules.join('\n')}\n`);
        for (const { id } of specimens) {
          await access(new URL(`social/${id}.png`, dir)).catch(() => {
            throw new Error(`Missing social cover for ${id}: run pnpm run generate:social.`);
          });
        }
      },
    },
  }],

  markdown: {
    shikiConfig: { theme: codeTheme },
  },

  vite: {
    server: {
      watch: { ignored: ['**/video/**'] },
    },
    optimizeDeps: { entries: ['**/*.html', '!video/**', '!dist/**'] },
    environments: {
      ssr: {
        optimizeDeps: { include: ['@base-ui/react/popover', '@base-ui/react/tabs', 'lucide-react', 'astro/zod', 'astro/components'] },
      },
    },
    plugins: [tailwindcss(), {
      name: 'interaction-source',
      enforce: 'pre',
      async load(id) {
        if (!id.endsWith('.astro?raw')) return;
        let source = await readFile(id.replace('?raw', ''), 'utf8');
        const script = source.match(/<script>([\s\S]*?)<\/script>/);
        if (script) {
          const { code } = await transform(script[1], { loader: 'ts', target: 'esnext' });
          source = source.replace(script[0], `<script>\n${code}</script>`);
        }
        return `export default ${JSON.stringify(source)}`;
      },
    }]
  },

  adapter: cloudflare()
});
