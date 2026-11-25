# microinteractions.dev

Live at **[microinteractions.dev](https://microinteractions.dev/)**. Built by [Juan Di Nella](https://juandinella.com/), Design Engineer, open to remote work.

A library of small UI behavior studies. Each study pairs a live demo with its timing, an inspector, a short article, and the full source. Every one works with the keyboard and respects reduced motion.

## Use a study

Each study installs into a React project with Tailwind CSS v4 and shadcn/ui, and takes its colors from your theme tokens:

```sh
npx shadcn@latest add https://microinteractions.dev/r/hold-confirm.json
```

```tsx
import { HoldConfirmButton } from '@/components/hold-confirm';

<HoldConfirmButton onConfirm={() => deleteProject()} />
```

To install by name, add the registry to your `components.json`:

```json
{
  "registries": {
    "@microinteractions": "https://microinteractions.dev/r/{name}.json"
  }
}
```

```sh
npx shadcn@latest add @microinteractions/hold-confirm
```

Not using React? Each study page also has the original Astro source, styled with plain CSS or Tailwind, ready to copy.

## For agents

Install the skill, and your coding agent finds the study that fits, adds it to your project, and checks it:

```sh
npx skills@latest add https://microinteractions.dev
```

[`/llms.txt`](https://microinteractions.dev/llms.txt) indexes the collection, every page is available as Markdown with `Accept: text/markdown`, and [`/api.md`](https://microinteractions.dev/api.md) describes the endpoints.

## License

Code is released under the [MIT License](LICENSE).
