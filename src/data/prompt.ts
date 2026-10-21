import type { CollectionEntry } from 'astro:content';
import { easingCss, type Specimen } from './specimens';

type Prompt = NonNullable<CollectionEntry<'studies'>['data']['prompt']>;

const list = (items: string[]) => items.map((item) => `- ${item}`).join('\n');

const series = (items: string[]) =>
  items.length < 3
    ? items.join(' and ')
    : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;

function timing(specimen: Specimen, prompt: Prompt) {
  const easing = easingCss(specimen.easing);
  if (!prompt.timing)
    return [`${specimen.duration}ms, ${easing}, on ${series(specimen.props)}.`];

  // Written timing must still state every duration the demo uses.
  const text = prompt.timing.join('\n');
  const missing = [
    specimen.minDuration,
    specimen.duration,
    specimen.confirmationDuration,
    specimen.release,
  ].filter((ms) => ms !== undefined && !text.includes(`${ms}ms`));
  if (missing.length > 0)
    throw new Error(
      `The ${specimen.id} prompt timing omits ${missing.map((ms) => `${ms}ms`).join(', ')}.`,
    );
  return prompt.timing;
}

export function buildPrompt(specimen: Specimen, prompt: Prompt) {
  return [
    `${prompt.task} Use my project's stack and conventions.`,
    `Behavior\n${list(prompt.behavior)}`,
    `Timing\n${list(timing(specimen, prompt))}`,
    `Accessibility\n${list(prompt.accessibility)}`,
    prompt.avoid.length > 0 && `Avoid\n${list(prompt.avoid)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
