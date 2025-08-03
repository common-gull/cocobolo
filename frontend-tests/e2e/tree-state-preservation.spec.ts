import { test, expect } from '@playwright/test';
import { 
  setupMocks, 
  clearMocks, 
} from '../utils/test-helpers';

test.describe('Tree State Preservation', () => {
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

  test('should maintain expansion state when creating subfolder', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create a multi-level folder structure
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    
    // Create Level 1
    await createFolderButton.click();
    let folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Level 1');
    await page.keyboard.press('Enter');
    
    // Create Level 2 inside Level 1
    await page.locator('text=Level 1').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Level 2');
    await page.keyboard.press('Enter');
    
    // Verify both levels are visible (Level 1 is expanded)
    await expect(page.locator('text=Level 1')).toBeVisible();
    await expect(page.locator('text=Level 2')).toBeVisible();
    
    // Now create Level 3 inside Level 2
    await page.locator('text=Level 2').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Level 3');
    await page.keyboard.press('Enter');
    
    // All three levels should still be visible
    await expect(page.locator('text=Level 1')).toBeVisible();
    await expect(page.locator('text=Level 2')).toBeVisible();
    await expect(page.locator('text=Level 3')).toBeVisible();
  });

  test('should preserve expansion state during note creation', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create nested folder structure
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    let folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Documents');
    await page.keyboard.press('Enter');
    
    // Create subfolder
    await page.locator('text=Documents').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Projects');
    await page.keyboard.press('Enter');
    
    // Both should be visible (Documents is expanded)
    await expect(page.locator('text=Documents')).toBeVisible();
    await expect(page.locator('text=Projects')).toBeVisible();
    
    // Create a note in the subfolder
    await page.locator('text=Projects').click({ button: 'right' });
    await page.click('text=Add New Note');
    
    // Should navigate to note
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Go back
    await page.goBack();
    
    // Expansion state should be preserved - all items visible
    await expect(page.locator('text=Documents')).toBeVisible();
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Untitled')).toBeVisible();
  });

  test('should maintain state across multiple operations', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Expand the existing work folder
    await page.locator('text=work').click(); // Expand it
    
    // Verify Meeting Notes is visible (work is expanded)
    await expect(page.locator('text=Meeting Notes')).toBeVisible();
    
    // Create a new folder at root level
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    const folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Archive');
    await page.keyboard.press('Enter');
    
    // Work folder should still be expanded (Meeting Notes visible)
    await expect(page.locator('text=work')).toBeVisible();
    await expect(page.locator('text=Meeting Notes')).toBeVisible();
    await expect(page.locator('text=Archive')).toBeVisible();
    
    // Add a subfolder to Archive
    await page.locator('text=Archive').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    const subfolderInput = page.locator('input[value="New Folder"]');
    await subfolderInput.fill('Old Projects');
    await page.keyboard.press('Enter');
    
    // All items should still be visible
    await expect(page.locator('text=work')).toBeVisible();
    await expect(page.locator('text=Meeting Notes')).toBeVisible();
    await expect(page.locator('text=Archive')).toBeVisible();
    await expect(page.locator('text=Old Projects')).toBeVisible();
  });

  test('should preserve state when creating items in different folders', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create two parent folders
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    
    // First folder
    await createFolderButton.click();
    let folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Folder A');
    await page.keyboard.press('Enter');
    
    // Second folder
    await createFolderButton.click();
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Folder B');
    await page.keyboard.press('Enter');
    
    // Add content to Folder A
    await page.locator('text=Folder A').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('A Child');
    await page.keyboard.press('Enter');
    
    // Add content to Folder B
    await page.locator('text=Folder B').click({ button: 'right' });
    await page.click('text=Add New Note');
    
    // Should navigate to note
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    await page.goBack();
    
    // Both folder structures should be visible
    await expect(page.locator('text=Folder A')).toBeVisible();
    await expect(page.locator('text=A Child')).toBeVisible();
    await expect(page.locator('text=Folder B')).toBeVisible();
    await expect(page.locator('text=Untitled')).toBeVisible();
  });


  test('should maintain state across navigation and back', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create complex folder structure
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    let folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Navigation Test');
    await page.keyboard.press('Enter');
    
    // Add multiple items
    await page.locator('text=Navigation Test').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Subfolder');
    await page.keyboard.press('Enter');
    
    await page.locator('text=Navigation Test').click({ button: 'right' });
    await page.click('text=Add New Note');
    
    // Should navigate to note
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Edit the note
    const titleInput = page.locator('input.editor-title-input');
    await titleInput.fill('Test Note');
    
    // Save the note before going back (simulate Ctrl+S or wait for auto-save)
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500); // Wait for save to complete
    
    // Navigate back
    await page.goBack();
    
    // Tree state should be preserved
    await expect(page.locator('text=Navigation Test')).toBeVisible();
    await expect(page.locator('text=Subfolder')).toBeVisible();
    await expect(page.locator('text=Test Note')).toBeVisible();
    
    // Navigate to the note again
    await page.click('text=Test Note');
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Go back again
    await page.goBack();
    
    // State should still be preserved
    await expect(page.locator('text=Navigation Test')).toBeVisible();
    await expect(page.locator('text=Subfolder')).toBeVisible();
    await expect(page.locator('text=Test Note')).toBeVisible();
  });

  test('should handle mixed expansion states correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create multiple folders, expand some, leave others collapsed
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    
    // Expanded folder with content
    await createFolderButton.click();
    let folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Expanded');
    await page.keyboard.press('Enter');
    
    await page.locator('text=Expanded').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Visible Child');
    await page.keyboard.press('Enter');
    
    // Collapsed folder (just create it, don't expand)
    await createFolderButton.click();
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Collapsed');
    await page.keyboard.press('Enter');
    
    // Verify initial state
    await expect(page.locator('text=Expanded')).toBeVisible();
    await expect(page.locator('text=Visible Child')).toBeVisible();
    await expect(page.locator('text=Collapsed')).toBeVisible();
    
    // Add content to the collapsed folder via context menu
    await page.locator('text=Collapsed').click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Hidden Child');
    await page.keyboard.press('Enter');
    
    // Now collapsed folder should be expanded, but expanded folder should remain expanded
    await expect(page.locator('text=Expanded')).toBeVisible();
    await expect(page.locator('text=Visible Child')).toBeVisible();
    await expect(page.locator('text=Collapsed')).toBeVisible();
    await expect(page.locator('text=Hidden Child')).toBeVisible();
  });
}); 