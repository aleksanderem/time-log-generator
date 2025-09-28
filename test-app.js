import { chromium } from '@playwright/test';

async function testApp() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Log all network requests
  page.on('request', request => {
    if (request.url().includes('openai')) {
      console.log('>> Request:', request.method(), request.url());
      console.log('   Headers:', request.headers());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('openai')) {
      console.log('<< Response:', response.status(), response.url());
    }
  });
  
  // Log console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  await page.goto('http://localhost:5173/');
  console.log('Page loaded');
  
  // Fill in the form
  await page.fill('input[type="date"]:first-of-type', '2025-07-01');
  await page.fill('input[type="date"]:last-of-type', '2025-07-05');
  
  // Add project
  await page.fill('input[placeholder="Add project name..."]', 'Test Project');
  await page.click('button:has-text("Add"):visible');
  
  // Click generate
  await page.click('button:has-text("Generate AI Time Logs")');
  
  // Wait for response
  await page.waitForTimeout(5000);
  
  // Take screenshot
  await page.screenshot({ path: 'test-result.png', fullPage: true });
  
  await browser.close();
}

testApp().catch(console.error);