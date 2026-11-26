import { calls, expect, hold, test } from './fixture';

test('the server markup hydrates with one form and every element', async ({ app, request }) => {
  const html = await (await request.get('/')).text();
  // A nested form would be dropped by the parser and break hydration.
  expect(html.match(/<form\b/g)).toHaveLength(1);
  for (const tag of ['hold-to-confirm', 'drag-select-table', 'worm-dots', 'drag-reorder', 'faq-panel', 'tick-rail', 'aligned-select']) expect(html).toContain(`<${tag}`);
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

test('the slider and the gooey group submit their values, and disabled leaves them out', async ({ app }) => {
  const values = () => app.evaluate(() => {
    const data = new FormData(document.querySelector('form')!);
    return [data.get('volume'), data.get('delivery')];
  });
  const slider = app.getByRole('slider', { name: 'Volume' });
  expect(await values()).toEqual(['50', 'x']);
  await slider.focus();
  await app.keyboard.press('End');
  await app.getByText('Option z', { exact: true }).click();
  expect(await values()).toEqual(['100', 'z']);

  await app.getByRole('button', { name: 'Toggle volume and delivery' }).click();
  await expect(slider).toBeDisabled();
  await expect(app.getByRole('radio', { name: 'Option y' })).toBeDisabled();
  expect(await values()).toEqual([null, null]);
  await expect(app.locator('edge-aware-tooltip')).toHaveCSS('opacity', '0.5');
  const option = app.getByText('Option y', { exact: true });
  await expect(option).toHaveCSS('opacity', '0.5');
  await expect(option).toHaveCSS('cursor', 'not-allowed');
  await option.click({ force: true });
  await option.hover();
  // Past the ring's 150ms fade, a hover on a disabled option still shows no ring.
  await app.waitForTimeout(200);
  expect(await option.locator('span').first().evaluate((ring) => getComputedStyle(ring, '::after').opacity)).toBe('0');
  await expect(app.getByRole('radio', { name: 'Option z' })).toBeChecked();
  await app.getByRole('button', { name: 'Toggle volume and delivery' }).click();
  expect(await values()).toEqual(['100', 'z']);

  // A disabled fieldset around the slider disables it the same way.
  const group = app.getByRole('group', { name: 'Edge-aware tooltip' });
  await group.evaluate((fieldset: HTMLFieldSetElement) => (fieldset.disabled = true));
  await expect(slider).toBeDisabled();
  await expect(app.locator('edge-aware-tooltip')).toHaveCSS('opacity', '0.5');
  expect((await values())[0]).toBeNull();
  await group.evaluate((fieldset: HTMLFieldSetElement) => (fieldset.disabled = false));
  expect(await calls(app)).toEqual(['volume:100', 'option:"z"']);
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
  // Reads each pour in the choice's own task, after the component's handler: on a busy runner the 340ms pour can land
  // before the next round trip.
  const choose = async (option: string) => {
    const read = await app.evaluateHandle(() => {
      const read = { animations: 0, start: '' };
      addEventListener('change', () => {
        const pours = [...document.querySelectorAll('[data-goo-blob]')].flatMap((blob) => blob.getAnimations());
        read.animations = pours.length;
        // The head is the last blob.
        read.start = (pours.at(-1)!.effect as KeyframeEffect).getKeyframes()[0].transform as string;
      }, { once: true });
      return read;
    });
    await app.getByText(option, { exact: true }).click();
    return read.jsonValue();
  };
  expect((await choose('Option z')).animations).toBe(8);
  await expect.poll(() => app.locator('[data-goo-blob]').evaluateAll((blobs) => blobs.flatMap((blob) => blob.getAnimations()).length)).toBe(0);
  await app.getByRole('button', { name: 'Reset form' }).click();
  await expect(app.getByRole('radio', { name: 'Option x' })).toBeChecked();
  await expect.poll(() => head().evaluate((blob) => new DOMMatrix(getComputedStyle(blob).transform).m42)).toBe(0);
  const { start } = await choose('Option y');
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

test('a keyboard move reorders the list and reports the new order once', async ({ app }) => {
  await app.getByRole('button', { name: 'Task A' }).focus();
  await app.keyboard.press('Space');
  await app.keyboard.press('ArrowDown');
  await app.keyboard.press('Space');
  await expect(app.getByRole('list', { name: 'Tasks', exact: true }).locator('[data-label]')).toHaveText(['Task B', 'Task A', 'Task C']);
  expect((await calls(app)).filter((call) => call.startsWith('reorder'))).toEqual(['reorder:["b","a","c"]']);
});

test('a list that takes its new order back as items keeps focus and the announcement', async ({ app }) => {
  const list = app.getByRole('list', { name: 'Saved tasks' });
  const handle = list.getByRole('button', { name: 'Saved x' });
  await handle.focus();
  await app.keyboard.press('Space');
  await app.keyboard.press('ArrowDown');
  await app.keyboard.press('Space');
  await expect(list.locator('[data-label]')).toHaveText(['Saved y', 'Saved x', 'Saved z']);
  await expect(list.locator('[data-position]')).toHaveText(['01', '02', '03']);
  // A remount would drop focus to <body> and take the live region with it.
  await expect(handle).toBeFocused();
  await expect(list.locator('xpath=ancestor::drag-reorder').locator('[data-status]')).toHaveText('Dropped Saved x at position 2 of 3.');

  await app.keyboard.press('Space');
  await app.keyboard.press('ArrowDown');
  await app.keyboard.press('Space');
  await expect(list.locator('[data-label]')).toHaveText(['Saved y', 'Saved z', 'Saved x']);
  await expect(handle).toBeFocused();

  await app.getByRole('button', { name: 'Reverse saved tasks' }).click();
  await expect(list.locator('[data-label]')).toHaveText(['Saved x', 'Saved z', 'Saved y']);
  await expect(list.locator('[data-position]')).toHaveText(['01', '02', '03']);
  await handle.focus();
  await app.keyboard.press('Space');
  await app.keyboard.press('End');
  await app.keyboard.press('Space');
  await expect(list.locator('[data-label]')).toHaveText(['Saved z', 'Saved y', 'Saved x']);
  await expect(handle).toBeFocused();
  expect((await calls(app)).filter((call) => call.startsWith('saved'))).toEqual([
    'saved:["y","x","z"]',
    'saved:["y","z","x"]',
    'saved:["z","y","x"]',
  ]);
});

test('the FAQ opens one answer at a time, keeps the rest findable, and reports each change once', async ({ app }) => {
  const question = (name: string) => app.getByRole('button', { name: `Question ${name}` });
  await expect(question('two')).toHaveAttribute('aria-expanded', 'true');
  await expect(app.getByRole('region', { name: 'Question two' })).toHaveText('Answer two');
  // The element turns React's hidden into hidden="until-found" for find in page.
  await expect(app.locator('faq-panel [data-answer][hidden="until-found"]')).toHaveCount(2);

  await question('three').click();
  await expect(question('three')).toHaveAttribute('aria-expanded', 'true');
  await expect(question('two')).toHaveAttribute('aria-expanded', 'false');
  await expect(app.locator('faq-panel [data-answer][hidden="until-found"]')).toHaveCount(2);

  await question('three').focus();
  await app.keyboard.press('Home');
  await expect(question('one')).toBeFocused();
  await app.keyboard.press('Enter');
  await expect(question('one')).toHaveAttribute('aria-expanded', 'true');
  await question('one').click();
  await expect(app.locator('faq-panel [data-answer][hidden="until-found"]')).toHaveCount(3);

  expect((await calls(app)).filter((call) => call.startsWith('faq'))).toEqual(['faq:"three"', 'faq:"one"', 'faq:null']);
});

test('the tick rail previews the section under the pointer and follows the scroll', async ({ app }) => {
  const rail = app.locator('tick-rail');
  const tick = (name: string) => rail.getByRole('link', { name: `Section ${name}` });
  await expect(tick('one')).toHaveAttribute('aria-current', 'location');
  await expect(tick('three')).toHaveAccessibleDescription('About three');

  await tick('three').hover();
  await expect(rail.locator('[data-card]')).toHaveAttribute('data-showing', '');
  await expect(rail.locator('[data-card-box] [data-face]:not([data-leaving]) [data-face-title]')).toHaveText('Section three');

  // Inside its own scrolling area, a click scrolls that area and focuses the section, without a hash.
  await tick('two').click();
  await expect(tick('two')).toHaveAttribute('aria-current', 'location');
  await expect(app.locator('#section-two')).toBeFocused();
  expect(await app.evaluate(() => location.hash)).toBe('');
});

test('the aligned select opens on its value, picks by key, and reports only real changes', async ({ app }) => {
  const trigger = app.getByRole('combobox', { name: 'Region' });
  await expect(trigger).toHaveText('Lima');
  await expect(app.locator('aligned-select [role="option"][aria-selected="true"]')).toHaveText('Lima');

  // On screen first: the menu is placed in window pixels, and the site tests cover the focus that scrolls.
  await trigger.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await app.waitForTimeout(100);
  await trigger.focus();
  await app.keyboard.press('ArrowDown');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const gap = await app.locator('aligned-select').evaluate((el) => {
    const value = el.querySelector('[data-display]')!.getBoundingClientRect();
    const label = el.querySelector('[aria-selected="true"] [data-label]')!.getBoundingClientRect();
    return Math.abs(value.top + value.height / 2 - (label.top + label.height / 2));
  });
  expect(gap).toBeLessThanOrEqual(0.5);

  // Picking the current option again reports nothing.
  await app.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(await calls(app)).toEqual([]);

  await app.keyboard.press('ArrowDown');
  await app.keyboard.press('ArrowDown');
  await app.keyboard.press('Enter');
  await expect(trigger).toHaveText('Tokyo');
  // Typeahead on the closed trigger changes the value too.
  await app.keyboard.press('l');
  await expect(trigger).toHaveText('Lagos');
  expect(await calls(app)).toEqual(['select:"Tokyo"', 'select:"Lagos"']);
  await expect(app.locator('aligned-select [role="option"][aria-selected="true"]')).toHaveText('Lagos');
});

test('the aligned select submits its value in a form, a reset restores it silently, and disabled leaves it out', async ({ app }) => {
  const trigger = app.getByRole('combobox', { name: 'Region' });
  const region = () => app.evaluate(() => new FormData(document.querySelector('form')!).get('region'));
  await expect.poll(region).toBe('Lima');
  await trigger.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await app.waitForTimeout(100);
  await trigger.focus();
  await app.keyboard.press('ArrowDown');
  await app.keyboard.press('ArrowDown');
  await app.keyboard.press('Enter');
  await expect(trigger).toHaveText('Tokyo');
  expect(await region()).toBe('Tokyo');
  expect(await calls(app)).toEqual(['select:"Tokyo"']);

  // The reset restores defaultValue and, like a native select, tells nobody.
  await app.getByRole('button', { name: 'Reset form' }).click();
  await expect(trigger).toHaveText('Lima');
  await expect.poll(region).toBe('Lima');
  expect(await calls(app)).toEqual(['select:"Tokyo"']);

  await app.getByRole('button', { name: 'Toggle region' }).click();
  await expect(trigger).toBeDisabled();
  await expect.poll(region).toBeNull();
  await app.getByRole('button', { name: 'Toggle region' }).click();
  await expect.poll(region).toBe('Lima');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
});
