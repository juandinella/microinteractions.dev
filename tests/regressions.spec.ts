import { expect, test, type Locator, type Page } from '@playwright/test';

const slugs = ['text-swap', 'chevron-morph', 'hold-confirm', 'edge-aware-tooltip', 'plucked-underline', 'gooey-radio-group', 'tab-indicator'];
const scripted = ['hold-confirm', 'edge-aware-tooltip', 'plucked-underline', 'gooey-radio-group', 'tab-indicator'];

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

for (const width of [320, 375, 780, 1280]) {
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

// One test per study, so each gets its own timeout and they run in parallel.
for (const slug of slugs) {
  test(`${slug}: copied CSS omits gallery state and scripts are valid JavaScript`, async ({ page }) => {
    await page.goto(`/${slug}/`);
    for (const format of ['css', 'tailwind']) {
      await page.locator(`[data-source-format][value="${format}"]`).check();
      const variant = page.locator(`[data-source-variant="${format}"]`);
      await variant.getByRole('tab', { name: 'CSS', exact: true }).click();
      const css = await variant.getByRole('tabpanel', { name: 'CSS', exact: true }).locator('code').textContent();
      expect(css, format).not.toMatch(/data-(?:inspect|touch-active)/);
      if (scripted.includes(slug)) {
        await variant.getByRole('tab', { name: 'JavaScript', exact: true }).click();
        const script = await variant.getByRole('tabpanel', { name: 'JavaScript', exact: true }).locator('code').textContent();
        expect(() => new Function(script!)).not.toThrow();
      }
    }
  });
}

test('copied hold and slider implementations work outside the gallery', async ({ page, browser }) => {
  for (const slug of ['hold-confirm', 'edge-aware-tooltip']) {
    await page.goto(`/${slug}/`);
    await page.locator('[data-source-format][value="css"]').check();
    const variant = page.locator('[data-source-variant="css"]');
    const code: Record<string, string> = {};
    for (const language of ['HTML', 'CSS', 'JavaScript']) {
      await variant.getByRole('tab', { name: language, exact: true }).click();
      code[language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
    }
    const standalone = await browser.newPage();
    const errors: string[] = [];
    standalone.on('pageerror', (error) => errors.push(error.message));
    // Copied code usually lands inside a form; the hold also sits in a fieldset that can disable it.
    await standalone.setContent(`<style>${code.CSS}</style><form><fieldset>${code.HTML}</fieldset></form>`);
    await standalone.locator('form').evaluate((form) => {
      (window as unknown as { submits: number }).submits = 0;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        (window as unknown as { submits: number }).submits++;
      });
    });
    await standalone.addScriptTag({ content: code.JavaScript });
    if (slug === 'hold-confirm') {
      const button = standalone.getByRole('button', { name: 'Hold to confirm', exact: true });
      // Pointer events still reach a disabled button, so a full hold must not confirm it,
      // whether the button or its fieldset is disabled.
      for (const target of ['button', 'fieldset']) {
        await standalone.locator('form').evaluate((form, selector) => (form.querySelector<HTMLButtonElement>(selector)!.disabled = true), target);
        const box = (await button.boundingBox())!;
        await standalone.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await standalone.mouse.down();
        await standalone.waitForTimeout(1300);
        // Read once: a confirmed button returns to idle on its own after 1400ms.
        expect(await button.getAttribute('data-state'), target).toBe('idle');
        await standalone.mouse.up();
        await standalone.locator('form').evaluate((form, selector) => (form.querySelector<HTMLButtonElement>(selector)!.disabled = false), target);
      }
      await button.focus();
      await standalone.keyboard.down('Space');
      await expect(button).toHaveAttribute('data-state', 'holding');
      await expect(standalone.locator('.hold-waiting').first()).toBeVisible();
      await standalone.keyboard.press('Escape');
      await standalone.keyboard.up('Space');
      await expect(button).toHaveAttribute('data-state', 'idle');
      await standalone.keyboard.down('Enter');
      await expect(button).toHaveAttribute('data-state', 'confirmed');
      await standalone.keyboard.up('Enter');
      await expect(standalone.locator('.hold-layer-done')).toHaveCSS('opacity', '1');
      await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 3_000 });
      await button.evaluate((element: HTMLButtonElement) => element.click());
      const dialog = standalone.getByRole('dialog', { name: 'Confirm this action' });
      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(button).toHaveAttribute('data-state', 'confirmed');
      await expect(dialog).toBeHidden();
      expect(await standalone.evaluate(() => (window as unknown as { submits: number }).submits)).toBe(0);
    } else {
      const slider = standalone.locator('[data-position-input]');
      for (const key of ['Home', 'End']) {
        await slider.focus();
        await standalone.keyboard.press(key);
        await expect(standalone.locator('[data-volume]')).toHaveText(key === 'Home' ? '0' : '100');
        const contained = await standalone.locator('.value-tooltip').evaluate((tooltip) => {
          const container = tooltip.closest('.slider-card')!.getBoundingClientRect();
          const rect = tooltip.getBoundingClientRect();
          return rect.left >= container.left && rect.right <= container.right;
        });
        expect(contained).toBe(true);
      }
      // A form reset restores the value without an input event; the tooltip and fill follow it.
      await standalone.locator('form').evaluate((form: HTMLFormElement) => form.reset());
      await expect(standalone.locator('[data-volume]')).toHaveText('50');
      await expect(slider).toHaveAttribute('aria-valuetext', '50 percent');
      expect(await standalone.locator('edge-aware-tooltip').evaluate((field) => field.style.getPropertyValue('--value'))).toBe('0.5');
    }
    expect(errors).toEqual([]);
    await standalone.close();
  }
});

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

  test('losing keyboard focus closes the underline at once', async ({ page }) => {
    await page.goto('/plucked-underline/');
    const link = page.locator('[data-stage] [data-pluck]').first();
    await link.focus();
    const state = await link.evaluate((link) => {
      link.blur();
      return {
        closing: link.querySelector('svg')!.getAnimations().length,
        transform: getComputedStyle(link.querySelector('path')!).transform,
      };
    });
    expect(state).toEqual({ closing: 0, transform: 'none' });
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

  test('the copied implementation works outside the gallery', async ({ page, browser }) => {
    await page.goto('/plucked-underline/');
    await page.locator('[data-source-format][value="css"]').check();
    const variant = page.locator('[data-source-variant="css"]');
    const code: Record<string, string> = {};
    for (const language of ['HTML', 'CSS', 'JavaScript']) {
      await variant.getByRole('tab', { name: language, exact: true }).click();
      code[language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
    }
    expect(code.JavaScript).not.toContain('preventDefault');
    const standalone = await browser.newPage();
    const errors: string[] = [];
    standalone.on('pageerror', (error) => errors.push(error.message));
    await standalone.setContent(`<style>${code.CSS}</style>${code.HTML}`);
    await standalone.addScriptTag({ content: code.JavaScript });
    const links = standalone.locator('[data-pluck]');
    await expect.poll(() => links.last().evaluate((link) => (link as HTMLElement).style.getPropertyValue('--pluck-duration'))).toMatch(/^\d+ms$/);
    await links.last().hover();
    await expect(links.last()).toHaveAttribute('data-plucked', '');
    await expect.poll(() => links.last().locator('path').evaluate((path) => getComputedStyle(path).transform)).toBe('matrix(1, 0, 0, 0.001, 0, 0)');
    await standalone.mouse.move(0, 0);
    await expect(links.last()).not.toHaveAttribute('data-plucked', '');
    expect(errors).toEqual([]);
    await standalone.close();
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
    await stage.getByText('Pickup').click();
    await expect(stage.getByRole('radio', { name: 'Pickup' })).toBeChecked();
    expect(await blobAnimations(stage)).toBe(8);
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

  test('each label changes with its ring, and hover darkens only unchecked rings', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    const timing = (option: string) =>
      stage.locator('.goo-option', { hasText: option }).evaluate((label) => {
        const ring = label.querySelector('.goo-ring')!;
        return [getComputedStyle(label).transitionDelay, getComputedStyle(ring).transitionDelay];
      });
    expect(await timing('Standard')).toEqual(['0.225s', '0.225s']);
    expect(await timing('Express')).toEqual(['0.1s', '0.1s']);
    const hoverRing = (option: string) =>
      stage.locator('.goo-option', { hasText: option }).locator('.goo-ring').evaluate((ring) => getComputedStyle(ring, '::after').opacity);
    await stage.getByText('Express').hover();
    await expect.poll(() => hoverRing('Express')).toBe('1');
    await stage.getByText('Standard').hover();
    await expect.poll(() => hoverRing('Express')).toBe('0');
    expect(await hoverRing('Standard')).toBe('0');
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

  test('copied groups get their own filters, start empty, and ignore other inputs', async ({ page, browser }) => {
    await page.goto('/gooey-radio-group/');
    await page.locator('[data-source-format][value="css"]').check();
    const variant = page.locator('[data-source-variant="css"]');
    const code: Record<string, string> = {};
    for (const language of ['HTML', 'CSS', 'JavaScript']) {
      await variant.getByRole('tab', { name: language, exact: true }).click();
      code[language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
    }
    const standalone = await browser.newPage();
    const errors: string[] = [];
    standalone.on('pageerror', (error) => errors.push(error.message));
    const empty = code.HTML.replaceAll('name="delivery"', 'name="pace"').replace(' checked', '')
      .replace('</label>', '</label><input type="checkbox" aria-label="Unrelated" />');
    await standalone.setContent(`<style>${code.CSS}</style>${code.HTML}${empty}`);
    await standalone.addScriptTag({ content: code.JavaScript });
    const [first, second] = [standalone.locator('.goo-group').first(), standalone.locator('.goo-group').last()];
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
    await standalone.close();
  });

  test('the copied implementation works outside the gallery', async ({ page, browser }) => {
    await page.goto('/gooey-radio-group/');
    await page.locator('[data-source-format][value="css"]').check();
    const variant = page.locator('[data-source-variant="css"]');
    const code: Record<string, string> = {};
    for (const language of ['HTML', 'CSS', 'JavaScript']) {
      await variant.getByRole('tab', { name: language, exact: true }).click();
      code[language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
    }
    expect(code.JavaScript).not.toContain('specimen-inspect');
    const standalone = await browser.newPage();
    const errors: string[] = [];
    standalone.on('pageerror', (error) => errors.push(error.message));
    await standalone.setContent(`<style>${code.CSS}</style><form>${code.HTML}</form>`);
    await standalone.addScriptTag({ content: code.JavaScript });
    const group = standalone.locator('.goo-group');
    expect(await standalone.locator('.goo-drop').evaluate((el) => getComputedStyle(el).filter)).toBe('url("#goo-merge-1")');
    await standalone.keyboard.press('Tab');
    await standalone.keyboard.press('ArrowDown');
    await expect(standalone.getByRole('radio', { name: 'Express' })).toBeChecked();
    expect(await blobAnimations(group)).toBe(0);
    await expect(standalone.locator('.goo-option', { hasText: 'Express' })).toHaveCSS('outline-style', 'solid');
    await standalone.getByText('Next day').click();
    expect(await blobAnimations(group)).toBe(8);
    await expect.poll(() => headY(standalone)).toBe(88);
    await expect(standalone.locator('.goo-option', { hasText: 'Next day' })).toHaveCSS('outline-style', 'none');
    // A form reset restores the default without a change event; the next pour starts from it.
    await standalone.locator('form').evaluate((form: HTMLFormElement) => form.reset());
    await expect(standalone.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await expect.poll(() => headY(standalone)).toBe(0);
    await standalone.getByText('Express').click();
    const start = await standalone.locator('[data-goo-blob]').last().evaluate(
      (head) => head.getAnimations()[0].effect!.getKeyframes()[0].transform as string,
    );
    expect(start).toMatch(/^translateY\(0px\)/);
    expect(errors).toEqual([]);
    await standalone.close();
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

  test('Escape puts every row back and reports no change', async ({ page }) => {
    await page.goto('/drag-select/');
    await listen(page);
    await press(page, 0, [3]);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await checked(page)).toEqual(Array(10).fill(false));
    expect((await log(page)).change).toBe(0);
    await expect(page.locator('[data-count]')).toHaveText('0 of 10');
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

  test('the copied implementations work outside the gallery', async ({ page, browser }) => {
    await page.goto('/drag-select/');
    for (const format of ['css', 'tailwind']) {
      await page.locator(`[data-source-format][value="${format}"]`).check();
      const variant = page.locator(`[data-source-variant="${format}"]`);
      const code: Record<string, string> = {};
      for (const language of ['HTML', 'CSS', 'JavaScript']) {
        await variant.getByRole('tab', { name: language, exact: true }).click();
        code[language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
      }
      expect(code.CSS, format).not.toMatch(/data-(?:inspect|trace)/);
      const standalone = await browser.newPage();
      const errors: string[] = [];
      standalone.on('pageerror', (error) => errors.push(error.message));
      await standalone.setContent(`<style>${code.CSS}</style><form>${code.HTML}</form>`);
      await standalone.addScriptTag({ content: code.JavaScript });
      await press(standalone, 0, [2]);
      await standalone.mouse.up();
      expect((await checked(standalone)).slice(0, 4), format).toEqual([true, true, true, false]);
      await expect(standalone.locator('[data-count]'), format).toHaveText('3 of 10');
      // A form reset clears the boxes without change events; the rows and count follow them.
      await standalone.locator('form').evaluate((form: HTMLFormElement) => form.reset());
      await expect(standalone.locator('[data-count]'), format).toHaveText('0 of 10');
      await expect(standalone.locator('tr[data-selected]'), format).toHaveCount(0);
      expect(errors, format).toEqual([]);
      await standalone.close();
    }
  });
});

test.describe('resize handle', () => {
  type Scope = import('@playwright/test').Page;
  const handle = (page: Scope) => page.getByRole('separator', { name: 'Resize sidebar' });
  const width = (page: Scope) => handle(page).getAttribute('aria-valuenow');
  const start = async (page: Scope, y = 60) => {
    const box = (await handle(page).boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + y };
    await page.mouse.move(point.x, point.y);
    return point;
  };

  test('a drag follows the pointer, and Escape puts the sidebar back', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await expect(handle(page)).toHaveAttribute('data-state', 'hover');
    await page.mouse.down();
    // The first 2px cross the drag threshold; the width follows from there.
    await page.mouse.move(point.x + 2, point.y);
    await page.mouse.move(point.x + 42, point.y + 30, { steps: 4 });
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

  // Chromium delivers the fraction to pointermove; WebKit rounds it, so there this only checks the plain case.
  test('a fractional drag lands on a whole pixel', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await page.mouse.down();
    await page.mouse.move(point.x + 2, point.y);
    await page.mouse.move(point.x + 22.4, point.y, { steps: 3 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '180');
    await page.mouse.up();
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

  test('the arrows stop at the minimum instead of collapsing', async ({ page }) => {
    await page.goto('/resize-handle/');
    await handle(page).focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '120');
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

  test('the copied implementations work outside the gallery', async ({ page, browser }) => {
    await page.goto('/resize-handle/');
    const code: Record<string, Record<string, string>> = {};
    for (const format of ['css', 'tailwind']) {
      await page.locator(`[data-source-format][value="${format}"]`).check();
      const variant = page.locator(`[data-source-variant="${format}"]`);
      code[format] = {};
      for (const language of ['HTML', 'CSS', 'JavaScript']) {
        await variant.getByRole('tab', { name: language, exact: true }).click();
        code[format][language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
      }
    }
    // The Tailwind version needs Tailwind to lay out, so it is checked for the hooks the shared script uses.
    expect(code.tailwind.JavaScript).toBe(code.css.JavaScript);
    for (const hook of ['data-side', 'data-handle', 'data-grip', 'role="separator"']) expect(code.tailwind.HTML).toContain(hook);

    const standalone = await browser.newPage();
    const errors: string[] = [];
    standalone.on('pageerror', (error) => errors.push(error.message));
    await standalone.setContent(`<style>${code.css.CSS}</style>${code.css.HTML}`);
    await standalone.addScriptTag({ content: code.css.JavaScript });
    const point = await start(standalone);
    await standalone.mouse.down();
    await standalone.mouse.move(point.x + 2, point.y);
    await standalone.mouse.move(point.x + 42, point.y, { steps: 4 });
    await standalone.mouse.up();
    await expect(handle(standalone)).toHaveAttribute('aria-valuenow', '200');
    expect(errors).toEqual([]);
    await standalone.close();
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

  test('the Tailwind version shares the script and its hooks', async ({ page }) => {
    await page.goto('/tab-indicator/');
    const code: Record<string, Record<string, string>> = {};
    for (const format of ['css', 'tailwind']) {
      await page.locator(`[data-source-format][value="${format}"]`).check();
      const variant = page.locator(`[data-source-variant="${format}"]`);
      code[format] = {};
      for (const language of ['HTML', 'JavaScript']) {
        await variant.getByRole('tab', { name: language, exact: true }).click();
        code[format][language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
      }
    }
    expect(code.tailwind.JavaScript).toBe(code.css.JavaScript);
    for (const hook of ['data-list', 'data-tab', 'data-panel', 'data-line', 'role="tablist"']) expect(code.tailwind.HTML).toContain(hook);
    expect(code.css.HTML).not.toContain('data-trace-progress');
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

  test('both versions share a valid script and its hooks', async ({ page }) => {
    await page.goto('/worm-dots/');
    const code: Record<string, Record<string, string>> = {};
    for (const format of ['css', 'tailwind']) {
      await page.locator(`[data-source-format][value="${format}"]`).check();
      const variant = page.locator(`[data-source-variant="${format}"]`);
      code[format] = {};
      for (const language of ['HTML', 'CSS', 'JavaScript']) {
        await variant.getByRole('tab', { name: language, exact: true }).click();
        code[format][language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
      }
      expect(code[format].CSS, format).not.toMatch(/data-(?:inspect|touch-active)/);
    }
    expect(() => new Function(code.css.JavaScript)).not.toThrow();
    expect(code.tailwind.JavaScript).toBe(code.css.JavaScript);
    for (const hook of ['data-track', 'data-slide', 'data-strip', 'data-ring', 'data-worm', 'data-dot', 'data-counter', 'data-status', 'group-data-scrubbing/wd', 'data-pressed:', 'data-visible:']) {
      expect(code.tailwind.HTML).toContain(hook);
    }
    for (const size of ['--wd-dot', '--wd-pill', '--wd-gap', '--wd-ring']) expect(code.tailwind.CSS).toContain(`@property ${size}`);
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
    // A frozen clock: the second move happens while the rows are still moving, however slow the runner is.
    await page.clock.install();
    await page.goto('/drag-reorder/');
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

  test('arrow keys move focus, Enter opens, and reduced motion skips the move', async ({ page }) => {
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
    // Nothing moves; only the new answer's 150ms fade runs, and the faq panel tests cover it.
    expect(await faq.evaluate((el) => [el, el.querySelector('[data-panel]')!, ...el.querySelectorAll('[data-answer]')].flatMap((node) => node.getAnimations()).length)).toBe(0);
    expect(await offset(faq)).toBeLessThan(0.5);
  });

  test('the Tailwind version shares the script and its hooks', async ({ page }) => {
    await page.goto('/faq-panel/');
    const code: Record<string, Record<string, string>> = {};
    for (const format of ['css', 'tailwind']) {
      await page.locator(`[data-source-format][value="${format}"]`).check();
      const variant = page.locator(`[data-source-variant="${format}"]`);
      code[format] = {};
      for (const language of ['HTML', 'JavaScript']) {
        await variant.getByRole('tab', { name: language, exact: true }).click();
        code[format][language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
      }
    }
    expect(code.tailwind.JavaScript).toBe(code.css.JavaScript);
    for (const hook of ['data-panel', 'data-item', 'data-trigger', 'data-answer', 'hidden="until-found"']) expect(code.tailwind.HTML).toContain(hook);
    expect(code.css.HTML).not.toContain('data-trace-progress');
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
  // Synthetic mouse events on the rail, timed in the page, so a slow runner can't stretch the delays.
  const showsAfter = (rail: import('@playwright/test').Locator, index: number) => rail.evaluate((el, index) => new Promise<number>((resolve) => {
    const card = el.querySelector('[data-card]')!;
    const tick = el.querySelectorAll('[data-tick]')[index].getBoundingClientRect();
    const start = performance.now();
    new MutationObserver((_, observer) => {
      if (!card.hasAttribute('data-showing')) return;
      observer.disconnect();
      resolve(performance.now() - start);
    }).observe(card, { attributes: true, attributeFilter: ['data-showing'] });
    el.querySelector('[data-rail]')!.dispatchEvent(new PointerEvent('pointermove', {
      pointerType: 'mouse', clientX: tick.left + 20, clientY: tick.top + tick.height / 2, bubbles: true,
    }));
  }), index);

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
    await page.goto('/tick-rail/');
    const rail = component(page);
    const card = rail.locator('[data-card]');
    expect(await showsAfter(rail, 2)).toBeGreaterThanOrEqual(70);
    await expect(title(rail)).toHaveText('Usage');
    await expect.poll(() => offset(rail, 2)).toBeLessThan(1);

    const ticks = rail.locator('[data-tick]');
    const box = (await ticks.nth(5).boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await expect(title(rail)).toHaveText('Touch');
    await expect.poll(() => offset(rail, 5)).toBeLessThan(1);

    await page.mouse.move(box.x + 400, box.y + 200);
    await expect(card).not.toHaveAttribute('data-showing');
    expect(await showsAfter(rail, 1)).toBeLessThan(40);
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

  test('with reduced motion, nothing transitions but the card still opens', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tick-rail/');
    const rail = component(page);
    const transitions = await rail.evaluate((el) =>
      [el.querySelector('[data-line]')!, el.querySelector('[data-card]')!].map((node) => getComputedStyle(node).transitionDuration),
    );
    // The site's reduced-motion reset shortens every transition to a microsecond.
    for (const duration of transitions) expect(parseFloat(duration)).toBeLessThan(0.001);
    expect(await showsAfter(rail, 4)).toBeGreaterThanOrEqual(70);
    await expect(title(rail)).toHaveText('Keyboard');
    expect(await offset(rail, 4)).toBeLessThan(1);
  });

  test('the Tailwind version shares the script and its hooks', async ({ page }) => {
    await page.goto('/tick-rail/');
    const code: Record<string, Record<string, string>> = {};
    for (const format of ['css', 'tailwind']) {
      await page.locator(`[data-source-format][value="${format}"]`).check();
      const variant = page.locator(`[data-source-variant="${format}"]`);
      code[format] = {};
      for (const language of ['HTML', 'JavaScript']) {
        await variant.getByRole('tab', { name: language, exact: true }).click();
        code[format][language] = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
      }
    }
    expect(code.tailwind.JavaScript).toBe(code.css.JavaScript);
    for (const hook of ['data-rail', 'data-tick', 'data-line', 'data-scroll', 'data-card', 'data-card-box', 'data-card-template', 'data-face-title', 'data-face-text']) {
      expect(code.tailwind.HTML).toContain(hook);
    }
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

test.describe('drag select: edges, keys and the header target', () => {
  type Scope = import('@playwright/test').Page;
  const boxes = (page: Scope) => page.locator('drag-select-table tbody input');
  const checked = (page: Scope) => boxes(page).evaluateAll((inputs: HTMLInputElement[]) => inputs.map((input) => input.checked));
  const center = async (page: Scope, index: number) => {
    const box = (await boxes(page).nth(index).locator('xpath=..').boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const press = async (page: Scope, from: number, to: number[]) => {
    const start = await center(page, from);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const index of to) {
      const point = await center(page, index);
      await page.mouse.move(point.x, point.y, { steps: 4 });
    }
  };
  const scrollTop = (page: Scope) => page.locator('drag-select-table [data-scroll]').evaluate((scroller) => scroller.scrollTop);

  test.use({ reducedMotion: 'no-preference' });

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

    await press(page, 0, [3]);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await escapes()).toEqual([]);
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

test.describe('gooey radio group timing and ring color', () => {
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

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the dot jumps, and ring and label still change color over 140ms without waiting', async ({ page }) => {
      await page.goto('/gooey-radio-group/');
      const stage = page.locator('[data-stage]');
      const timing = await stage.locator('gooey-radio-group').evaluate((group) => {
        const read = (value: string) => {
          const label = group.querySelector(`input[value="${value}"]`)!.closest('label')!;
          const ring = label.querySelector('.goo-ring')!;
          const [labelStyle, ringStyle] = [getComputedStyle(label), getComputedStyle(ring)];
          return {
            label: [labelStyle.transitionProperty, labelStyle.transitionDuration, labelStyle.transitionDelay],
            ring: [ringStyle.transitionProperty, ringStyle.transitionDuration, ringStyle.transitionDelay],
            overlay: getComputedStyle(ring, '::after').transitionDelay,
          };
        };
        const input = group.querySelector<HTMLInputElement>('input[value="pickup"]')!;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // Only the scripted drop counts: WebKit also lists the site reset's 0.001ms CSS transitions.
        const animations = [...group.querySelectorAll('[data-goo-blob]')]
          .flatMap((blob) => blob.getAnimations())
          .filter((animation) => !(animation instanceof CSSTransition)).length;
        return { checked: read('pickup'), unchecked: read('standard'), animations };
      });
      expect(timing.animations).toBe(0);
      expect(timing.checked.label).toEqual(['color', '0.14s', '0s']);
      expect(timing.checked.ring).toEqual(['border-color', '0.14s', '0s']);
      expect(timing.checked.overlay).toBe('0s');
      expect(timing.unchecked.label).toEqual(['color', '0.14s', '0s']);
      expect(timing.unchecked.ring).toEqual(['border-color', '0.14s', '0s']);
      await expect.poll(() =>
        stage.locator('[data-goo-blob]').last().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42),
      ).toBe(132);
    });
  });

  for (const [scheme, color] of [['light', 'oklch(0.62 0.01 258.74)'], ['dark', 'oklch(0.54 0.014 258.74)']] as const) {
    test.describe(`in ${scheme} mode`, () => {
      test.use({ colorScheme: scheme });

      test('the unchecked ring keeps 3:1, apart from the hover ring and the ink', async ({ page }) => {
        await page.goto('/gooey-radio-group/');
        const stage = page.locator('[data-stage]');
        const colors = await stage.locator('gooey-radio-group').evaluate((group, expected) => {
          // Each browser serializes oklch its own way, so compare against a probe it resolved itself.
          const probe = document.createElement('span');
          probe.style.border = `2px solid ${expected}`;
          group.append(probe);
          const want = getComputedStyle(probe).borderTopColor;
          probe.remove();
          const ring = (value: string) => group.querySelector(`input[value="${value}"]`)!.closest('label')!.querySelector('.goo-ring')!;
          return {
            want,
            unchecked: getComputedStyle(ring('express')).borderTopColor,
            hover: getComputedStyle(ring('express'), '::after').borderTopColor,
            checked: getComputedStyle(ring('standard')).borderTopColor,
          };
        }, color);
        expect(colors.unchecked).toBe(colors.want);
        expect(new Set([colors.unchecked, colors.hover, colors.checked]).size).toBe(3);
      });
    });
  }
});

test.describe('resize handle: threshold, give and hover', () => {
  type Scope = import('@playwright/test').Page;
  const handle = (page: Scope) => page.getByRole('separator', { name: 'Resize sidebar' });
  const sidebar = (page: Scope) => page.locator('resizable-sidebar');
  // The width on screen, which the script writes on every frame; aria-valuenow is the width the drag asks for.
  const shown = (page: Scope) => sidebar(page).evaluate((element: HTMLElement) => element.style.getPropertyValue('--rsb-width'));
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
  // Records the width on screen from the pointerup handler on, one sample a frame, for 400ms.
  const sampleRelease = (page: Scope) =>
    page.evaluate(() => {
      const element = document.querySelector<HTMLElement>('resizable-sidebar')!;
      const read = () => parseFloat(element.style.getPropertyValue('--rsb-width'));
      const samples: { t: number; width: number }[] = [];
      (window as any).__release = samples;
      // The window listener runs after the handle's, in the same task as the release.
      window.addEventListener(
        'pointerup',
        () => {
          const t0 = performance.now();
          samples.push({ t: 0, width: read() });
          const tick = () => {
            const t = performance.now() - t0;
            samples.push({ t, width: read() });
            if (t < 400) requestAnimationFrame(tick);
            else (window as any).__releaseDone = true;
          };
          requestAnimationFrame(tick);
        },
        { once: true },
      );
    });

  test('a vertical swipe on the divider is left to the page', async ({ page }) => {
    await page.goto('/resize-handle/');
    await expect(handle(page)).toHaveCSS('touch-action', 'pan-y');
  });

  test('a mouse press resizes only past 2px of travel, from where it crossed', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await page.mouse.down();
    await expect(handle(page)).toHaveAttribute('data-state', 'drag');
    await page.mouse.move(point.x + 1, point.y);
    expect(await handle(page).getAttribute('aria-valuenow')).toBe('160');
    expect(await shown(page)).toBe('160px');
    // Through +2, where the drag starts and is anchored, to +3: one pixel of resize.
    await page.mouse.move(point.x + 3, point.y, { steps: 2 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '161');
    await page.mouse.up();
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('below the minimum the edge gives while the width stays, and snaps back on release', async ({ page }) => {
      await page.goto('/resize-handle/');
      const point = await start(page);
      await grab(page, point);
      // 60px left of the anchor: a proposed width of 100, inside the 60 to 120 zone.
      await page.mouse.move(point.x - 62, point.y, { steps: 10 });
      await expect(handle(page)).toHaveAttribute('aria-valuenow', '120');
      await expect(handle(page)).toHaveAttribute('aria-valuetext', '120 pixels');
      expect(await shown(page)).toBe('110px');
      expect((await page.locator('[data-side]').boundingBox())!.width).toBeCloseTo(110, 0);

      await sampleRelease(page);
      await page.mouse.up();
      await page.waitForFunction(() => (window as any).__releaseDone === true);
      const raw: { t: number; width: number }[] = await page.evaluate(() => (window as any).__release);
      // Measured boxes carry sub-pixel noise (110.0000006); a tenth of a pixel is far below anything visible.
      const samples = raw.map(({ t, width }) => ({ t, width: Math.round(width * 10) / 10 }));
      expect(samples[0].width).toBe(110);
      // The return runs on the 240ms snap: it passes through the widths between, never back, and lands on 120.
      for (let i = 1; i < samples.length; i++) expect(samples[i].width).toBeGreaterThanOrEqual(samples[i - 1].width);
      expect(samples.some(({ width }) => width > 110 && width < 120)).toBe(true);
      // Not instant: the drawer curve is still more than half a pixel short of 120 after 100ms.
      const near = samples.find(({ width }) => width >= 119.5)!;
      expect(near.t).toBeGreaterThanOrEqual(100);
      expect(samples.at(-1)!.width).toBe(120);

      // The release committed the minimum, not the edge on screen.
      await expect(handle(page)).toHaveAttribute('aria-valuenow', '120');
      await handle(page).focus();
      await page.keyboard.press('ArrowRight');
      await expect(handle(page)).toHaveAttribute('aria-valuenow', '132');
    });

    test('the give grows toward the collapse and the collapse starts from it', async ({ page }) => {
      await page.goto('/resize-handle/');
      const point = await start(page);
      await grab(page, point);
      // Proposed 61: the deepest give before the collapse.
      await page.mouse.move(point.x - 101, point.y, { steps: 10 });
      await expect(handle(page)).toHaveAttribute('aria-valuenow', '120');
      expect(await shown(page)).toBe('94px');
      await page.mouse.move(point.x - 104, point.y);
      await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
      await page.mouse.up();
    });
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the give still follows the pointer and returns at once', async ({ page }) => {
      await page.goto('/resize-handle/');
      const point = await start(page);
      await grab(page, point);
      await page.mouse.move(point.x - 62, point.y, { steps: 10 });
      expect(await shown(page)).toBe('110px');
      await sampleRelease(page);
      await page.mouse.up();
      await page.waitForFunction(() => (window as any).__releaseDone === true);
      const samples: { t: number; width: number }[] = await page.evaluate(() => (window as any).__release);
      expect(samples.every(({ width }) => Math.abs(width - 120) < 0.1)).toBe(true);
    });
  });

  test('the maximum keeps a hard stop', async ({ page }) => {
    await page.goto('/resize-handle/');
    const point = await start(page);
    await grab(page, point);
    await page.mouse.move(point.x + 260, point.y, { steps: 10 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '320');
    expect(await shown(page)).toBe('320px');
    await page.mouse.up();
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

  test('keyboard focus shows the grip without a transition', async ({ page }) => {
    await page.goto('/resize-handle/');
    await handle(page).focus();
    expect(await handle(page).evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await expect(page.locator('[data-grip]')).toHaveCSS('transition-duration', '0s');
    await expect(page.locator('[data-grip]')).toHaveCSS('opacity', '1');
  });

  test('forced colors draws the line at rest', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Forced colors emulation is Chromium only.');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/resize-handle/');
    const colors = await sidebar(page).evaluate((element) => {
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

test.describe('worm dots: taps, scrub and Escape', () => {
  const component = (page: Page) => page.locator('[data-stage] worm-dots');
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

  test('a tap from the first dot to the last travels in 280ms', async ({ page }) => {
    await page.goto('/worm-dots/');
    const wormDots = component(page);
    await watchTravel(wormDots);
    const last = await middle(dot(wormDots, 6));
    await page.mouse.click(last.x, last.y);
    await page.waitForFunction(() => (window as unknown as { wdTravel: { end?: number } }).wdTravel.end !== undefined);
    const { start, end } = await page.evaluate(() => (window as unknown as { wdTravel: { start: number; end: number } }).wdTravel);
    // 280ms plus at most a frame or two; five dots at the old 40ms each would take 440ms.
    expect(end - start).toBeGreaterThanOrEqual(270);
    expect(end - start).toBeLessThan(380);
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

test.describe('chevron morph: gallery tap and press', () => {
  test.use({ reducedMotion: 'no-preference' });

  const demoButton = (page: Page) => page.locator('[data-stage] .morph-button').first();
  const stemOpacity = (button: Locator) =>
    button.locator('[data-trace-progress]').evaluate((stem) => Number(getComputedStyle(stem).opacity));

  // WebKit reports a tap's click as a mouse event; only the pointerdown says it was touch.
  const syntheticTap = (button: Locator) =>
    button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const at = {
        bubbles: true, cancelable: true, composed: true,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      };
      const pointer = { ...at, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
      element.dispatchEvent(new PointerEvent('pointerdown', pointer));
      element.dispatchEvent(new PointerEvent('pointerup', pointer));
      element.dispatchEvent(new MouseEvent('click', { ...at, detail: 1, button: 0 }));
    });

  const pressOutside = (page: Page) =>
    page.locator('h1').evaluate((heading) => {
      heading.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 8, pointerType: 'touch', isPrimary: true, button: 0,
      }));
    });

  test.describe('chevron morph gallery tap', () => {
    test('a second tap keeps the arrow instead of toggling it off', async ({ page }) => {
      await page.goto('/chevron-morph/');
      const button = demoButton(page);
      await syntheticTap(button);
      await expect(button).toHaveAttribute('data-touch-active', '');
      await syntheticTap(button);
      await expect(button).toHaveAttribute('data-touch-active', '');
      await expect.poll(() => stemOpacity(button)).toBe(1);
      await pressOutside(page);
      await expect(button).not.toHaveAttribute('data-touch-active');
    });

    test('keyboard, programmatic and mouse clicks leave the attribute alone', async ({ page }) => {
      await page.goto('/chevron-morph/');
      const button = demoButton(page);
      // A touch press first, so a stale pointer type can't excuse the keyboard click.
      await syntheticTap(button);
      await pressOutside(page);
      await expect(button).not.toHaveAttribute('data-touch-active');

      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).not.toHaveAttribute('data-touch-active');
      await page.keyboard.press('Space');
      await expect(button).not.toHaveAttribute('data-touch-active');
      // Assistive technologies click with detail 0.
      await button.evaluate((element: HTMLButtonElement) => element.click());
      await expect(button).not.toHaveAttribute('data-touch-active');

      await button.click();
      await expect(button).not.toHaveAttribute('data-touch-active');
    });
  });

  test.describe('chevron morph real taps', () => {
    test.use({ hasTouch: true });

    test('two taps leave the arrow showing', async ({ page }) => {
      await page.goto('/chevron-morph/');
      const button = demoButton(page);
      await button.tap();
      await expect(button).toHaveAttribute('data-touch-active', '');
      await button.tap();
      await expect(button).toHaveAttribute('data-touch-active', '');
    });
  });

  test('chevron morph buttons reset the tap highlight', async ({ page }) => {
    await page.goto('/chevron-morph/');
    const value = await demoButton(page).evaluate((element) =>
      getComputedStyle(element).getPropertyValue('-webkit-tap-highlight-color'));
    test.skip(value === '', 'This engine does not expose -webkit-tap-highlight-color.');
    expect(value).toMatch(/^(?:transparent|rgba\(0, 0, 0, 0\))$/);
  });

  test('holding Space on a focused chevron button shows the press', async ({ page }) => {
    await page.goto('/chevron-morph/');
    const button = demoButton(page);
    const transform = () => button.evaluate((element) => getComputedStyle(element).transform);
    await button.focus();
    await page.keyboard.down('Space');
    await expect.poll(transform).toBe('matrix(0.96, 0, 0, 0.96, 0, 0)');
    await page.keyboard.up('Space');
    await expect.poll(transform).toBe('none');
    await expect(button).not.toHaveAttribute('data-touch-active');
  });

  test('copied and installed chevron morph code ships the press and tap fixes', async ({ page, request }) => {
    await page.goto('/chevron-morph/');
    await page.locator('[data-source-format][value="css"]').check();
    const css = page.locator('[data-source-variant="css"]');
    await css.getByRole('tab', { name: 'CSS', exact: true }).click();
    const cssCode = await css.getByRole('tabpanel', { name: 'CSS', exact: true }).locator('code').textContent();
    expect(cssCode).toContain('-webkit-tap-highlight-color: transparent');
    expect(cssCode).toContain('.morph-button:active {');
    expect(cssCode).not.toContain(':active:not(:focus-visible)');

    await page.locator('[data-source-format][value="tailwind"]').check();
    const tailwind = page.locator('[data-source-variant="tailwind"]');
    await tailwind.getByRole('tab', { name: 'HTML', exact: true }).click();
    const html = await tailwind.getByRole('tabpanel', { name: 'HTML', exact: true }).locator('code').textContent();
    expect(html).toContain('[-webkit-tap-highlight-color:transparent]');
    expect(html).toContain('motion-safe:active:transform-[scale(0.96)]');
    expect(html).not.toContain('not-focus-visible');

    const item = await (await request.get('/r/chevron-morph.json')).json();
    const port = item.files.map((file: { content: string }) => file.content).join('\n');
    expect(port).toContain('[-webkit-tap-highlight-color:transparent]');
    expect(port).toContain('motion-safe:active:transform-[scale(0.96)]');
    expect(port).not.toMatch(/touch-active|touchActive|not-focus-visible/);
  });
});

test.describe('faq panel: opening, repeats and reduced motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  const MOVE_EASE = 'cubic-bezier(0.64, 0, 0.2, 1)';
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  const component = (page: Page) => page.locator('[data-stage] faq-panel');
  const offset = (faq: Locator) => faq.evaluate((el) => {
    const panel = el.querySelector('[data-panel]')!.getBoundingClientRect();
    const item = el.querySelector('[aria-expanded="true"]')!.closest('[data-item]')!.getBoundingClientRect();
    return Math.max(Math.abs(panel.top - item.top), Math.abs(panel.height - item.height));
  });
  const settled = (faq: Locator) =>
    expect.poll(() => faq.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);

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

  test.describe('details', () => {
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

    test('a question chosen mid-move turns the chevrons on the panel\'s ease-out', async ({ page }) => {
      await page.goto('/faq-panel/');
      const faq = component(page);
      const turn = await faq.evaluate((el) => {
        const buttons = el.querySelectorAll<HTMLElement>('[data-trigger]');
        const panel = el.querySelector('[data-panel]')!;
        buttons[buttons.length - 1].click();
        panel.getAnimations()[0].currentTime = 150;
        buttons[1].click();
        const effect = panel.getAnimations()[0].effect as KeyframeEffect;
        const chevron = buttons[1].querySelector('svg')!;
        return {
          panel: effect.getKeyframes()[0].easing,
          ease: getComputedStyle(el).getPropertyValue('--fqp-ease').trim(),
          chevron: getComputedStyle(chevron).transitionTimingFunction,
        };
      });
      expect(turn.panel).toBe(EASE_OUT);
      expect(turn.ease).toBe(EASE_OUT);
      expect(turn.chevron).toBe(EASE_OUT);
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

    test('the hover fill has no transition in any version', async ({ page }) => {
      await page.goto('/faq-panel/');
      const faq = component(page);
      const durations = await faq.evaluate((el) =>
        [...el.querySelectorAll('[data-trigger]')].map((trigger) => getComputedStyle(trigger).transitionDuration));
      for (const duration of durations) expect(duration.split(',').every((value) => parseFloat(value) === 0)).toBe(true);

      for (const format of ['css', 'tailwind']) {
        await page.locator(`[data-source-format][value="${format}"]`).check();
        const variant = page.locator(`[data-source-variant="${format}"]`);
        const language = format === 'css' ? 'CSS' : 'HTML';
        await variant.getByRole('tab', { name: language, exact: true }).click();
        const code = (await variant.getByRole('tabpanel', { name: language, exact: true }).locator('code').textContent())!;
        expect(code).not.toContain('background-color 120ms');
        expect(code).not.toContain('transition-[background-color]');
      }
    });
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

  test.describe('hold confirm: drag off, modifiers, touch', () => {
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

    test('a vertical swipe on the button can scroll the page', async ({ page }) => {
      await page.goto('/hold-confirm/');
      await expect(page.locator('.hold-button')).toHaveCSS('touch-action', 'pan-y');
    });
  });
});

test.describe('plucked underline: intent, touch and keyboard blur', () => {
  const links = (page: Page) => page.locator('[data-stage] [data-pluck]');

  test.describe('details', () => {
    test.beforeEach(async ({ page }) => {
      // A paused clock: the touch's quiet timer can't release the string and the 50ms touch window can't run out
      // between steps, however slow the runner is. CSS transitions still run on real time.
      await page.clock.install();
      await page.goto('/plucked-underline/');
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
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
});

test.describe('tab indicator: list scroll, hover and hit areas', () => {
  // Narrow enough that the four tabs overflow the list, so choosing one can scroll it.
  test.use({ reducedMotion: 'no-preference', viewport: { width: 360, height: 800 } });

  const component = (page: Page) => page.locator('[data-stage] tab-indicator');

  type Sample = { t: number; scroll: number; screenX: number; lineX: number };

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

  test.describe('details', () => {
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

    test('a click on a cut-off tab scrolls with the line, and the line never turns back on screen', async ({ page }) => {
      const { list, tabs } = await open(page);
      const { index, x, y } = await cutOff(list, tabs);

      // Samples every frame from the click, in the page, so no round trip falls between frames.
      await list.evaluate((el: HTMLElement) => {
        const line = el.querySelector<HTMLElement>('[data-line]')!;
        const read = (t: number): Sample => ({
          t,
          scroll: el.scrollLeft,
          screenX: line.getBoundingClientRect().left,
          lineX: new DOMMatrix(getComputedStyle(line).transform).m41,
        });
        (window as unknown as { tbiSamples: Promise<Sample[]> }).tbiSamples = new Promise((resolve) => {
          const samples: Sample[] = [];
          let clicked: number | undefined;
          el.addEventListener(
            'click',
            () => {
              clicked = performance.now();
              samples.push(read(0));
            },
            { capture: true, once: true },
          );
          const begin = performance.now();
          const frame = () => {
            const now = performance.now();
            if (clicked !== undefined) samples.push(read(now - clicked));
            if ((clicked !== undefined && now - clicked > 700) || now - begin > 8000) resolve(samples);
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
      });
      await page.mouse.click(x, y);
      const samples = await page.evaluate(() => (window as unknown as { tbiSamples: Promise<Sample[]> }).tbiSamples);
      await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');

      expect(samples.length).toBeGreaterThan(10);
      const first = samples[0];
      const last = samples[samples.length - 1];
      expect(last.scroll).toBeGreaterThan(first.scroll + 10);

      // Not a jump: well after the first frame the list is still on its way...
      const midway = samples.filter((s) => s.t >= 60 && s.t <= 110);
      expect(midway.length).toBeGreaterThan(0);
      for (const s of midway) expect(last.scroll - s.scroll).toBeGreaterThan(Math.max(0.5, 0.02 * (last.scroll - first.scroll)));
      // ...and it has arrived soon after the line's 250ms.
      for (const s of samples.filter((s) => s.t >= 450)) expect(Math.abs(s.scroll - last.scroll)).toBeLessThan(1);

      // The list covers the same share of its trip as the line, at most one frame later: the scroll is written in
      // requestAnimationFrame, after the line's transition has already been sampled for that frame.
      const travel = last.lineX - first.lineX;
      const scrolled = last.scroll - first.scroll;
      expect(travel).toBeGreaterThan(scrolled);
      const share = samples.map((s) => ({ t: s.t, line: (s.lineX - first.lineX) / travel, scroll: (s.scroll - first.scroll) / scrolled }));
      for (let i = 1; i < share.length; i++) {
        expect(Math.abs(share[i].scroll - share[i - 1].line), `at ${Math.round(share[i].t)}ms`).toBeLessThan(0.08);
      }
      // On screen the line never runs past where it ends up, then drifts back.
      for (const s of samples) expect(s.screenX, `at ${Math.round(s.t)}ms`).toBeLessThanOrEqual(last.screenX + 1);

      // On screen the line only heads right, toward the new tab.
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i].screenX - samples[i - 1].screenX, `at ${Math.round(samples[i].t)}ms`).toBeGreaterThan(-1);
      }
    });

    test('tabs change color and background at once', async ({ page }) => {
      const { tabs } = await open(page);
      const durations = await tabs.evaluateAll((els) =>
        els.flatMap((el) => getComputedStyle(el).transitionDuration.split(',').map((d) => parseFloat(d))),
      );
      expect(durations.every((d) => d === 0)).toBe(true);
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
});

test.describe('text swap: timing, taps and press', () => {
  test.use({ reducedMotion: 'no-preference' });

  const demoButton = (page: Page) => page.locator('[data-stage] .swap').first();
  const layerTiming = (button: Locator) =>
    button.locator('.swap-layer').evaluateAll((layers) =>
      layers.map((layer) => {
        const style = getComputedStyle(layer);
        return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
      }),
    );
  const scaleX = (button: Locator) =>
    button.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return transform === 'none' ? 1 : new DOMMatrix(transform).a;
    });
  const nextOpacity = (button: Locator) =>
    button.locator('.swap-next').evaluate((label) => Number(getComputedStyle(label).opacity));

  // WebKit reports a tap's click as a mouse event; only the pointerdown says it was touch.
  const syntheticTap = (button: Locator) =>
    button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const at = {
        bubbles: true, cancelable: true, composed: true,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      };
      const pointer = { ...at, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
      element.dispatchEvent(new PointerEvent('pointerdown', pointer));
      element.dispatchEvent(new PointerEvent('pointerup', pointer));
      element.dispatchEvent(new MouseEvent('click', { ...at, detail: 1, button: 0 }));
    });

  // A touch that starts a scroll sends pointerdown but no click.
  const touchOutside = (page: Page) =>
    page.locator('h1').evaluate((heading) => {
      heading.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 8, pointerType: 'touch', isPrimary: true, button: 0,
      }));
    });

  const tapOutside = (page: Page) =>
    page.locator('h1').evaluate((heading) => {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0 }));
    });

  test.describe('text swap', () => {
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

    test('a second tap keeps the label, a scroll keeps it, a tap outside clears it', async ({ page }) => {
      await page.goto('/text-swap/');
      const button = demoButton(page);
      await syntheticTap(button);
      await expect(button).toHaveAttribute('data-touch-active', '');
      await syntheticTap(button);
      await expect(button).toHaveAttribute('data-touch-active', '');
      await expect.poll(() => nextOpacity(button)).toBe(1);

      await touchOutside(page);
      await expect(button).toHaveAttribute('data-touch-active', '');
      await tapOutside(page);
      await expect(button).not.toHaveAttribute('data-touch-active');
    });

    test('keyboard, programmatic and mouse clicks leave the attribute alone', async ({ page }) => {
      await page.goto('/text-swap/');
      const button = demoButton(page);
      // A touch press first, so a stale pointer type can't excuse the keyboard click.
      await syntheticTap(button);
      await tapOutside(page);
      await expect(button).not.toHaveAttribute('data-touch-active');

      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).not.toHaveAttribute('data-touch-active');
      await page.keyboard.press('Space');
      await expect(button).not.toHaveAttribute('data-touch-active');
      // Assistive technologies click with detail 0.
      await button.evaluate((element: HTMLButtonElement) => element.click());
      await expect(button).not.toHaveAttribute('data-touch-active');

      await button.click();
      await expect(button).not.toHaveAttribute('data-touch-active');
    });

    test('holding Space on a focused button presses it', async ({ page }) => {
      await page.goto('/text-swap/');
      const button = demoButton(page);
      await button.focus();
      expect(await button.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      await page.keyboard.down('Space');
      await expect
        .poll(() => scaleX(button))
        .toBeCloseTo(0.97, 3);
      await page.keyboard.up('Space');
      await expect
        .poll(() => scaleX(button))
        .toBe(1);
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
});

test.describe('tick rail: clicks, intent and the current tick', () => {
  test.describe('details', () => {
    const component = (page: Page) => page.locator('[data-stage] tick-rail');
    const lengths = (rail: Locator) =>
      rail.evaluate((el) => [...el.querySelectorAll('[data-line]')].map((line) => Math.round(line.getBoundingClientRect().width)));

    // Synthetic mouse moves on the rail, timed in the page so a slow runner can't stretch the gaps between them. The chain
    // of 20ms timers always runs ahead of the card's 80ms one, since timers fire in the order they come due.
    // Returns how many moves had been sent when the card opened, or -1, and when it opened.
    const sweep = (rail: Locator, direction: 'across' | 'down') =>
      rail.evaluate(
        (el, direction) =>
          new Promise<{ movesBeforeOpen: number; openedAt: number }>((resolve) => {
            const card = el.querySelector('[data-card]')!;
            const nav = el.querySelector('[data-rail]')!;
            const box = nav.getBoundingClientRect();
            const first = el.querySelectorAll('[data-tick]')[direction === 'across' ? 3 : 0].getBoundingClientRect();
            let x = direction === 'across' ? box.left + 2 : first.left + 20;
            let y = direction === 'across' ? first.top + first.height / 2 : first.top + 2;
            const total = direction === 'across' ? Math.floor((box.width - 4) / 4) : 12;
            let moves = 0;
            let movesBeforeOpen = -1;
            let openedAt = -1;
            const start = performance.now();
            const observer = new MutationObserver(() => {
              if (movesBeforeOpen >= 0 || !card.hasAttribute('data-showing')) return;
              movesBeforeOpen = moves;
              openedAt = performance.now() - start;
            });
            observer.observe(card, { attributes: true, attributeFilter: ['data-showing'] });
            const step = () => {
              nav.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: x, clientY: y, bubbles: true }));
              moves++;
              if (direction === 'across') x += 4;
              else y += 6;
              if (moves < total) return void setTimeout(step, 20);
              // Crossing ends by leaving the rail, which drops the pending open.
              if (direction === 'across') nav.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
              setTimeout(() => {
                observer.disconnect();
                resolve({ movesBeforeOpen, openedAt });
              }, 200);
            };
            step();
          }),
        direction,
      );

    test('an arrow key changes the lit tick’s color at once', async ({ page }) => {
      await page.goto('/tick-rail/');
      const rail = component(page);
      const ticks = rail.getByRole('link');
      await ticks.first().focus();
      await expect(ticks.first()).toHaveAttribute('data-lit', '');
      await page.keyboard.press('ArrowDown');
      await expect(ticks.nth(1)).toBeFocused();
      const state = await rail.evaluate((el) => {
        const all = [...el.querySelectorAll<HTMLElement>('[data-tick]')];
        return {
          running: all.reduce((sum, tick) => sum + tick.getAnimations().length, 0),
          lit: getComputedStyle(all[1]).color,
          rest: getComputedStyle(all[2]).color,
        };
      });
      expect(state.running).toBe(0);
      expect(state.lit).not.toBe(state.rest);
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
      await page.goto('/tick-rail/');
      const rail = component(page);

      const across = await sweep(rail, 'across');
      expect(across.movesBeforeOpen).toBe(-1);

      const down = await sweep(rail, 'down');
      expect(down.openedAt).toBeGreaterThanOrEqual(70);
      // Vertical moves don't restart the wait, so it opens while they're still coming.
      expect(down.movesBeforeOpen).toBeGreaterThan(0);
      expect(down.movesBeforeOpen).toBeLessThan(12);
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

    test('Enter on a tick jumps the demo to its section instead of scrolling there', async ({ page }) => {
      await page.goto('/tick-rail/');
      const rail = component(page);
      const ticks = rail.getByRole('link');
      const scroller = rail.locator('[data-scroll]');
      await ticks.nth(3).focus();
      await page.keyboard.press('Enter');
      await expect(rail.locator('#tkr-theming')).toBeFocused();
      const right = await scroller.evaluate((el) => el.scrollTop);
      await page.waitForTimeout(400);
      expect(right).toBeGreaterThan(0);
      expect(await scroller.evaluate((el) => el.scrollTop)).toBe(right);
      const gap = await rail.evaluate(
        (el) => el.querySelector('#tkr-theming')!.getBoundingClientRect().top - el.querySelector('[data-scroll]')!.getBoundingClientRect().top,
      );
      expect(Math.abs(gap)).toBeLessThan(2);
    });
  });
});
