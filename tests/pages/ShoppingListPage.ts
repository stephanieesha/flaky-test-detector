import { Page, expect } from '@playwright/test';
import { ShoppingListLocators } from '../locators/locators';

export class ShoppingListPage {
  private locators: ShoppingListLocators;

  constructor(private page: Page) {
    this.locators = new ShoppingListLocators(page);
  }

  async login(email: string, password: string) {
    await this.page.goto('/login');
    await this.locators.emailInput.fill(email);
    await this.locators.passwordInput.fill(password);
    await this.locators.signInButton.click();

    // Render's free tier can take 20-30s+ to wake from idle - a genuine
    // source of flakiness, not simulated, hence the generous timeout.
    await expect(this.page).not.toHaveURL(/login/i, { timeout: 45000 });
  }

  async goToCategories() {
    await this.locators.viewAllCategoriesButton.click();
  }

  async openCategory(name: string) {
    await this.locators.categoryByName(name).click();
  }

  async addItem(
    itemName: string,
    options: { brand?: string; unitPrice?: string; quantity?: string; frequency?: string; notes?: string } = {}
  ) {
    await this.locators.addItemButton.click();
    await this.locators.itemNameInput.fill(itemName);

    if (options.brand) {
      await this.locators.itemBrandInput.fill(options.brand);
    }
    if (options.unitPrice) {
      await this.locators.itemUnitPriceInput.fill(options.unitPrice);
    }
    if (options.quantity) {
      await this.locators.itemQuantityInput.fill(options.quantity);
    }
    if (options.frequency) {
      await this.locators.itemFrequencySelect.selectOption(options.frequency);
    }
    if (options.notes) {
      await this.locators.itemNotesInput.fill(options.notes);
    }

    await this.locators.saveItemButton.click();
    await expect(this.page.getByText(itemName, { exact: true })).toBeVisible({ timeout: 10000 });
  }

  async editItem(itemName: string, updates: { unitPrice?: string }) {
    const row = this.locators.itemRow(itemName);
    await this.locators.editButtonIn(row).click();

    if (updates.unitPrice) {
      await this.locators.itemUnitPriceInput.fill(updates.unitPrice);
    }

    await this.locators.saveEditButton.click();
  }

  async deleteItem(itemName: string) {
    const row = this.locators.itemRow(itemName);
    await this.locators.deleteButtonIn(row).click();
    await this.locators.confirmDeleteButton.click();
  }
}
