import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { specimens } from '../src/data/specimens';

// Stops the page's timers, animation frames and performance.now(), however slow the runner is. clock.install() alone
// leaves them running in real time; it has to come before page.goto(). CSS transitions and animations keep running.
const pauseClock = async (page: Page) => page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));

const slugs = ['text-swap', 'chevron-morph', 'hold-confirm', 'edge-aware-tooltip', 'plucked-underline', 'gooey-radio-group', 'tab-indicator'];

// The files a reader copies. The Markdown carries the same ones as the page's tabs.
const copied = async (request: APIRequestContext, id: string) => {
  const markdown = await (await request.get(`/markdown/${id}.md`)).text();
  const code = markdown.split('\n## Implementation\n')[1].split('\n## Tailwind implementation\n')[0];
  const file = (language: string) => code.match(new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``))?.[1] ?? '';
  return { html: file('html'), css: file('css'), js: file('js') };
};

test('the copied code runs outside the gallery', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const { id } of specimens) {
    const { html, css, js } = await copied(request, id);
    expect(html, id).not.toBe('');
    expect(html + css + js, id).not.toMatch(/specimen-inspect|data-(?:inspect|trace|touch-active)/);
    await page.goto('about:blank');
    await page.setContent(`<style>${css}</style>${html}`);
    if (js) await page.addScriptTag({ content: js });
    const undefinedElements = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter(({ localName }) => localName.includes('-') && !customElements.get(localName)).length);
    expect(undefinedElements, id).toBe(0);
    expect(errors, id).toEqual([]);
  }
});

test.describe('hold focus indicator', () => {
  test.use({ hasTouch: true });

  for (const input of ['mouse', 'touch']) {
    test(`first ${input} press hides the ring and keyboard restores it`, async ({ page }) => {
      await page.goto('/hold-confirm/');
      const button = page.getByRole('button', { name: 'Hold to confirm', exact: true });

      if (input === 'mouse') {
        await button.hover();
        await page.mouse.down();
        await expect(button).toHaveAttribute('data-state', 'holding');
      } else {
        await button.tap();
      }

      await expect(button).toBeFocused();
      await expect(button).toHaveCSS('outline-style', 'none');

      await page.keyboard.press('Escape');
      await expect(button).toHaveAttribute('data-state', 'idle');
      await expect(button).toHaveCSS('outline-style', 'solid');
      if (input === 'mouse') await page.mouse.up();

      await page.keyboard.press('Tab');
      await expect(button).not.toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(button).toBeFocused();
      await expect(button).toHaveCSS('outline-width', '2px');

      await page.keyboard.down('Space');
      await expect(button).toHaveAttribute('data-state', 'holding');
      await page.keyboard.press('Escape');
      await page.keyboard.up('Space');
      await expect(button).toHaveAttribute('data-state', 'idle');
    });
  }
});

for (const width of [320, 780]) {
  test(`inspector readouts stay on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const slug of slugs) {
      await page.goto(`/${slug}/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      const scrub = page.locator('[data-scrub]');
      for (const end of ['min', 'max'] as const) {
        await scrub.evaluate((input: HTMLInputElement, end) => {
          input.value = input[end];
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, end);
        const geometry = await page.locator('.readout').evaluate((readout) => {
          const walker = document.createTreeWalker(readout, NodeFilter.SHOW_TEXT);
          const tops = new Set<number>();
          while (walker.nextNode()) {
            if (!walker.currentNode.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            for (const rect of range.getClientRects()) {
              if (rect.width && rect.height) tops.add(Math.round(rect.top));
            }
          }
          const strip = readout.closest('.strip')!;
          return { lines: tops.size, overflow: strip.scrollWidth - strip.clientWidth };
        });
        expect(geometry.lines, `${slug} at ${width}px, ${end}`).toBe(1);
        expect(geometry.overflow, `${slug} at ${width}px, ${end}`).toBeLessThanOrEqual(1);
      }
    }
  });
}

test('study pages offer the shadcn command for each package manager', async ({ page }) => {
  await page.goto('/hold-confirm/');
  await expect(page.getByRole('tablist', { name: 'Package manager' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add with shadcn' }).click();
  await expect(page.getByRole('dialog', { name: 'Add with shadcn' })).toBeVisible();
  const install = page.getByRole('tablist', { name: 'Package manager' }).locator('..');
  const copy = page.getByRole('button', { name: 'Copy install command' });
  await expect(copy).toBeVisible();
  const panels = install.getByRole('tabpanel');
  const command = panels.locator('code');
  await expect(command).toHaveText('$ npx shadcn@latest add https://microinteractions.dev/r/hold-confirm.json');
  for (const [manager, runner] of [['yarn', 'yarn'], ['bun', 'bunx --bun'], ['pnpm', 'pnpm dlx']]) {
    await install.getByRole('tab', { name: manager, exact: true }).click();
    // Base UI keeps the outgoing panel mounted until its exit completes.
    await expect(panels).toHaveCount(1);
    await expect(panels).toHaveAccessibleName(manager);
    await expect(command).toHaveText(`$ ${runner} shadcn@latest add https://microinteractions.dev/r/hold-confirm.json`);
  }

  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {
    value: async (text: string) => { (window as unknown as { copied: string }).copied = text; },
  }));
  await copy.click();
  await expect(copy).toHaveAttribute('data-copied', 'true');
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe('pnpm dlx shadcn@latest add https://microinteractions.dev/r/hold-confirm.json');
  await expect(page.getByRole('status').filter({ hasText: 'Install command copied to clipboard.' })).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Add with shadcn' })).toBeFocused();
  await page.goto('/text-swap/');
  await page.getByRole('button', { name: 'Add with shadcn' }).click();
  await expect(page.getByRole('button', { name: 'Copy install command' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'pnpm' })).toHaveAttribute('aria-selected', 'true');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add with shadcn' })).toHaveCount(0);
});

test.describe('skill command on the index', () => {
  const command = 'npx skills@latest add https://microinteractions.dev';

  test('a press anywhere on the frame copies the command and confirms it', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {
      value: async (text: string) => { (window as unknown as { copied: string[] }).copied = [...((window as unknown as { copied?: string[] }).copied ?? []), text]; },
    }));
    const copied = () => page.evaluate(() => (window as unknown as { copied?: string[] }).copied);
    const copy = page.getByRole('button', { name: 'Copy skill install command' });
    const frame = (await page.locator('skill-command').boundingBox())!;
    expect(frame.height).toBeGreaterThanOrEqual(44);

    // Held past the press feedback and released far from the icon: the hit area must not shrink mid-press.
    await page.mouse.move(frame.x + 8, frame.y + 8);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.move(frame.x + 60, frame.y + 12);
    await page.mouse.up();
    await expect(copy).toHaveAttribute('data-copied', 'true');
    expect(await copied()).toEqual([command]);
    expect(await page.evaluate(() => String(getSelection()))).toBe('');
    await expect(page.getByRole('status').filter({ hasText: 'Skill install command copied to clipboard.' })).toHaveCount(1);
    await expect(copy).not.toHaveAttribute('data-copied');

    await copy.focus();
    await page.keyboard.press('Enter');
    await expect(copy).toHaveAttribute('data-copied', 'true');
    expect(await copied()).toEqual([command, command]);
  });

  test('a blocked clipboard leaves the command selected', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('blocked')) }));
    const copy = page.getByRole('button', { name: 'Copy skill install command' });
    await copy.click();
    await expect.poll(() => page.evaluate(() => String(getSelection()))).toBe(command);
    await expect(copy).not.toHaveAttribute('data-copied');
    await expect(page.getByRole('status').filter({ hasText: 'The command is selected' })).toHaveCount(1);
  });

  test('it is plain text without JavaScript and never overflows', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 640 } });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('skill-command code')).toHaveText(`$ ${command}`);
    await expect(page.locator('skill-command button')).toBeHidden();
    const frame = (await page.locator('skill-command').boundingBox())!;
    expect(frame.x + frame.width).toBeLessThanOrEqual(320);
    const text = page.locator('skill-command code');
    expect(await text.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
    await context.close();
  });
});

test('the install popup stays put while its button is pressed', async ({ page }) => {
  await page.goto('/hold-confirm/');
  const trigger = page.getByRole('button', { name: 'Add with shadcn' });
  const popup = page.getByRole('dialog', { name: 'Add with shadcn' });
  await expect(page.locator('astro-island', { has: trigger })).not.toHaveAttribute('ssr');

  // Every frame: Chromium moved it on the press that closes, WebKit after opening from a held press.
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { seen: Set<string> }).seen = seen;
    const sample = () => {
      const positioner = document.querySelector('[role="dialog"]')?.parentElement;
      if (positioner) {
        const { x, y } = positioner.getBoundingClientRect();
        seen.add(`${x},${y}`);
      }
      requestAnimationFrame(sample);
    };
    sample();
  });
  const width = (await trigger.boundingBox())!.width;
  const heldClick = async () => {
    await page.mouse.down();
    await expect.poll(async () => (await trigger.boundingBox())!.width).toBeLessThan(width * 0.98);
    await page.waitForTimeout(300);
    await page.mouse.up();
  };
  await trigger.hover();
  await heldClick();
  await expect(popup).toBeVisible();
  await page.waitForTimeout(400);
  await heldClick();
  await expect(popup).toHaveCount(0);
  expect(await page.evaluate(() => [...(window as unknown as { seen: Set<string> }).seen])).toHaveLength(1);
});

test.describe('plucked underline', () => {
  const durations = (page: import('@playwright/test').Page) =>
    page.locator('[data-stage] [data-pluck]').evaluateAll((links) =>
      links.map((link) => ({
        label: link.textContent!.trim(),
        width: link.querySelector('svg')!.getBoundingClientRect().width,
        ms: parseFloat((link as HTMLElement).style.getPropertyValue('--pluck-duration')),
      })),
    );

  test('each string rings for a time set by its width, and the trace follows it', async ({ page }) => {
    await page.goto('/plucked-underline/');
    await page.evaluate(() => document.fonts.ready);
    // ResizeObserver reports after the first layout, so wait for every string to be measured.
    await expect.poll(async () => (await durations(page)).every(({ ms }) => ms > 0)).toBe(true);
    const strings = await durations(page);
    for (const { width, ms } of strings) {
      expect(ms).toBe(Math.round(Math.min(Math.max(width * 13, 400), 1200)));
    }
    const ring = Object.fromEntries(strings.map(({ label, ms }) => [label, ms]));
    expect(ring.Bio).toBeLessThan(ring['Get in touch']);

    for (const label of ['Bio', 'Get in touch']) {
      const link = page.locator('[data-stage]').getByRole('link', { name: label, exact: true });
      await link.hover();
      await expect(link).toHaveAttribute('data-plucked', '');
      await expect(page.locator('[data-trace-readout]')).toHaveText(String(ring[label]));
      await expect.poll(() => link.locator('path').evaluate((path) => getComputedStyle(path).transform)).toBe('matrix(1, 0, 0, 0.001, 0, 0)');
    }
    await page.mouse.move(0, 0);
    await expect(page.locator('[data-stage] [data-plucked]')).toHaveCount(0);
    await expect(page.locator('[data-trace-readout]')).toHaveText('0');
  });

  test('a string left mid-swing keeps ringing while the underline closes', async ({ page }) => {
    await page.goto('/plucked-underline/');
    const link = page.locator('[data-stage]').getByRole('link', { name: 'Get in touch', exact: true });
    const path = link.locator('path');
    // Pluck, move 250ms into the ring (past the 140ms opening), leave, and read two moments of the
    // ring, all in one task. In real time a slow machine finishes the ring before the test reads it.
    const swing = await link.evaluate((link) => {
      const path = link.querySelector('path')!;
      const read = () => getComputedStyle(path).transform;
      const pointer = (type: string) =>
        link.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', clientX: link.getBoundingClientRect().left + 20 }));
      // Hover arms on enter and plucks on the first move.
      pointer('pointerenter');
      pointer('pointermove');
      // By 250ms the underline has opened, so leaving starts its closing transition.
      link.querySelector('svg')!.getAnimations().forEach((opening) => opening.finish());
      const [ring] = path.getAnimations();
      ring.pause();
      ring.currentTime = 250;
      pointer('pointerleave');
      const frames = [read()];
      ring.currentTime = 282;
      frames.push(read());
      const state = { plucked: link.hasAttribute('data-plucked'), ringing: link.hasAttribute('data-ringing') };
      ring.play();
      return { frames, ...state };
    });
    expect(swing.plucked).toBe(false);
    expect(swing.ringing).toBe(true);
    expect(swing.frames[0]).not.toBe('none');
    expect(swing.frames[0]).not.toBe(swing.frames[1]);
    await expect(link).not.toHaveAttribute('data-ringing', '');
    await expect.poll(() => path.evaluate((path) => getComputedStyle(path).transform)).toBe('none');
  });

  test('keyboard focus shows the settled underline without motion', async ({ page }) => {
    await page.goto('/plucked-underline/');
    const link = page.locator('[data-stage] [data-pluck]').first();
    await link.focus();
    const state = await link.evaluate((link) => ({
      focusVisible: link.matches(':focus-visible'),
      transform: getComputedStyle(link.querySelector('path')!).transform,
      running: link.getAnimations({ subtree: true }).length,
    }));
    expect(state).toEqual({ focusVisible: true, transform: 'matrix(1, 0, 0, 0.001, 0, 0)', running: 0 });
  });

  test.describe('on touch', () => {
    test.use({ hasTouch: true });

    test('a tap plucks without navigating and the string falls quiet', async ({ page }) => {
      await page.goto('/plucked-underline/');
      const link = page.locator('[data-stage] [data-pluck]').first();
      await link.tap();
      await expect(link).toHaveAttribute('data-plucked', '');
      expect(new URL(page.url()).hash).toBe('');
      await expect(link).not.toHaveAttribute('data-plucked', '', { timeout: 2_000 });
    });
  });
});

test.describe('gooey radio group', () => {
  const headY = (scope: import('@playwright/test').Page | import('@playwright/test').Locator) =>
    scope.locator('[data-goo-blob]').last().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
  const blobAnimations = (scope: import('@playwright/test').Locator) =>
    scope.locator('[data-goo-blob]').evaluateAll((blobs) => blobs.flatMap((blob) => blob.getAnimations()).length);

  test('a click pours the drop into the option, and the trace follows it', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    // Counted in the choice's own task, after the component's handler: on a busy runner the 340ms pour can land
    // before the next round trip.
    await stage.evaluate((el: HTMLElement) => addEventListener('change', () => {
      el.dataset.poursOnChange = String([...el.querySelectorAll('[data-goo-blob]')].flatMap((blob) => blob.getAnimations()).length);
    }, { once: true }));
    await stage.getByText('Pickup').click();
    await expect(stage.getByRole('radio', { name: 'Pickup' })).toBeChecked();
    await expect(stage).toHaveAttribute('data-pours-on-change', '8');
    await expect.poll(() => headY(stage)).toBe(132);
    await expect(page.locator('[data-trace-readout]')).toHaveText('340');
  });

  test('a new choice mid-pour turns the drop from where it is', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    // Start a pour, move it 150ms in, change course and read the new drop's first frame in one task.
    // Waiting in real time instead lets a slow machine finish the 340ms pour before the read.
    const [midway, restart, early] = await stage.locator('[data-goo-blob]').last().evaluate((head) => {
      const y = () => new DOMMatrix(getComputedStyle(head).transform).m42;
      const choose = (value: string) => {
        const input = document.querySelector<HTMLInputElement>(`[data-stage] input[value="${value}"]`)!;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      choose('pickup');
      head.parentElement!.querySelectorAll('[data-goo-blob]').forEach((blob) =>
        blob.getAnimations().forEach((pour) => (pour.currentTime = 150)),
      );
      const before = y();
      choose('standard');
      const animation = head.getAnimations()[0];
      animation.pause();
      animation.currentTime = 0;
      const start = y();
      animation.currentTime = 50;
      return [before, start, y()];
    });
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(132);
    // Within one frame of travel; WebKit samples style and clock a few pixels apart.
    expect(Math.abs(restart - midway)).toBeLessThan(15);
    // The redirected drop starts at speed: ease-in-out would barely have moved 50ms in.
    expect(restart - early).toBeGreaterThan(15);
  });

  test('arrow keys move the selection without the drop', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    // Tab back from the timeline, so focus arrives from the keyboard.
    await page.locator('[data-scrub]').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(stage.getByRole('radio', { name: 'Standard' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(stage.getByRole('radio', { name: 'Express' })).toBeChecked();
    expect(await blobAnimations(stage)).toBe(0);
    expect(await headY(stage)).toBe(44);
    await expect(stage.locator('.goo-option', { hasText: 'Express' })).toHaveCSS('outline-style', 'solid');
  });

  test('the inspector scrubs a jump and puts the selection back', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    await page.locator('[data-scrub]').focus();
    for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
    const y = await headY(stage);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(132);
    await page.keyboard.press('Escape');
    await expect(stage.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await expect.poll(() => headY(stage)).toBe(0);
  });

  test('copied groups get their own filters, start empty, and ignore other inputs', async ({ page, request }) => {
    const { html, css, js } = await copied(request, 'gooey-radio-group');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const empty = html.replaceAll('name="delivery"', 'name="pace"').replace(' checked', '')
      .replace('</label>', '</label><input type="checkbox" aria-label="Unrelated" />');
    await page.setContent(`<style>${css}</style>${html}${empty}`);
    await page.addScriptTag({ content: js });
    const [first, second] = [page.locator('.goo-group').first(), page.locator('.goo-group').last()];
    const filterOf = (group: import('@playwright/test').Locator) =>
      group.evaluate((el) => [el.querySelector('filter')!.id, getComputedStyle(el.querySelector('.goo-drop')!).filter]);
    expect(await filterOf(first)).toEqual(['goo-merge-1', 'url("#goo-merge-1")']);
    expect(await filterOf(second)).toEqual(['goo-merge-2', 'url("#goo-merge-2")']);

    const dropOpacity = () => second.locator('.goo-drop').evaluate((el) => getComputedStyle(el).opacity);
    expect(await dropOpacity()).toBe('0');
    await second.getByRole('checkbox', { name: 'Unrelated' }).check();
    expect(await blobAnimations(second)).toBe(0);
    await second.getByText('Express').click();
    expect(await dropOpacity()).toBe('1');
    expect(await blobAnimations(second)).toBe(8);
    await expect.poll(() => headY(second)).toBe(44);
    expect(errors).toEqual([]);
  });
});

test.describe('drag select', () => {
  type Scope = import('@playwright/test').Page;
  const boxes = (page: Scope) => page.locator('drag-select-table tbody input');
  const checked = (page: Scope) => boxes(page).evaluateAll((inputs: HTMLInputElement[]) => inputs.map((input) => input.checked));
  const center = async (page: Scope, index: number) => {
    const box = (await boxes(page).nth(index).locator('xpath=..').boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // Counts the events each box fires, so a test can tell `input` during a drag from `change` after it.
  const listen = (page: Scope) =>
    page.locator('drag-select-table').evaluate((table) => {
      const log = { input: 0, change: 0 };
      (window as unknown as { dragLog: typeof log }).dragLog = log;
      table.addEventListener('input', () => log.input++);
      table.addEventListener('change', () => log.change++);
    });
  const log = (page: Scope) => page.evaluate(() => (window as unknown as { dragLog: { input: number; change: number } }).dragLog);
  const press = async (page: Scope, from: number, to: number[]) => {
    const start = await center(page, from);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const index of to) {
      const point = await center(page, index);
      await page.mouse.move(point.x, point.y, { steps: 4 });
    }
  };

  test('a drag gives its range the first row’s new state and reports it once on release', async ({ page }) => {
    await page.goto('/drag-select/');
    await listen(page);
    await press(page, 1, [4, 2]);
    expect(await checked(page)).toEqual([false, true, true, false, false, false, false, false, false, false]);
    await expect(page.locator('[data-band]')).toHaveAttribute('data-shown', '');
    expect((await log(page)).change).toBe(0);
    await page.mouse.up();
    expect(await log(page)).toEqual({ input: 6, change: 2 });
    await expect(page.locator('[data-count]')).toHaveText('2 of 10');
    await expect(page.locator('drag-select-table tbody tr[data-selected]')).toHaveCount(2);
    await expect(page.locator('[data-band]')).not.toHaveAttribute('data-shown', '');

    await press(page, 2, [3]);
    await page.mouse.up();
    expect(await checked(page)).toEqual([false, true, false, false, false, false, false, false, false, false]);
  });

  test('Shift+arrows give the focused box’s state to the rows they reach, and backing up restores them', async ({ page }) => {
    await page.goto('/drag-select/');
    await boxes(page).nth(1).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    expect((await checked(page)).slice(0, 4)).toEqual([false, true, true, true]);
    await page.keyboard.press('Shift+ArrowUp');
    expect((await checked(page)).slice(0, 4)).toEqual([false, true, true, false]);
    await expect(boxes(page).nth(2)).toBeFocused();
    await expect(page.locator('[data-count]')).toHaveText('2 of 10');
  });

  test('a change from other code updates the rows, header, and count', async ({ page }) => {
    await page.goto('/drag-select/');
    await boxes(page).evaluateAll((inputs: HTMLInputElement[]) => {
      for (const input of inputs) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await expect(page.locator('[data-count]')).toHaveText('10 of 10');
    await expect(page.locator('drag-select-table tbody tr[data-selected]')).toHaveCount(10);
    await expect(page.getByRole('checkbox', { name: 'Select all' })).toBeChecked();
  });

  const scrollTop = (page: Scope) => page.locator('drag-select-table [data-scroll]').evaluate((scroller) => scroller.scrollTop);

  test('a still press near the bottom edge checks only its row and does not scroll', async ({ page }) => {
    await page.goto('/drag-select/');
    await page.locator('drag-select-table [data-scroll]').scrollIntoViewIfNeeded();
    // The lowest box cell that is fully visible, pressed 4px above its bottom: deep in the 48px zone.
    const target = await page.locator('drag-select-table').evaluate((table) => {
      const frame = table.querySelector('[data-scroll]')!.getBoundingClientRect();
      const cells = [...table.querySelectorAll('tbody [data-box-cell]')];
      let index = -1;
      cells.forEach((cell, i) => {
        if (cell.getBoundingClientRect().bottom <= frame.bottom) index = i;
      });
      const cell = cells[index].getBoundingClientRect();
      const y = cell.bottom - 4;
      return { index, x: cell.left + cell.width / 2, y, fromEdge: frame.bottom - y };
    });
    expect(target.index).toBeGreaterThan(0);
    expect(target.fromEdge).toBeLessThan(48);

    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.waitForTimeout(300);
    expect(await scrollTop(page)).toBe(0);
    const expected = Array(10).fill(false);
    expected[target.index] = true;
    expect(await checked(page)).toEqual(expected);

    // Moving toward the edge past the 2px mouse slop starts the autoscroll.
    await page.mouse.move(target.x, target.y + 6);
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test('keyboard changes appear without animating, and a pointer press animates again', async ({ page }) => {
    await page.goto('/drag-select/');
    const table = page.locator('drag-select-table');
    // Counted while the `input` event dispatches, in the same task as the change, so a short
    // transition can't finish before it is read.
    await table.evaluate((element) => {
      const log: number[] = [];
      (window as unknown as { animationLog: number[] }).animationLog = log;
      element.addEventListener('input', (event) => {
        const box = (event.target as HTMLElement).parentElement!;
        log.push(box.getAnimations({ subtree: true }).length);
      });
    });
    const animations = () => page.evaluate(() => [...(window as unknown as { animationLog: number[] }).animationLog]);

    await boxes(page).nth(1).focus();
    await page.keyboard.press('Space');
    await expect(table).toHaveAttribute('data-keyboard', '');
    await page.keyboard.press('Shift+ArrowDown');
    expect((await checked(page)).slice(0, 3)).toEqual([false, true, true]);
    expect(await animations()).toEqual([0, 0]);

    // Row 4 is fully visible; row 6 sits under the scroller's bottom edge.
    const point = await center(page, 3);
    await page.mouse.click(point.x, point.y);
    await expect(table).not.toHaveAttribute('data-keyboard', '');
    const log = await animations();
    expect(log).toHaveLength(3);
    expect(log[2]).toBeGreaterThan(0);
  });

  test('Escape during a drag cancels it without reaching listeners on document', async ({ page }) => {
    await page.goto('/drag-select/');
    await page.evaluate(() => {
      const log: string[] = [];
      (window as unknown as { escapeLog: string[] }).escapeLog = log;
      document.addEventListener('keydown', (event) => log.push(`capture:${event.key}`), { capture: true });
      document.addEventListener('keydown', (event) => log.push(`bubble:${event.key}`));
    });
    const escapes = () => page.evaluate(() => [...(window as unknown as { escapeLog: string[] }).escapeLog]);

    await listen(page);
    await press(page, 0, [3]);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await escapes()).toEqual([]);
    expect((await log(page)).change).toBe(0);
    expect(await checked(page)).toEqual(Array(10).fill(false));

    // With no drag in progress, Escape belongs to the page again.
    await page.keyboard.press('Escape');
    expect(await escapes()).toEqual(['capture:Escape', 'bubble:Escape']);
  });

  test('Select all fills its header cell, and a click near its edge toggles every row', async ({ page }) => {
    await page.goto('/drag-select/');
    const label = page.locator('drag-select-table thead label');
    const box = (await label.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(34);

    await page.mouse.click(box.x + 4, box.y + box.height / 2);
    await expect(page.getByRole('checkbox', { name: 'Select all' })).toBeChecked();
    await expect(page.locator('[data-count]')).toHaveText('10 of 10');
    await expect(page.locator('[data-band]')).not.toHaveAttribute('data-shown', '');

    await page.mouse.click(box.x + box.width - 4, box.y + 4);
    await expect(page.locator('[data-count]')).toHaveText('0 of 10');
  });
});

test.describe('resize handle', () => {
  type Scope = import('@playwright/test').Page;
  const handle = (page: Scope) => page.getByRole('separator', { name: 'Resize sidebar' });
  const width = (page: Scope) => handle(page).getAttribute('aria-valuenow');
  // The width on screen, which the script writes on every frame; aria-valuenow is the width the drag asks for.
  const shown = (page: Scope) => page.locator('resizable-sidebar').evaluate((element: HTMLElement) =>
    Math.round(parseFloat(element.style.getPropertyValue('--rsb-width')) * 10) / 10);
  // Whole pixels, so WebKit, which rounds clientX, measures the same travel as Chromium.
  const start = async (page: Scope, y = 60) => {
    const box = (await handle(page).boundingBox())!;
    const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + y) };
    await page.mouse.move(point.x, point.y);
    return point;
  };
  // Presses and passes the 2px mouse slop, which anchors the drag at point.x - 2.
  const grab = async (page: Scope, point: { x: number; y: number }) => {
    await page.mouse.down();
    await page.mouse.move(point.x - 2, point.y);
  };

  // The panes scroll when their content is taller than the component; the demo's content has to fit, or a
  // scrollbar runs along the divider for a few clipped pixels.
  test('neither pane scrolls at rest', async ({ page }) => {
    await page.goto('/resize-handle/');
    const overflowing = await page
      .locator('resizable-sidebar > div')
      .evaluateAll((elements) => elements.filter((element) => element.scrollHeight > element.clientHeight).length);
    expect(overflowing).toBe(0);
  });

  test('a drag follows the pointer, and Escape puts the sidebar back', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await expect(handle(page)).toHaveAttribute('data-state', 'hover');
    await page.mouse.down();
    // The first 2px cross the drag threshold; the width follows from there.
    await page.mouse.move(point.x + 2, point.y);
    // Chromium delivers the fraction to pointermove; the width lands on a whole pixel.
    await page.mouse.move(point.x + 42.4, point.y + 30, { steps: 4 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '200');
    const grip = (await page.locator('[data-grip]').boundingBox())!;
    expect(Math.abs(grip.y + grip.height / 2 - (point.y + 30))).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '160');
    await page.mouse.up();
  });

  test('dragging below half the minimum collapses the sidebar and dragging back reopens it', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await page.mouse.down();
    await page.mouse.move(point.x - 2, point.y);
    await page.mouse.move(point.x - 122, point.y, { steps: 6 });
    await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
    await expect(page.locator('[data-side]')).toHaveJSProperty('inert', true);
    await page.mouse.move(point.x - 22, point.y, { steps: 6 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '140');
    await page.mouse.up();
    await expect(page.locator('[data-side]')).toHaveJSProperty('inert', false);
  });

  test('window splitter keys move, limit, and collapse the divider', async ({ page }) => {
    await page.goto('/resize-handle/');
    await handle(page).focus();
    await page.keyboard.press('ArrowRight');
    expect(await width(page)).toBe('172');
    await page.keyboard.press('Shift+ArrowLeft');
    expect(await width(page)).toBe('124');
    await page.keyboard.press('End');
    expect(await width(page)).toBe(await handle(page).getAttribute('aria-valuemax'));
    await page.keyboard.press('Enter');
    await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
    await page.keyboard.press('Enter');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '320');
    await page.keyboard.press('Home');
    await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
    // Modified arrows belong to the browser.
    await page.keyboard.press('Enter');
    const before = await width(page);
    await page.keyboard.press('Alt+ArrowLeft');
    expect(await width(page)).toBe(before);
  });

  test('Enter after a drag collapse brings back the width from before the drag', async ({ page }) => {
    await page.goto('/resize-handle/');
    await handle(page).focus();
    await page.keyboard.press('Shift+ArrowRight');
    const point = await start(page);
    await page.mouse.down();
    await page.mouse.move(point.x - 200, point.y, { steps: 8 });
    await page.mouse.up();
    await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
    await handle(page).focus();
    await page.keyboard.press('Enter');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '208');
  });

  test('Escape over the handle keeps its hover state', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y + 20, { steps: 2 });
    await page.keyboard.press('Escape');
    await expect(handle(page)).toHaveAttribute('data-state', 'hover');
    await page.mouse.up();
  });

  test('a narrow container squeezes the sidebar and gives the chosen width back', async ({ page }) => {
    await page.goto('/resize-handle/');
    const sidebar = page.locator('resizable-sidebar');
    await handle(page).focus();
    await page.keyboard.press('End');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '320');
    await sidebar.evaluate((element) => (element.style.width = '330.5px'));
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '188');
    await expect(handle(page)).toHaveAttribute('aria-valuemax', '188');
    await sidebar.evaluate((element) => (element.style.width = ''));
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '320');
  });

  test('a sidebar connected while hidden reads as collapsed and opens at its starting width', async ({ page }) => {
    await page.goto('/resize-handle/');
    const sidebar = page.locator('resizable-sidebar');
    const separator = page.locator('[data-handle]');
    await sidebar.evaluate((element) => {
      element.style.display = 'none';
      const parent = element.parentElement!;
      element.remove();
      parent.append(element);
    });
    await expect(separator).toHaveAttribute('aria-valuetext', 'Collapsed');
    await expect(page.locator('[data-side]')).toHaveJSProperty('inert', true);
    await sidebar.evaluate((element) => (element.style.display = ''));
    await expect(separator).toHaveAttribute('aria-valuenow', '160');
  });

  test('a cancelled drag from a collapsed sidebar keeps the width to restore', async ({ page }) => {
    await page.goto('/resize-handle/');
    await handle(page).focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Enter');
    const point = await start(page);
    await page.mouse.down();
    await page.mouse.move(point.x + 160, point.y, { steps: 6 });
    await page.mouse.move(point.x - 10, point.y, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
    await handle(page).focus();
    await page.keyboard.press('Enter');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '256');
  });

  test('a cancelled drag fits the container as it is after the drag', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await page.mouse.down();
    await page.mouse.move(point.x + 30, point.y, { steps: 3 });
    await page.locator('resizable-sidebar').evaluate((element) => (element.style.width = '260px'));
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(handle(page)).toHaveAttribute('aria-valuemax', '118');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '118');
  });

  test('a collapsed sidebar keeps its handle and grip inside the rounded container', async ({ page }) => {
    await page.goto('/resize-handle/');
    const sidebar = page.locator('resizable-sidebar');
    await expect(sidebar).toHaveCSS('overflow', 'hidden');
    await handle(page).focus();
    await page.keyboard.press('Home');
    const container = (await sidebar.boundingBox())!;
    const separator = (await handle(page).boundingBox())!;
    expect(separator.x).toBeGreaterThanOrEqual(container.x);
    const grip = (await page.locator('[data-grip]').boundingBox())!;
    expect(grip.x).toBeGreaterThan(container.x + 1);
  });

  test('a mouse press resizes only past 2px of travel, from where it crossed', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await page.mouse.down();
    await expect(handle(page)).toHaveAttribute('data-state', 'drag');
    await page.mouse.move(point.x + 1, point.y);
    expect(await handle(page).getAttribute('aria-valuenow')).toBe('160');
    expect(await shown(page)).toBe(160);
    // Through +2, where the drag starts and is anchored, to +3: one pixel of resize.
    await page.mouse.move(point.x + 3, point.y, { steps: 2 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '161');
    await page.mouse.up();
  });

  test('below the minimum the edge gives while the width stays, and snaps back over 240ms on release', async ({ page }) => {
    await page.clock.install();
    await page.goto('/resize-handle/');
    const point = await start(page);
    await grab(page, point);
    // 60px left of the anchor: a proposed width of 100, inside the 60 to 120 zone.
    await page.mouse.move(point.x - 62, point.y, { steps: 10 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '120');
    expect(await shown(page)).toBe(110);
    await pauseClock(page);
    await page.mouse.up();
    expect(await shown(page)).toBe(110);
    await page.clock.runFor(100);
    expect(await shown(page)).toBeGreaterThan(110);
    expect(await shown(page)).toBeLessThan(119.5);
    await page.clock.runFor(200);
    expect(await shown(page)).toBe(120);
  });

  test('with reduced motion the give still follows the pointer and returns at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/resize-handle/');
    const point = await start(page);
    await grab(page, point);
    await page.mouse.move(point.x - 62, point.y, { steps: 10 });
    expect(await shown(page)).toBe(110);
    await page.mouse.up();
    expect(await shown(page)).toBe(120);
  });

  test('holding Enter toggles once, and a held arrow keeps moving', async ({ page }) => {
    await page.goto('/resize-handle/');
    await handle(page).focus();
    // Playwright sends every keydown after the first with repeat: true.
    for (let i = 0; i < 4; i++) await page.keyboard.down('Enter');
    await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
    await page.keyboard.up('Enter');
    await page.keyboard.press('Enter');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '160');

    for (let i = 0; i < 3; i++) await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowRight');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '196');
  });

  test('a pointer that enters without moving leaves the grip hidden', async ({ page }) => {
    await page.goto('/resize-handle/');
    const box = (await handle(page).boundingBox())!;
    const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + 60) };
    await page.evaluate(({ x, y }) => {
      const separator = document.querySelector('[data-handle]')!;
      const init = { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y };
      // The page last saw the pointer here, then content scrolled under it: an enter and a move with no movement.
      document.body.dispatchEvent(new PointerEvent('pointermove', { ...init, bubbles: true }));
      separator.dispatchEvent(new PointerEvent('pointerenter', init));
      separator.dispatchEvent(new PointerEvent('pointermove', { ...init, bubbles: true }));
      // A tap on a touch laptop enters too.
      separator.dispatchEvent(new PointerEvent('pointerenter', { ...init, pointerId: 2, pointerType: 'touch' }));
      separator.dispatchEvent(new PointerEvent('pointermove', { ...init, pointerId: 2, pointerType: 'touch', bubbles: true }));
    }, point);
    await expect(handle(page)).toHaveAttribute('data-state', 'idle');
    await expect(page.locator('[data-grip]')).toHaveCSS('opacity', '0');

    // A mouse that moves shows it.
    await page.mouse.move(point.x, point.y + 20);
    await expect(handle(page)).toHaveAttribute('data-state', 'hover');
    await expect(page.locator('[data-grip]')).toHaveCSS('opacity', '1');
  });

  test('forced colors draws the line at rest', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Forced colors emulation is Chromium only.');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/resize-handle/');
    const colors = await page.locator('resizable-sidebar').evaluate((element) => {
      const probe = document.createElement('span');
      element.append(probe);
      probe.style.color = 'CanvasText';
      const canvasText = getComputedStyle(probe).color;
      probe.remove();
      return { line: getComputedStyle(element.querySelector('[data-handle]')!, '::before').backgroundColor, canvasText };
    });
    expect(colors.line).toBe(colors.canvasText);
  });
});

test.describe('tab indicator', () => {
  const component = (page: import('@playwright/test').Page) => page.locator('[data-stage] tab-indicator');
  const offset = (tabIndicator: import('@playwright/test').Locator) => tabIndicator.evaluate((el) => {
    const line = el.querySelector('[data-line]')!.getBoundingClientRect();
    const tab = el.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
    return Math.max(Math.abs(line.left - tab.left), Math.abs(line.width - tab.width));
  });

  test('the line lands under the chosen tab and no tab changes width', async ({ page }) => {
    await page.goto('/tab-indicator/');
    const tabIndicator = component(page);
    const tabs = tabIndicator.getByRole('tab');
    const widths = () => tabs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    const before = await widths();
    await tabs.nth(3).click();
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(tabIndicator.getByRole('tabpanel')).toHaveCount(1);
    await expect.poll(() => tabIndicator.locator('[data-line]').evaluate((line) => line.getAnimations().length)).toBe(0);
    expect(await offset(tabIndicator)).toBeLessThan(0.5);
    expect(await widths()).toEqual(before);
  });

  test('arrow keys move focus and selection at once, and Tab enters the panel', async ({ page }) => {
    await page.goto('/tab-indicator/');
    const tabIndicator = component(page);
    const tabs = tabIndicator.getByRole('tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    expect(await tabIndicator.locator('[data-line]').evaluate((line) => line.getAnimations().length)).toBe(0);
    expect(await offset(tabIndicator)).toBeLessThan(0.5);
    await page.keyboard.press('End');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Tab');
    await expect(tabIndicator.getByRole('tabpanel')).toBeFocused();
  });
});

test.describe('worm dots', () => {
  const component = (page: import('@playwright/test').Page) => page.locator('[data-stage] worm-dots');
  const geometry = (wormDots: import('@playwright/test').Locator) => wormDots.evaluate((el) => {
    const center = (dot: Element) => {
      const box = dot.getBoundingClientRect();
      return box.left + box.width / 2;
    };
    const worm = el.querySelector('[data-worm]')!.getBoundingClientRect();
    const dots = [...el.querySelectorAll('[data-dot]')].map(center);
    return { left: worm.left, right: worm.right, dots };
  });

  test('the worm is drawn from the scroll position and stays stretched mid-swipe', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    await wormDots.locator('[data-track]').evaluate(async (track: HTMLElement) => {
      const slides = track.querySelectorAll<HTMLElement>('[data-slide]');
      track.style.scrollSnapType = 'none';
      track.scrollLeft = (slides[1].offsetLeft - slides[0].offsetLeft) * 2.5;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const { left, right, dots } = await geometry(wormDots);
    // Halfway between slides 3 and 4, it reaches from 6px before dot 3 to 6px past dot 4.
    expect(Math.abs(left - (dots[2] - 6))).toBeLessThan(0.5);
    expect(Math.abs(right - (dots[3] + 6))).toBeLessThan(0.5);
    await expect(wormDots.getByRole('button', { name: 'Slide 4 of 6' })).toHaveAttribute('aria-current', 'true');
  });

  test('dragging along the dots scrubs and snaps to the nearest dot', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    const first = await wormDots.getByRole('button', { name: 'Slide 1 of 6' }).boundingBox();
    const fifth = await wormDots.getByRole('button', { name: 'Slide 5 of 6' }).boundingBox();
    const y = first!.y + first!.height / 2;
    await page.mouse.move(first!.x + first!.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(fifth!.x + fifth!.width / 2 + 4, y, { steps: 8 });
    await page.mouse.up();
    const current = wormDots.getByRole('button', { name: 'Slide 5 of 6' });
    await expect(current).toHaveAttribute('aria-current', 'true');
    await expect(wormDots.locator('[data-counter]')).toHaveText('5 / 6');
    await expect.poll(async () => {
      const { left, right, dots } = await geometry(wormDots);
      return Math.abs((left + right) / 2 - dots[4]);
    }).toBeLessThan(0.5);
    await expect(wormDots.locator('[data-track]')).toHaveCSS('scroll-snap-type', 'x mandatory');
  });

  test('one tab stop moves with the arrow keys, Home, and End', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    const dot = (n: number) => wormDots.getByRole('button', { name: `Slide ${n} of 6` });
    await expect(wormDots.locator('[data-dot][tabindex="0"]')).toHaveCount(1);
    await dot(1).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(dot(1)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(dot(2)).toBeFocused();
    await expect(dot(2)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('End');
    await expect(dot(6)).toBeFocused();
    await expect(wormDots.locator('[data-counter]')).toHaveText('6 / 6');
    await page.keyboard.press('Home');
    await expect(dot(1)).toHaveAttribute('aria-current', 'true');
    await expect(wormDots.locator('[data-dot][tabindex="0"]')).toHaveCount(1);
  });

  test('a settled swipe is announced, a keyboard move is not repeated', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    const status = wormDots.locator('[data-status]');
    await wormDots.locator('[data-track]').evaluate((track: HTMLElement) => {
      const slides = track.querySelectorAll<HTMLElement>('[data-slide]');
      track.scrollTo({ left: (slides[1].offsetLeft - slides[0].offsetLeft) * 2, behavior: 'instant' });
    });
    await expect(status).toHaveText('Slide 3 of 6');
    await wormDots.getByRole('button', { name: 'Slide 3 of 6' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(wormDots.getByRole('button', { name: 'Slide 4 of 6' })).toBeFocused();
    await page.waitForTimeout(400);
    await expect(status).toHaveText('Slide 3 of 6');
  });

  test('removed mid-scrub, it reconnects clean, and a hidden one draws no NaN', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    const first = await wormDots.getByRole('button', { name: 'Slide 1 of 6' }).boundingBox();
    const y = first!.y + first!.height / 2;
    await page.mouse.move(first!.x + first!.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(first!.x + 60, y, { steps: 4 });
    await expect(wormDots).toHaveAttribute('data-scrubbing', '');
    const state = await wormDots.evaluate((el) => {
      const parent = el.parentElement!;
      const hidden = document.createElement('div');
      hidden.style.display = 'none';
      document.body.append(hidden);
      hidden.append(el);
      const worm = el.querySelector<HTMLElement>('[data-worm]')!;
      const whileHidden = worm.style.transform + ' ' + worm.style.width;
      parent.append(el);
      hidden.remove();
      return {
        whileHidden,
        snap: el.querySelector<HTMLElement>('[data-track]')!.style.scrollSnapType,
        scrubbing: el.hasAttribute('data-scrubbing'),
        pressed: el.querySelectorAll('[data-pressed]').length,
      };
    });
    await page.mouse.up();
    expect(state.whileHidden).not.toContain('NaN');
    expect(state).toMatchObject({ snap: '', scrubbing: false, pressed: 0 });
  });

  test('keyboard focus rings the worm and follows a swipe to the current dot', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    await wormDots.getByRole('button', { name: 'Slide 1 of 6' }).focus();
    const worm = wormDots.locator('[data-worm]');
    await expect(worm).toHaveCSS('outline-style', 'solid');
    await expect(worm).toHaveCSS('outline-width', '2px');
    await wormDots.locator('[data-track]').evaluate((track: HTMLElement) => {
      const slides = track.querySelectorAll<HTMLElement>('[data-slide]');
      track.scrollTo({ left: (slides[1].offsetLeft - slides[0].offsetLeft) * 3, behavior: 'instant' });
    });
    await expect(wormDots.getByRole('button', { name: 'Slide 4 of 6' })).toBeFocused();
    await expect(worm).toHaveCSS('outline-style', 'solid');
  });

  test('forced colors draws the dots and the worm with system colors', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Forced colors emulation is Chromium only.');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/worm-dots/');
    const colors = await component(page).evaluate((el) => {
      const probe = document.createElement('span');
      el.append(probe);
      const system = (color: string) => {
        probe.style.color = color;
        return getComputedStyle(probe).color;
      };
      const result = {
        worm: getComputedStyle(el.querySelector('[data-worm]')!).backgroundColor,
        dot: getComputedStyle(el.querySelector('[data-dot]')!, '::before').backgroundColor,
        canvasText: system('CanvasText'),
        grayText: system('GrayText'),
        canvas: system('Canvas'),
      };
      probe.remove();
      return result;
    });
    expect(colors.worm).toBe(colors.canvasText);
    expect(colors.dot).toBe(colors.grayText);
    expect(colors.dot).not.toBe(colors.canvas);
  });

  const dot = (wormDots: Locator, n: number) => wormDots.getByRole('button', { name: `Slide ${n} of 6` });
  const middle = async (locator: Locator) => {
    const box = (await locator.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const wormOffset = (wormDots: Locator, index: number) => wormDots.evaluate((el, index) => {
    const worm = el.querySelector('[data-worm]')!.getBoundingClientRect();
    const target = el.querySelectorAll('[data-dot]')[index].getBoundingClientRect();
    return Math.abs((worm.left + worm.right) / 2 - (target.left + target.width / 2));
  }, index);

  // The strip turns snapping off when a travel starts and back on when it ends, so the two style
  // mutations bracket one travel. Timed inside the page, so a slow runner can't stretch it.
  const watchTravel = (wormDots: Locator) => wormDots.locator('[data-track]').evaluate((track: HTMLElement) => {
    const times: { start?: number; end?: number } = {};
    (window as unknown as { wdTravel: typeof times }).wdTravel = times;
    new MutationObserver(() => {
      const now = performance.now();
      if (track.style.scrollSnapType === 'none') times.start ??= now;
      else if (times.start !== undefined) times.end ??= now;
    }).observe(track, { attributes: true, attributeFilter: ['style'] });
  });

  test('a tap from the first dot to the last travels in 360ms', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    await watchTravel(wormDots);
    const target = await middle(dot(wormDots, 6));
    await page.mouse.click(target.x, target.y);
    await page.waitForFunction(() => (window as unknown as { wdTravel: { end?: number } }).wdTravel.end !== undefined);
    const { start, end } = await page.evaluate(() => (window as unknown as { wdTravel: { start: number; end: number } }).wdTravel);
    // Plus at most a few frames; a flat 280ms or 40ms per extra dot would put the long tap at 280 or 440ms.
    expect(end - start).toBeGreaterThanOrEqual(350);
    expect(end - start).toBeLessThan(440);
    await expect(wormDots.locator('[data-counter]')).toHaveText('6 / 6');
    expect(await wormOffset(wormDots, 5)).toBeLessThan(0.5);
  });

  test('a mouse press on a slide or a vertical wheel does not stop a tap partway', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    const track = wormDots.locator('[data-track]');
    await track.evaluate((track: HTMLElement) => {
      const result: { during?: string; after?: string } = {};
      (window as unknown as { wdInterrupt: typeof result }).wdInterrupt = result;
      const slide = track.querySelectorAll<HTMLElement>('[data-slide]')[1];
      const observer = new MutationObserver(() => {
        if (track.style.scrollSnapType !== 'none') return;
        observer.disconnect();
        // Two frames into the travel, so the press lands while it is still running.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          result.during = track.style.scrollSnapType;
          const box = slide.getBoundingClientRect();
          const at = { bubbles: true, cancelable: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
          slide.dispatchEvent(new PointerEvent('pointerdown', { ...at, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 }));
          slide.dispatchEvent(new PointerEvent('pointerup', { ...at, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 }));
          slide.dispatchEvent(new WheelEvent('wheel', { ...at, deltaY: 40 }));
          result.after = track.style.scrollSnapType;
        }));
      });
      observer.observe(track, { attributes: true, attributeFilter: ['style'] });
    });
    const last = await middle(dot(wormDots, 6));
    await page.mouse.click(last.x, last.y);
    await page.waitForFunction(() => (window as unknown as { wdInterrupt: { after?: string } }).wdInterrupt.after !== undefined);
    // Still driven by the strip after the press and the wheel: the browser would otherwise snap to a slide on the way.
    expect(await page.evaluate(() => (window as unknown as { wdInterrupt: object }).wdInterrupt)).toEqual({ during: 'none', after: 'none' });
    await expect(wormDots.locator('[data-counter]')).toHaveText('6 / 6');
    await expect(dot(wormDots, 6)).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => wormOffset(wormDots, 5)).toBeLessThan(0.5);
    await expect(track).toHaveCSS('scroll-snap-type', 'x mandatory');
  });

  test('Escape during a scrub returns to the dot it started from', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    const counter = wormDots.locator('[data-counter]');
    const first = await middle(dot(wormDots, 1));
    const fourth = await middle(dot(wormDots, 4));
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(fourth.x, first.y, { steps: 8 });
    await expect(wormDots).toHaveAttribute('data-scrubbing', '');
    await expect(counter).toHaveText('4 / 6');
    await page.keyboard.press('Escape');
    await expect(wormDots).not.toHaveAttribute('data-scrubbing', '');
    // The release over dot 4 that follows commits nothing.
    await page.mouse.up();
    await expect(counter).toHaveText('1 / 6');
    await expect(dot(wormDots, 1)).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => wormOffset(wormDots, 0)).toBeLessThan(0.5);
    await expect(wormDots.locator('[data-track]')).toHaveCSS('scroll-snap-type', 'x mandatory');
    await expect(wormDots.locator('[data-pressed]')).toHaveCount(0);
  });

  test('a touch press that rolls 6px is still a tap on the dot it went down on', async ({ page }) => {
    // Taps and snaps jump under reduced motion, so the end state can be read at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/worm-dots/');
    const wormDots = component(page);

    // Synthetic pointers, since Playwright can't move a finger in WebKit. They aren't active pointers,
    // so capturing one would throw; the stub only skips the capture.
    const press = (pointerType: 'touch' | 'mouse') => wormDots.evaluate((el, pointerType) => {
      const strip = el.querySelector<HTMLElement>('[data-strip]')!;
      strip.setPointerCapture = () => {};
      const third = el.querySelectorAll<HTMLElement>('[data-dot]')[2];
      const box = third.getBoundingClientRect();
      // 8px right of dot 3's center, then 6px further: past the halfway point to dot 4 on release.
      const x = box.left + box.width / 2 + 8;
      const y = box.top + box.height / 2;
      const fire = (type: string, clientX: number) => third.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType, isPrimary: true, button: 0, clientX, clientY: y,
      }));
      const observer = new MutationObserver(() => {});
      observer.observe(el, { attributes: true, attributeFilter: ['data-scrubbing'] });
      fire('pointerdown', x);
      fire('pointermove', x + 3);
      fire('pointermove', x + 6);
      fire('pointerup', x + 6);
      const scrubbed = observer.takeRecords().length > 0;
      observer.disconnect();
      return scrubbed;
    }, pointerType);

    expect(await press('touch')).toBe(false);
    await expect(dot(wormDots, 3)).toHaveAttribute('aria-current', 'true');
    await expect(wormDots.locator('[data-counter]')).toHaveText('3 / 6');

    // The same 6px with a mouse clears its 4px slop, so it scrubs and snaps to where it let go.
    expect(await press('mouse')).toBe(true);
    await expect(dot(wormDots, 4)).toHaveAttribute('aria-current', 'true');
  });

  test('on touch, a dot shows pressed after 100ms, not on contact', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    const state = await wormDots.evaluate(async (el) => {
      const strip = el.querySelector<HTMLElement>('[data-strip]')!;
      strip.setPointerCapture = () => {};
      const second = el.querySelectorAll<HTMLElement>('[data-dot]')[1];
      const box = second.getBoundingClientRect();
      const fire = (type: string) => second.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0,
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
      }));
      fire('pointerdown');
      const atOnce = second.hasAttribute('data-pressed');
      await new Promise((resolve) => setTimeout(resolve, 150));
      const later = second.hasAttribute('data-pressed');
      // A cancel, such as the page taking over a vertical swipe, drops it.
      fire('pointercancel');
      return { atOnce, later, cancelled: second.hasAttribute('data-pressed') };
    });
    expect(state).toEqual({ atOnce: false, later: true, cancelled: false });
  });
});

test.describe('drag to reorder', () => {
  const component = (page: import('@playwright/test').Page) => page.locator('[data-stage] drag-reorder');
  const labels = (page: import('@playwright/test').Page) => component(page).locator('[data-label]').allTextContents();

  test('closes over the lifted row and opens a gap by nudging 8px × 0.7ⁿ', async ({ page }) => {
    await page.goto('/drag-reorder/');
    const items = component(page).locator('[data-item]');
    const box = (await items.nth(0).boundingBox())!;
    const pitch = (await items.nth(1).boundingBox())!.y - box.y;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height / 2);
    await page.mouse.down();
    // One move, so every row starts from rest and gets its stagger.
    await page.mouse.move(x + 30, box.y + box.height / 2 + pitch * 2);
    const shifts = await items.evaluateAll((els) => els.map((el) => ({ transform: (el as HTMLElement).style.transform, delay: (el as HTMLElement).style.transitionDelay })));
    expect(shifts[0].transform).toMatch(/^translate\(30px, /);
    expect(shifts.slice(1).map((shift) => shift.delay)).toEqual(['24ms', '0ms', '0ms', '24ms']);
    const ys = shifts.slice(1).map((shift) => Number(/translateY\(([-\d.]+)px\)/.exec(shift.transform)?.[1]));
    expect(ys[0] + pitch).toBeCloseTo(-5.6, 1);
    expect(ys[1] + pitch).toBeCloseTo(-8, 1);
    expect(ys[2] + pitch).toBeCloseTo(8, 1);
    expect(ys[3] + pitch).toBeCloseTo(5.6, 1);
    const line = component(page).locator('[data-line]');
    await expect(line).toHaveAttribute('data-active', '');
    expect(await line.evaluate((el) => (el as HTMLElement).style.transform)).toBe(`translateY(${pitch * 2}px)`);
    await page.mouse.up();
    await expect.poll(() => labels(page)).toEqual(['Review pull request', 'Update icons', 'Draft changelog', 'Fix focus ring', 'Ship release']);
    await expect(items.nth(0).locator('[data-position]')).toHaveText('01');
    await expect(line).not.toHaveAttribute('data-active', '');
    await expect(component(page).locator('[data-status]')).toHaveText('Dropped Draft changelog at position 3 of 5.');
    expect(await items.evaluateAll((els) => els.every((el) => (el as HTMLElement).style.transform === ''))).toBe(true);
  });

  test('Escape cancels a pointer drag, and the list is named on its <ul>', async ({ page }) => {
    await page.goto('/drag-reorder/');
    const items = component(page).locator('[data-item]');
    await expect(component(page).locator('[data-list]')).toHaveAttribute('aria-label', 'Tasks');
    await expect(component(page)).not.toHaveAttribute('aria-label');
    await expect(items.nth(0).locator('[data-handle]')).toHaveAttribute('aria-pressed', 'false');
    const box = (await items.nth(0).boundingBox())!;
    const pitch = (await items.nth(1).boundingBox())!.y - box.y;
    await page.mouse.move(box.x + 60, box.y + 22);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 22 + pitch * 2, { steps: 6 });
    await page.keyboard.press('Escape');
    await expect(component(page).locator('[data-status]')).toHaveText('Cancelled. Draft changelog is back at position 1 of 5.');
    await page.mouse.up();
    expect(await labels(page)).toEqual(['Draft changelog', 'Review pull request', 'Update icons', 'Fix focus ring', 'Ship release']);
  });

  test('rows at rest wait by distance, rows still moving retarget at once', async ({ page }) => {
    await page.clock.install();
    await page.goto('/drag-reorder/');
    // The second move has to happen while the rows are still moving.
    await pauseClock(page);
    const items = component(page).locator('[data-item]');
    const delays = () => items.evaluateAll((els) => els.slice(1).map((el) => (el as HTMLElement).style.transitionDelay));
    const box = (await items.nth(0).boundingBox())!;
    const pitch = (await items.nth(1).boundingBox())!.y - box.y;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + pitch * 2);
    expect(await delays()).toEqual(['24ms', '0ms', '0ms', '24ms']);
    await page.mouse.move(x, y + pitch * 3);
    expect(await delays()).toEqual(['0ms', '0ms', '0ms', '0ms']);
    await page.clock.runFor(400);
    await page.mouse.move(x, y + pitch * 2);
    expect(await delays()).toEqual(['24ms', '0ms', '0ms', '24ms']);
    await page.mouse.up();
    await page.clock.runFor(400);
    await expect.poll(() => labels(page)).toEqual(['Review pull request', 'Update icons', 'Draft changelog', 'Fix focus ring', 'Ship release']);
  });

  test('with reduced motion the rows beside the gap still part, and the number shows the slot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/drag-reorder/');
    const items = component(page).locator('[data-item]');
    const box = (await items.nth(0).boundingBox())!;
    const pitch = (await items.nth(1).boundingBox())!.y - box.y;
    await page.mouse.move(box.x + 60, box.y + 22);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 22 + pitch * 2);
    const ys = await items.evaluateAll((els) => els.slice(1).map((el) => Number(/translateY\(([-\d.]+)px\)/.exec((el as HTMLElement).style.transform)?.[1])));
    expect(ys.map((y) => Math.round(y + pitch))).toEqual([0, -8, 8, 0]);
    // Every row shows the position it would have after a drop here, so no two rows share a number.
    expect(await items.locator('[data-position]').allTextContents()).toEqual(['03', '01', '02', '04', '05']);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(items.nth(0).locator('[data-position]')).toHaveText('01');
  });

  test('on touch the row scrolls the page and only the grip lifts it', async ({ page }) => {
    await page.goto('/drag-reorder/');
    const handle = component(page).locator('[data-handle]').first();
    expect(await handle.evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
    const grip = handle.locator('[data-grip]');
    expect(await grip.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
    // The grip's hit area is 44px tall and reaches the row's left edge.
    const hit = await grip.evaluate((el) => {
      const style = getComputedStyle(el, '::before');
      const box = el.getBoundingClientRect();
      const row = el.closest('[data-item]')!.getBoundingClientRect();
      return { height: box.height - parseFloat(style.top) - parseFloat(style.bottom), left: box.left + parseFloat(style.left) - row.left, width: box.width - parseFloat(style.left) - parseFloat(style.right) };
    });
    expect(Math.round(hit.height)).toBe(44);
    expect(Math.round(hit.width)).toBe(44);
    expect(Math.round(hit.left)).toBeLessThanOrEqual(1);
  });

  test('a held Space picks up once, and a pointer press drops a row picked up with the keyboard', async ({ page }) => {
    await page.goto('/drag-reorder/');
    const handles = component(page).locator('[data-handle]');
    const status = component(page).locator('[data-status]');
    await handles.nth(0).focus();
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await expect(handles.nth(0)).toHaveAttribute('aria-pressed', 'true');
    const box = (await handles.nth(2).boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + 22);
    await page.mouse.down();
    await expect(handles.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toHaveText('Dropped Draft changelog at position 1 of 5.');
    await page.mouse.move(box.x + 60, box.y + 22 + 60, { steps: 4 });
    await expect(component(page)).toHaveAttribute('data-dragging', '');
    await page.mouse.up();
  });

  test('picks up with Space, moves with the arrow keys, and announces', async ({ page }) => {
    await page.goto('/drag-reorder/');
    const handles = component(page).locator('[data-handle]');
    const status = component(page).locator('[data-status]');
    await handles.nth(1).focus();
    await page.keyboard.press('Space');
    await expect(status).toContainText('Picked up Review pull request. Position 2 of 5');
    await page.keyboard.press('ArrowDown');
    await expect(status).toHaveText('Moved to position 3 of 5.');
    await expect(handles.nth(2)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(status).toHaveText('Dropped Review pull request at position 3 of 5.');
    expect(await labels(page)).toEqual(['Draft changelog', 'Update icons', 'Review pull request', 'Fix focus ring', 'Ship release']);
    await page.keyboard.press('Space');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowUp');
    await expect(status).toHaveText('Already at the first position.');
    await page.keyboard.press('Escape');
    await expect(status).toContainText('Cancelled. Review pull request is back at position 3 of 5.');
    expect(await labels(page)).toEqual(['Draft changelog', 'Update icons', 'Review pull request', 'Fix focus ring', 'Ship release']);
  });
});

test.describe('faq panel', () => {
  const component = (page: import('@playwright/test').Page) => page.locator('[data-stage] faq-panel');
  const offset = (faq: import('@playwright/test').Locator) => faq.evaluate((el) => {
    const panel = el.querySelector('[data-panel]')!.getBoundingClientRect();
    const item = el.querySelector('[aria-expanded="true"]')!.closest('[data-item]')!.getBoundingClientRect();
    return Math.max(Math.abs(panel.top - item.top), Math.abs(panel.height - item.height));
  });
  const settled = (faq: import('@playwright/test').Locator) =>
    expect.poll(() => faq.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);

  test('the panel lands on the chosen question and fits its answer', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const questions = faq.getByRole('button');
    expect(await offset(faq)).toBeLessThan(0.5);
    // Counts the moves in the click's own task, after the button's handler. The move lasts 300ms, and on
    // a busy runner the round trips after the click can outlast it, leaving nothing to count.
    await faq.evaluate((el) => addEventListener('click', () => {
      el.dataset.movesOnClick = String(el.querySelector('[data-panel]')!.getAnimations().length);
    }, { once: true }));
    await questions.nth(3).click();
    await expect(questions.nth(3)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(faq).toHaveAttribute('data-moves-on-click', '1');
    await settled(faq);
    expect(await offset(faq)).toBeLessThan(0.5);
    // Closed answers stay in the DOM for find in page.
    await expect(faq.locator('[data-answer][hidden="until-found"]')).toHaveCount(4);
    await expect(faq.locator('[data-answer]:not([hidden])')).toHaveCount(1);
    await expect(faq.getByRole('region', { name: 'What about reduced motion?' })).toBeVisible();
  });

  test('the card keeps its height on every frame of a change', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const heights = await faq.evaluate(async (el) => {
      const buttons = el.querySelectorAll<HTMLElement>('[data-trigger]');
      const seen: number[] = [el.getBoundingClientRect().height];
      for (const index of [4, 1, 3]) {
        buttons[index].click();
        const [move] = el.querySelector('[data-panel]')!.getAnimations();
        const animations = el.getAnimations({ subtree: true });
        animations.forEach((animation) => animation.pause());
        for (const t of [50, 120, 190, 260]) {
          animations.forEach((animation) => (animation.currentTime = t));
          seen.push(el.getBoundingClientRect().height);
        }
        move.finish();
        animations.forEach((animation) => animation.finish());
        seen.push(el.getBoundingClientRect().height);
      }
      return seen;
    });
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.5);
  });

  test('rapid changes, closing and reopening mid-move, settle on the last one', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const steps: [number, number][] = [[4, 100], [4, 50], [4, 80], [0, 120], [2, 30], [2, 150], [1, 60]];
    await faq.evaluate(async (el, steps) => {
      const buttons = el.querySelectorAll<HTMLElement>('[data-trigger]');
      for (const [index, time] of steps) {
        buttons[index].click();
        el.getAnimations({ subtree: true }).forEach((animation) => {
          animation.pause();
          animation.currentTime = time;
        });
      }
      el.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, steps);
    await settled(faq);
    const questions = faq.getByRole('button');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(faq.locator('[aria-expanded="true"]')).toHaveCount(1);
    await expect(faq.locator('[data-answer]:not([hidden])')).toHaveCount(1);
    await expect(faq.locator('[data-answer][inert], [data-answer][style*="height"]')).toHaveCount(0);
    await expect(faq.locator('[data-panel]')).toHaveCSS('opacity', '1');
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('a resize during a move is measured when the move settles', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const reserve = await faq.evaluate(async (el: HTMLElement) => {
      const next = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const before = el.style.minHeight;
      el.querySelectorAll<HTMLElement>('[data-trigger]')[4].click();
      const [move] = el.querySelector('[data-panel]')!.getAnimations();
      const animations = el.getAnimations({ subtree: true });
      animations.forEach((animation) => animation.pause());
      // Narrower, so every answer wraps to more lines while the panel is moving.
      el.style.width = '260px';
      // The observer reports the resize, and its fit runs a frame later, while the move is still paused.
      await next();
      await next();
      // Read as the move settles, before any later resize could correct it.
      const settled = new Promise<string>((resolve) => move.addEventListener('finish', () => resolve(el.style.minHeight)));
      animations.forEach((animation) => animation.finish());
      const atSettle = await settled;
      await next();
      return { before, atSettle, later: el.style.minHeight };
    });
    expect(reserve.atSettle).not.toBe(reserve.before);
    expect(reserve.atSettle).toBe(reserve.later);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('moving the element in the DOM, even mid-move, starts it over with one set of listeners', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    await faq.evaluate((el) => {
      const parent = el.parentNode!;
      el.querySelectorAll<HTMLElement>('[data-trigger]')[3].click();
      parent.removeChild(el);
      parent.appendChild(el);
    });
    const questions = faq.getByRole('button');
    await expect(questions.nth(3)).toHaveAttribute('aria-expanded', 'true');
    await settled(faq);
    expect(await offset(faq)).toBeLessThan(0.5);
    // One click, one change: a second set of listeners would close it again.
    await questions.nth(2).click();
    await expect(questions.nth(2)).toHaveAttribute('aria-expanded', 'true');
    await settled(faq);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('turning reduced motion on mid-move lands the move at once', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const questions = faq.getByRole('button');
    await faq.evaluate((el) => {
      el.querySelectorAll<HTMLElement>('[data-trigger]')[4].click();
      el.getAnimations({ subtree: true }).forEach((animation) => animation.pause());
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settled(faq);
    await expect(questions.nth(4)).toHaveAttribute('aria-expanded', 'true');
    await expect(faq.locator('[data-answer]:not([hidden])')).toHaveCount(1);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('a find-in-page match opens its answer at once and closes the open one', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const questions = faq.getByRole('button');
    await faq.evaluate((el) => {
      const answer = el.querySelectorAll('[data-answer]')[2];
      answer.dispatchEvent(new Event('beforematch', { bubbles: true }));
    });
    await expect(questions.nth(2)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'false');
    expect(await faq.evaluate((el) => el.getAnimations({ subtree: true }).filter((animation) => !(animation instanceof CSSTransition)).length)).toBe(0);
    await expect(faq.locator('[data-answer]:not([hidden])')).toHaveCount(1);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('markup with several open questions keeps only the first', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    await faq.evaluate((el) => {
      const parent = el.parentNode!;
      parent.removeChild(el);
      el.querySelectorAll('[data-trigger]').forEach((button, i) => button.setAttribute('aria-expanded', String(i === 1 || i === 3)));
      el.querySelectorAll('[data-answer]').forEach((answer, i) => (i === 1 || i === 3 ? answer.removeAttribute('hidden') : answer.setAttribute('hidden', 'until-found')));
      parent.appendChild(el);
    });
    await expect(faq.locator('[aria-expanded="true"]')).toHaveCount(1);
    await expect(faq.getByRole('button').nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(faq.locator('[data-answer]:not([hidden])')).toHaveCount(1);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('a question chosen mid-move takes over from where the panel is', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const turn = await faq.evaluate(async (el) => {
      const buttons = el.querySelectorAll<HTMLElement>('[data-trigger]');
      const panel = el.querySelector<HTMLElement>('[data-panel]')!;
      buttons[buttons.length - 1].click();
      const animation = panel.getAnimations()[0];
      animation.pause();
      animation.currentTime = 200;
      const at = panel.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientTop;
      buttons[1].click();
      const [next] = panel.getAnimations();
      const start = next.effect!.getKeyframes()[0].transform as string;
      return { at, start: Number(start.match(/-?[\d.]+/)![0]), easing: (next.effect as KeyframeEffect).getKeyframes()[0].easing };
    });
    expect(Math.abs(turn.start - turn.at)).toBeLessThan(0.5);
    expect(turn.easing).toBe('cubic-bezier(0.23, 1, 0.32, 1)');
    await settled(faq);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('choosing the open question closes it, and the panel fades on its row', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const first = faq.getByRole('button').first();
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await settled(faq);
    await expect(faq.locator('[data-panel]')).toHaveCSS('opacity', '0');
    await expect(faq.locator('[data-answer][hidden="until-found"]')).toHaveCount(5);
    await first.click();
    await settled(faq);
    expect(await offset(faq)).toBeLessThan(0.5);
    await expect(faq.locator('[data-panel]')).toHaveCSS('opacity', '1');
  });

  test('arrow keys move focus and Enter opens', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/faq-panel/');
    const faq = component(page);
    const questions = faq.getByRole('button');
    await questions.first().focus();
    await page.keyboard.press('ArrowUp');
    await expect(questions.last()).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await expect(questions.nth(1)).toBeFocused();
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'true');
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  const MOVE_EASE = 'cubic-bezier(0.64, 0, 0.2, 1)';
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  // Clicks a question and reads every timing in the click's own task, before a slow runner can let the move end.
  const clickAndRead = (faq: Locator, index: number) => faq.evaluate((el: HTMLElement, index) => {
    el.querySelectorAll<HTMLElement>('[data-trigger]')[index].click();
    const panel = el.querySelector<HTMLElement>('[data-panel]')!;
    const [move] = panel.getAnimations();
    const effect = move.effect as KeyframeEffect;
    const timing = (animation: Animation) => {
      const { duration, easing } = animation.effect!.getTiming();
      return { duration, easing };
    };
    const style = getComputedStyle(el);
    return {
      duration: effect.getTiming().duration,
      effectEasing: effect.getTiming().easing,
      curve: effect.getKeyframes()[0].easing,
      card: el.getAnimations().map(timing),
      answers: [...el.querySelectorAll('[data-answer]')].flatMap((answer) => answer.getAnimations().map(timing)),
      newText: el.querySelectorAll('[data-answer]')[index].firstElementChild!.getAnimations().map((animation) => animation.effect!.getTiming().delay),
      move: style.getPropertyValue('--fqp-move').trim(),
      ease: style.getPropertyValue('--fqp-ease').trim(),
      // The panel's opacity 60ms and 120ms in; the move stays paused afterwards.
      opacity: [60, 120].map((t) => {
        move.pause();
        move.currentTime = t;
        return Number(getComputedStyle(panel).opacity);
      }),
    };
  }, index);

  const finishAll = (faq: Locator) =>
    faq.evaluate((el) => el.getAnimations({ subtree: true }).forEach((animation) => animation.finish()));

  test('holding Enter toggles the question once', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    const questions = faq.getByRole('button');
    await faq.evaluate((el) => {
      el.dataset.clicks = '0';
      el.addEventListener('click', () => (el.dataset.clicks = String(Number(el.dataset.clicks) + 1)));
    });
    await questions.nth(1).focus();
    // Every keydown after the first carries repeat: true, as holding the key does.
    for (let i = 0; i < 5; i++) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(faq).toHaveAttribute('data-clicks', '1');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(faq.locator('[aria-expanded="true"]')).toHaveCount(1);

    // The arrows still repeat.
    await page.keyboard.down('ArrowDown');
    await page.keyboard.down('ArrowDown');
    await page.keyboard.up('ArrowDown');
    await expect(questions.nth(3)).toBeFocused();
  });

  test('the last close and the first open run 240ms on the ease-out; a move between questions stays 300ms', async ({ page }) => {
    await page.goto('/faq-panel/');
    const faq = component(page);
    await settled(faq);

    // Closing the last open answer.
    const close = await clickAndRead(faq, 0);
    expect(close.duration).toBe(240);
    expect(close.effectEasing).toBe('linear');
    expect(close.curve).toBe(EASE_OUT);
    expect(close.card).toEqual([{ duration: 240, easing: EASE_OUT }]);
    expect(close.answers).toEqual([{ duration: 240, easing: EASE_OUT }]);
    expect([close.move, close.ease]).toEqual(['240ms', EASE_OUT]);
    // Opacity follows the time, not the eased progress: half gone a quarter of the way in, gone at the middle,
    // so the panel is still there while it shrinks.
    expect(close.opacity[0]).toBeGreaterThan(0.4);
    expect(close.opacity[0]).toBeLessThan(0.6);
    expect(close.opacity[1]).toBeLessThan(0.01);
    await finishAll(faq);
    await settled(faq);
    await expect(faq.locator('[data-panel]')).toHaveCSS('opacity', '0');

    // Opening from nothing open: the new text still lands with the panel.
    const open = await clickAndRead(faq, 2);
    expect(open.duration).toBe(240);
    expect(open.effectEasing).toBe('linear');
    expect(open.curve).toBe(EASE_OUT);
    expect(open.card).toEqual([{ duration: 240, easing: EASE_OUT }]);
    expect(open.answers).toEqual([{ duration: 240, easing: EASE_OUT }]);
    expect(open.newText).toEqual([30]);
    expect([open.move, open.ease]).toEqual(['240ms', EASE_OUT]);
    await finishAll(faq);
    await settled(faq);
    expect(await offset(faq)).toBeLessThan(0.5);

    // Between questions, the recorded move.
    const move = await clickAndRead(faq, 4);
    expect(move.duration).toBe(300);
    expect(move.curve).toBe(MOVE_EASE);
    expect(move.card).toEqual([]);
    expect(move.answers).toEqual([{ duration: 300, easing: MOVE_EASE }, { duration: 300, easing: MOVE_EASE }]);
    expect(move.newText).toEqual([90]);
    expect([move.move, move.ease]).toEqual(['300ms', MOVE_EASE]);
    expect(move.opacity).toEqual([1, 1]);
    await finishAll(faq);
    await settled(faq);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('reduced motion lands the panel at once and fades the new answer in', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/faq-panel/');
    const faq = component(page);
    const read = await faq.evaluate((el) => {
      el.querySelectorAll<HTMLElement>('[data-trigger]')[3].click();
      const panel = el.querySelector('[data-panel]')!;
      const text = el.querySelectorAll('[data-answer]')[3].firstElementChild!;
      const panelBox = panel.getBoundingClientRect();
      const item = el.querySelectorAll('[data-item]')[3].getBoundingClientRect();
      // Only scripted animations count: WebKit also lists the site reset's 0.001ms CSS transitions.
      const scripted = (node: Element) => node.getAnimations().filter((animation) => !(animation instanceof CSSTransition));
      return {
        panelAnimations: scripted(panel).length,
        heights: [...el.querySelectorAll('[data-answer]')].flatMap(scripted).length,
        card: scripted(el).length,
        landed: Math.max(Math.abs(panelBox.top - item.top), Math.abs(panelBox.height - item.height)),
        fades: scripted(text).map((animation) => {
          const effect = animation.effect as KeyframeEffect;
          const { duration, delay } = effect.getTiming();
          return {
            duration,
            delay,
            properties: effect.getKeyframes().map(({ opacity, transform, filter }) => ({ opacity, transform, filter })),
          };
        }),
      };
    });
    expect(read.panelAnimations).toBe(0);
    expect(read.heights).toBe(0);
    expect(read.card).toBe(0);
    // A frame later: in WebKit the site's reduced-motion reset leaves a 0.001ms transition that hasn't advanced
    // within the click's own task.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await offset(faq)).toBeLessThan(0.5);
    expect(read.fades).toEqual([{
      duration: 150,
      delay: 0,
      properties: [
        { opacity: '0', transform: undefined, filter: undefined },
        { opacity: '1', transform: undefined, filter: undefined },
      ],
    }]);
    await settled(faq);
    await expect(faq.getByRole('button').nth(3)).toHaveAttribute('aria-expanded', 'true');

    // The next change cancels the fade in flight.
    const cancelled = await faq.evaluate((el) => {
      const buttons = el.querySelectorAll<HTMLElement>('[data-trigger]');
      buttons[1].click();
      const fade = el.querySelectorAll('[data-answer]')[1].firstElementChild!.getAnimations()[0];
      buttons[2].click();
      return fade.playState;
    });
    expect(cancelled).toBe('idle');

    // Find in page still opens its answer without the fade.
    const found = await faq.evaluate((el) => {
      const answer = el.querySelectorAll('[data-answer]')[4];
      answer.dispatchEvent(new Event('beforematch', { bubbles: true }));
      return answer.firstElementChild!.getAnimations().length;
    });
    expect(found).toBe(0);
  });
});

test.describe('tick rail', () => {
  const component = (page: import('@playwright/test').Page) => page.locator('[data-stage] tick-rail');
  const lengths = (rail: import('@playwright/test').Locator) =>
    rail.evaluate((el) => [...el.querySelectorAll('[data-line]')].map((line) => Math.round(line.getBoundingClientRect().width)));
  const title = (rail: import('@playwright/test').Locator) =>
    rail.locator('[data-card-box] [data-face]:not([data-leaving]) [data-face-title]');
  // How far the card's center sits from its tick's.
  const offset = (rail: import('@playwright/test').Locator, index: number) => rail.evaluate((el, index) => {
    const tick = el.querySelectorAll('[data-tick]')[index].getBoundingClientRect();
    const box = el.querySelector('[data-card-box]')!.getBoundingClientRect();
    return Math.abs(box.top + box.height / 2 - (tick.top + tick.height / 2));
  }, index);
  const openPaused = async (page: Page) => {
    await page.clock.install();
    await page.goto('/tick-rail/');
    await pauseClock(page);
    return component(page);
  };
  const hover = async (page: Page, index: number) => {
    const box = (await component(page).locator('[data-tick]').nth(index).boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
  };

  test('the ticks follow the pointer inside a row, not only across rows', async ({ page }) => {
    // Without transitions, each length is read as soon as the pointer moves.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tick-rail/');
    const rail = component(page);
    const tick = (await rail.locator('[data-tick]').nth(3).boundingBox())!;
    await page.mouse.move(tick.x + 20, tick.y + 2);
    const top = await lengths(rail);
    await page.mouse.move(tick.x + 20, tick.y + tick.height - 2);
    const bottom = await lengths(rail);
    expect(top[3]).toBeGreaterThan(22);
    expect(bottom[3]).toBeGreaterThan(22);
    expect(top[2] - bottom[2]).toBeGreaterThan(4);
    expect(bottom[4] - top[4]).toBeGreaterThan(4);
    // Three rows away, a tick is back at rest.
    expect(top[6]).toBe(8);
  });

  test('one card waits for intent, lands on its tick, and reopens at once while warm', async ({ page }) => {
    const rail = await openPaused(page);
    const card = rail.locator('[data-card]');
    await hover(page, 2);
    await page.clock.runFor(79);
    await expect(card).not.toHaveAttribute('data-showing');
    await page.clock.runFor(1);
    await expect(title(rail)).toHaveText('Usage');
    await expect.poll(() => offset(rail, 2)).toBeLessThan(1);

    await hover(page, 5);
    await expect(title(rail)).toHaveText('Touch');
    await expect.poll(() => offset(rail, 5)).toBeLessThan(1);

    const box = (await rail.boundingBox())!;
    await page.mouse.move(box.x + box.width + 40, box.y);
    await page.clock.runFor(120);
    await expect(card).not.toHaveAttribute('data-showing');
    await hover(page, 1);
    await expect(card).toHaveAttribute('data-showing', '');
    await expect(title(rail)).toHaveText('Install');
  });

  test('the keyboard moves between ticks at once, Escape hides the card, and Enter scrolls inside the demo', async ({ page }) => {
    await page.goto('/tick-rail/');
    const rail = component(page);
    const card = rail.locator('[data-card]');
    const ticks = rail.getByRole('link');
    await expect(ticks.first()).toHaveAttribute('aria-current', 'location');
    await expect(ticks.nth(1)).toHaveAccessibleDescription('Copy the files, or add them with the shadcn CLI.');

    // Focus fades the card in; the moves after it land at once.
    await ticks.first().focus();
    await expect(card).toHaveAttribute('data-showing', '');
    await expect.poll(() => card.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.keyboard.press('ArrowDown');
    await expect(ticks.nth(1)).toBeFocused();
    await expect(title(rail)).toHaveText('Install');
    expect(await card.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await offset(rail, 1)).toBeLessThan(1);

    await page.keyboard.press('End');
    await expect(ticks.last()).toBeFocused();
    await expect(title(rail)).toHaveText('Browser support');
    await page.keyboard.press('Escape');
    await expect(card).not.toHaveAttribute('data-showing');

    await page.keyboard.press('Home');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await expect(title(rail)).toHaveText('Theming');
    const scrollY = await page.evaluate(() => scrollY);
    await page.keyboard.press('Enter');
    await expect(rail.locator('#tkr-theming')).toBeFocused();
    // A jump, not a scroll: already there.
    expect(await rail.evaluate((el) => Math.abs(
      el.querySelector('#tkr-theming')!.getBoundingClientRect().top - el.querySelector('[data-scroll]')!.getBoundingClientRect().top,
    ))).toBeLessThan(2);
    await expect(ticks.nth(3)).toHaveAttribute('aria-current', 'location');
    await expect(ticks.first()).not.toHaveAttribute('aria-current');
    await expect(card).not.toHaveAttribute('data-showing');
    expect(await page.evaluate(() => [scrollY, location.hash])).toEqual([scrollY, '']);
  });

  test('without JavaScript, the ticks are links and the current one is already longer', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8791/tick-rail/');
    const rail = component(page);
    expect(await lengths(rail)).toEqual([16, 8, 8, 8, 8, 8, 8, 8]);
    await expect(rail.getByRole('link', { name: 'Usage' })).toHaveAttribute('href', '#tkr-usage');
    await context.close();
  });

  test('with reduced motion the card still waits, and lands at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const rail = await openPaused(page);
    await hover(page, 4);
    await page.clock.runFor(80);
    await expect(title(rail)).toHaveText('Keyboard');
    expect(await offset(rail, 4)).toBeLessThan(1);
  });

  test('a mouse click on a tick or on the card closes the card, and the next tick reopens it', async ({ page }) => {
    await page.goto('/tick-rail/');
    const rail = component(page);
    const card = rail.locator('[data-card]');
    const ticks = rail.getByRole('link');

    const second = (await ticks.nth(2).boundingBox())!;
    await page.mouse.move(second.x + 20, second.y + second.height / 2);
    await expect(card).toHaveAttribute('data-showing', '');
    await page.mouse.down();
    await page.mouse.up();
    await expect(ticks.nth(2)).toHaveAttribute('aria-current', 'location');
    await expect(card).not.toHaveAttribute('data-showing');

    // Moving inside the clicked row keeps it closed; another row brings it back.
    await page.mouse.move(second.x + 24, second.y + second.height / 2 + 1);
    await expect(card).not.toHaveAttribute('data-showing');
    const fifth = (await ticks.nth(5).boundingBox())!;
    await page.mouse.move(fifth.x + 20, fifth.y + fifth.height / 2);
    await expect(card).toHaveAttribute('data-showing', '');
    await expect(rail.locator('[data-card-box] [data-face]:not([data-leaving]) [data-face-title]')).toHaveText('Touch');

    await rail.locator('[data-card-box]').click();
    await expect(ticks.nth(5)).toHaveAttribute('aria-current', 'location');
    await expect(card).not.toHaveAttribute('data-showing');
  });

  test('a pointer crossing the rail sideways opens no card, and one moving down opens it after 80ms', async ({ page }) => {
    const rail = await openPaused(page);
    const card = rail.locator('[data-card]');
    const nav = (await rail.locator('[data-rail]').boundingBox())!;
    const tick = (await rail.locator('[data-tick]').nth(3).boundingBox())!;
    for (let x = nav.x + 2; x < nav.x + nav.width; x += 4) {
      await page.mouse.move(x, tick.y + tick.height / 2);
      await page.clock.runFor(20);
    }
    await page.mouse.move(nav.x + 400, tick.y);
    await page.clock.runFor(500);
    await expect(card).not.toHaveAttribute('data-showing');

    // Moving down doesn't restart the wait.
    for (let step = 0; step < 4; step++) {
      await expect(card).not.toHaveAttribute('data-showing');
      await page.mouse.move(tick.x + 20, tick.y + 2 + step * 6);
      await page.clock.runFor(20);
    }
    await expect(card).toHaveAttribute('data-showing', '');
  });

  test('the current tick stays at 16px while the pointer is elsewhere on the rail', async ({ page }) => {
    // Without transitions, each length is read as soon as the pointer moves.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tick-rail/');
    const rail = component(page);
    const ticks = rail.getByRole('link');
    await expect(ticks.first()).toHaveAttribute('aria-current', 'location');

    const far = (await ticks.nth(6).boundingBox())!;
    await page.mouse.move(far.x + 20, far.y + far.height / 2);
    const seen = await lengths(rail);
    expect(seen[0]).toBeGreaterThanOrEqual(16);
    expect(seen[3]).toBe(8);
    expect(seen[6]).toBeGreaterThan(22);
  });
});

test.describe('tick rail on touch', () => {
  test.use({ hasTouch: true });

  test('the first tap previews a section, the second goes there, and a tap outside closes the card', async ({ page }) => {
    await page.goto('/tick-rail/');
    const rail = page.locator('[data-stage] tick-rail');
    const card = rail.locator('[data-card]');
    const ticks = rail.getByRole('link');

    await ticks.nth(2).tap();
    await expect(card).toHaveAttribute('data-showing', '');
    await expect(rail.locator('[data-card-box] [data-face]:not([data-leaving]) [data-face-title]')).toHaveText('Usage');
    await expect(ticks.first()).toHaveAttribute('aria-current', 'location');

    await ticks.nth(2).tap();
    await expect(ticks.nth(2)).toHaveAttribute('aria-current', 'location');
    await expect(card).not.toHaveAttribute('data-showing');

    await ticks.nth(4).tap();
    await expect(card).toHaveAttribute('data-showing', '');
    await page.locator('h1').tap();
    await expect(card).not.toHaveAttribute('data-showing');
  });
});

test.describe('gooey radio group timing', () => {
  test('a redirect lights the new ring after 130ms and its tail starts without the lag', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    // Start a pour, move it 150ms in and change course in one task, so the first pour is still running.
    const result = await stage.locator('gooey-radio-group').evaluate((group) => {
      const choose = (value: string) => {
        const input = group.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const blobs = [...group.querySelectorAll<HTMLElement>('[data-goo-blob]')];
      choose('pickup');
      blobs.forEach((blob) => blob.getAnimations().forEach((pour) => (pour.currentTime = 150)));
      choose('standard');
      const label = group.querySelector('input[value="standard"]')!.closest('label')!;
      const ring = label.querySelector('.goo-ring')!;
      const tail = blobs[0].getAnimations()[0];
      const y = (frame: Keyframe) => Number(/translateY\((-?[\d.]+)px\)/.exec(frame.transform as string)![1]);
      const frames = (tail.effect as KeyframeEffect).getKeyframes();
      return {
        arrive: group.style.getPropertyValue('--goo-arrive'),
        ring: getComputedStyle(ring).transitionDelay,
        label: getComputedStyle(label).transitionDelay,
        overlay: getComputedStyle(ring, '::after').transitionDelay,
        duration: tail.effect!.getTiming().duration,
        // Keyframes are 5ms apart; with a 40ms lag the tail's first eight would be equal.
        tailMoves: Math.abs(y(frames[2]) - y(frames[0])),
      };
    });
    expect(result.arrive).toBe('130ms');
    expect(result.ring).toBe('0.13s');
    expect(result.label).toBe('0.13s');
    expect(result.overlay).toBe('0.13s');
    expect(result.duration).toBe(300);
    expect(result.tailMoves).toBeGreaterThan(0.5);
  });

  test('a pour from rest lights the new ring after 225ms, even after a redirect', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    const [arrive, ring, label, duration] = await stage.locator('gooey-radio-group').evaluate((group) => {
      const choose = (value: string) => {
        const input = group.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const blobs = [...group.querySelectorAll<HTMLElement>('[data-goo-blob]')];
      // A redirect first, then let it land, so the next change pours from rest.
      choose('pickup');
      blobs.forEach((blob) => blob.getAnimations().forEach((pour) => (pour.currentTime = 150)));
      choose('next-day');
      blobs.forEach((blob) => blob.getAnimations().forEach((pour) => pour.finish()));
      choose('express');
      const option = group.querySelector('input[value="express"]')!.closest('label')!;
      return [
        group.style.getPropertyValue('--goo-arrive'),
        getComputedStyle(option.querySelector('.goo-ring')!).transitionDelay,
        getComputedStyle(option).transitionDelay,
        blobs.at(-1)!.getAnimations()[0].effect!.getTiming().duration,
      ];
    });
    expect(arrive).toBe('225ms');
    expect(ring).toBe('0.225s');
    expect(label).toBe('0.225s');
    expect(duration).toBe(340);
  });

  test('with reduced motion the dot jumps', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/gooey-radio-group/');
    // Only the scripted drop counts: WebKit also lists the site reset's 0.001ms CSS transitions.
    const state = await page.locator('[data-stage] gooey-radio-group').evaluate((group) => {
      const input = group.querySelector<HTMLInputElement>('input[value="pickup"]')!;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const blobs = [...group.querySelectorAll('[data-goo-blob]')];
      return blobs.flatMap((blob) => blob.getAnimations()).filter((animation) => !(animation instanceof CSSTransition)).length;
    });
    expect(state).toBe(0);
  });
});

test.describe('hold to confirm: drag off, modifiers and touch', () => {
  type Log = { confirms: string[]; moves: { state: string; pressed: boolean }[] };

  // Freezes page time after load, so the 1200ms timer only runs inside `runFor`.
  const open = async (page: Page) => {
    const start = new Date('2026-01-01T00:00:00Z');
    await page.clock.install({ time: start });
    await page.goto('/hold-confirm/');
    await page.clock.pauseAt(new Date(start.getTime() + 60_000));
    const button = page.locator('.hold-button');
    // Both read the button in the same task as the event: the state at confirmation, and the
    // state right after the button's own `pointermove` handler ran.
    await button.evaluate((button: HTMLButtonElement) => {
      const log: Log = { confirms: [], moves: [] };
      (window as unknown as { log: Log }).log = log;
      button.addEventListener('holdconfirm', () => log.confirms.push(button.dataset.state!));
      window.addEventListener('pointermove', () => log.moves.push({ state: button.dataset.state!, pressed: 'pressed' in button.dataset }));
    });
    const box = (await button.boundingBox())!;
    return { button, box, center: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
  };

  const log = (page: Page) => page.evaluate(() => (window as unknown as { log: Log }).log);

  test('dragging off the button cancels the hold', async ({ page }) => {
    const { button, box, center } = await open(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await expect(button).toHaveAttribute('data-state', 'holding');
    await page.mouse.move(box.x + box.width + 60, center.y);
    expect((await log(page)).moves.at(-1)).toEqual({ state: 'idle', pressed: false });
    await page.clock.runFor(1300);
    expect(await button.getAttribute('data-state')).toBe('idle');
    expect((await log(page)).confirms).toEqual([]);
    await page.mouse.up();
    await page.clock.runFor(1300);
    expect((await log(page)).confirms).toEqual([]);
  });

  test('dragging back on restarts from zero and confirms once', async ({ page }) => {
    const { button, box, center } = await open(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.clock.runFor(800);
    await page.mouse.move(box.x + box.width + 60, center.y);
    expect((await log(page)).moves.at(-1)).toEqual({ state: 'idle', pressed: false });
    await page.mouse.move(center.x, center.y);
    expect((await log(page)).moves.at(-1)).toEqual({ state: 'holding', pressed: true });
    // 800ms held before leaving doesn't carry over: the restarted hold needs the full 1200ms.
    await page.clock.runFor(1100);
    expect(await button.getAttribute('data-state')).toBe('holding');
    await page.clock.runFor(200);
    expect((await log(page)).confirms).toEqual(['confirmed']);

    // Still held after the demo resets to idle: sliding off and back on doesn't re-arm.
    await page.clock.runFor(1500);
    expect(await button.getAttribute('data-state')).toBe('idle');
    await page.mouse.move(box.x + box.width + 60, center.y);
    await page.mouse.move(center.x, center.y);
    expect((await log(page)).moves.at(-1)).toEqual({ state: 'idle', pressed: false });
    await page.clock.runFor(1300);
    await page.mouse.up();
    expect((await log(page)).confirms).toEqual(['confirmed']);
  });

  test('scrolling the page cancels the hold', async ({ page }) => {
    const { button, center } = await open(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await expect(button).toHaveAttribute('data-state', 'holding');
    await page.evaluate(() => window.scrollBy({ top: 40, behavior: 'instant' }));
    await expect(button).toHaveAttribute('data-state', 'idle');
    await expect(button).not.toHaveAttribute('data-pressed');
    await page.clock.runFor(1300);
    await page.mouse.up();
    expect((await log(page)).confirms).toEqual([]);
  });

  test('Ctrl+click is left to the browser', async ({ page }) => {
    const { button, center } = await open(page);
    await page.mouse.move(center.x, center.y);
    await page.keyboard.down('Control');
    await page.mouse.down();
    expect(await button.getAttribute('data-state')).toBe('idle');
    expect(await button.getAttribute('data-pressed')).toBeNull();
    // The context menu that macOS opens for Ctrl+click isn't cancelled.
    const prevented = await button.evaluate(
      (button) => !button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ctrlKey: true })),
    );
    expect(prevented).toBe(false);
    await page.clock.runFor(1300);
    await page.mouse.up();
    await page.keyboard.up('Control');
    expect(await button.getAttribute('data-state')).toBe('idle');
    expect((await log(page)).confirms).toEqual([]);
  });
});

test.describe('plucked underline: intent, touch and keyboard blur', () => {
  const links = (page: Page) => page.locator('[data-stage] [data-pluck]');

  test.beforeEach(async ({ page }) => {
    // A paused clock: the touch's quiet timer can't release the string and the 50ms touch window can't run out
    // between steps, however slow the runner is. CSS transitions still run on real time.
    await page.clock.install();
    await page.goto('/plucked-underline/');
    await pauseClock(page);
  });

  test('a link scrolled under a still cursor waits for the mouse to move', async ({ page }) => {
    const link = links(page).first();
    await link.scrollIntoViewIfNeeded();
    // What a page scrolled under a still cursor reports: an enter and a move at the position it last saw.
    const plucked = await link.evaluate((link) => {
      const box = link.getBoundingClientRect();
      const at = { pointerType: 'mouse', clientX: box.left + 12, clientY: box.top + box.height / 2 };
      document.body.dispatchEvent(new PointerEvent('pointermove', { ...at, bubbles: true }));
      link.dispatchEvent(new PointerEvent('pointerenter', at));
      link.dispatchEvent(new PointerEvent('pointermove', { ...at, bubbles: true }));
      return link.hasAttribute('data-plucked');
    });
    expect(plucked).toBe(false);

    const box = (await link.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(link).toHaveAttribute('data-plucked', '');
    // Plucked where the real move crossed the string, not where the scrolled-in enter happened.
    const x = await link.evaluate((link) => parseFloat(link.style.getPropertyValue('--pluck-x')));
    expect(Math.abs(x - 50)).toBeLessThan(5);
  });

  test('a touch that turns into a scroll lets the string go', async ({ page }) => {
    const link = links(page).first();
    const state = await link.evaluate((link) => {
      const box = link.getBoundingClientRect();
      const touch = {
        pointerType: 'touch', pointerId: 2, isPrimary: true, bubbles: true,
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
      };
      link.dispatchEvent(new PointerEvent('pointerdown', touch));
      const plucked = link.hasAttribute('data-plucked');
      link.dispatchEvent(new PointerEvent('pointercancel', touch));
      return { plucked, released: !link.hasAttribute('data-plucked') };
    });
    expect(state).toEqual({ plucked: true, released: true });
    await expect(link).not.toHaveAttribute('data-ringing', '');
  });

  test('a keyboard Tab away closes the underline at once, a pointer leaving still takes 110ms', async ({ page }) => {
    const first = links(page).first();
    // transitionrun fires for every transition that starts, however short, so a missed read can't hide one.
    await first.evaluate((link) => {
      const string = link.querySelector('svg')!;
      const runs: string[] = [];
      (window as unknown as { runs: string[] }).runs = runs;
      string.addEventListener('transitionrun', (event) => {
        if (event.target === string) runs.push(getComputedStyle(string).transitionDuration);
      });
    });
    const runs = () => page.evaluate(() => (window as unknown as { runs: string[] }).runs);

    await first.focus();
    expect(await first.evaluate((link) => link.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Tab');
    // Wherever Tab lands (WebKit may skip links), focus has left the first link.
    await expect(first).not.toBeFocused();
    const state = await first.evaluate((link) => ({
      closing: link.querySelector('svg')!.getAnimations().length,
      transform: getComputedStyle(link.querySelector('path')!).transform,
    }));
    expect(state).toEqual({ closing: 0, transform: 'none' });

    const box = (await first.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(first).toHaveAttribute('data-plucked', '');
    await expect.poll(runs).toHaveLength(1);
    // Left before its first frame advances, the opening has nothing to reverse and no closing transition starts.
    await first.evaluate((link) => link.querySelector('svg')!.getAnimations().forEach((opening) => opening.finish()));
    await page.mouse.move(0, 0);
    // A run left by the Tab would come first.
    await expect.poll(runs).toEqual(['0.14s', '0.11s']);
  });

  test('a mouse enter right after a touch does not pluck again', async ({ page }) => {
    const link = links(page).first();
    // iOS's emulated mouse events, a few pixels off so only the touch window can hold them back.
    const emulatedMouse = (offset: number) =>
      link.evaluate((link, offset) => {
        const box = link.getBoundingClientRect();
        const mouse = { pointerType: 'mouse', clientX: box.left + box.width / 2 + offset, clientY: box.top + box.height / 2 };
        const records = new MutationObserver(() => {});
        records.observe(link, { attributes: true, attributeFilter: ['data-plucked'] });
        link.dispatchEvent(new PointerEvent('pointerenter', mouse));
        link.dispatchEvent(new PointerEvent('pointermove', { ...mouse, bubbles: true }));
        const changes = records.takeRecords().length;
        records.disconnect();
        return changes;
      }, offset);

    await link.evaluate((link) => {
      const box = link.getBoundingClientRect();
      const touch = {
        pointerType: 'touch', pointerId: 3, isPrimary: true, bubbles: true,
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
      };
      link.dispatchEvent(new PointerEvent('pointerdown', touch));
      link.dispatchEvent(new PointerEvent('pointerup', touch));
    });
    await expect(link).toHaveAttribute('data-plucked', '');
    await page.clock.runFor(40);
    expect(await emulatedMouse(4)).toBe(0);

    await page.clock.runFor(20);
    expect(await emulatedMouse(8)).toBeGreaterThan(0);
  });
});

test.describe('tab indicator: list scroll, hover and hit areas', () => {
  // Narrow enough that the four tabs overflow the list, so choosing one can scroll it.
  test.use({ viewport: { width: 360, height: 800 } });

  const component = (page: Page) => page.locator('[data-stage] tab-indicator');

  const open = async (page: Page) => {
    await page.goto('/tab-indicator/');
    const tabIndicator = component(page);
    await expect(tabIndicator).toHaveAttribute('data-ready', '');
    const list = tabIndicator.locator('[data-list]');
    await list.scrollIntoViewIfNeeded();
    const overflow = await list.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeGreaterThan(40);
    return { tabIndicator, list, tabs: tabIndicator.getByRole('tab') };
  };

  // The first tab whose right edge runs past the list's visible area, and a point on the part still showing.
  const cutOff = async (list: Locator, tabs: Locator) => {
    const listBox = (await list.boundingBox())!;
    const boxes = await tabs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
    const index = boxes.findIndex((box) => box.right > listBox.x + listBox.width - 1);
    expect(index).toBeGreaterThan(0);
    const box = boxes[index];
    expect(box.left).toBeLessThan(listBox.x + listBox.width - 12);
    return { index, x: box.left + 6, y: box.top + box.height / 2 };
  };

  test('an arrow key scrolls the list in the same task, with nothing left to smooth', async ({ page }) => {
    const { list, tabs } = await open(page);
    await tabs.first().focus();
    const result = await list.evaluate(async (el: HTMLElement) => {
      const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const before = el.scrollLeft;
      // ArrowLeft on the first tab wraps to the last one, which is cut off at the right edge.
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
      const sameTask = el.scrollLeft;
      await frames();
      const later = el.scrollLeft;
      return { before, sameTask, later, max: el.scrollWidth - el.clientWidth };
    });
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.last()).toBeFocused();
    expect(result.sameTask).toBeGreaterThan(result.before + 10);
    expect(Math.abs(result.sameTask - result.max)).toBeLessThan(1);
    expect(Math.abs(result.later - result.sameTask)).toBeLessThan(0.5);

    const back = await list.evaluate((el: HTMLElement) => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
      return el.scrollLeft;
    });
    expect(back).toBeLessThan(1);
  });

  test('with reduced motion a click scrolls the list in the same task', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { list, tabs } = await open(page);
    const { index } = await cutOff(list, tabs);
    const result = await list.evaluate((el: HTMLElement, i) => {
      const before = el.scrollLeft;
      el.querySelectorAll<HTMLElement>('[data-tab]')[i].click();
      return { before, after: el.scrollLeft };
    }, index);
    expect(result.after).toBeGreaterThan(result.before + 1);
  });

  test('neighboring hit areas leave no dead strip between tabs', async ({ page }) => {
    const { tabs } = await open(page);
    const result = await tabs.evaluateAll((els) => {
      const misses: number[] = [];
      let checked = 0;
      const list = els[0].closest('[data-list]')!.getBoundingClientRect();
      for (let i = 0; i < els.length - 1; i++) {
        const a = els[i].getBoundingClientRect();
        const b = els[i + 1].getBoundingClientRect();
        // Only gaps the list shows clear of its edge fade; it cuts the later tabs off.
        if (b.left + 2 > list.right - 32) continue;
        checked++;
        for (const y of [a.top + a.height / 2, a.top - 3, a.bottom + 3]) {
          for (let x = a.right - 1; x <= b.left + 1; x += 0.25) {
            const hit = document.elementFromPoint(x, y)?.closest('[data-tab]');
            if (hit !== els[i] && hit !== els[i + 1]) misses.push(x);
          }
        }
      }
      return { misses, checked, gap: els[1].getBoundingClientRect().left - els[0].getBoundingClientRect().right };
    });
    expect(result.checked).toBeGreaterThan(0);
    expect(result.gap).toBeGreaterThan(1);
    expect(result.misses).toEqual([]);
  });

  test('a scroll under a still cursor lights no tab until the mouse moves', async ({ page }) => {
    const { tabIndicator, tabs } = await open(page);
    const box = (await tabs.nth(1).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x - 4, y);
    await page.mouse.move(x, y);
    const transparent = 'rgba(0, 0, 0, 0)';
    await expect(tabs.nth(1)).not.toHaveCSS('background-color', transparent);

    await tabs.first().focus();
    await page.keyboard.press('End');
    await expect(tabIndicator).toHaveAttribute('data-scrolling', '');
    const backgrounds = () => tabs.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(await backgrounds()).toEqual(Array(await tabs.count()).fill(transparent));

    await page.mouse.move(x + 3, y);
    await expect(tabIndicator).not.toHaveAttribute('data-scrolling');
    const under = await page.evaluate(({ px, py }) => {
      const tab = document.elementFromPoint(px, py)?.closest('[data-tab]');
      return tab ? getComputedStyle(tab).backgroundColor : null;
    }, { px: x + 3, py: y });
    expect(under).not.toBeNull();
    expect(under).not.toBe(transparent);
  });
});

for (const [slug, selector, scale] of [['text-swap', '.swap', 0.97], ['chevron-morph', '.morph-button', 0.96]] as const) {
  test.describe(`${slug} taps and press`, () => {
    test.use({ hasTouch: true });

    test('a tap keeps the hover state until a tap outside, and other clicks leave it alone', async ({ page }) => {
      await page.goto(`/${slug}/`);
      const button = page.locator('[data-stage]').locator(selector).first();
      await button.tap();
      await expect(button).toHaveAttribute('data-touch-active', '');
      await button.tap();
      await expect(button).toHaveAttribute('data-touch-active', '');
      await page.locator('h1').tap();
      await expect(button).not.toHaveAttribute('data-touch-active');

      // After a touch, so a stale pointer type can't excuse these.
      await button.focus();
      for (const key of ['Enter', 'Space']) await page.keyboard.press(key);
      // Assistive technologies click with detail 0.
      await button.evaluate((element: HTMLButtonElement) => element.click());
      await button.click();
      await expect(button).not.toHaveAttribute('data-touch-active');
    });

    test('holding Space on a focused button shows the press', async ({ page }) => {
      await page.goto(`/${slug}/`);
      const button = page.locator('[data-stage]').locator(selector).first();
      const transform = () => button.evaluate((element) => getComputedStyle(element).transform);
      await button.focus();
      await page.keyboard.down('Space');
      await expect.poll(transform).toBe(`matrix(${scale}, 0, 0, ${scale}, 0, 0)`);
      await page.keyboard.up('Space');
      await expect.poll(transform).toBe('none');
    });
  });
}

test.describe('text swap timing', () => {

  const demoButton = (page: Page) => page.locator('[data-stage] .swap').first();
  const layerTiming = (button: Locator) =>
    button.locator('.swap-layer').evaluateAll((layers) =>
      layers.map((layer) => {
        const style = getComputedStyle(layer);
        return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
      }),
    );
  const nextOpacity = (button: Locator) =>
    button.locator('.swap-next').evaluate((label) => Number(getComputedStyle(label).opacity));

  test('the swap runs 220ms in and 160ms back, and focus stays instant', async ({ page }) => {
    await page.goto('/text-swap/');
    const button = demoButton(page);
    await page.mouse.move(0, 0);
    expect((await layerTiming(button)).map(({ duration }) => duration)).toEqual(['0.16s', '0.16s']);

    await button.hover();
    await expect.poll(async () => (await layerTiming(button)).map(({ duration }) => duration)).toEqual(['0.22s', '0.22s']);
    await expect.poll(() => nextOpacity(button)).toBe(1);

    await page.mouse.move(0, 0);
    await expect.poll(async () => (await layerTiming(button)).map(({ duration }) => duration)).toEqual(['0.16s', '0.16s']);

    await button.focus();
    expect((await layerTiming(button)).map(({ duration }) => duration)).toEqual(['0s', '0s']);
  });

  test('reduced motion crossfades on the ease-out curve without the press', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/text-swap/');
    const button = demoButton(page);
    await button.hover();
    for (const { duration, easing } of await layerTiming(button)) {
      expect(duration).toBe('0.15s');
      expect(easing).not.toBe('linear');
      expect(easing).toBe('cubic-bezier(0.23, 1, 0.32, 1)');
    }
    await expect.poll(() => nextOpacity(button)).toBe(1);

    await button.focus();
    await page.keyboard.down('Space');
    expect(await button.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
    await page.keyboard.up('Space');
  });
});

test.describe('aligned select', () => {
  type Scope = import('@playwright/test').Page;
  const ZONE = 0;
  const THEME = 3;
  const field = (page: Scope, index: number) => page.locator('[data-stage] aligned-select').nth(index);
  const trigger = (page: Scope, index: number) => field(page, index).getByRole('combobox');
  const menu = (page: Scope, index: number) => field(page, index).locator('[data-menu]');
  const options = (page: Scope, index: number) => field(page, index).getByRole('option');
  const expanded = (page: Scope, index: number) => expect(trigger(page, index)).toHaveAttribute('aria-expanded', 'true');
  const closed = (page: Scope, index: number) => expect(trigger(page, index)).toHaveAttribute('aria-expanded', 'false');

  // The menu is placed in window pixels, so the trigger goes to the middle of the window, clear of both edges.
  const open = async (page: Scope, index: number) => {
    await page.goto('/aligned-select/');
    await page.waitForFunction(() => customElements.get('aligned-select'));
    await trigger(page, index).evaluate((el) => new Promise<void>((resolve) => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
  };
  const center = async (locator: import('@playwright/test').Locator) => {
    const box = (await locator.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // How far the selected option's label sits from the trigger's value, on each axis.
  const misalignment = (page: Scope, index: number) => field(page, index).evaluate((el) => {
    const value = el.querySelector('[data-display]')!.getBoundingClientRect();
    const label = el.querySelector('[aria-selected="true"] [data-label]')!.getBoundingClientRect();
    return {
      y: Math.abs(value.top + value.height / 2 - (label.top + label.height / 2)),
      start: Math.abs(getComputedStyle(el).direction === 'rtl' ? value.right - label.right : value.left - label.left),
    };
  });
  const selectedText = async (page: Scope, index: number) => (await field(page, index).locator('[aria-selected="true"]').textContent())!.trim();
  // Counts the change events that reach the document.
  const watchChanges = (page: Scope) => page.evaluate(() => {
    const seen: [string, boolean][] = [];
    (window as unknown as { seen: typeof seen }).seen = seen;
    document.addEventListener('change', (event) => seen.push([(event.target as Element).localName, event.bubbles]));
  });
  const changes = (page: Scope) => page.evaluate(() => (window as unknown as { seen: [string, boolean][] }).seen);

  test('a click opens the menu on the value and leaves it open', async ({ page }) => {
    await open(page, THEME);
    await trigger(page, THEME).click();
    await expanded(page, THEME);
    await expect(menu(page, THEME)).toBeVisible();
    for (const axis of Object.values(await misalignment(page, THEME))) expect(axis).toBeLessThanOrEqual(0.5);
    // The release of the opening press lands on the current option and must not pick it.
    await page.waitForTimeout(300);
    await expanded(page, THEME);
  });

  test('press, drag past 10px and release picks the option, closes, and fires one bubbling change', async ({ page }) => {
    await open(page, THEME);
    await watchChanges(page);
    const start = await center(trigger(page, THEME));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expanded(page, THEME);
    const dark = await center(options(page, THEME).nth(2));
    await page.mouse.move(dark.x, dark.y, { steps: 6 });
    await page.mouse.up();
    await closed(page, THEME);
    await expect(trigger(page, THEME)).toHaveText('Dark');
    expect(await selectedText(page, THEME)).toBe('Dark');
    expect(await changes(page)).toEqual([['aligned-select', true]]);
  });

  test('a release under 10px picks nothing, and one dragged out of the menu closes it', async ({ page }) => {
    await open(page, THEME);
    await watchChanges(page);
    const start = await center(trigger(page, THEME));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 3, start.y + 4, { steps: 3 });
    await page.mouse.up();
    await expanded(page, THEME);
    await expect(trigger(page, THEME)).toHaveText('Light');

    // Nine pixels down is still inside the slop.
    await page.keyboard.press('Escape');
    await closed(page, THEME);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 9, { steps: 3 });
    await page.mouse.up();
    await expanded(page, THEME);
    await expect(trigger(page, THEME)).toHaveText('Light');
    await page.keyboard.press('Escape');
    await closed(page, THEME);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 300, start.y + 20, { steps: 8 });
    await page.mouse.up();
    await closed(page, THEME);
    await expect(trigger(page, THEME)).toHaveText('Light');
    expect(await changes(page)).toEqual([]);
  });

  test('a long list is cut 8px from the window edge and scrolled so the current option stays on the trigger', async ({ page }) => {
    await open(page, ZONE);
    await trigger(page, ZONE).click();
    await expanded(page, ZONE);
    const state = await field(page, ZONE).evaluate((el) => {
      const shell = el.querySelector('[data-menu]')!.getBoundingClientRect();
      const list = el.querySelector<HTMLElement>('[data-list]')!;
      return {
        top: shell.top,
        bottom: document.documentElement.clientHeight - shell.bottom,
        scrolled: list.scrollTop,
        up: getComputedStyle(el.querySelector('[data-arrow="up"]')!).opacity,
        hasUp: el.querySelector('[data-menu]')!.hasAttribute('data-up'),
      };
    });
    expect(Math.abs(state.top - 8)).toBeLessThanOrEqual(0.5);
    expect(state.bottom).toBeGreaterThanOrEqual(7.5);
    expect(state.scrolled).toBeGreaterThan(100);
    expect(state.hasUp).toBe(true);
    expect(state.up).toBe('1');
    expect(await selectedText(page, ZONE)).toBe('Tokyo');
    const { y, start } = await misalignment(page, ZONE);
    expect(y).toBeLessThanOrEqual(1);
    expect(start).toBeLessThanOrEqual(0.5);
  });

  test('a trigger within 20px of the window edge opens below it', async ({ page }) => {
    await open(page, THEME);
    // Waits two frames, so the scroll event of the move has fired before the menu opens.
    // The sticky header would cover the trigger from a pointer, so the keyboard opens it.
    await trigger(page, THEME).evaluate((el) => new Promise<void>((resolve) => {
      scrollBy({ top: el.getBoundingClientRect().top - 10, behavior: 'instant' });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.focus({ preventScroll: true });
        resolve();
      }));
    }));
    expect((await trigger(page, THEME).boundingBox())!.y).toBeLessThan(20);
    await page.keyboard.press('ArrowDown');
    await expanded(page, THEME);
    const { below } = await field(page, THEME).evaluate((el) => ({
      below: el.querySelector('[data-menu]')!.getBoundingClientRect().top - el.querySelector('[data-trigger]')!.getBoundingClientRect().bottom,
    }));
    expect(below).toBeGreaterThanOrEqual(0);
    expect(below).toBeLessThan(12);
  });

  test('the keyboard opens without animation, moves the highlight, and keeps focus on the trigger', async ({ page }) => {
    await open(page, ZONE);
    const box = trigger(page, ZONE);
    const active = async () => (await field(page, ZONE).locator('[data-highlighted]').textContent())!.trim();
    await watchChanges(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await expanded(page, ZONE);
    expect(await menu(page, ZONE).evaluate((el) => el.getAnimations().length)).toBe(0);
    await expect(box).toHaveAttribute('aria-activedescendant', (await options(page, ZONE).nth(24).getAttribute('id'))!);
    expect(await active()).toBe('Tokyo');

    await page.keyboard.press('ArrowDown');
    expect(await active()).toBe('Toronto');
    await page.keyboard.press('ArrowDown');
    expect(await active()).toBe('Toronto');
    await page.keyboard.press('ArrowUp');
    expect(await active()).toBe('Tokyo');
    await page.keyboard.press('Home');
    expect(await active()).toBe('Auckland');
    // The list scrolls to the highlight, and the arrow shows there is more below.
    await expect(menu(page, ZONE)).not.toHaveAttribute('data-up');
    await page.keyboard.press('PageDown');
    expect(await active()).toBe('Johannesburg');
    await page.keyboard.press('PageDown');
    expect(await active()).toBe('Paris');
    await page.keyboard.press('PageUp');
    expect(await active()).toBe('Johannesburg');
    await page.keyboard.press('End');
    expect(await active()).toBe('Toronto');
    await expect(box).toHaveAttribute('aria-activedescendant', (await options(page, ZONE).nth(25).getAttribute('id'))!);
    await expect(box).toBeFocused();
    // The highlighted option is inside the menu, clear of its scroll arrows.
    const clear = await field(page, ZONE).evaluate((el) => {
      const shell = el.querySelector('[data-menu]')!.getBoundingClientRect();
      const row = el.querySelector('[data-highlighted]')!.getBoundingClientRect();
      return row.top >= shell.top && row.bottom <= shell.bottom;
    });
    expect(clear).toBe(true);

    await page.keyboard.press('Enter');
    await closed(page, ZONE);
    await expect(box).toHaveText('Toronto');
    await expect(box).toBeFocused();
    expect(await changes(page)).toEqual([['aligned-select', true]]);
  });

  test('Escape and Tab close the menu without picking, and focus never leaves the trigger', async ({ page }) => {
    await open(page, THEME);
    await watchChanges(page);
    await page.evaluate(() => {
      const keys: string[] = [];
      (window as unknown as { keys: string[] }).keys = keys;
      document.addEventListener('keydown', (event) => keys.push(event.key));
    });
    const box = trigger(page, THEME);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(field(page, THEME).locator('[data-highlighted]')).toHaveText('Dark');
    await expect(box).toBeFocused();
    await page.keyboard.press('Escape');
    await closed(page, THEME);
    await expect(box).toBeFocused();
    await expect(box).toHaveText('Light');

    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await expanded(page, THEME);
    await page.keyboard.press('Tab');
    await closed(page, THEME);
    await expect(box).not.toBeFocused();
    await expect(box).toHaveText('Light');
    expect(await selectedText(page, THEME)).toBe('Light');
    expect(await changes(page)).toEqual([]);
    // Escape closes one layer: the document never sees it.
    expect(await page.evaluate(() => (window as unknown as { keys: string[] }).keys)).not.toContain('Escape');
  });

  test('typing on the closed trigger changes the value, cycles on the same letter, resets after a second, and takes a space', async ({ page }) => {
    await page.clock.install();
    await open(page, ZONE);
    const box = trigger(page, ZONE);
    await watchChanges(page);
    await box.focus();
    await pauseClock(page);
    await expect(box).toHaveText('Tokyo');
    await page.keyboard.press('l');
    await expect(box).toHaveText('Lagos');
    expect(await selectedText(page, ZONE)).toBe('Lagos');
    await closed(page, ZONE);
    await page.keyboard.press('l');
    await expect(box).toHaveText('Lima');
    await page.keyboard.press('l');
    await expect(box).toHaveText('Lisbon');
    // "li" typed together is one search; the same letter alone cycled above.
    await page.clock.runFor(1100);
    await page.keyboard.press('l');
    await page.keyboard.press('o');
    await expect(box).toHaveText('London');
    await page.clock.runFor(1100);
    // The search has reset: "i" is a new search, not "loi".
    await page.keyboard.press('i');
    await expect(box).toHaveText('Istanbul');
    expect((await changes(page)).length).toBe(5);
    await page.clock.runFor(1100);
    for (const key of ['l', 'o', 's', ' ', 'a']) await page.keyboard.press(key);
    await expect(box).toHaveText('Los Angeles');
    await closed(page, ZONE);
    // With the search over, Space opens.
    await page.clock.runFor(1100);
    await page.keyboard.press(' ');
    await expanded(page, ZONE);
  });

  test('typing inside the open menu moves the highlight and Enter picks it', async ({ page }) => {
    await open(page, ZONE);
    const box = trigger(page, ZONE);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('s');
    await expect(field(page, ZONE).locator('[data-highlighted]')).toHaveText('São Paulo');
    await page.keyboard.press('Enter');
    await expect(box).toHaveText('São Paulo');
    await closed(page, ZONE);
  });

  test('with reduced motion the end state is the same and the only animation is a 70ms fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, THEME);
    // Read in the press's own task, after the element's handler: the fade is over within a few frames.
    await page.evaluate(() => addEventListener('pointerdown', () => {
      const [fade] = document.querySelectorAll('[data-menu]')[3].getAnimations();
      document.documentElement.dataset.fade = JSON.stringify(fade && {
        properties: Object.keys(fade.effect!.getKeyframes()[0]).filter((key) => !['offset', 'easing', 'composite', 'computedOffset'].includes(key)),
        duration: fade.effect!.getTiming().duration,
      });
    }, { once: true }));
    await trigger(page, THEME).click();
    await expanded(page, THEME);
    expect(await page.evaluate(() => document.documentElement.dataset.fade)).toBe(JSON.stringify({ properties: ['opacity'], duration: 70 }));
    for (const axis of Object.values(await misalignment(page, THEME))) expect(axis).toBeLessThanOrEqual(0.5);
    await options(page, THEME).nth(2).click();
    await closed(page, THEME);
    await expect(trigger(page, THEME)).toHaveText('Dark');
  });

  test('a press on an option of an open menu, dragged to another and released, picks that one', async ({ page }) => {
    await open(page, THEME);
    await watchChanges(page);
    await trigger(page, THEME).click();
    await expanded(page, THEME);
    await page.waitForTimeout(100);
    const from = await center(options(page, THEME).nth(0));
    const to = await center(options(page, THEME).nth(2));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    await closed(page, THEME);
    await expect(trigger(page, THEME)).toHaveText('Dark');
    expect(await changes(page)).toEqual([['aligned-select', true]]);
  });

  test('a very long label keeps the menu inside a 320px window and ends in an ellipsis', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page, 1);
    const long = 'Benachrichtigungen vollständig deaktivieren und nie wieder anzeigen, auch nicht am Wochenende';
    await field(page, 1).evaluate((el, text) => {
      const option = el.querySelector<HTMLElement>('[aria-selected="true"]')!;
      option.dataset.value = text;
      option.querySelector('[data-label]')!.textContent = text;
      el.querySelector('[data-display]')!.textContent = text;
    }, long);
    await trigger(page, 1).click();
    await expanded(page, 1);
    const state = await field(page, 1).evaluate((el) => {
      const shell = el.querySelector('[data-menu]')!.getBoundingClientRect();
      const label = el.querySelector<HTMLElement>('[aria-selected="true"] [data-label]')!;
      return {
        left: shell.left,
        right: document.documentElement.clientWidth - shell.right,
        ellipsis: getComputedStyle(label).textOverflow,
        cut: label.scrollWidth > label.clientWidth,
      };
    });
    expect(state.left).toBeGreaterThanOrEqual(7.5);
    expect(state.right).toBeGreaterThanOrEqual(7.5);
    expect(state.ellipsis).toBe('ellipsis');
    expect(state.cut).toBe(true);
  });

  test('holding Enter on the closed trigger opens once, and does not pick or close', async ({ page }) => {
    await open(page, THEME);
    await watchChanges(page);
    await trigger(page, THEME).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expanded(page, THEME);
    await expect(trigger(page, THEME)).toHaveText('Light');
    expect(await changes(page)).toEqual([]);
  });

  test('another scroller keeps the menu open, and the page scroll still closes it', async ({ page }) => {
    await open(page, THEME);
    await page.evaluate(() => {
      const scroller = document.createElement('div');
      scroller.id = 'unrelated';
      scroller.style.cssText = 'position:fixed;left:0;bottom:0;width:80px;height:40px;overflow:auto';
      scroller.innerHTML = '<div style="height:400px"></div>';
      document.body.append(scroller);
    });
    await trigger(page, THEME).focus();
    await page.keyboard.press('ArrowDown');
    await expanded(page, THEME);
    await page.locator('#unrelated').evaluate((el) => (el.scrollTop = 50));
    await page.waitForTimeout(200);
    expect(await page.locator('#unrelated').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expanded(page, THEME);
    await page.evaluate(() => scrollBy({ top: 40, behavior: 'instant' }));
    await closed(page, THEME);
  });

  test('a scroll arrow that appears under an idle pointer does not start scrolling, a moving pointer does', async ({ page }) => {
    await open(page, ZONE);
    const box = (await trigger(page, ZONE).boundingBox())!;
    // The aligned menu of a long list is cut at 8px, so its up arrow sits at the top of the window.
    await page.mouse.move(box.x + box.width / 2, 17);
    await trigger(page, ZONE).evaluate((el) => el.focus({ preventScroll: true }));
    await page.keyboard.press('ArrowDown');
    await expanded(page, ZONE);
    const list = field(page, ZONE).locator('[data-list]');
    await expect(menu(page, ZONE)).toHaveAttribute('data-up', '');
    const before = await list.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(400);
    expect(await list.evaluate((el) => el.scrollTop)).toBe(before);
    await page.mouse.move(box.x + box.width / 2 + 3, 17, { steps: 3 });
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeLessThan(before);
  });

  test('focusing a trigger that is out of view scrolls it in and the menu opened at once stays open', async ({ page }) => {
    await open(page, THEME);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await trigger(page, THEME).evaluate((el) => new Promise<void>((resolve) => {
      // focus() scrolls the trigger into view; its scroll event arrives a frame after the menu opened.
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await expanded(page, THEME);
    await page.waitForTimeout(200);
    await expanded(page, THEME);
  });

  test('the keyboard highlight gets a 2px ring, the mouse highlight does not', async ({ page }) => {
    await open(page, THEME);
    const box = trigger(page, THEME);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    const highlighted = field(page, THEME).locator('[data-highlighted]');
    await expect(highlighted).toHaveText('Dark');
    await expect(menu(page, THEME)).toHaveAttribute('data-keyed', '');
    await expect(highlighted).toHaveCSS('outline-width', '2px');
    await expect(highlighted).toHaveCSS('outline-style', 'solid');

    const target = await center(options(page, THEME).nth(0));
    await page.mouse.move(target.x - 5, target.y, { steps: 2 });
    await page.mouse.move(target.x, target.y, { steps: 2 });
    await expect(highlighted).toHaveText('System');
    await expect(menu(page, THEME)).not.toHaveAttribute('data-keyed');
    await expect(highlighted).not.toHaveCSS('outline-style', 'solid');
  });

  // A copy of a demo select inside a form (and a fieldset), under its own name, so the form behavior is tested on
  // markup the page already styles. `setup` runs on the copy before it connects.
  const inForm = async (page: Scope, source: number, name: string, setup = '') => {
    await page.goto('/aligned-select/');
    await page.waitForFunction(() => customElements.get('aligned-select'));
    await page.evaluate(([source, name, setup]) => {
      const copy = document.querySelectorAll('[data-stage] aligned-select')[Number(source)].cloneNode(true) as HTMLElement;
      copy.querySelector(':scope > input')?.remove();
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      copy.setAttribute('name', String(name));
      new Function('copy', String(setup))(copy);
      const form = document.createElement('form');
      form.id = 'form';
      const fieldset = document.createElement('fieldset');
      fieldset.id = 'fieldset';
      fieldset.style.cssText = 'border:0;padding:0;margin:0';
      fieldset.append(copy);
      form.append(fieldset);
      document.body.append(form);
      const log: string[] = [];
      (window as unknown as { log: string[] }).log = log;
      form.addEventListener('input', (event) => log.push(`input:${event.bubbles}:${event.composed}`));
      form.addEventListener('change', () => log.push('change'));
    }, [source, name, setup]);
    // On screen before any focus, whose scroll would close a menu opened at once.
    await page.locator('#form [data-trigger]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(100);
    return page.locator('#form aligned-select');
  };
  const submitted = (page: Scope, name: string) => page.evaluate((name) => new FormData(document.querySelector<HTMLFormElement>('#form')!).get(name), name);
  const eventLog = (page: Scope) => page.evaluate(() => (window as unknown as { log: string[] }).log);

  test('in a form, a pick is submitted, input then change fire once, and a reset restores the first value silently', async ({ page }) => {
    const select = await inForm(page, THEME, 'theme');
    const box = select.getByRole('combobox');
    expect(await submitted(page, 'theme')).toBe('Light');
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(box).toHaveText('Dark');
    expect(await submitted(page, 'theme')).toBe('Dark');
    expect(await eventLog(page)).toEqual(['input:true:true', 'change']);

    // Picking the same option again reports nothing.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await eventLog(page)).toEqual(['input:true:true', 'change']);

    // A cancelled reset changes nothing.
    await page.evaluate(() => {
      const stop = (event: Event) => event.preventDefault();
      document.querySelector('#form')!.addEventListener('reset', stop, { once: true });
      document.querySelector<HTMLFormElement>('#form')!.reset();
    });
    await page.waitForTimeout(100);
    await expect(box).toHaveText('Dark');

    // A reset closes an open menu and restores the value the element started with.
    await page.keyboard.press('ArrowDown');
    await expect(box).toHaveAttribute('aria-expanded', 'true');
    await page.evaluate(() => document.querySelector<HTMLFormElement>('#form')!.reset());
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    await expect(box).toHaveText('Light');
    expect(await submitted(page, 'theme')).toBe('Light');
    expect(await select.locator('[aria-selected="true"]').textContent()).toContain('Light');
    expect(await eventLog(page)).toEqual(['input:true:true', 'change']);
  });

  test('a disabled trigger or fieldset does not open, leaves the value out of the form, and works again when enabled', async ({ page }) => {
    const select = await inForm(page, THEME, 'theme');
    const box = select.getByRole('combobox');
    for (const target of ['trigger', 'fieldset'] as const) {
      const set = (disabled: boolean) =>
        page.evaluate(([target, disabled]) => {
          const element = target === 'trigger' ? document.querySelector<HTMLButtonElement>('#form [data-trigger]')! : document.querySelector<HTMLFieldSetElement>('#fieldset')!;
          element.disabled = Boolean(disabled);
        }, [target, disabled] as const);
      await set(true);
      await expect.poll(() => submitted(page, 'theme')).toBeNull();
      await box.scrollIntoViewIfNeeded();
      const at = await center(box);
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.up();
      await expect(box).toHaveAttribute('aria-expanded', 'false');
      await expect(select.locator('[data-menu]')).toBeHidden();

      await set(false);
      await expect.poll(() => submitted(page, 'theme')).toBe('Light');
      await box.click();
      await expect(box).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(box).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('an open menu closes when its trigger is disabled', async ({ page }) => {
    const select = await inForm(page, THEME, 'theme');
    const box = select.getByRole('combobox');
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await expect(box).toHaveAttribute('aria-expanded', 'true');
    await box.evaluate((el: HTMLButtonElement) => (el.disabled = true));
    await expect(box).toHaveAttribute('aria-expanded', 'false');
  });

  test('an option with a data-value shows its label, is found by its label, and submits its value', async ({ page }) => {
    const select = await inForm(
      page,
      ZONE,
      'zone',
      `[...copy.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === 'Lima').dataset.value = 'America/Lima';`,
    );
    const box = select.getByRole('combobox');
    expect(await submitted(page, 'zone')).toBe('Tokyo');
    await box.focus();
    // "l" cycles through Lagos, then Lima.
    await page.keyboard.press('l');
    await page.keyboard.press('l');
    await expect(box).toHaveText('Lima');
    expect(await submitted(page, 'zone')).toBe('America/Lima');
    expect(await select.evaluate((el) => (el as HTMLElement & { value: string }).value)).toBe('America/Lima');
    expect(await eventLog(page)).toEqual(['input:true:true', 'change', 'input:true:true', 'change']);
  });

  test('moving the element keeps the picked value and its hidden input, and a reset still restores the first one', async ({ page }) => {
    const select = await inForm(page, THEME, 'theme');
    const box = select.getByRole('combobox');
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(box).toHaveText('Dark');

    await page.evaluate(() => {
      const element = document.querySelector('#form aligned-select')!;
      element.remove();
      document.querySelector('#fieldset')!.append(element);
    });
    await expect(box).toHaveText('Dark');
    expect(await submitted(page, 'theme')).toBe('Dark');
    expect(await select.locator(':scope > input[type="hidden"]').count()).toBe(1);
    expect(await select.evaluate((el) => (el as HTMLElement & { value: string }).value)).toBe('Dark');

    await page.evaluate(() => document.querySelector<HTMLFormElement>('#form')!.reset());
    await expect(box).toHaveText('Light');
    expect(await submitted(page, 'theme')).toBe('Light');
  });

  test('right to left, the labels still start where the value does', async ({ page }) => {
    await open(page, THEME);
    await page.evaluate(() => (document.documentElement.dir = 'rtl'));
    for (const index of [THEME, ZONE]) {
      await trigger(page, index).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(100);
      await trigger(page, index).click();
      await expanded(page, index);
      const { y, start } = await misalignment(page, index);
      expect(y).toBeLessThanOrEqual(1);
      expect(start).toBeLessThanOrEqual(0.5);
      await page.keyboard.press('Escape');
      await closed(page, index);
    }
  });
});

test.describe('aligned select on touch', () => {
  test.use({ hasTouch: true });

  test('a tap opens the menu below the trigger, a tap on an option picks it, and a tap outside closes', async ({ page }) => {
    await page.goto('/aligned-select/');
    await page.waitForFunction(() => customElements.get('aligned-select'));
    const select = page.locator('[data-stage] aligned-select').nth(3);
    const box = select.getByRole('combobox');
    await box.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const taps: string[] = [];
      (window as unknown as { taps: string[] }).taps = taps;
      addEventListener('pointerdown', (event) => taps.push(event.pointerType), { capture: true });
    });

    await box.tap();
    await expect(box).toHaveAttribute('aria-expanded', 'true');
    const gap = await select.evaluate((el) => el.querySelector('[data-menu]')!.getBoundingClientRect().top - el.querySelector('[data-trigger]')!.getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(12);

    await select.getByRole('option', { name: 'Dark' }).tap();
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    await expect(box).toHaveText('Dark');

    await box.tap();
    await expect(box).toHaveAttribute('aria-expanded', 'true');
    // A visible row label, so the page doesn't scroll, which would close the menu by itself.
    await page.locator('[data-stage] li').first().locator('span').first().tap();
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    await expect(box).toHaveText('Dark');
    expect(await page.evaluate(() => (window as unknown as { taps: string[] }).taps.every((type) => type === 'touch'))).toBe(true);
  });
});
