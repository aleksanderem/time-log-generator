import { test, expect } from '@playwright/test';
import path from 'path';

test('test screenshot upload functionality', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for app to load
  await page.waitForSelector('h1:has-text("AI-Powered Time Log Generator")');
  
  // Prepare test data
  const screenshotPath = path.join('/Users/alex/Desktop/KOLABO/Artifacts/time_log', 'SCR-20250801-lptw.png');
  
  // Upload the screenshot using file chooser
  const fileInputPromise = page.waitForEvent('filechooser');
  
  // Click on the upload area
  await page.click('label[for="screenshot-upload"]');
  
  // Handle the file chooser
  const fileChooser = await fileInputPromise;
  await fileChooser.setFiles(screenshotPath);
  
  // Wait for the analysis to complete
  await page.waitForSelector('text=Analyzing...', { state: 'attached' });
  await page.waitForSelector('text=Analyzing...', { state: 'detached', timeout: 30000 });
  
  // Check if the screenshot was added
  await expect(page.locator('text=SCR-20250801-lptw.png')).toBeVisible();
  
  // Look for the analysis result - GTmetrix report should have been analyzed
  const screenshotSection = page.locator('div:has(span:has-text("SCR-20250801-lptw.png"))');
  
  // Log what we see
  const content = await screenshotSection.textContent();
  console.log('Screenshot analysis result:', content);
  
  // The AI should have identified this as a GTmetrix performance report
  await expect(screenshotSection).toContainText(/performance|GTmetrix|report/i);
});