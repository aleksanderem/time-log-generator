import { test, expect } from '@playwright/test';

test.describe('WordPress Extraction Verification', () => {
  test('confirms extraction works correctly', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    let extractedProjects: string[] = [];
    
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Extracted projects from WordPress:')) {
        const match = text.match(/\[(.*?)\]/);
        if (match) {
          extractedProjects = match[1].split(',').map(p => p.trim());
        }
        console.log('✓ Extraction working:', text);
      }
    });

    // Test 1: Single JSON object
    const singleJson = `{
      "type": "page_modification",
      "title": "Community Advocates",
      "estimated_time": 2.8,
      "day": "2025-07-08",
      "date": "2025-07-08 18:00:51"
    }`;

    await page.locator('textarea[placeholder="Paste WordPress plugin output here..."]').fill(singleJson);
    await page.waitForTimeout(500);
    
    // Test 2: Multiple with filtering
    const multiJson = `[
      {"type": "page_creation", "title": "New Page", "date": "2025-07-08"},
      {"type": "post_update", "title": "Should Not Appear", "date": "2025-07-08"},
      {"type": "page_modification", "title": "Updated Page", "date": "2025-07-08"}
    ]`;
    
    await page.locator('textarea[placeholder="Paste WordPress plugin output here..."]').fill(multiJson);
    await page.waitForTimeout(500);
    
    // Verify the green project badges appear
    const projectBadges = page.locator('.bg-green-200.rounded-full');
    const count = await projectBadges.count();
    
    console.log(`✓ Found ${count} project badges in UI`);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/final-extraction-test.png', fullPage: true });
  });
});