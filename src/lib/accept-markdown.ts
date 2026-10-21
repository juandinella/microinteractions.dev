export function acceptsMarkdown(accept: string | null): boolean {
  const ranges = (accept ?? '').split(',').map((range) => {
    const [type, ...parameters] = range.trim().toLowerCase().split(';');
    const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
    const q = quality ? Number(quality.trim().slice(2)) : 1;
    return { type: type.trim(), q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  const markdown = ranges.find(({ type }) => type === 'text/markdown');
  const html = ranges.find(({ type }) => type === 'text/html')
    ?? ranges.find(({ type }) => type === 'text/*')
    ?? ranges.find(({ type }) => type === '*/*');
  return !!markdown && markdown.q > 0 && markdown.q >= (html?.q ?? 0);
}
