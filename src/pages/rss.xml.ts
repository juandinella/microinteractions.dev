import type { APIRoute } from 'astro';
import { author } from '../data/author';
import { specimens } from '../data/specimens';

export const prerender = true;

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Editorial dates have no time of day; publish them at noon UTC so no timezone moves the day.
const rfc822 = (date: string) => new Date(`${date}T12:00:00Z`).toUTCString();

export const GET: APIRoute = ({ site }) => {
  const feed = new URL('/rss.xml', site).href;
  const newest = [...specimens].sort((a, b) => b.published.localeCompare(a.published));
  const items = newest.map((specimen) => {
    const url = new URL(`/${specimen.id}/`, site).href;
    return [
      '<item>',
      `<title>${escape(specimen.title)}</title>`,
      `<link>${url}</link>`,
      `<guid isPermaLink="true">${url}</guid>`,
      `<pubDate>${rfc822(specimen.published)}</pubDate>`,
      `<dc:creator>${escape(author.name)}</dc:creator>`,
      `<category>${escape(specimen.category)}</category>`,
      `<description>${escape(specimen.seoDescription)}</description>`,
      '</item>',
    ].join('');
  });

  return new Response([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<channel>',
    '<title>Microinteractions</title>',
    `<link>${new URL('/', site).href}</link>`,
    `<atom:link href="${feed}" rel="self" type="application/rss+xml" />`,
    `<description>Small UI interaction studies by ${escape(author.name)}, with live demos, timing notes, and copyable HTML, CSS, and JavaScript.</description>`,
    '<language>en</language>',
    `<lastBuildDate>${rfc822(newest[0].published)}</lastBuildDate>`,
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n') + '\n', {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
