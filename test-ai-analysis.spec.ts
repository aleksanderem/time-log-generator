import { test, expect } from '@playwright/test';

test.describe('AI Analysis Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174/');
  });

  test('should successfully analyze WordPress data with AI', async ({ page }) => {
    // Set date range
    await page.fill('input[placeholder="Start Date"]', '2024-06-01');
    await page.fill('input[placeholder="End Date"]', '2024-06-30');
    
    // Set target hours
    await page.fill('input[placeholder="Target hours per day"]', '8');
    
    // Add a project
    await page.fill('input[placeholder="Enter project name"]', 'Test Project');
    await page.click('button:has-text("Add Project")');
    
    // Add WordPress data
    const wordpressData = `[
      {
        "type": "page_modification",
        "title": "Homepage",
        "date": "2024-06-15 10:30:00",
        "estimated_time": 2.5
      },
      {
        "type": "page_creation",
        "title": "About Us",
        "date": "2024-06-16 14:00:00",
        "estimated_time": 3.0
      }
    ]`;
    
    await page.fill('textarea[placeholder*="WordPress"]', wordpressData);
    
    // Click generate button
    await page.click('button:has-text("Generate Time Log")');
    
    // Wait for AI analysis to complete
    await page.waitForSelector('text=Generated Time Log', { timeout: 30000 });
    
    // Check if tasks were generated
    const tasks = await page.locator('tr').filter({ hasText: '2024-06-' }).count();
    expect(tasks).toBeGreaterThan(0);
    
    // Check if AI generated tasks contain references to WordPress activities
    const taskTexts = await page.locator('tr td:nth-child(3)').allTextContents();
    const hasWordPressReferences = taskTexts.some(text => 
      text.includes('Homepage') || text.includes('About Us')
    );
    expect(hasWordPressReferences).toBeTruthy();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure by stopping the server
    await page.route('**/api/chat/completions', route => {
      route.abort('failed');
    });
    
    // Set minimal date range
    await page.fill('input[placeholder="Start Date"]', '2024-06-01');
    await page.fill('input[placeholder="End Date"]', '2024-06-01');
    
    // Click generate
    await page.click('button:has-text("Generate Time Log")');
    
    // Should show error or use fallback
    await page.waitForSelector('text=Generated Time Log', { timeout: 10000 });
    
    // Check that fallback tasks were generated
    const tasks = await page.locator('tr').filter({ hasText: '2024-06-01' }).count();
    expect(tasks).toBeGreaterThan(0);
  });

  test('should analyze screenshots when API key is available', async ({ page }) => {
    // Create a test image file
    const buffer = Buffer.from('fake-image-data');
    
    // Upload screenshot
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Upload Screenshots")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([{
      name: 'screenshot-2024-06-15.png',
      mimeType: 'image/png',
      buffer: buffer
    }]);
    
    // Check if screenshot was added
    await page.waitForSelector('text=screenshot-2024-06-15.png');
  });

  test('should extend task descriptions using AI', async ({ page }) => {
    // First generate some tasks
    await page.fill('input[placeholder="Start Date"]', '2024-06-01');
    await page.fill('input[placeholder="End Date"]', '2024-06-01');
    await page.click('button:has-text("Generate Time Log")');
    
    // Wait for tasks to be generated
    await page.waitForSelector('text=Generated Time Log');
    
    // Find and click extend button on first task
    const firstExtendButton = await page.locator('button[title="Extend task description"]').first();
    await firstExtendButton.click();
    
    // Select extend level
    await page.click('button:has-text("Detailed")');
    
    // Wait for extension to complete
    await page.waitForSelector('text=✓', { timeout: 30000 });
    
    // Check if task was extended
    const taskText = await page.locator('tr td:nth-child(3)').first().textContent();
    expect(taskText?.length).toBeGreaterThan(50);
  });
});