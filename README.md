# microinteractions.dev

Live at **[microinteractions.dev](https://microinteractions.dev/)**. Built by [Juan Di Nella](https://juandinella.com/), Design Engineer, open to remote work.

A library of small UI behavior studies. Each study pairs a live demo with its timing, an inspector, a short article, and the full source, written to work with the keyboard and with reduced motion.

## Use a study

Every study installs as a React component, themed with your shadcn tokens:

```sh
npx shadcn@latest add https://microinteractions.dev/r/hold-confirm.json
```

Each study page has the command, plus the Astro source in CSS and Tailwind variants to copy.

Agents can read the collection through [`/llms.txt`](https://microinteractions.dev/llms.txt), a Markdown version of every page (`Accept: text/markdown`), the [API](https://microinteractions.dev/api.md), and WebMCP tools in the browser.

## Develop

Requires Node `>=22.12.0` and pnpm.

| Command | Action |
| :-- | :-- |
| `pnpm run dev` | Dev server at `localhost:4321` |
| `pnpm run build` | Check Tailwind classes, then build to `dist/` |
| `pnpm run test:e2e` | Test the production Worker in Chromium and WebKit |
| `pnpm run test:consumer` | Install every study with the shadcn CLI into `consumer/` and test it |
| `pnpm run preview` | Build and run the Worker with Wrangler |

Install the browsers once with `pnpm exec playwright install chromium webkit`, and the consumer project with `npm ci --prefix consumer`.

```text
src/components/          Study demos (custom elements) and site UI
src/components/tailwind/ Tailwind variant of each demo
src/registry/            React port of each study for the shadcn registry
src/content/studies/     One MDX article per study
src/data/specimens.ts    IDs, categories, copy, timing, publish dates
src/data/previews.ts     Demos, raw sources, inspection modes
src/styles/              Tokens, base styles, reduced-motion handling
src/worker.ts            Cloudflare Worker: headers, Markdown negotiation
```

Product and design direction live in [`PRODUCT.md`](PRODUCT.md) and [`DESIGN.md`](DESIGN.md).

## Adding a study

1. Build the demo in `src/components/` and its Tailwind variant in `src/components/tailwind/`, with keyboard and reduced-motion behavior.
2. Add its ID and metadata to `src/data/specimens.ts`, including `published`, `seoTitle`, and `seoDescription`. Durations and easing must match the demo's CSS.
3. Register the demo, its `?raw` sources, and its inspection mode in `src/data/previews.ts`.
4. Write the article in `src/content/studies/{id}.mdx`.
5. Port it to React in `src/registry/{id}.tsx` with shadcn theme tokens.
6. Run `pnpm run build`, `pnpm run test:e2e`, and `pnpm run test:consumer`.

The sidebar, routes, sitemap, RSS, and agent endpoints all derive from `specimens.ts`.

## Publishing

- **Covers:** on pull requests, CI renders `public/social/{id}.png` for studies whose cover inputs changed. The build fails without one. Locally: `pnpm run generate:social`.
- **og:video:** add the study's pointer moves to `scripts/og-choreographies.ts`, then `pnpm og:videos {id}` (needs `ffmpeg`).
- **IndexNow:** after Cloudflare deploys `main`, CI submits the changed study URLs. Locally: `pnpm run indexnow --since <sha> --dry-run`.

## License

Code is released under the [MIT License](LICENSE).
