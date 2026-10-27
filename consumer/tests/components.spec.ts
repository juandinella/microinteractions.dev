import { calls, expect, hold, test } from './fixture';

test('the server markup hydrates with one form and every element', async ({ app, request }) => {
  const html = await (await request.get('/')).text();
  // A nested form would be dropped by the parser and break hydration.
  expect(html.match(/<form\b/g)).toHaveLength(1);
  for (const tag of ['hold-to-confirm', 'drag-select-table', 'worm-dots']) expect(html).toContain(`<${tag}`);
  await expect(app.getByRole('button', { name: 'Delete project', exact: true })).toBeVisible();
});

test('hover swaps the label and morphs the chevron', async ({ app }) => {
  await app.getByRole('button', { name: 'Download for macOS, 42 MB' }).hover();
  await expect(app.getByText('macOS · 42 MB')).toHaveCSS('opacity', '1');
  const next = app.getByRole('button', { name: 'Next item' });
  await next.hover();
  await expect(next.locator('path').nth(1)).toHaveCSS('opacity', '1');
});

test('hold to confirm confirms a full hold, ignores a disabled fieldset, and confirms from its dialog', async ({ app }) => {
  const button = app.getByRole('button', { name: 'Delete project', exact: true });
  await hold(app, button);
  await app.mouse.up();
  await expect(button).toHaveAttribute('data-state', 'confirmed');
  expect(await calls(app)).toEqual(['hold']);
  await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 3_000 });

  await app.getByRole('group', { name: 'Hold to confirm' }).evaluate((fieldset: HTMLFieldSetElement) => (fieldset.disabled = true));
  await hold(app, button);
  // Read once: a confirmed button returns to idle on its own.
  expect(await button.getAttribute('data-state')).toBe('idle');
  await app.mouse.up();
  await app.getByRole('group', { name: 'Hold to confirm' }).evaluate((fieldset: HTMLFieldSetElement) => (fieldset.disabled = false));

  // Some assistive technologies click without a sustained press.
  await button.evaluate((element: HTMLButtonElement) => element.click());
  const dialog = app.getByRole('dialog', { name: 'Delete project' });
  await expect(dialog.getByText('Delete this project?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(button).toHaveAttribute('data-state', 'confirmed');
  expect(await calls(app)).toEqual(['hold', 'hold']);
});

test('the slider keeps its tooltip inside and follows a form reset', async ({ app }) => {
  const slider = app.getByRole('slider', { name: 'Volume' });
  await slider.focus();
  await app.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', '100 percent');
  const inside = await app.locator('edge-aware-tooltip').evaluate((field) => {
    const bounds = field.getBoundingClientRect();
    const tooltip = field.querySelector('[data-volume]')!.parentElement!.getBoundingClientRect();
    return tooltip.left >= bounds.left - 0.5 && tooltip.right <= bounds.right + 0.5;
  });
  expect(inside).toBe(true);
  await app.getByRole('button', { name: 'Reset form' }).click();
  await expect(app.locator('[data-volume]')).toHaveText('50');
  await expect(slider).toHaveAttribute('aria-valuetext', '50 percent');
});

test('a hover plucks the underline and leaving releases it', async ({ app }) => {
  const link = app.getByRole('link', { name: 'Get in touch' });
  await link.hover();
  await expect(link).toHaveAttribute('data-plucked', '');
  await app.mouse.move(0, 0);
  await expect(link).not.toHaveAttribute('data-plucked');
});

test('the gooey drop pours, and a form reset moves the next pour back to the default', async ({ app }) => {
  const head = () => app.locator('[data-goo-blob]').last();
  await app.getByText('Option z', { exact: true }).click();
  expect(await app.locator('[data-goo-blob]').evaluateAll((blobs) => blobs.flatMap((blob) => blob.getAnimations()).length)).toBe(8);
  await app.waitForTimeout(600);
  await app.getByRole('button', { name: 'Reset form' }).click();
  await expect(app.getByRole('radio', { name: 'Option x' })).toBeChecked();
  await expect.poll(() => head().evaluate((blob) => new DOMMatrix(getComputedStyle(blob).transform).m42)).toBe(0);
  await app.getByText('Option y', { exact: true }).click();
  const start = await head().evaluate((blob) => blob.getAnimations()[0].effect!.getKeyframes()[0].transform as string);
  expect(start).toMatch(/^translateY\(0px\)/);
  expect(await calls(app)).toEqual(['option:"z"', 'option:"x"', 'option:"y"']);
});

test('tabs follow clicks and arrow keys', async ({ app }) => {
  const tab = app.getByRole('tab', { name: /Tab c/ });
  await tab.click();
  await expect(app.getByRole('tabpanel')).toHaveText('Panel c');
  // WebKit doesn't focus a button on click.
  await tab.focus();
  await app.keyboard.press('ArrowLeft');
  await expect(app.getByRole('tab', { name: /Tab b/ })).toHaveAttribute('aria-selected', 'true');
  expect(await calls(app)).toEqual(['tab:"c"', 'tab:"b"']);
});

test('a drag down the boxes checks a run of rows, and a form reset clears them', async ({ app }) => {
  const cells = app.locator('tbody [data-box-cell]');
  // Mouse moves use page coordinates, so the table has to be on screen first.
  await app.locator('drag-select-table').scrollIntoViewIfNeeded();
  const first = (await cells.nth(0).boundingBox())!;
  const third = (await cells.nth(2).boundingBox())!;
  await app.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await app.mouse.down();
  await app.mouse.move(third.x + third.width / 2, third.y + third.height / 2, { steps: 6 });
  await app.mouse.up();
  await expect(app.locator('[data-count]')).toHaveText('3 of 5');
  await expect(app.locator('tr[data-selected]')).toHaveCount(3);
  // shadcn/tailwind.css narrows `data-selected:` to "true"; the port's rows must still look selected.
  await expect(app.locator('tr[data-selected] th').first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await app.getByRole('button', { name: 'Reset form' }).click();
  await expect(app.locator('[data-count]')).toHaveText('0 of 5');
  await expect(app.locator('tr[data-selected]')).toHaveCount(0);
  await expect.poll(() => calls(app)).toEqual(['rows:["A","B","C"]', 'rows:[]']);
});

test('the sidebar resizes from the keyboard', async ({ app }) => {
  const side = app.locator('[data-side]');
  const before = (await side.boundingBox())!.width;
  await app.getByRole('separator', { name: 'Resize sidebar' }).focus();
  await app.keyboard.press('ArrowRight');
  await expect.poll(async () => (await side.boundingBox())!.width).toBeGreaterThan(before);
});

test('worm dots move to a slide, and a new slide joins the strip', async ({ app }) => {
  await app.getByRole('button', { name: 'Slide 3 of 3' }).click();
  await expect(app.locator('[data-counter]')).toHaveText('3 / 3');
  await app.getByRole('button', { name: 'Add slide' }).click();
  await expect(app.locator('[data-counter]')).toHaveText('1 / 4');
  await app.getByRole('button', { name: 'Slide 4 of 4' }).click();
  await expect(app.locator('[data-counter]')).toHaveText('4 / 4');
});
