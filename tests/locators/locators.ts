import { Page, Locator } from '@playwright/test';

export class ShoppingListLocators {
  constructor(private page: Page) {}

  get emailInput(): Locator {
    return this.page.getByRole('textbox', { name: 'you@example.com' });
  }

  get passwordInput(): Locator {
    return this.page.getByRole('textbox', { name: '••••••••' });
  }

  get signInButton(): Locator {
    return this.page.locator('form').getByRole('button', { name: 'Sign in' });
  }

  get viewAllCategoriesButton(): Locator {
    return this.page.getByRole('button', { name: 'View all' });
  }

  categoryByName(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }

  get addItemButton(): Locator {
    return this.page.getByRole('button', { name: '+ Add item' });
  }

  get itemNameInput(): Locator {
    return this.page.getByRole('textbox', { name: 'e.g. Indomie noodles' });
  }

  get itemBrandInput(): Locator {
    return this.page.getByRole('textbox', { name: 'e.g. Dangote' });
  }

  get itemUnitPriceInput(): Locator {
    return this.page.locator('input[name="unitPrice"]');
  }

  get itemQuantityInput(): Locator {
    // No real accessible label on this input - Playwright falls back to its
    // current value as the accessible name (recorded default: "1").
    return this.page.getByRole('spinbutton', { name: '1' });
  }

  get itemFrequencySelect(): Locator {
    return this.page.getByRole('combobox');
  }

  get itemNotesInput(): Locator {
    return this.page.getByRole('textbox', { name: 'e.g. the chicken flavour' });
  }

  get saveItemButton(): Locator {
    return this.page.getByRole('button', { name: 'Save item' });
  }

  get saveEditButton(): Locator {
    return this.page.getByRole('button', { name: 'Save' });
  }

  get confirmDeleteButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete' });
  }

  itemRow(itemName: string): Locator {
    // Items render as table rows with the name and action buttons in
    // separate cells, so the row's combined accessible name is used to
    // target the whole row rather than traversing from the name cell.
    return this.page.getByRole('row', { name: itemName });
  }

  editButtonIn(row: Locator): Locator {
    return row.getByRole('button', { name: '✏️' });
  }

  deleteButtonIn(row: Locator): Locator {
    return row.getByRole('button', { name: '✕' });
  }
}
