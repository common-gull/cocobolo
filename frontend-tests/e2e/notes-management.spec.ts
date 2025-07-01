import { test, expect } from '@playwright/test';
import { setupMocks, clearMocks } from '../utils/test-helpers';

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

  test('should delete a note', async ({ page }) => {
    // TODO - Fix this test. The app should navigate back to the app page after deleting a note
    // Click on a note to open it
    await page.click('text=Welcome to Cocobolo');
    
    // Wait for editor to load
    await page.waitForLoadState('networkidle');
    
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
    await page.click('button:has-text("Delete")');
  });

  test('should create folder', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Click the create folder button
    const createFolderButton = page.locator('button[title="Create New Folder"]');
    await expect(createFolderButton).toBeVisible();
    
    // Mock the prompt dialog to return a folder name
    await page.evaluate(() => {
      (window as any).prompt = () => 'Test Folder';
    });
    
    await createFolderButton.click();

    await expect(page.locator('text=Test Folder')).toBeVisible();
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