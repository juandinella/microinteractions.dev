// Renders the app on the server into the client build, so the browser hydrates it like a framework would.
import { readFile, writeFile } from 'node:fs/promises';

const { render } = await import('./dist-server/entry-server.js');
const file = new URL('./dist/index.html', import.meta.url);
const html = await readFile(file, 'utf8');
if (!html.includes('<!--app-->')) throw new Error('dist/index.html has no <!--app--> placeholder.');
await writeFile(file, html.replace('<!--app-->', render()));
