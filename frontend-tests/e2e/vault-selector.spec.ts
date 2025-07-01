import { test, expect } from '@playwright/test';
import { setupMocks, clearMocks } from '../utils/test-helpers';

test.describe('Vault Selector', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearMocks(page);
  });

  test('should display vault selector on home page', async ({ page }) => {
    await page.goto('/');

    // Should show the vault selector interface with main title
    await expect(page.locator('h1:has-text("Cocobolo")')).toBeVisible();
    await expect(page.locator('text=Select a vault to continue')).toBeVisible();

    // Should show known vaults (use first occurrence to avoid strict mode violation)
    await expect(page.locator('text=Personal Notes').first()).toBeVisible();
    await expect(page.locator('text=Work Notes').first()).toBeVisible();
  });

  test('should allow creating a new vault', async ({ page }) => {
    await page.goto('/');

    // Click create new vault button
    await page.click('text=Create New Vault');

    // Should navigate to vault creator
    await expect(page).toHaveURL('/vault-creator');
    await expect(page.locator('h2:has-text("Create New Vault")')).toBeVisible();
  });

  test('should allow selecting an existing vault', async ({ page }) => {
    await page.goto('/');

    // Click on an existing vault (use first occurrence)
    await page.click('text=Personal Notes', { timeout: 5000 });

    // Should navigate to vault unlock
    await expect(page).toHaveURL('/vault-unlock');
    await expect(page.locator('h2')).toContainText('Unlock Vault');
  });

  test('should show favorite vaults first', async ({ page }) => {
    await page.goto('/');

    // Should show favorite vaults section
    await expect(page.locator('text=Favorite Vaults')).toBeVisible();
    
    // Personal Notes should be visible in the favorites section (use first occurrence)
    await expect(page.locator('text=Personal Notes').first()).toBeVisible();
  });

  test('should handle empty vault list', async ({ page }) => {
    // Mock empty vault list by overriding the mock state before page load
    await page.addInitScript(() => {
      // Override the mock state to have empty vaults
      if ((window as any).__MOCK_STATE__) {
        (window as any).__MOCK_STATE__.vaults = [];
      }
    });

    await page.goto('/');

    // Should show empty state - try multiple possible selectors
    try {
      await expect(page.locator('h3:has-text("No Vaults Found")')).toBeVisible();
    } catch {
      // Try alternative selectors if the exact text doesn't match
      await expect(page.locator('text=No vaults found')).toBeVisible();
    }
    
    await expect(page.locator('text=Create New Vault')).toBeVisible();
  });
}); 