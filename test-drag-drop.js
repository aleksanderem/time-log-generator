import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test('test screenshot drag and drop functionality', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for app to load
  await page.waitForSelector('h1:has-text("AI-Powered Time Log Generator")');
  
  // Find the drop zone
  const dropZone = page.locator('label[for="screenshot-upload"]');
  
  // Prepare test file
  const filePath = path.join('/Users/alex/Desktop/KOLABO/Artifacts/time_log', 'SCR-20250801-lptw.png');
  const buffer = fs.readFileSync(filePath);
  
  // Create a DataTransfer and dispatch drag events
  await dropZone.dispatchEvent('dragenter', {
    dataTransfer: {
      files: [new File([buffer], 'SCR-20250801-lptw.png', { type: 'image/png' })]
    }
  });
  
  // Check if drag state is active (background should change)
  await expect(dropZone).toHaveClass(/border-blue-500/);
  
  // Drop the file
  await dropZone.dispatchEvent('drop', {
    dataTransfer: {
      files: [new File([buffer], 'SCR-20250801-lptw.png', { type: 'image/png' })]
    }
  });
  
  // Wait for analysis
  await page.waitForSelector('text=Analyzing...', { state: 'attached' });
  await page.waitForSelector('text=Analyzing...', { state: 'detached', timeout: 30000 });
  
  // Verify screenshot was added
  await expect(page.locator('text=SCR-20250801-lptw.png')).toBeVisible();
  
  console.log('Drag and drop test completed successfully!');
});