import { durationLabel, specimens } from '../data/specimens';

export const skillName = 'microinteractions';

// The Skills CLI reads /.well-known/agent-skills/ from the site, so there is no repository to keep in sync.
export const skillInstall = 'npx skills@latest add https://microinteractions.dev';

const patterns = specimens.map((specimen) => specimen.aliases[0]).join(', ');

export const skillDescription = `Build, adapt, or review a small UI interaction from microinteractions.dev, with its exact timing, thresholds, and keyboard and touch behavior, as a shadcn React component or as HTML, CSS, and JavaScript. Use when a request involves one of these: ${patterns}. Also use when someone names microinteractions.dev or one of its studies, or asks which interactions it has.`;

// Agents drop or cut a description over the limit in the Agent Skills specification.
if (skillDescription.length > 1024) throw new Error(`The agent skill description has ${skillDescription.length} characters; the limit is 1024. Shorten the first alias of some studies.`);

export const skillMarkdown = (site: URL | undefined) => {
  const url = (path: string) => new URL(path, site).href;
  const studies = specimens.map((specimen) => {
    const timing = specimen.duration ? `${durationLabel(specimen)}, ${specimen.easingName}` : specimen.easingName;
    return `- \`${specimen.id}\` **${specimen.title}**: ${specimen.summary} Asked for as: ${specimen.aliases.join(', ')}. ${timing}.`;
  }).join('\n');

  return `---
name: ${skillName}
description: ${JSON.stringify(skillDescription)}
---

# Microinteractions

Studies of small UI interactions from ${url('/')}, by Juan Di Nella. The durations, distances, and thresholds in a study were tuned together, so a version written from memory looks right and behaves wrong. Read the study before writing code.

Each study has an id:

- Page with the live demo: \`${url('/')}{id}/\`
- Markdown with the reasoning and the source: \`${url('/markdown/')}{id}.md\`
- React component: \`${url('/r/')}{id}.json\` (all of them: ${url('/r/registry.json')})

## Studies

${studies}

## 1. Find the study

Match what the person does and what happens, not the component's name. "Animated tabs" that swap with a fade are not \`tab-indicator\`.

\`\`\`text
Is the request only to see what exists?
├── Yes → list every study with its page link, ask which one and where, and stop. Looking is not permission to edit.
└── No → does a study have the same gesture and the same result?
    ├── Yes → it is the study. Go to 2.
    ├── Same gesture, different result → it is a reference. Go to 2, then take Reference in 3.
    └── No → fetch ${url('/markdown/index.md')}. Studies published after this file was installed appear only there.
        ├── Found → go to 2.
        └── Not found → say the collection has no study for it and build it without this skill.
            Never credit that code to microinteractions.dev.
\`\`\`

If the place it goes is unclear, ask before editing.

## 2. Read the study

\`\`\`sh
curl -fsSL ${url('/markdown/')}{id}.md -o /tmp/{id}.md
\`\`\`

Download the file. Fetch tools that summarize drop the thresholds and event order that make the interaction work.

List its \`## \` headings, then read everything above \`## Implementation\`. The \`## Prompt\` block there is the full specification: Behavior, Timing, Accessibility, Avoid. Then read every section after the code; they cover wiring, forms, keyboard, and touch. The code in between can reach 100 KB, so open only the format you need in 3.

If the site can't be reached, say so and stop. The one-line summaries above are not enough to rebuild a study.

## 3. Choose how it enters the project

Read \`package.json\`, \`components.json\`, and any component that already does the job.

\`\`\`text
Is the study only a reference?
├── Yes → Reference
└── No → does the project already have a component doing this job?
    ├── Yes → Adapt
    └── No → React, Tailwind CSS v4, and a components.json?
        ├── Yes → Install
        └── No → Copy
\`\`\`

Never add React, Tailwind, or shadcn to a project for one interaction.

- **Install.** With the project's package runner, run \`npx shadcn@latest add ${url('/r/')}{id}.json --dry-run\`. If it would overwrite a file, show the person which one and stop, because it may hold their edits. Otherwise run it again with \`--yes\` instead of \`--dry-run\`. Never pass \`--overwrite\`. Then read the installed \`.tsx\`: its props and comments are the documentation. Never edit \`{id}-element.ts\`, because it holds the behavior and the next install replaces it.
- **Copy.** Take \`## Tailwind implementation\` if the project uses Tailwind v4, else \`## Implementation\`. Keep the custom element's name, the \`data-\` attributes, and the script as they are, because they reference each other. Extract the code from the download with a command instead of retyping it: one changed line in a 300-line script is hard to see. The HTML shows sample rows, so keep its structure and fill it with the project's content.
- **Adapt.** Edit the existing component with the Prompt as its specification. Keep its name, props, and events, because replacing it breaks its callers.
- **Reference.** Take from the study only the Timing and Accessibility lines about the shared gesture. Tell the person which values came from it and that the rest is custom.

In every branch, match the project's colors, type, radius, spacing, and labels. Never change a duration, easing, delay, distance, or threshold unless the person asks: changing one breaks its balance with the others. Keep the keyboard, focus, touch, and \`prefers-reduced-motion\` code even where the project has none.

## 4. Connect it

Demos use sample data and reset themselves. Replace the data, the labels, and the handler with the application's own, including what happens while the action is pending and when it fails. An empty callback is not a finished interaction. If the application has no handler yet, say which event to connect instead of inventing one.

Leave a comment with the study's page URL next to the code you installed, copied, or adapted. It credits the source, and the next person finds why a value is 160ms and not 200ms.

## 5. Verify

Run it in a browser and check, in order:

1. \`## What to observe\`, exactly as written. It is the test for what the study is about.
2. Keyboard only, from Tab to the final state.
3. \`prefers-reduced-motion: reduce\`.
4. Touch: tap, and a page scroll that starts on the control.

Report each as passed, failed, or not run. A build that compiles verifies none of them.

## Reviewing an existing interaction

Do 1 and 2, then compare the code with the Prompt line by line. Report one row per difference: file and line, what the code does, what the study says, what the person using it notices. Order rows by what breaks: keyboard and screen readers, touch, lost or repeated actions, then timing. Skip naming and styling, and skip a difference the project explains in a comment. Don't edit until asked.
`;
};
