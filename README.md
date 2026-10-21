# microinteractions.dev

Live at **[microinteractions.dev](https://microinteractions.dev/)**. Built by [Juan Di Nella](https://juandinella.com/), Design Engineer, open to remote work.

An Astro library for precise, tactile UI microinteraction studies. A grid of interactive cards and a categorized sidebar lead to individual study pages with a live preview, frame inspector, technical notes, and copyable component source. The product direction is a restrained "motion specimen tray": quiet surfaces, small metadata, and visible behavior.

Product and design source of truth:
- `PRODUCT.md`
- `DESIGN.md`

## Stack

- Astro 7
- React 19 integration
- Tailwind CSS v4 through the Vite plugin
- Cloudflare adapter and Wrangler for preview/deploy
- pnpm lockfile

## Requirements

- Node `>=22.12.0`
- pnpm

## Commands

Run commands from the repository root.

| Command | Action |
| :-- | :-- |
| `pnpm install` | Install dependencies |
| `pnpm run dev` | Start Astro dev server at `localhost:4321` |
| `pnpm run build` | Build the site to `dist/` |
| `pnpm run test:e2e` | Build and verify the local production Worker in Chromium and WebKit |
| `pnpm run preview` | Build, then run `wrangler dev` for Cloudflare Worker behavior |
| `pnpm run deploy` | Build, then deploy with Wrangler |
| `pnpm run generate-types` | Generate Cloudflare environment types with Wrangler |
| `pnpm astro ...` | Run Astro CLI commands |

Install browser binaries once with `pnpm exec playwright install chromium webkit`. The regression suite covers the inspector, source fallbacks, keyboard behavior, mobile layouts, published assets, and Markdown exports. It starts a local-only Worker on port 8791.

There is no configured lint script. `pnpm astro check` is not currently ready because it prompts to install `@astrojs/check` and `typescript`.

## Project Structure

```text
src/pages/index.astro              Interactive collection grid
src/pages/[slug].astro             Statically generated study pages
src/layouts/BaseLayout.astro       Document, metadata, header, sidebar, mobile index
src/components/SpecimenNav.astro   Shared collection navigation and active state
src/components/SpecimenStage.astro Live stage, inspector, and technical metadata
src/components/SpecimenCode.astro  Expandable Astro source with clipboard feedback
src/data/specimens.ts              IDs, categories, copy, and timing data
src/data/previews.ts               Demo components and raw source registry
src/styles/global.css              CSS entrypoint
src/styles/tokens.css              Design tokens
src/styles/base.css                Base resets and reduced-motion handling
public/                            Static assets
astro.config.mjs                   Astro integrations, Tailwind Vite plugin, Cloudflare adapter
wrangler.jsonc                     Cloudflare Worker/assets configuration
```

Generated and local runtime output such as `dist/`, `.astro/`, `.wrangler/`, and `node_modules/` is ignored.

## Adding a Study

1. Add its Astro demo component under `src/components/`, including keyboard and reduced-motion behavior.
2. Add its stable ID to `SpecimenId` and its metadata to `src/data/specimens.ts`. Keep duration, easing, and trigger information aligned with the demo. Array order controls previous/next navigation.
3. Register the component, its `?raw` source import, and its filename in `src/data/previews.ts`.
4. Verify the live component fits the index card and works with touch and keyboard. The card passes `embedded` to the component; components that need a compact presentation can accept that prop (see `EdgeAwareTooltip.astro`). Add new sidebar categories to the shared `categories` list and remove the study's title from `planned` once it ships.
5. Verify the new slug and inspector, then run `pnpm run build`. New trigger types also need matching inspector behavior in `SpecimenStage.astro`.

The source panel displays the original Astro component. It uses the shared tokens in `src/styles/tokens.css` and the reduced-motion handling in `src/styles/base.css`.

## SEO maintenance

- Use `https://microinteractions.dev/` and trailing slashes for study URLs. Canonical and `og:url` omit query parameters. HTTP-to-HTTPS redirects are configured in Cloudflare, outside the repository.
- Each study needs `seoTitle` and `seoDescription` in `src/data/specimens.ts`, separate from its visible title and summary.
- Builds generate the sitemap and permanent redirects from published pages. `robots.txt` announces `https://microinteractions.dev/sitemap-index.xml`.
- `StructuredData.astro` emits the page, site, author, article and breadcrumb data, plus the index's `ItemList` of studies. Articles carry `datePublished` from each study's `published` date and the study's cover as `image`; the sitemap uses the same dates as `lastmod`. Author identity lives in `src/data/author.ts`; attribution is visible on the home page. Study headers intentionally have no byline. Do not infer editorial dates from build timestamps.
- `/rss.xml` lists every study, newest first, and every page links to it. It is generated from `src/data/specimens.ts`.
- Each study has its own cover at `public/social/{id}.png`, rendered with the shared composition. On pull requests, the Social covers workflow renders the covers whose title, summary, category, or renderer changed and commits them. `pnpm run generate:social` does the same locally (`--all` renders every cover). The build fails if a cover is missing.
- After Cloudflare deploys a push to main that touches a study, the IndexNow workflow submits the changed study URLs and the index to Bing and the other IndexNow engines. Run it by hand with `pnpm run indexnow` (whole sitemap), `pnpm run indexnow <url> ...`, or `pnpm run indexnow --since <sha>`; add `--dry-run` to only list the URLs. The key file is `public/<key>.txt`.
- Verify generated HTML with `pnpm run build`. Check redirect behavior with `pnpm run preview` and again on the public site after deployment.

## License

Code is released under the [MIT License](LICENSE).
