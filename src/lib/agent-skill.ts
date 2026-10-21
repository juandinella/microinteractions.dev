import { durationLabel, specimens } from '../data/specimens';

export const skillName = 'microinteractions';
export const skillDescription = 'Implement and review small UI interactions using studied examples with exact timing, easing, accessibility notes, and copyable HTML, CSS, JavaScript, and Tailwind source.';

export const skillMarkdown = (site: URL | undefined) => `---
name: ${skillName}
description: ${skillDescription}
---

# Microinteractions

Studies of small UI interactions from ${new URL('/', site).href}. Each study explains why its timing and easing were chosen and ships complete source.

## When to use

Use this skill when building or reviewing one of the interactions below, or when you need a reference for duration, easing, keyboard support, or reduced-motion handling in a similar interaction.

## Studies

${specimens.map((specimen) => `- **${specimen.title}** (${specimen.category}): ${specimen.summary} ${specimen.duration ? `${durationLabel(specimen)}, ` : ''}${specimen.easingName}. ${new URL(`/markdown/${specimen.id}.md`, site).href}`).join('\n')}

The full list with summaries is at ${new URL('/markdown/index.md', site).href}. Any page also returns Markdown when requested with \`Accept: text/markdown\`.

## How to apply a study

1. Fetch the study's Markdown. It contains the reasoning, the CSS implementation, and a Tailwind version when one exists.
2. Copy the implementation, then adapt names and colors to the project. Keep the duration and easing unless the project has a documented reason to differ; the article explains what changes if you do.
3. Keep the keyboard, focus, and \`prefers-reduced-motion\` handling from the source. The interactions are designed to work without hover, animation, or color alone.
4. Link the study in a code comment so the timing decisions stay traceable.
`;
