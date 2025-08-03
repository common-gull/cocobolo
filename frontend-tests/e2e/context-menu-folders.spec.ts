import { test, expect } from '@playwright/test';
import { 
  setupMocks, 
  clearMocks, 
} from '../utils/test-helpers';

test.describe('Context Menu - Folders', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    
    // Go through proper unlock flow
    await page.goto('/vault-unlock');
    await page.fill('input[type="password"]', 'correct-password');
    
    await Promise.all([
      page.waitForURL('/app', { timeout: 10000 }),
      page.click('button:has-text("Unlock Vault")')
    ]);
    
    // Wait for the main app content to load
    await expect(page.locator('button:has-text("Create Note")')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    await clearMocks(page);
  });

  test('should display context menu when right-clicking on folder', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // First create a folder to test with
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    const folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await folderInput.press('Enter');
    
    // Wait for folder to be created
    await expect(page.locator('text=New Folder')).toBeVisible();
    
    // Right-click on the folder
    await page.locator('text=New Folder').click({ button: 'right' });
    
    // Verify context menu appears with all expected items
    await expect(page.locator('text=Add Subfolder')).toBeVisible();
    await expect(page.locator('text=Add New Note')).toBeVisible();
    await expect(page.locator('text=Add New Whiteboard')).toBeVisible();
    await expect(page.locator('text=Rename Folder')).toBeVisible();
    await expect(page.locator('text=Delete Folder')).toBeVisible();
  });

  test('should show correct menu items in proper order', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Use existing work folder
    await page.locator('text=work').click({ button: 'right' });
    
    // Get all menu items and verify order
    const menuItems = page.locator('[role="menuitem"]');
    
    await expect(menuItems.nth(0)).toContainText('Add Subfolder');
    await expect(menuItems.nth(1)).toContainText('Add New Note');
    await expect(menuItems.nth(2)).toContainText('Add New Whiteboard');
    // There should be a divider here
    await expect(menuItems.nth(3)).toContainText('Rename Folder');
    await expect(menuItems.nth(4)).toContainText('Delete Folder');
  });

  test('should close context menu on escape key', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Right-click to open context menu
    await page.locator('text=work').click({ button: 'right' });
    
    // Verify menu is open
    await expect(page.locator('text=Add Subfolder')).toBeVisible();
    
    // Press escape to close
    await page.keyboard.press('Escape');
    
    // Verify menu is closed
    await expect(page.locator('text=Add Subfolder')).not.toBeVisible();
  });

  test('should close context menu on outside click', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Right-click to open context menu
    await page.locator('text=work').click({ button: 'right' });
    
    // Verify menu is open
    await expect(page.locator('text=Add Subfolder')).toBeVisible();
    
    // Click outside the menu
    await page.click('body', { position: { x: 50, y: 50 } });
    
    // Verify menu is closed
    await expect(page.locator('text=Add Subfolder')).not.toBeVisible();
  });

  test('should not show folder context menu on notes', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Right-click on a note
    await page.locator('text=Welcome to Cocobolo').click({ button: 'right' });
    
    // Should not show folder-specific options
    await expect(page.locator('text=Add Subfolder')).not.toBeVisible();
    await expect(page.locator('text=Add New Note')).not.toBeVisible();
    await expect(page.locator('text=Add New Whiteboard')).not.toBeVisible();
    
    // Should show note-specific options (only Delete is available for notes currently)
    await expect(page.locator('text=Delete Note')).toBeVisible();
  });

  test('should maintain context menu functionality for existing rename/delete', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create a test folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    const folderInput = page.locator('input[value="New Folder"]');
    await folderInput.press('Enter');
    await expect(page.locator('text=New Folder')).toBeVisible();
    
    // Right-click and test rename functionality
    await page.locator('text=New Folder').click({ button: 'right' });
    await page.click('text=Rename Folder');
    
    // Should open inline editing
    const renameInput = page.locator('input[value="New Folder"]');
    await expect(renameInput).toBeVisible();
    
    await renameInput.fill('Renamed Test Folder');
    await page.keyboard.press('Enter');
    
    // Verify rename worked
    await expect(page.locator('text=Renamed Test Folder')).toBeVisible();
    
    // Test delete functionality
    await page.getByRole('button', { name: /Renamed Test Folder \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Delete Folder');
    await page.click('button:has-text("Delete")');
    
    // Verify folder is deleted (check for the specific folder button, not text in dialog)
    await expect(page.getByRole('button', { name: /Renamed Test Folder \(\d+\)/ })).not.toBeVisible();
  });

  test('should handle context menu on nested folders', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create a parent folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    const parentInput = page.locator('input[value="New Folder"]');
    await parentInput.fill('Parent Folder');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('text=Parent Folder')).toBeVisible();
    
    // Expand the parent folder and create a subfolder
    await page.locator('text=Parent Folder').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    // Should create subfolder in edit mode
    const subfolderInput = page.locator('input[value="New Folder"]');
    await expect(subfolderInput).toBeVisible();
    await subfolderInput.fill('Child Folder');
    await page.keyboard.press('Enter');
    
    // Verify child folder exists and has context menu
    await expect(page.locator('text=Child Folder')).toBeVisible();
    
    // Right-click on child folder
    await page.locator('text=Child Folder').click({ button: 'right' });
    
    // Should show full context menu
    await expect(page.locator('text=Add Subfolder')).toBeVisible();
    await expect(page.locator('text=Add New Note')).toBeVisible();
    await expect(page.locator('text=Add New Whiteboard')).toBeVisible();
  });
}); 