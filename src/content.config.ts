import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const studies = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/studies' }),
  schema: z.object({
    observe: z.string().optional(),
    references: z.array(z.object({
      title: z.string(),
      author: z.string().optional(),
      url: z.url(),
    })).default([]),
    // Timing comes from specimens.ts; the prompt states the decisions around it.
    prompt: z.object({
      task: z.string(),
      behavior: z.array(z.string()),
      // Replaces the generated timing line when a study has more than one phase.
      timing: z.array(z.string()).optional(),
      accessibility: z.array(z.string()),
      avoid: z.array(z.string()).default([]),
    }).optional(),
  }),
});

export const collections = { studies };
