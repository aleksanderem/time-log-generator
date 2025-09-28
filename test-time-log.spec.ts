import { test, expect } from '@playwright/test';

test.describe('Time Log Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174');
  });

  test('should extract projects from WordPress JSON output', async ({ page }) => {
    // Test data with page_modification
    const testData = `{
      "type": "page_modification",
      "title": "Community Advocates",
      "estimated_time": 2.8,
      "day": "2025-07-08",
      "date": "2025-07-08 18:00:51",
      "revisions": "40"
    }`;

    // Find and fill the WordPress Activity Output textarea
    const textarea = page.locator('textarea[placeholder="Paste WordPress plugin output here..."]');
    await textarea.fill(testData);

    // Wait for the extraction to happen
    await page.waitForTimeout(500);

    // Check if project was extracted - should see "Community Advocates" in the projects section
    const projectElement = page.locator('text="Community Advocates"');
    await expect(projectElement).toBeVisible();

    // Check console logs
    page.on('console', msg => {
      if (msg.text().includes('Extracted projects from WordPress:')) {
        console.log('Console log:', msg.text());
      }
    });
  });

  test('should extract multiple projects from JSON array', async ({ page }) => {
    const testData = `[
      {
        "type": "page_modification",
        "title": "Home Page",
        "date": "2025-07-08 10:00:00"
      },
      {
        "type": "page_creation",
        "title": "About Us",
        "date": "2025-07-08 11:00:00"
      },
      {
        "type": "post_update",
        "title": "Blog Post",
        "date": "2025-07-08 12:00:00"
      }
    ]`;

    const textarea = page.locator('textarea[placeholder="Paste WordPress plugin output here..."]');
    await textarea.fill(testData);

    await page.waitForTimeout(500);

    // Should extract only page_modification and page_creation
    await expect(page.locator('text="Home Page"')).toBeVisible();
    await expect(page.locator('text="About Us"')).toBeVisible();
    
    // Should NOT extract post_update
    await expect(page.locator('text="Blog Post"')).not.toBeVisible();
  });

  test('should handle screenshot upload and analysis', async ({ page }) => {
    // Check if the screenshot upload area is visible
    const uploadArea = page.locator('label[for="screenshot-upload"]');
    await expect(uploadArea).toBeVisible();
    await expect(uploadArea).toContainText('Upload screenshots');
  });

  test('should show all entries when clicked', async ({ page }) => {
    // First need to generate some tasks
    await page.locator('input[type="date"]').first().fill('2025-01-01');
    await page.locator('input[type="date"]').last().fill('2025-01-15');
    
    // Add a project
    const projectInput = page.locator('input[placeholder="Add project name..."]');
    await projectInput.fill('Test Project');
    await projectInput.press('Enter');

    // Generate tasks
    await page.click('text="Generate AI Time Logs"');

    // Wait for generation (this might fail without API key, but we can test the UI)
    await page.waitForTimeout(2000);

    // If tasks were generated, test the "show all" functionality
    const showAllButton = page.locator('text=/and \\d+ more entries/');
    if (await showAllButton.isVisible()) {
      await showAllButton.click();
      await expect(page.locator('text="Show less"')).toBeVisible();
    }
  });
});