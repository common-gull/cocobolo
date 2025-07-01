# Frontend Tests

This directory contains the frontend testing setup for Cocobolo, using Playwright with Tauri API mocks for comprehensive e2e testing.

## Overview

The testing setup allows you to:
- Run the app with mocked Tauri API responses (no Rust backend required)
- Perform end-to-end testing of the complete user interface
- Test user workflows without setting up real vaults or encryption
- Use Playwright's powerful testing features with realistic mock data

## Architecture

```
frontend-tests/
├── mocks/           # Tauri API mocks using Playwright
├── fixtures/        # Test data and fixtures
├── e2e/            # Playwright end-to-end tests
├── utils/          # Test helper functions
└── README.md       # This file
```

## Setup

### Prerequisites

Make sure you have the dependencies installed:

```bash
npm install
```

### Tauri API Mocking

The Tauri API mocking setup includes:

- **`mocks/tauri-api-mock.ts`** - Playwright-based mocks that replace Tauri's invoke function
- **`fixtures/test-data.ts`** - Realistic test data for consistent testing

### Playwright Setup

Playwright is configured to:
- Test against multiple browsers (Chrome, Firefox, Safari)
- Test responsive design (desktop and mobile viewports)
- Automatically start the dev server with mocks enabled
- Capture screenshots and videos on test failures

## Running Tests

### End-to-End Tests

Run all Playwright tests:

```bash
npm run test:e2e
```

Run tests in headed mode (see browser):

```bash
npm run test:e2e:headed
```

Run tests with UI mode (interactive):

```bash
npm run test:e2e:ui
```

## Mock Data

The mocks provide realistic test data including:

- **Vaults**: Personal Notes, Work Notes, Archive
- **Notes**: Welcome note, meeting notes, recipes, whiteboards
- **Authentication**: Password `correct-password` unlocks vaults
- **Folders**: work, personal, archive, projects
- **Tags**: Various tags for filtering and organization

## Test Structure

### E2E Tests

- **`vault-selector.spec.ts`** - Tests vault selection and creation
- **`vault-unlock.spec.ts`** - Tests vault unlocking and authentication
- **`notes-management.spec.ts`** - Tests note CRUD operations

### Test Helpers

The `utils/test-helpers.ts` file provides common functions:

- `unlockVault()` - Authenticate and unlock a vault
- `createNote()` - Create a new note with title and content
- `searchNotes()` - Search for notes
- `mockApiResponse()` - Mock specific API responses
- And many more...

### Test Fixtures

The `fixtures/test-data.ts` file contains:

- Mock vault data
- Sample notes and metadata
- Test scenarios (empty vault, full vault, etc.)
- Common passwords and paths
- Error and success messages

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { unlockVault, createNote } from '../utils/test-helpers';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await unlockVault(page);
    await createNote(page, 'Test Note', 'Test content');
    await expect(page.locator('text=Test Note')).toBeVisible();
  });
});
```

### Using Mock Data

```typescript
import { mockVaults, testPasswords } from '../fixtures/test-data';

test('should work with mock data', async ({ page }) => {
  // Use predefined mock data
  await page.goto('/');
  await expect(page.locator(`text=${mockVaults[0].name}`)).toBeVisible();
});
```

### Custom API Mocking

```typescript
import { mockApiResponse } from '../utils/test-helpers';

test('should handle API errors', async ({ page }) => {
  await mockApiResponse(page, 'get_notes_list', { error: 'Network error' }, 500);
  await page.goto('/app');
  await expect(page.locator('text=Error loading notes')).toBeVisible();
});
```

## Configuration

### Vite Test Config

The `vite.test.config.ts` file:
- Runs on port 3000 (different from Tauri's 1420)
- Enables test mode environment variables
- Removes Tauri-specific constraints

### Playwright Config

The `playwright.config.ts` file:
- Configures multiple browsers and viewports
- Sets up the dev server to run with mocks
- Configures screenshots, videos, and traces
- Sets reasonable timeouts and retry logic

## Mock Behavior

### Authentication

- Password `correct-password` will successfully unlock vaults
- Any other password will fail with "Invalid password"
- Rate limiting is disabled by default

### Notes

- CRUD operations work as expected
- Auto-save is simulated with delays
- Search and filtering work with mock data

### Vaults

- Vault creation always succeeds
- Directory selection returns mock paths
- All vaults appear as encrypted and valid

## Debugging

### View Mock Responses

When running in development mode, mock responses are logged to the console.

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots at the point of failure
- Video recordings of the entire test
- Network traces for debugging

### Interactive Debugging

Use Playwright's UI mode for step-by-step debugging:

```bash
npm run test:e2e:ui
```

## CI/CD Integration

The tests are configured to work in CI environments:
- Reduced parallelism on CI
- Automatic retries for flaky tests
- HTML report generation
- Artifact collection for failures

## Best Practices

1. **Use test helpers** - Don't repeat common operations
2. **Use fixtures** - Reuse mock data across tests
3. **Test user workflows** - Focus on end-to-end user journeys
4. **Mock realistically** - Keep mock data close to real data
5. **Test error states** - Don't just test happy paths
6. **Use data-testid** - Add test IDs to components for reliable selection
7. **Wait for state changes** - Use proper waits instead of arbitrary timeouts

## Troubleshooting

### Common Issues

**Tests fail to start dev server:**
- Check that port 3000 is available
- Ensure all dependencies are installed

**Mocks not working:**
- Verify MSW service worker is registered
- Check browser console for MSW logs

**Tests are flaky:**
- Add proper waits for async operations
- Use `page.waitForLoadState()` after navigation
- Avoid `page.waitForTimeout()` in favor of specific waits

**TypeScript errors:**
- Ensure test files import types correctly
- Check that mock data matches type definitions

### Getting Help

- Check the Playwright documentation: https://playwright.dev/
- Review existing tests for examples
- Use the interactive UI mode for debugging 