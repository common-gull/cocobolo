import { Page, expect } from '@playwright/test';
import { 
  setupTauriMocks, 
  clearTauriMocks,
  mockTauriCommand,
  mockTauriCommandStatic,
  mockTauriCommandSequence,
  mockTauriCommandDynamic,
  getTauriCommandCallCount,
  resetTauriCommandCallCount,
  MockConfig,
  MockResponse
} from '../mocks/tauri-api-mock';

// Re-export for convenience
export { 
  mockTauriCommand,
  mockTauriCommandStatic,
  mockTauriCommandSequence,
  mockTauriCommandDynamic,
  getTauriCommandCallCount,
  resetTauriCommandCallCount,
  type MockConfig,
  type MockResponse
};

/**
 * Helper functions for Playwright tests
 */

/**
 * Setup Tauri mocks for a page
 */
export async function setupMocks(page: Page) {
  await setupTauriMocks(page);
}

/**
 * Clear Tauri mocks between tests
 */
export async function clearMocks(page: Page) {
  await clearTauriMocks(page);
}

/**
 * Navigate to a URL with mocks enabled
 */
export async function gotoWithMocks(page: Page, url: string) {
  await setupMocks(page);
  await page.goto(url);
}

/**
 * Unlock a vault with the given password
 */
export async function unlockVault(page: Page, password: string = 'correct-password') {
  await gotoWithMocks(page, '/vault-unlock');
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*\/app/);
}

/**
 * Create a new note with the given title and content
 */
export async function createNote(
  page: Page, 
  title: string, 
  content: string = '',
  noteType: 'text' | 'whiteboard' = 'text'
) {
  if (noteType === 'whiteboard') {
    await page.click('[data-testid="create-note-dropdown"]');
    await page.click('text=Whiteboard');
  } else {
    await page.click('[data-testid="create-note-button"]');
  }
  
  if (noteType === 'text') {
    await page.fill('input[placeholder="Note title"]', title);
    if (content) {
      await page.fill('textarea[placeholder="Start writing..."]', content);
    }
    await page.click('button:has-text("Save")');
  }
  
  // Wait for navigation back to app
  await expect(page).toHaveURL('/app');
}

/**
 * Search for notes with the given query
 */
export async function searchNotes(page: Page, query: string) {
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill(query);
  // Wait for search results to update
  await page.waitForTimeout(300);
}

/**
 * Select a vault from the vault selector
 */
export async function selectVault(page: Page, vaultName: string) {
  await page.goto('/');
  await page.click(`text=${vaultName}`);
}

/**
 * Create a new vault
 */
export async function createVault(
  page: Page, 
  name: string, 
  password: string, 
  path: string = '/mock/new/vault'
) {
  await page.goto('/vault-creator');
  
  await page.fill('input[placeholder="Vault name"]', name);
  await page.fill('input[placeholder="Select vault location"]', path);
  await page.fill('input[type="password"][placeholder="Password"]', password);
  await page.fill('input[type="password"][placeholder="Confirm password"]', password);
  
  await page.click('button:has-text("Create Vault")');
}

/**
 * Test helper for simulating network failures or slow responses
 */
export async function mockNetworkConditions(
  page: Page,
  command: string,
  condition: 'slow' | 'failure' | 'timeout'
) {
  switch (condition) {
    case 'slow':
      await mockTauriCommandSequence(page, command, [
        { response: null, delay: 2000, shouldFail: false }
      ]);
      break;
    case 'failure':
      await mockTauriCommandStatic(page, command, {
        shouldFail: true,
        errorMessage: 'Network error'
      });
      break;
    case 'timeout':
      await mockTauriCommandSequence(page, command, [
        { response: null, delay: 10000, shouldFail: true, errorMessage: 'Request timeout' }
      ]);
      break;
  }
}

/**
 * Test helper for simulating authentication scenarios
 */
export async function mockAuthScenario(
  page: Page,
  scenario: 'success' | 'wrong-password' | 'rate-limited'
) {
  switch (scenario) {
    case 'success':
      await mockTauriCommandStatic(page, 'unlock_vault', {
        success: true,
        session_id: 'mock-session-123',
        vault_info: {
          name: 'Test Vault',
          created_at: '2025-01-01T00:00:00Z',
          version: '1.0.0',
          is_encrypted: true
        }
      });
      break;
    case 'wrong-password':
      await mockTauriCommandStatic(page, 'unlock_vault', {
        success: false,
        error_message: 'Invalid password'
      });
      break;
    case 'rate-limited':
      await mockTauriCommandStatic(page, 'unlock_vault', {
        success: false,
        error_message: 'Too many failed attempts. Try again later.'
      });
      break;
  }
}

/**
 * Test helper for simulating note operations with different outcomes
 */
export async function mockNoteOperation(
  page: Page,
  operation: 'create' | 'save' | 'delete' | 'load',
  outcome: 'success' | 'failure' | 'permission-denied'
) {
  const command = operation === 'create' ? 'create_note' :
                  operation === 'save' ? 'save_note' :
                  operation === 'delete' ? 'delete_note' :
                  'load_note';

  switch (outcome) {
    case 'success':
      if (operation === 'delete') {
        await mockTauriCommandStatic(page, command, true);
      } else if (operation === 'load') {
        await mockTauriCommandStatic(page, command, {
          id: 'test-note-1',
          title: 'Test Note',
          content: 'Test content',
          note_type: 'text',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          tags: []
        });
      } else {
        await mockTauriCommandStatic(page, command, {
          success: true,
          note: {
            id: 'test-note-1',
            title: 'Test Note',
            content: 'Test content',
            note_type: 'text',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            tags: []
          }
        });
      }
      break;
    case 'failure':
      if (operation === 'delete') {
        await mockTauriCommandStatic(page, command, false);
      } else {
        await mockTauriCommandStatic(page, command, {
          success: false,
          error_message: `Failed to ${operation} note`
        });
      }
      break;
    case 'permission-denied':
      await mockTauriCommand(page, command, {
        static: { shouldFail: true, errorMessage: 'Permission denied' }
      });
      break;
  }
}

/**
 * Wait for an element to be visible with a custom timeout
 */
export async function waitForElement(page: Page, selector: string, timeout: number = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Mock a specific API response
 */
export async function mockApiResponse(
  page: Page, 
  endpoint: string, 
  response: any, 
  status: number = 200
) {
  await page.route(`**/${endpoint}`, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
}

/**
 * Check if an element contains specific text
 */
export async function expectTextContent(page: Page, selector: string, text: string) {
  await expect(page.locator(selector)).toContainText(text);
}

/**
 * Check if an element is visible
 */
export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible();
}

/**
 * Check if an element is not visible
 */
export async function expectNotVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).not.toBeVisible();
}

/**
 * Fill a form field by label
 */
export async function fillByLabel(page: Page, label: string, value: string) {
  await page.fill(`input:has-text("${label}"), textarea:has-text("${label}")`, value);
}

/**
 * Click a button by text
 */
export async function clickButton(page: Page, text: string) {
  await page.click(`button:has-text("${text}")`);
}

/**
 * Navigate to a specific route and wait for it to load
 */
export async function navigateAndWait(page: Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
}

/**
 * Take a screenshot with a custom name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `frontend-tests/screenshots/${name}.png` });
}

/**
 * Simulate typing with realistic delays
 */
export async function typeText(page: Page, selector: string, text: string, delay: number = 50) {
  await page.type(selector, text, { delay });
}

/**
 * Wait for a specific network request to complete
 */
export async function waitForRequest(page: Page, urlPattern: string) {
  return page.waitForRequest(urlPattern);
}

/**
 * Wait for a specific network response
 */
export async function waitForResponse(page: Page, urlPattern: string) {
  return page.waitForResponse(urlPattern);
} 