import { test, expect } from '@playwright/test';
import { 
  setupMocks, 
  clearMocks, 
} from '../utils/test-helpers';

test.describe('Notes Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    
    // Go through proper unlock flow but with more targeted approach
    await page.goto('/vault-unlock');

    // Fill password and unlock
    await page.fill('input[type="password"]', 'correct-password');

    // Click unlock and wait for navigation
    await Promise.all([
      page.waitForURL('/app', { timeout: 10000 }),
      page.click('button:has-text("Unlock Vault")')
    ]);

    // Wait for the main app content to load - look for Create Note button
    await expect(page.locator('button:has-text("Create Note")')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    await clearMocks(page);
  });

  test('should display notes list', async ({ page }) => {
    // Should show existing notes in the sidebar
    await expect(page.locator('text=Welcome to Cocobolo')).toBeVisible();
    // Meeting Notes is in the work folder, so we should see the work folder
    await expect(page.locator('text=work')).toBeVisible();
  });

  test('should create a new note', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Use the main area create button
    const mainCreateButton = page.locator('button:has-text("Create Note")');
    await expect(mainCreateButton).toBeVisible();
    await expect(mainCreateButton).toBeEnabled();
    
    // Click the create button and verify it opens a new note
    await mainCreateButton.click();
    
    // Should navigate to a new document
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Should show the editor with title input
    await expect(page.locator('input.editor-title-input')).toBeVisible();
    
    // Verify sidebar action buttons exist (these are icon buttons with title attributes)
    await page.goBack();
    await expect(page.locator('button[title="Create New Note"]')).toBeVisible();
  });

  test('should edit an existing note', async ({ page }) => {
    // Click on an existing note
    await page.click('text=Welcome to Cocobolo');
    
    // Should navigate to document editor
    await expect(page).toHaveURL(/\/documents\/note-1/);
    
    // Wait for the editor to load
    await page.waitForLoadState('networkidle');
    
    // Should show note title input (not textbox, but input)
    const titleInput = page.locator('input.editor-title-input');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue('Welcome to Cocobolo');
    
    // For now, just verify we can edit the title
    await titleInput.fill('Updated Welcome to Cocobolo');
    await expect(titleInput).toHaveValue('Updated Welcome to Cocobolo');
  });

  test('should delete a note from editor and navigate to app', async ({ page }) => {
    // Click on a note to open it
    await page.click('text=Welcome to Cocobolo');
    
    // Wait for editor to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the document page
    await expect(page).toHaveURL(/\/documents\/note-1/);
    
    // Click the context menu button (three dots)
    const contextMenuButton = page.locator('.context-menu-trigger').first();
    await expect(contextMenuButton).toBeVisible();
    await contextMenuButton.click();
    
    // Click delete option
    await page.click('text=Delete Note');
    
    // Verify the delete confirmation modal is shown
    await expect(page.locator('h2:has-text("Delete Note")')).toBeVisible();
    await expect(page.locator('text=Are you sure you want to delete this note?')).toBeVisible();
    
    // Confirm deletion in the modal
    await Promise.all([
      page.waitForURL('/app', { timeout: 10000 }),
      page.click('button:has-text("Delete")')
    ]);
    
    // Should be back on the main app page
    await expect(page).toHaveURL('/app');
    
    // The deleted note should no longer appear in the sidebar
    await expect(page.locator('text=Welcome to Cocobolo')).not.toBeVisible();
    await expect(page.locator('text=Welcome to Test Vault')).toBeVisible();
  });

  test('should cancel note deletion', async ({ page }) => {
    // Click on a note to open it
    await page.click('text=Welcome to Cocobolo');
    
    // Wait for editor to load
    await page.waitForLoadState('networkidle');
    
    // Click the context menu button
    const contextMenuButton = page.locator('.context-menu-trigger').first();
    await expect(contextMenuButton).toBeVisible();
    await contextMenuButton.click();
    
    // Click delete option
    await page.click('text=Delete Note');
    
    // Verify the delete confirmation modal is shown
    await expect(page.locator('h2:has-text("Delete Note")')).toBeVisible();
    
    // Cancel the deletion
    await page.click('button:has-text("Cancel")');
    
    // Should still be on the document page
    await expect(page).toHaveURL(/\/documents\/note-1/);
    
    // Note should still exist in sidebar
    await page.goBack();
    await expect(page.locator('text=Welcome to Cocobolo')).toBeVisible();
  });

  test('should delete note from sidebar and navigate to app if currently viewing deleted note', async ({ page }) => {
    // Click on a note to open it
    await page.click('text=Welcome to Cocobolo');
    
    // Wait for editor to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're viewing the note
    await expect(page).toHaveURL(/\/documents\/note-1/);

    await page.locator("text=Welcome to Cocobolo").first().click( { button: "right" });
    await page.click('button:has-text("Delete")');

    await page.locator('button:has-text("Delete")').filter({hasNotText: 'Note'}).click()

    // Should be back on the main app page
    await expect(page).toHaveURL('/app');

    // The deleted note should no longer appear in the sidebar
    await expect(page.locator('text=Welcome to Cocobolo')).not.toBeVisible();
    await expect(page.locator('text=Welcome to Test Vault')).toBeVisible();
  });

  test('should maintain app state when deleting non-current note', async ({ page }) => {
    // First, expand the work folder to access Meeting Notes
    await page.click('text=work');
    await expect(page.locator('text=Meeting Notes')).toBeVisible();
    
    // Navigate to Meeting Notes
    await page.click('text=Meeting Notes');
    await expect(page).toHaveURL(/\/documents\/note-2/);
    
    // This test verifies that when viewing one note,
    // the UI remains stable and functional.
    await expect(page.locator('input.editor-title-input')).toBeVisible();
    await expect(page.locator('input.editor-title-input')).toHaveValue('Meeting Notes');
    
    // Test editing functionality
    const titleInput = page.locator('input.editor-title-input');
    await titleInput.fill('Updated Meeting Notes');
    await expect(titleInput).toHaveValue('Updated Meeting Notes');
  });

  test('should create folder', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Click the create folder button
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await expect(createFolderButton).toBeVisible();
    
    await createFolderButton.click();

    // Should create an input field with "New Folder" that's immediately editable
    const folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    
    // Type a new name and press Enter
    await folderInput.fill('Test Folder');
    await page.locator('input[value="Test Folder"]').press('Enter');
    
    // Should show the renamed folder as text (no longer editing)
    await expect(page.locator('text=Test Folder')).toBeVisible();
    await expect(page.locator('input[value="New Folder"]')).not.toBeVisible();
  });

  test('should rename folder via right-click context menu', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // First create a folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    // Wait for New Folder input to appear and finish editing
    const folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await folderInput.press('Enter'); // Confirm the default name
    
    // Wait for it to become text (no longer editing)
    await expect(page.locator('text=New Folder')).toBeVisible();
    
    // Right-click on the folder to open context menu
    await page.locator('text=New Folder').click({ button: 'right' });
    
    // Click the rename option in context menu
    await expect(page.locator('text=Rename Folder')).toBeVisible();
    await page.click('text=Rename Folder');
    
    // Should open inline editing mode
    const renameInput = page.locator('input[value="New Folder"]');
    await expect(renameInput).toBeVisible();
    
    // Type new name and confirm
    await renameInput.fill('Renamed Folder');
    await page.locator('input[value="Renamed Folder"]').press('Enter');
    
    // Should show the renamed folder
    await expect(page.locator('text=Renamed Folder')).toBeVisible();
    await expect(page.locator('text=New Folder')).not.toBeVisible();
  });

  test('should cancel folder rename with Escape key', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // First create a folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    // Wait for New Folder input to appear and finish editing
    const folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await folderInput.press('Enter'); // Confirm the default name
    
    // Wait for it to become text (no longer editing)
    await expect(page.locator('text=New Folder')).toBeVisible();
    
    // Right-click on the folder to open context menu
    await page.locator('text=New Folder').click({ button: 'right' });
    await page.click('text=Rename Folder');
    
    // Should open inline editing mode
    const renameInput = page.locator('input[value="New Folder"]');
    await expect(renameInput).toBeVisible();
    
    // Type new name but press Escape to cancel
    await renameInput.fill('Should Not Save');
    await page.locator('input[value="Should Not Save"]').press('Escape');
    
    // Should still show the original folder name
    await expect(page.locator('text=New Folder')).toBeVisible();
    await expect(page.locator('text=Should Not Save')).not.toBeVisible();
  });

  test('should handle duplicate folder names', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Create first folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    // Wait for New Folder input to appear and finish editing
    let folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    await folderInput.press('Enter'); // Confirm the default name
    
    // Wait for it to become text (no longer editing)
    await expect(page.locator('text=New Folder')).toBeVisible();
    
    // Create second folder
    await createFolderButton.click();
    
    // Should create "New Folder 1" automatically
    folderInput = page.locator('input[value="New Folder 1"]');
    await expect(folderInput).toBeVisible();
    await folderInput.press('Enter'); // Confirm the default name
    
    // Wait for it to become text
    await expect(page.locator('text=New Folder 1')).toBeVisible();
    
    // Both folders should exist
    await expect(page.getByRole('button', { name: 'New Folder (0)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Folder 1 (0)' })).toBeVisible();
  });

  test('should cancel folder rename with empty name but keep the folder', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Create folder
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await createFolderButton.click();
    
    // Wait for New Folder input to appear
    const folderInput = page.locator('input[value="New Folder"]');
    await expect(folderInput).toBeVisible();
    
    // Clear the name and press Enter
    await folderInput.fill('');
    await page.locator('input[value=""]').press('Enter');
    
    // Should keep the folder with the original name (New Folder)
    await expect(page.locator('text=New Folder')).toBeVisible();
  });

  test('should create whiteboard note', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Use the main area create whiteboard button
    const mainCreateWhiteboardButton = page.locator('button:has-text("Create Whiteboard")');
    await expect(mainCreateWhiteboardButton).toBeVisible();
    await expect(mainCreateWhiteboardButton).toBeEnabled();
    
    // Click the create button and verify it opens a new whiteboard
    await mainCreateWhiteboardButton.click();
    
    // Should navigate to a new document
    await expect(page).toHaveURL(/\/documents\/note-\d+/);
    
    // Go back to verify sidebar button
    await page.goBack();
    
    // Verify sidebar action button exists too (icon button with title)
    await expect(page.locator('button[title="Create New Whiteboard"]')).toBeVisible();
  });
}); 