// Records each study's live preview as a short looping clip for og:video: 1200×630, 60fps, H.264.
// Pass slugs to record only those (node scripts/record-og-videos.mjs worm-dots); with none, every study is recorded.
// Studies without a choreography in scripts/og-choreographies.ts are skipped with a warning.
// It records the built site in dist/client, so run it through pnpm run og:videos, which builds first.
//
// Pages run on a virtual clock. Timers, requestAnimationFrame, and CSS and Web Animations advance exactly one frame
// before each screenshot, so the clip plays in real time however long a capture takes.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const FPS = 60;
const WIDTH = 1200;
const HEIGHT = 630;
// Width of the recorded frame in CSS pixels unless a choreography sets its own. Captured at 2x, then scaled down.
const FRAME_WIDTH = 720;
// Settles layout, fonts, and hover states before the first frame.
const PRE_ROLL = 400;
const BUDGET = 1024 * 1024;

const root = new URL('..', import.meta.url);
const site = fileURLToPath(new URL('dist/client/', root));
const out = new URL('public/og/videos/', root);

const bundled = await build({
  stdin: {
    contents: "export { choreographies } from './scripts/og-choreographies.ts'; export { specimens } from './src/data/specimens.ts';",
    resolveDir: fileURLToPath(root),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { choreographies, specimens } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const unknown = requested.filter((slug) => !specimens.some(({ id }) => id === slug));
if (unknown.length) throw new Error(`Unknown study: ${unknown.join(', ')}.`);
const slugs = requested.length ? requested : specimens.map(({ id }) => id);
for (const slug of slugs.filter((slug) => !choreographies[slug])) {
  console.warn(`Skipping ${slug}: no choreography in scripts/og-choreographies.ts.`);
}
const queue = slugs.filter((slug) => choreographies[slug]);
if (!queue.length) process.exit(0);

await access(join(site, 'index.html')).catch(() => {
  throw new Error('No build in dist/client. Run pnpm run og:videos, which builds first.');
});

// The built site, served as Cloudflare would serve its static assets.
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  const file = join(site, path.endsWith('/') ? `${path}index.html` : path);
  try {
    if (!file.startsWith(site)) throw new Error('Outside the site');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;

// Runs in the page before its own scripts. Time stands still until the recorder calls __og.frame(time).
function installVirtualTime() {
  const realFrame = window.requestAnimationFrame.bind(window);
  const perfOrigin = performance.now();
  const dateOrigin = Date.now();
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  let frames = new Map();

  const schedule = (callback, delay, args, every) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(Number(delay) || 0, 0), callback, args, every });
    return id;
  };
  window.setTimeout = (callback, delay, ...args) => schedule(callback, delay, args);
  window.setInterval = (callback, delay, ...args) => schedule(callback, delay, args, Math.max(Number(delay) || 0, 1));
  window.clearTimeout = (id) => timers.delete(id);
  window.clearInterval = (id) => timers.delete(id);
  window.requestAnimationFrame = (callback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  performance.now = () => perfOrigin + now;
  Date.now = () => dateOrigin + now;

  const run = (callback, args) => {
    try {
      if (typeof callback === 'function') callback(...args);
    } catch (error) {
      reportError(error);
    }
  };

  // Animations the page plays are paused and stepped from the virtual clock. Ones the page pauses or seeks itself are its own.
  const { pause, play, finish } = Animation.prototype;
  const clock = Object.getOwnPropertyDescriptor(Animation.prototype, 'currentTime');
  const driven = new WeakMap();
  const seen = new WeakSet();
  let started = false;
  Animation.prototype.pause = function () {
    driven.delete(this);
    return pause.call(this);
  };
  Animation.prototype.play = function () {
    driven.delete(this);
    return play.call(this);
  };
  Object.defineProperty(Animation.prototype, 'currentTime', {
    ...clock,
    set(value) {
      driven.delete(this);
      clock.set.call(this, value);
    },
  });

  const step = () => {
    for (const animation of document.getAnimations()) {
      // Scroll-driven animations follow the scroll, which the page moves on the virtual clock already.
      if (animation.timeline !== document.timeline) continue;
      const rate = animation.playbackRate || 1;
      if (driven.has(animation) && animation.playState !== 'paused') driven.delete(animation);
      if (!driven.has(animation)) {
        if (animation.playState !== 'running') {
          seen.add(animation);
          continue;
        }
        // A new animation starts on this frame, as a browser would paint it. One already running keeps its progress.
        const fresh = started && !seen.has(animation);
        driven.set(animation, fresh ? now : now - (clock.get.call(animation) ?? 0) / rate);
        pause.call(animation);
      }
      seen.add(animation);
      const time = (now - driven.get(animation)) * rate;
      const end = animation.effect?.getComputedTiming().endTime ?? 0;
      if (rate > 0 ? Number.isFinite(end) && time >= end : time <= 0) {
        driven.delete(animation);
        finish.call(animation);
      } else {
        clock.set.call(animation, time);
      }
    }
    started = true;
  };

  window.__og = {
    async frame(time) {
      // Waiting for a real frame delivers pointer moves, which Chromium aligns to frames, before time advances.
      await new Promise((resolve) => realFrame(resolve));
      for (;;) {
        let due;
        for (const entry of timers) if (entry[1].at <= time && (!due || entry[1].at < due[1].at)) due = entry;
        if (!due) break;
        const [id, timer] = due;
        now = Math.max(now, timer.at);
        if (timer.every) timer.at += timer.every;
        else timers.delete(id);
        run(timer.callback, timer.args);
      }
      now = time;
      const batch = frames;
      frames = new Map();
      for (const callback of batch.values()) run(callback, [perfOrigin + now]);
      step();
    },
  };
}

// macOS-style pointers, drawn because headless screenshots have none. `hot` is the hotspot in viewBox units.
const pointers = {
  arrow: {
    size: 22,
    box: 24,
    hot: [6, 3.5],
    svg: '<path d="M6 3.5V19.6l4.3-4.1 2.7 6.1 2.7-1.2-2.6-5.9h6.1Z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke"/>',
  },
  pointer: {
    size: 28,
    box: 32,
    hot: [13.35, 3.4],
    svg: '<path d="M11.5 17V5.2a1.85 1.85 0 0 1 3.7 0V13v-1a1.75 1.75 0 0 1 3.5 0v1.6a1.75 1.75 0 0 1 3.5 0v1.2a1.6 1.6 0 0 1 3.2 0V20c0 3.9-2.4 7-6.5 7h-2.6c-2.4 0-3.9-1-5.3-2.9l-3.6-5.2a1.75 1.75 0 0 1 2.7-2.2Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/><path d="M15.2 13v4M18.7 13.6v3.6M22.2 14.8v2.6" stroke="#111" stroke-width="1.2" stroke-linecap="round"/>',
  },
  resize: {
    size: 26,
    box: 32,
    hot: [16, 16],
    svg: '<path d="M4 16l6-6v3.5h12V10l6 6-6 6v-3.5H10V22Z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke"/>',
  },
  grabbing: {
    size: 28,
    box: 32,
    hot: [17, 18],
    svg: '<path d="M8.8 17.5v-3a1.75 1.75 0 0 1 3.5 0v-.8a1.75 1.75 0 0 1 3.5 0v-.2a1.75 1.75 0 0 1 3.5 0v.4a1.75 1.75 0 0 1 3.5 0v1.1a1.6 1.6 0 0 1 3.2 0V20c0 3.9-2.4 7-6.5 7h-2.8c-2.4 0-3.9-1-5.3-2.9l-2.4-3.4a1.6 1.6 0 0 1 2.3-2.2Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/><path d="M12.3 13.7v3.3M15.8 13.5v3.5M19.3 13.9v3.1M22.8 15v2.2" stroke="#111" stroke-width="1.2" stroke-linecap="round"/>',
  },
};

// Draws the pointer and click rings on top of the page. The shape follows the CSS cursor under the hotspot.
function installPointer(shapes) {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;contain:strict';
  const rings = Array.from({ length: 4 }, () => {
    const ring = document.createElement('div');
    ring.style.cssText = 'position:absolute;left:0;top:0;box-sizing:border-box;border:1.5px solid oklch(0.23 0.012 258.74);border-radius:50%';
    return layer.appendChild(ring);
  });
  const cursor = layer.appendChild(document.createElement('div'));
  cursor.style.cssText = 'position:absolute;left:0;top:0;filter:drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.28))';
  document.documentElement.append(layer);

  const shapeAt = (x, y) => {
    const element = document.elementFromPoint(x, y);
    const css = element ? getComputedStyle(element).cursor : 'auto';
    if (css === 'pointer') return 'pointer';
    if (css === 'grab' || css === 'grabbing') return 'grabbing';
    if (['ew-resize', 'col-resize', 'e-resize', 'w-resize'].includes(css)) return 'resize';
    return 'arrow';
  };

  let drawn;
  window.__ogPointer = ({ x, y, press, clicks }) => {
    const name = shapeAt(x, y);
    const shape = shapes[name];
    if (name !== drawn) {
      cursor.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.box} ${shape.box}" width="${shape.size}" height="${shape.size}" style="display:block">${shape.svg}</svg>`;
      drawn = name;
    }
    const unit = shape.size / shape.box;
    const [hx, hy] = shape.hot.map((value) => value * unit);
    cursor.style.transformOrigin = `${hx}px ${hy}px`;
    cursor.style.transform = `translate(${x - hx}px, ${y - hy}px) scale(${1 - 0.1 * press})`;
    rings.forEach((ring, index) => {
      const click = clicks[index];
      ring.style.opacity = click ? String(click.opacity) : '0';
      if (!click) return;
      ring.style.width = ring.style.height = `${click.radius * 2}px`;
      ring.style.transform = `translate(${click.x - click.radius}px, ${click.y - click.radius}px)`;
    });
  };
}

const ease = (t) => 1 - (1 - t) ** 3;
// A hand's reach: fast in the middle, gentle at both ends.
const minimumJerk = (t) => t ** 3 * (10 - 15 * t + 6 * t * t);

async function record(page, slug) {
  const choreography = choreographies[slug];
  const width = choreography.width ?? FRAME_WIDTH;
  const height = Math.round((width * HEIGHT) / WIDTH);

  await page.goto(`${origin}/${slug}/`);
  await page.evaluate(() => document.fonts.ready);
  const stage = page.locator('[data-stage]').first();
  await stage.evaluate((element, [w, h]) => {
    element.style.cssText += `;width:${w}px;height:${h}px;min-height:0;flex:none`;
  }, [width, height]);
  await stage.scrollIntoViewIfNeeded();
  const clip = await stage.boundingBox();
  await page.evaluate(installPointer, pointers);

  const file = fileURLToPath(new URL(`${slug}.mp4`, out));
  const encoder = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '28', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const encoded = once(encoder, 'close');

  let time = 0;
  let frames = 0;
  let capturing = false;
  let start = 0;
  const pointer = { x: 0, y: 0 };
  let pressed = false;
  let pressChanged = -Infinity;
  const clicks = [];

  const tick = async () => {
    time = start + ((frames + 1) * 1000) / FPS;
    const since = (time - pressChanged) / (pressed ? 80 : 140);
    const press = pressed ? ease(Math.min(since, 1)) : 1 - ease(Math.min(since, 1));
    const rings = clicks
      .map((click) => ({ ...click, age: (time - click.at) / 450 }))
      .filter(({ age }) => age >= 0 && age < 1)
      .map(({ x, y, age }) => ({ x, y, radius: 8 + 12 * ease(age), opacity: 0.45 * (1 - age) }));
    await page.evaluate(async ({ time, state }) => {
      await window.__og.frame(time);
      window.__ogPointer(state);
    }, { time, state: { ...pointer, press: Math.max(press, 0), clicks: rings } });
    frames++;
    if (!capturing) return;
    const png = await page.screenshot({ clip, type: 'png' });
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
  };

  const resolve = async (target) => {
    const spec = typeof target === 'string' ? { selector: target } : target;
    if (spec.frame) return { x: clip.x + clip.width * spec.frame[0], y: clip.y + clip.height * spec.frame[1] };
    const box = await stage.locator(spec.selector).nth(spec.nth ?? 0).boundingBox();
    if (!box) throw new Error(`${slug}: ${spec.selector} is not visible.`);
    return { x: box.x + box.width * (spec.x ?? 0.5), y: box.y + box.height * (spec.y ?? 0.5) };
  };

  const director = {
    async wait(ms) {
      for (let i = Math.round((ms * FPS) / 1000); i > 0; i--) await tick();
    },
    async move(to, ms) {
      const from = { ...pointer };
      const end = await resolve(to);
      const dx = end.x - from.x;
      const dy = end.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.5) return;
      const steps = Math.max(Math.round(((ms ?? Math.min(240 + distance * 0.8, 650)) * FPS) / 1000), 1);
      // A free hand bows slightly off the straight line; a dragging one stays closer to it.
      const bow = (pressed ? 0.015 : 0.06) * distance;
      for (let i = 1; i <= steps; i++) {
        const t = minimumJerk(i / steps);
        const arc = Math.sin(Math.PI * t) * bow;
        pointer.x = from.x + dx * t - (dy / distance) * arc;
        pointer.y = from.y + dy * t + (dx / distance) * arc;
        await page.mouse.move(pointer.x, pointer.y);
        await tick();
      }
    },
    async down() {
      await page.mouse.down();
      pressed = true;
      pressChanged = time;
      clicks.push({ ...pointer, at: time });
      await tick();
    },
    async up() {
      await page.mouse.up();
      pressed = false;
      pressChanged = time;
      await tick();
    },
    async click(to) {
      if (to) await director.move(to);
      await director.down();
      await director.wait(70);
      await director.up();
    },
    async drag(to, ms) {
      await director.down();
      await director.wait(80);
      await director.move(to, ms);
      await director.wait(50);
      await director.up();
    },
  };

  const rest = await resolve(choreography.rest);
  Object.assign(pointer, rest);
  await page.mouse.move(rest.x, rest.y);
  await director.wait(PRE_ROLL);
  start = time;
  frames = 0;
  capturing = true;
  await tick();
  await choreography.play(director);
  encoder.stdin.end();
  const [code] = await encoded;
  if (code !== 0) throw new Error(`ffmpeg exited with ${code} for ${slug}.`);
  const { size } = await stat(file);
  const seconds = (frames / FPS).toFixed(1);
  const kb = Math.round(size / 1024);
  console.log(`Recorded public/og/videos/${slug}.mp4 (${seconds}s, ${kb} KB).`);
  if (size > BUDGET) console.warn(`  ${slug}.mp4 is over 1 MB: shorten its choreography or raise the CRF.`);
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
try {
  for (const slug of queue) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    await context.addInitScript(installVirtualTime);
    try {
      await record(await context.newPage(), slug);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
