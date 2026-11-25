// Counts what browser analytics can't see: registry installs, Markdown reads, and skill fetches by agents.
// Each point holds no IP or other visitor identifier. Columns: blob1 surface, blob2 study or file, blob3 user agent.
// Query with the Analytics Engine SQL API, counting SUM(_sample_interval) because points can be sampled.
const surfaces = [
  ['registry', /^\/r\/([\w-]+)\.json$/],
  ['markdown', /^\/markdown\/([\w-]+)\.md$/],
  ['skill', /^\/\.well-known\/agent-skills\/([\w-]+)\/SKILL\.md$/],
] as const;

export function usagePoint(request: Request, response: Response, slug?: string) {
  const { hostname, pathname } = new URL(request.url);
  if (hostname !== 'microinteractions.dev' || request.method !== 'GET') return;
  if (response.status !== 200 && response.status !== 304) return;

  const direct = surfaces.flatMap(([surface, pattern]) => {
    const name = pathname.match(pattern)?.[1];
    return name ? [[surface, name] as const] : [];
  })[0];
  // A page URL answered with Markdown because the client asked for it in Accept.
  const negotiated = slug && response.headers.get('Content-Type')?.startsWith('text/markdown')
    ? (['negotiated-markdown', slug] as const)
    : undefined;
  const read = direct ?? negotiated;
  if (!read) return;

  const [surface, name] = read;
  return { indexes: [name], blobs: [surface, name, (request.headers.get('User-Agent') ?? '').slice(0, 256)] };
}
