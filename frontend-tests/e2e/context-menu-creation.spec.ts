import { test, expect } from '@playwright/test';
import { 
  setupMocks, 
  clearMocks, 
} from '../utils/test-helpers';

test.describe('Context Menu - Item Creation', () => {
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

  test('should create subfolder via context menu', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Right-click on existing work folder
    await page.getByRole('button', { name: /work \(\d+\)/ }).click({ button: 'right' });
    
    // Click Add Subfolder
    await page.click('text=Add Subfolder');
    
    // Should create a new subfolder in edit mode
    const subfolderInput = page.locator('input[value="New Folder"]');
    await expect(subfolderInput).toBeVisible();
    
    // Type name and confirm
    await subfolderInput.fill('Project A');
    await page.keyboard.press('Enter');

    // Verify the subfolder appears under work folder
    await expect(page.getByRole('button', { name: /Project A \(\d+\)/ })).toBeVisible();
    
    // Verify it's nested under work folder (work should be expanded)
    await expect(page.getByRole('button', { name: /work \(\d+\)/ })).toBeVisible();
  });

  test('should create new note via context menu', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    await page.getByRole('button', { name: /work \(\d+\)/ }).click({ button: 'right' });
    
    await page.click('text=Add New Note');

    // Should navigate to new note editor
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Should show editor with title input
    await expect(page.locator('input.editor-title-input')).toBeVisible();
    await expect(page.locator('input.editor-title-input')).toHaveValue('Untitled');
    
    // Go back to verify note appears in work folder
    await page.goBack();

    // The new note should appear in the work folder
    await expect(page.getByRole('button', { name: 'Untitled' })).toBeVisible();
  });

  test('should create new whiteboard via context menu', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Right-click on work folder
    await page.getByRole('button', { name: /work \(\d+\)/ }).click({ button: 'right' });
    
    // Click Add New Whiteboard
    await page.click('text=Add New Whiteboard');
    
    // Should navigate to new whiteboard editor
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Should show editor with title input for whiteboard
    await expect(page.locator('input.mantine-Input-input')).toBeVisible();
    await expect(page.locator('input.mantine-Input-input')).toHaveValue('Untitled Whiteboard');

    // The new whiteboard should appear in the work folder
    await expect(page.getByRole('button', { name: 'Untitled Whiteboard' })).toBeVisible();
  });

  test('should auto-expand parent folder when creating subfolder', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create a new parent folder first
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    const folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await folderInput.fill('Test Parent');
    await page.keyboard.press('Enter');
    
    await expect(page.getByRole('button', { name: /Test Parent \(\d+\)/ })).toBeVisible();
    
    // Right-click on the parent folder and add subfolder
    await page.getByRole('button', { name: /Test Parent \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    // Create the subfolder
    const subfolderInput = page.locator('input[value="New Folder"]');
    await expect(subfolderInput).toBeVisible();
    await subfolderInput.fill('Child Folder');
    await page.keyboard.press('Enter');
    
    // Verify both parent and child are visible (parent should be expanded)
    await expect(page.getByRole('button', { name: /Test Parent \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Child Folder \(\d+\)/ })).toBeVisible();
  });

  test('should create items in deeply nested folders', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create a nested structure: Parent > Child > Grandchild
    
    // Create parent folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    let folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Parent');
    await page.keyboard.press('Enter');
    
    // Wait for Parent folder to appear
    await expect(page.getByRole('button', { name: /Parent \(\d+\)/ })).toBeVisible();
    
    // Create child folder
    await page.getByRole('button', { name: /Parent \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Child');
    await page.keyboard.press('Enter');
    
    // Wait for Child folder to appear and click it for grandchild
    await expect(page.getByRole('button', { name: /Child \(\d+\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Child \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await folderInput.fill('Grandchild');
    await page.keyboard.press('Enter');
    
    // Wait for Grandchild folder to appear
    await expect(page.getByRole('button', { name: /Grandchild \(\d+\)/ })).toBeVisible();
    
    // Now create a note in the grandchild folder
    await page.getByRole('button', { name: /Grandchild \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add New Note');
    
    // Should navigate to note editor
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    await expect(page.locator('input.editor-title-input')).toHaveValue('Untitled');
    
    // Go back and verify the note appears in the correct location
    await page.goBack();
    
    // All folders should be visible and expanded
    await expect(page.getByRole('button', { name: /Parent \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Child \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Grandchild \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Untitled' })).toBeVisible();
  });

  test('should handle multiple items creation in same folder', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create a test folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    // Wait for the input to appear and fill it
    const folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await folderInput.fill('Multi Items');
    await page.keyboard.press('Enter');
    
    await expect(page.getByRole('button', { name: /Multi Items \(\d+\)/ })).toBeVisible();
    
    // Create multiple items in this folder
    
    // 1. Add a subfolder
    await page.getByRole('button', { name: /Multi Items \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    const subfolderInput = page.locator('input[value="New Folder"]');
    await expect(subfolderInput).toBeVisible();
    await subfolderInput.fill('Subfolder 1');
    await page.keyboard.press('Enter');
    
    // 2. Add a note
    await page.getByRole('button', { name: /Multi Items \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add New Note');
    
    // Should navigate to note, go back
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    await page.goBack();
    
    // 3. Add a whiteboard
    await page.getByRole('button', { name: /Multi Items \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add New Whiteboard');
    
    // Should navigate to whiteboard, go back
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    await page.goBack();
    
    // Verify all items are visible in the folder
    await expect(page.getByRole('button', { name: /Multi Items \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Subfolder 1 \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Untitled', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Untitled Whiteboard' })).toBeVisible();
  });

  test('should handle unique naming for multiple subfolders', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create parent folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    let folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await folderInput.fill('Parent');
    await page.keyboard.press('Enter');
    
    await expect(page.getByRole('button', { name: /Parent \(\d+\)/ })).toBeVisible();
    
    // Create first subfolder
    await page.getByRole('button', { name: /Parent \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await page.keyboard.press('Enter'); // Keep default name
    
    // Create second subfolder - should get "New Folder (1)"
    await page.getByRole('button', { name: /Parent \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder (1)"]');
    await expect(folderInput).toBeVisible();
    await page.keyboard.press('Enter');
    
    // Create third subfolder - should get "New Folder (2)"
    await page.getByRole('button', { name: /Parent \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add Subfolder');
    
    folderInput = page.locator('input[value="New Folder (2)"]');
    await expect(folderInput).toBeVisible();
    await page.keyboard.press('Enter');
    
    // Verify all three subfolders exist with unique names
    await expect(page.getByRole('button', { name: /^New Folder \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^New Folder \(1\) \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^New Folder \(2\) \(\d+\)$/ })).toBeVisible();
  });

  test('should navigate correctly to newly created items', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Create note via context menu
    await page.getByRole('button', { name: /work \(\d+\)/ }).click({ button: 'right' });
    await page.click('text=Add New Note');
    
    // Should be on the note page
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Should be able to edit the note
    const titleInput = page.locator('input.editor-title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Test Note from Context Menu');
    
    // Save the note before going back (simulate Ctrl+S or wait for auto-save)
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500); // Allow save to complete
    
    // Go back to main app
    await page.goBack();
    
    // Wait for the note list to refresh, then look for the updated title
    await page.waitForTimeout(1000); // Allow sidebar to refresh
    await expect(page.getByRole('button', { name: 'Test Note from Context Menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Test Note from Context Menu' }).click();
    
    // Should navigate back to the same note
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    await expect(page.locator('input.editor-title-input')).toHaveValue('Test Note from Context Menu');
  });
}); 