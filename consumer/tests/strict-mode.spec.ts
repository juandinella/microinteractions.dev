import { calls, expect, test } from './fixture';

// Strict Mode runs every effect twice, so a callback fired on mount would show up here, twice.
test('no callback fires on mount', async ({ app }) => {
  await app.waitForTimeout(300);
  expect(await calls(app)).toEqual([]);
});

test('changing a collection keeps the selection and reports what changed once', async ({ app }) => {
  // Tabs: adding keeps the selected tab; removing it falls back to the first tab.
  await app.getByRole('button', { name: 'Add tab d' }).click();
  await expect(app.getByRole('tab', { name: /Tab b/ })).toHaveAttribute('aria-selected', 'true');
  await app.getByRole('button', { name: 'Remove tab b' }).click();
  await expect(app.getByRole('tab', { name: /Tab a/ })).toHaveAttribute('aria-selected', 'true');

  // Rows: a removed row takes its box with it; the others keep theirs.
  await app.getByRole('checkbox', { name: 'Row B' }).check();
  await app.getByRole('checkbox', { name: 'Row D' }).check();
  await app.getByRole('button', { name: 'Remove row D' }).click();
  await app.getByRole('button', { name: 'Add row F' }).click();
  await expect(app.getByRole('checkbox', { name: 'Row B' })).toBeChecked();
  await expect(app.locator('[data-count]')).toHaveText('1 of 5');

  // Options: the choice survives while it's an option, then falls back to the default.
  await app.getByText('Option z', { exact: true }).click();
  await app.getByRole('button', { name: 'Remove option y' }).click();
  await expect(app.getByRole('radio', { name: 'Option z' })).toBeChecked();
  await app.getByRole('button', { name: 'Remove option z' }).click();
  await expect(app.getByRole('radio', { name: 'Option x' })).toBeChecked();

  await expect.poll(() => calls(app)).toEqual([
    'tab:"a"',
    'rows:["B"]',
    'rows:["B","D"]',
    'rows:["B"]',
    'option:"z"',
    'option:"x"',
  ]);
});

test('defaults are read once', async ({ app }) => {
  await app.getByRole('button', { name: 'Change defaults' }).click();
  await app.waitForTimeout(200);
  await expect(app.getByRole('tab', { name: /Tab b/ })).toHaveAttribute('aria-selected', 'true');
  await expect(app.getByRole('radio', { name: 'Option x' })).toBeChecked();
  await expect(app.getByRole('slider', { name: 'Volume' })).toHaveValue('50');
  expect(await calls(app)).toEqual([]);
});
