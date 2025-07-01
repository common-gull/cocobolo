import { test, expect } from '@playwright/test';
import { setupMocks, clearMocks } from '../utils/test-helpers';

test.describe('Vault Unlock', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    // Navigate to vault unlock page
    await page.goto('/vault-unlock');
  });

  test.afterEach(async ({ page }) => {
    await clearMocks(page);
  });

  test('should display unlock form', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Unlock Vault');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Unlock Vault")')).toBeVisible();
  });

  test('should unlock vault with correct password', async ({ page }) => {
    // Enter correct password
    await page.fill('input[type="password"]', 'correct-password');
    await page.click('button:has-text("Unlock Vault")');
    
    // Should navigate to main app
    await expect(page).toHaveURL('/app');
    await expect(page.locator('text=Welcome to Cocobolo')).toBeVisible();
  });

  test('should show error with incorrect password', async ({ page }) => {
    // Enter incorrect password
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button:has-text("Unlock Vault")');
    
    // Should show error message (use first occurrence)
    await expect(page.locator('text=Invalid password').first()).toBeVisible();
    
    // Should stay on unlock page
    await expect(page).toHaveURL('/vault-unlock');
  });


  test('should validate empty password', async ({ page }) => {
    // Try to click the unlock button without entering a password
    const unlockButton = page.locator('button:has-text("Unlock Vault")');
    
    // The button should be disabled when no password is entered
    await expect(unlockButton).toBeDisabled();
    
    // Enter a password to enable the button
    await page.fill('input[type="password"]', 'test');
    await expect(unlockButton).toBeEnabled();
  });
}); 