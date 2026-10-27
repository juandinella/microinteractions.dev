// Installs every study from the built registry into consumer/, a Vite + React project with the
// shadcn theme, then type-checks it, builds it with server rendering, and runs its Playwright tests.
// The site's own build can't show that an installed component compiles, hydrates, or behaves.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = join(root, 'dist/client');
const consumer = join(root, 'consumer');
// components.json points the @microinteractions namespace here.
const port = 8799;

// Asynchronous, so the registry server in this process keeps answering the CLI. The shell runs
// package manager shims that aren't executables, such as Homebrew's pnpm.
const run = (command, cwd = root) =>
  new Promise((resolve, reject) => {
    console.log(`\n$ ${command}`);
    spawn(command, { cwd, stdio: 'inherit', shell: true }).on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Failed: ${command}`)),
    );
  });

if (!existsSync(join(site, 'r/registry.json'))) await run('pnpm run build');

const types = { '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const server = createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(site, path));
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
// Every address, so `localhost` reaches it whether it resolves to IPv4 or IPv6.
await new Promise((resolve) => server.listen(port, resolve));

try {
  const { items } = JSON.parse(await readFile(join(site, 'r/registry.json'), 'utf8'));
  // Start from what a project has before installing: the theme, and nothing the CLI writes.
  await rm(join(consumer, 'src/components'), { recursive: true, force: true });
  await rm(join(consumer, 'src/lib'), { recursive: true, force: true });
  // The installed files are gitignored here, and Tailwind skips ignored files unless they're named.
  await writeFile(
    join(consumer, 'src/index.css'),
    '@import "tailwindcss";\n@import "shadcn/tailwind.css";\n@import "./theme.css";\n@source "./components";\n',
  );
  if (!existsSync(join(consumer, 'node_modules'))) await run('npm ci', consumer);
  await run(`npx --no-install shadcn add ${items.map(({ name }) => `@microinteractions/${name}`).join(' ')} --yes --overwrite`, consumer);
  await run('npm run typecheck', consumer);
  await run('npm run build', consumer);
} finally {
  server.close();
}

await run('pnpm exec playwright test --config consumer/playwright.config.ts');
