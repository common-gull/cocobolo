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

- **Vaults**: Personal Notes, Work Notes
- **Notes**: Welcome note, meeting notes
- **Authentication**: Password `correct-password` unlocks vaults
- **Folders**: work folder with sample content

## Test Structure

### E2E Tests

- **`vault-selector.spec.ts`** - Tests vault selection and creation
- **`vault-unlock.spec.ts`** - Tests vault unlocking and authentication
- **`notes-management.spec.ts`** - Tests note CRUD operations

### Test Helpers

The `utils/test-helpers.ts` file provides common functions:

- `setupMocks()` - Setup Tauri API mocks
- `clearMocks()` - Clear mocks between tests
- `mockTauriCommand()` - Mock specific Tauri commands

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { setupMocks, clearMocks } from '../utils/test-helpers';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearMocks(page);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/vault-unlock');
    await page.fill('input[type="password"]', 'correct-password');
    await page.click('button:has-text("Unlock Vault")');
    await expect(page).toHaveURL('/app');
  });
});
```

## Configuration

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
- Rate limiting is simulated

### Notes

- CRUD operations work as expected
- Auto-save is simulated
- Folder creation and management work

### Vaults

- Vault creation always succeeds
- Directory selection returns mock paths
- All vaults appear as encrypted and valid

## Debugging

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots at the point of failure
- Video recordings of the entire test

### Interactive Debugging

Use Playwright's UI mode for step-by-step debugging:

```bash
npm run test:e2e:ui
```

## Best Practices

1. **Use test helpers** - Don't repeat common operations
2. **Test user workflows** - Focus on end-to-end user journeys
3. **Mock realistically** - Keep mock data close to real data
4. **Test error states** - Don't just test happy paths
5. **Wait for state changes** - Use proper waits instead of arbitrary timeouts

## Troubleshooting

### Common Issues

**Tests fail to start dev server:**
- Check that the required port is available
- Ensure all dependencies are installed

**Mocks not working:**
- Verify mocks are properly set up in beforeEach
- Check browser console for errors

**Tests are flaky:**
- Add proper waits for async operations
- Use `page.waitForLoadState()` after navigation
- Avoid `page.waitForTimeout()` in favor of specific waits 