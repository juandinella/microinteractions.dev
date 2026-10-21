import { specimens } from '../data/specimens';

// WebMCP: lets an in-browser agent read and open studies. Chrome's early preview
// exposed the API on navigator; the current draft moved it to document.
interface ModelContext {
  registerTool(tool: object, options?: { signal?: AbortSignal }): Promise<void> | void;
}

const modelContext: ModelContext | undefined =
  (document as Document & { modelContext?: ModelContext }).modelContext
  ?? (navigator as Navigator & { modelContext?: ModelContext }).modelContext;

const ids = specimens.map((specimen) => specimen.id);
const idSchema = {
  type: 'object',
  properties: { id: { type: 'string', enum: ids, description: 'Study ID, as returned by list_studies.' } },
  required: ['id'],
  additionalProperties: false,
};

const studyId = (input: { id?: unknown }) => {
  const id = ids.find((candidate) => candidate === input.id);
  if (!id) throw new Error(`Unknown study "${String(input.id)}". Valid IDs: ${ids.join(', ')}.`);
  return id;
};

const tools = [
  {
    name: 'list_studies',
    title: 'List studies',
    description: 'List every microinteraction study with its category, trigger, duration, easing, and URLs.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => JSON.stringify(specimens.map((specimen) => ({
      id: specimen.id,
      title: specimen.title,
      category: specimen.category,
      summary: specimen.summary,
      trigger: specimen.triggerLabel,
      durationMs: specimen.duration,
      ...(specimen.minDuration && { minDurationMs: specimen.minDuration }),
      easing: specimen.easingName,
      url: new URL(`/${specimen.id}/`, location.origin).href,
      markdownUrl: new URL(`/markdown/${specimen.id}.md`, location.origin).href,
    })), null, 2),
  },
  {
    name: 'get_study',
    title: 'Get study',
    description: 'Get a study as Markdown: the reasoning behind its timing and easing, accessibility notes, and the complete CSS and Tailwind source.',
    inputSchema: idSchema,
    annotations: { readOnlyHint: true },
    execute: async (input: { id?: unknown }, options?: { signal?: AbortSignal }) => {
      const response = await fetch(`/markdown/${studyId(input)}.md`, { signal: options?.signal });
      if (!response.ok) throw new Error(`Could not load the study (HTTP ${response.status}).`);
      return response.text();
    },
  },
  {
    name: 'open_study',
    title: 'Open study',
    description: 'Navigate this tab to a study page so the user can try the live demo.',
    inputSchema: idSchema,
    execute: async (input: { id?: unknown }) => {
      const url = `/${studyId(input)}/`;
      // Navigate after returning so the agent receives the result before the page unloads.
      setTimeout(() => location.assign(url));
      return `Opening ${new URL(url, location.origin).href}`;
    },
  },
];

let controller: AbortController | undefined;

function register() {
  if (!modelContext) return;
  controller?.abort();
  controller = new AbortController();
  for (const tool of tools) {
    // The older navigator API returns undefined instead of a promise.
    Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal }))
      .catch((error) => console.warn(`WebMCP: could not register ${tool.name}`, error));
  }
}

register();
addEventListener('pagehide', () => controller?.abort());
addEventListener('pageshow', (event) => { if (event.persisted) register(); });
