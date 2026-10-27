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
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Optional gitignored Vite plugins for local tooling; forced to dev-only so they never reach a build.
const localConfig = new URL('./astro.local.mjs', import.meta.url);
const localPlugins = await access(localConfig).then(async () => (await import(localConfig.href)).default, () => []);

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
        // Cloudflare Web Analytics posts its beacons here.
        "connect-src 'self' https://cloudflareinsights.com",
      ],
      // Shiki and the live demos use inline styles; scripts remain hash-restricted.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      scriptDirective: { resources: ["'self'", 'https://static.cloudflareinsights.com/beacon.min.js'] },
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
        const rules = ['/index.html / 301', '/index / 301', '/sitemap.xml /sitemap-index.xml 301'];
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
    // The registry ports import the consumer's `@/lib/utils`. The dependency scan still reaches them,
    // and an unresolved import makes it skip pre-bundling, which breaks pages once deps are discovered.
    optimizeDeps: { entries: ['**/*.html', '!video/**', '!dist/**'], exclude: ['@/lib/utils'] },
    environments: {
      ssr: {
        optimizeDeps: {
          include: ['@base-ui/react/popover', '@base-ui/react/tabs', 'lucide-react', 'astro/zod', 'astro/components'],
          exclude: ['@/lib/utils'],
        },
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
    }, {
      // The studies with an og:video clip. Prerendering runs in workerd, where pages can't read the file system.
      name: 'og-videos',
      resolveId: (id) => (id === 'virtual:og-videos' ? '\0virtual:og-videos' : undefined),
      async load(id) {
        if (id !== '\0virtual:og-videos') return;
        const files = await readdir(new URL('./public/og/videos/', import.meta.url)).catch(() => []);
        const ids = files.filter((file) => file.endsWith('.mp4')).map((file) => file.slice(0, -4));
        return `export default ${JSON.stringify(ids)}`;
      },
    }, {
      // The shadcn registry's React ports, and the TypeScript <script> of each demo before the code tabs
      // transpile it. Read as text: a ?raw import would send the dev dependency scan into files that
      // import the consumer's @/lib/utils, and the failed scan breaks pre-bundling.
      name: 'registry-sources',
      resolveId: (id) => (id === 'virtual:registry-sources' ? '\0virtual:registry-sources' : undefined),
      async load(id) {
        if (id !== '\0virtual:registry-sources') return;
        const read = async (dir, extension, pick) => {
          const sources = {};
          for (const file of await readdir(dir)) {
            if (!file.endsWith(extension)) continue;
            this.addWatchFile(fileURLToPath(new URL(file, dir)));
            const source = pick(await readFile(new URL(file, dir), 'utf8'));
            if (source !== undefined) sources[file] = source;
          }
          return sources;
        };
        const components = await read(new URL('./src/registry/', import.meta.url), '.tsx', (source) => source);
        const scripts = await read(new URL('./src/components/', import.meta.url), '.astro', (source) => source.match(/<script>([\s\S]*?)<\/script>/)?.[1]);
        return `export const components = ${JSON.stringify(components)};\nexport const scripts = ${JSON.stringify(scripts)};`;
      },
    }, ...localPlugins.map((plugin) => ({ ...plugin, apply: 'serve' }))]
  },

  // No page uses astro:assets. The default 'cloudflare-binding' service would still
  // publish /_image backed by the paid Images binding, open to anonymous requests.
  adapter: cloudflare({ imageService: 'passthrough' })
});
