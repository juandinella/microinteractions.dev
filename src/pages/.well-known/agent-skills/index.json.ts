import type { APIRoute } from 'astro';
import { skillDescription, skillMarkdown, skillName } from '../../../lib/agent-skill';

export const prerender = true;

// Agent Skills Discovery RFC v0.2.0. The digest must match the published SKILL.md byte for byte.
export const GET: APIRoute = async ({ site }) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(skillMarkdown(site)));
  const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return new Response(`${JSON.stringify({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [{
      name: skillName,
      type: 'skill-md',
      description: skillDescription,
      url: `/.well-known/agent-skills/${skillName}/SKILL.md`,
      digest: `sha256:${digest}`,
    }],
  }, null, 2)}\n`, { headers: { 'Content-Type': 'application/json' } });
};
