import { expect, test as base, type Page } from '@playwright/test';

const elements = [
  'hold-to-confirm',
  'edge-aware-tooltip',
  'plucked-underline',
  'gooey-radio-group',
  'tab-indicator',
  'drag-select-table',
  'resizable-sidebar',
  'worm-dots',
];

// Opens the app once its custom elements are defined, and fails the test on any console error,
// which includes React's hydration mismatches.
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.goto('/');
    await page.waitForFunction((tags) => tags.every((tag) => customElements.get(tag)), elements);
    await use(page);
    expect(errors).toEqual([]);
  },
});

export { expect };

export const calls = (page: Page) => page.evaluate(() => [...(window.calls ?? [])]);

export const hold = async (page: Page, target: import('@playwright/test').Locator, ms = 1300) => {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
};
