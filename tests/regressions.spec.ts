import { expect, test } from '@playwright/test';

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
      // The dialog's buttons stay inside it and confirm without submitting the surrounding form.
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
  // The command waits behind a trigger beside the title, so the preview leads the page.
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

  // The choice follows the reader to the next installable study.
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
      pointer('pointerenter');
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
    // The underline closes, but the string keeps moving.
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

  test('losing keyboard focus closes a flat underline', async ({ page }) => {
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
    expect(state).toEqual({ closing: 1, transform: 'matrix(1, 0, 0, 0.001, 0, 0)' });
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
    await expect(page.locator('[data-trace-readout]')).toHaveText('480');
  });

  test('a new choice mid-pour turns the drop from where it is', async ({ page }) => {
    await page.goto('/gooey-radio-group/');
    const stage = page.locator('[data-stage]');
    // Start a pour, move it 250ms in, change course and read the new drop's first frame in one task.
    // Waiting in real time instead lets a slow machine finish the 480ms pour before the read.
    const [midway, restart, early] = await stage.locator('[data-goo-blob]').last().evaluate((head) => {
      const y = () => new DOMMatrix(getComputedStyle(head).transform).m42;
      const choose = (value: string) => {
        const input = document.querySelector<HTMLInputElement>(`[data-stage] input[value="${value}"]`)!;
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      choose('pickup');
      head.parentElement!.querySelectorAll('[data-goo-blob]').forEach((blob) =>
        blob.getAnimations().forEach((pour) => (pour.currentTime = 250)),
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
    expect(await timing('Standard')).toEqual(['0.315s', '0.315s']);
    expect(await timing('Express')).toEqual(['0.15s', '0.15s']);
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
    // A second group with nothing checked, its own radio name, and an unrelated input inside.
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
    // Keyboard: the ring follows the arrow keys and the drop is skipped, in WebKit too.
    await standalone.keyboard.press('Tab');
    await standalone.keyboard.press('ArrowDown');
    await expect(standalone.getByRole('radio', { name: 'Express' })).toBeChecked();
    expect(await blobAnimations(group)).toBe(0);
    await expect(standalone.locator('.goo-option', { hasText: 'Express' })).toHaveCSS('outline-style', 'solid');
    // Pointer: the drop pours and no ring is left behind.
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
    // Backing off from row 4 to row 2 put rows 3 and 4 back.
    expect(await checked(page)).toEqual([false, true, true, false, false, false, false, false, false, false]);
    await expect(page.locator('[data-band]')).toHaveAttribute('data-shown', '');
    expect((await log(page)).change).toBe(0);
    await page.mouse.up();
    expect(await log(page)).toEqual({ input: 6, change: 2 });
    await expect(page.locator('[data-count]')).toHaveText('2 of 10');
    await expect(page.locator('drag-select-table tbody tr[data-selected]')).toHaveCount(2);
    await expect(page.locator('[data-band]')).not.toHaveAttribute('data-shown', '');

    // Starting on a checked box clears.
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
    await page.mouse.move(point.x + 40, point.y + 30, { steps: 4 });
    await expect(handle(page)).toHaveAttribute('aria-valuenow', '200');
    // The grip tracks the pointer down the divider.
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
    await page.mouse.move(point.x - 120, point.y, { steps: 6 });
    await expect(handle(page)).toHaveAttribute('aria-valuetext', 'Collapsed');
    await expect(page.locator('[data-side]')).toHaveJSProperty('inert', true);
    await page.mouse.move(point.x - 20, point.y, { steps: 6 });
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
    await page.mouse.move(point.x + 20.4, point.y, { steps: 3 });
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
    // A fractional container still yields whole-pixel limits.
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
    await standalone.mouse.move(point.x + 40, point.y, { steps: 4 });
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
    await page.mouse.move(x + 30, box.y + box.height / 2 + pitch * 2, { steps: 8 });
    // Dragged from index 0 to the gap at 2: the row closes up one slot, then the two rows beside the gap nudge away from it.
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
  // How far the panel is from the open question's box.
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
    await questions.nth(3).click();
    await expect(questions.nth(3)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'false');
    expect(await faq.locator('[data-panel]').evaluate((panel) => panel.getAnimations().length)).toBe(1);
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
    // Each click lands partway through the move before it; the last one runs to the end.
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
    // The browser fires beforematch on the hidden answer, then reveals it.
    await faq.evaluate((el) => {
      const answer = el.querySelectorAll('[data-answer]')[2];
      answer.dispatchEvent(new Event('beforematch', { bubbles: true }));
    });
    await expect(questions.nth(2)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'false');
    // The panel and the answers jump; only the chevrons' CSS transitions may run.
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
      return { at, start: Number(start.match(/-?[\d.]+/)![0]), easing: next.effect!.getTiming().easing };
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
    expect(await faq.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
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
