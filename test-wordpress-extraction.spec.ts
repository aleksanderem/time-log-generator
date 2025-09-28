import { test, expect } from '@playwright/test';

test.describe('WordPress Project Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Listen to console logs
    page.on('console', msg => {
      console.log('Browser console:', msg.text());
    });
  });

  test('should extract project from single JSON object', async ({ page }) => {
    const testData = `{
      "type": "page_modification",
      "title": "Community Advocates",
      "estimated_time": 2.8,
      "day": "2025-07-08",
      "date": "2025-07-08 18:00:51",
      "revisions": "40"
    }`;

    const textarea = page.locator('textarea[placeholder="Paste WordPress plugin output here..."]');
    await textarea.fill(testData);
    await page.waitForTimeout(1000);

    // Check if project appears in the Projects section
    const projectsSection = page.locator('div:has-text("Projects")');
    await expect(projectsSection).toContainText('Community Advocates');
    
    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/wordpress-extraction.png', fullPage: true });
  });

  test('should only extract page_creation and page_modification', async ({ page }) => {
    const testData = `[
      {
        "type": "page_modification",
        "title": "Home Page",
        "date": "2025-07-08 10:00:00"
      },
      {
        "type": "page_creation", 
        "title": "Services Page",
        "date": "2025-07-08 11:00:00"
      },
      {
        "type": "post_update",
        "title": "Blog Post Title",
        "date": "2025-07-08 12:00:00"
      },
      {
        "type": "media_upload",
        "title": "Image.jpg",
        "date": "2025-07-08 13:00:00"
      }
    ]`;

    const textarea = page.locator('textarea[placeholder="Paste WordPress plugin output here..."]');
    await textarea.fill(testData);
    await page.waitForTimeout(1000);

    // Should see page_modification and page_creation projects
    const projectsSection = page.locator('div:has-text("Projects")').first();
    await expect(projectsSection).toContainText('Home Page');
    await expect(projectsSection).toContainText('Services Page');
    
    // Should NOT see other types
    await expect(projectsSection).not.toContainText('Blog Post Title');
    await expect(projectsSection).not.toContainText('Image.jpg');
  });
});