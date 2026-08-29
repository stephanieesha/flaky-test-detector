import { test, expect } from '@playwright/test';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { uniqueName } from './helpers/testData';

const EMAIL = process.env.TEST_EMAIL || '';
const PASSWORD = process.env.TEST_PASSWORD || '';
const CATEGORY_NAME = process.env.TEST_CATEGORY_NAME || 'Test 1';

test.beforeEach(async ({ page }) => {
  if (!EMAIL || !PASSWORD) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set (see .env.example / GitHub Secrets)');
  }
  const app = new ShoppingListPage(page);
  await app.login(EMAIL, PASSWORD);
  await app.goToCategories();
  await app.openCategory(CATEGORY_NAME);
});

test('user can log in and reach a category', async ({ page }) => {
  await expect(page).not.toHaveURL(/login/i);
});

test('add an item to the category', async ({ page }) => {
  const app = new ShoppingListPage(page);
  const itemName = uniqueName('item');

  await app.addItem(itemName, { brand: 'Test Brand', unitPrice: '300', quantity: '2' });
  await app.deleteItem(itemName);
});

test.describe('Editing an item', () => {
  // Same real-world flakiness pattern, demonstrated two ways: checking the
  // UI too soon after an edit (fragile, fixed wait) vs. waiting for the
  // actual condition (robust, auto-retrying assertion).

  test('edit an item [fragile: fixed wait]', async ({ page }) => {
    const app = new ShoppingListPage(page);
    const itemName = uniqueName('item');
    const updatedPrice = '3000';
    const formattedPrice = `₦${Number(updatedPrice).toLocaleString('en-US')}`;

    await app.addItem(itemName, { unitPrice: '300' });
    await app.editItem(itemName, { unitPrice: updatedPrice });
    await page.waitForTimeout(300);
    await expect(page.getByRole('row', { name: itemName })).toContainText(formattedPrice);

    await app.deleteItem(itemName);
  });

  test('edit an item [robust: condition wait]', async ({ page }) => {
    const app = new ShoppingListPage(page);
    const itemName = uniqueName('item');
    const updatedPrice = '3000';
    const formattedPrice = `₦${Number(updatedPrice).toLocaleString('en-US')}`;

    await app.addItem(itemName, { unitPrice: '300' });
    await app.editItem(itemName, { unitPrice: updatedPrice });
    await expect(page.getByRole('row', { name: itemName })).toContainText(formattedPrice, { timeout: 10000 });

    await app.deleteItem(itemName);
  });
});

test('delete an item from the category', async ({ page }) => {
  const app = new ShoppingListPage(page);
  const itemName = uniqueName('item');

  await app.addItem(itemName);
  await app.deleteItem(itemName);

  await expect(page.getByText(itemName, { exact: true })).toHaveCount(0, { timeout: 10000 });
});
