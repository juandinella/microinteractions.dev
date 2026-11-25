import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Every installed study, rendered by worst-case.html with demo data and with the realistic worst case.
// The layout rules apply to any component, so a new study gets them by adding its entry to
// src/worst-case/studies.tsx; the first test fails until it does.

const modes = ['demo', 'worst', 'empty', 'one', 'many'] as const;
const directions = ['ltr', 'rtl'] as const;

// Scrollers meant to scroll sideways: the tab list and the carousel track.
const sideways = '[role="tablist"], [data-track]';

const open = async (page: Page, query: string) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto(`/worst-case.html?${query}`);
  await page.waitForFunction(() => document.querySelectorAll('[data-study]').length > 0);
  // Elements upgrade after hydration, and the fixtures render only some of them in every mode.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-study] *')].every((element) => !element.localName.includes('-') || customElements.get(element.localName)),
  );
  await page.waitForTimeout(200);
  return errors;
};

test('every registry item has a worst case', async ({ page }) => {
  const { items } = JSON.parse(readFileSync(new URL('../../dist/client/r/registry.json', import.meta.url), 'utf8'));
  await open(page, 'data=demo');
  const studies = await page.locator('[data-study]').evaluateAll((sections) => sections.map((section) => section.getAttribute('aria-label')));
  expect(studies.sort()).toEqual(items.map(({ name }: { name: string }) => name).sort());
});

for (const mode of modes) {
  for (const dir of directions) {
    test(`${mode} data, ${dir}: nothing overflows or gets cut`, async ({ page }) => {
      const errors = await open(page, `data=${mode}&width=320&dir=${dir}`);
      const problems = await page.evaluate((sideways) => {
        const found: string[] = [];
        const name = (element: Element) =>
          `${element.localName}${element.id ? `#${element.id}` : ''}${element.textContent?.trim() ? ` "${element.textContent.trim().slice(0, 40)}"` : ''}`;
        for (const section of document.querySelectorAll<HTMLElement>('[data-study]')) {
          const study = section.getAttribute('aria-label');
          const bounds = section.getBoundingClientRect();
          for (const element of section.querySelectorAll<HTMLElement>('*')) {
            const box = element.getBoundingClientRect();
            // Nothing to see, or text only for screen readers in a 1px box.
            if (!box.width || !box.height || (box.width <= 1 && box.height <= 1)) continue;
            const style = getComputedStyle(element);
            // A box sticking out of its study pushes the page sideways. Inside a clipping or
            // scrolling ancestor the overflow is that ancestor's, checked below.
            let clipped = false;
            for (let parent = element.parentElement; parent && parent !== section; parent = parent.parentElement) {
              if (getComputedStyle(parent).overflowX !== 'visible') clipped = true;
            }
            if (!clipped && (box.left < bounds.left - 1 || box.right > bounds.right + 1)) {
              found.push(`${study}: ${name(element)} sticks out by ${Math.round(Math.max(bounds.left - box.left, box.right - bounds.right))}px`);
            }
            // A clipping box narrower than its content cuts it, unless it ends in an ellipsis or scrolls sideways on purpose.
            if (style.overflowX !== 'visible' && element.scrollWidth > element.clientWidth + 1 && style.textOverflow !== 'ellipsis' && !element.matches(sideways)) {
              found.push(`${study}: ${name(element)} cuts ${element.scrollWidth - element.clientWidth}px of its content`);
            }
          }
        }
        return found;
      }, sideways);
      expect(problems).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

const study = (page: Page, name: string) => page.locator(`[data-study][aria-label="${name}"]`);

test('hold to confirm fits its confirmed label', async ({ page }) => {
  await open(page, 'data=worst&width=320');
  const button = study(page, 'hold-confirm').locator('button[data-state]').nth(1);
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await expect(button).toHaveAttribute('data-state', 'confirmed', { timeout: 3_000 });
  await page.mouse.up();
  expect(await button.evaluate((element) => element.lastElementChild!.scrollWidth <= element.clientWidth)).toBe(true);
});

test('the slider tooltip shows its whole label and value at one width', async ({ page }) => {
  await open(page, 'data=worst&width=320');
  for (const slider of await study(page, 'edge-aware-tooltip').locator('edge-aware-tooltip').all()) {
    const tooltip = slider.locator('[data-tip]');
    const widths = new Set<number>();
    for (const value of [0, 9, 10, 100]) {
      await slider.locator('input').evaluate((input: HTMLInputElement, value) => {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
      const fit = await tooltip.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const field = element.parentElement!.getBoundingClientRect();
        const label = element.firstElementChild!;
        return { width: Math.round(box.width), whole: label.scrollWidth <= label.clientWidth, inside: box.left >= field.left - 1 && box.right <= field.right + 1 };
      });
      expect(fit.whole && fit.inside).toBe(true);
      widths.add(fit.width);
    }
    expect(widths.size).toBe(1);
  }
});

test('the drag-select count reads in the page language', async ({ page }) => {
  await open(page, 'data=many&width=400');
  await expect(study(page, 'drag-select').locator('[data-count]')).toHaveText('0 of 1,284');
});

test('a long tick rail scrolls and keeps the current tick in view', async ({ page }) => {
  await open(page, 'data=many&width=400');
  const rail = study(page, 'tick-rail').locator('[data-rail]');
  const inView = (tick: string) =>
    rail.evaluate((element, tick) => {
      const box = element.getBoundingClientRect();
      const target = element.querySelector(tick)!.getBoundingClientRect();
      return target.top >= box.top && target.bottom <= box.bottom;
    }, tick);
  expect(await inView('[data-tick]')).toBe(true);
  await page.evaluate(() => document.getElementById('s29')!.scrollIntoView({ block: 'start' }));
  await expect.poll(() => inView('[aria-current]')).toBe(true);
  await expect(rail.locator('[aria-current]')).toHaveAttribute('href', /#s(2[5-9]|3\d)$/);
});

test('in right-to-left the resize handle follows the sidebar', async ({ page }) => {
  await open(page, 'data=worst&width=400&dir=rtl');
  const sidebar = study(page, 'resize-handle').locator('[data-side]');
  const handle = study(page, 'resize-handle').locator('[data-handle]');
  const width = async () => (await sidebar.boundingBox())!.width;
  await handle.scrollIntoViewIfNeeded();
  const edge = (await sidebar.boundingBox())!.x;
  const grip = (await handle.boundingBox())!;
  expect(Math.abs(grip.x + grip.width / 2 - edge)).toBeLessThan(2);

  const before = await width();
  const x = grip.x + grip.width / 2;
  const y = grip.y + 60;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(x - step * 4, y);
  await page.mouse.up();
  await expect.poll(width).toBeGreaterThan(before + 20);

  const dragged = await width();
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(width).toBeGreaterThan(dragged);
});

test('in right-to-left the slider tooltip and the chevrons follow the direction', async ({ page }) => {
  await open(page, 'data=worst&width=400&dir=rtl');
  for (const slider of await study(page, 'edge-aware-tooltip').locator('edge-aware-tooltip').all()) {
    const offset = await slider.evaluate((element) => {
      const arrow = element.querySelector('[class*="rotate-45"]')!.getBoundingClientRect();
      const input = element.querySelector('input')!;
      const box = input.getBoundingClientRect();
      const share = (input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min));
      return arrow.left + arrow.width / 2 - (box.right - 12 - (box.width - 24) * share);
    });
    expect(Math.abs(offset)).toBeLessThan(3);
  }
  const previous = study(page, 'chevron-morph').getByRole('button', { name: 'Previous item' });
  expect(await previous.locator('svg').evaluate((svg) => getComputedStyle(svg).scale)).toBe('-1 1');
});
