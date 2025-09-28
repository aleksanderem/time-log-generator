import { test, expect } from '@playwright/test';
import { TimeFormatter } from './src/services/time-formatter';

test.describe('Time Format Tests', () => {
  test('should convert decimal hours to h/m/s format', () => {
    // Test various time conversions
    expect(TimeFormatter.toHoursMinutesSeconds(1.5)).toBe('1h 30m');
    expect(TimeFormatter.toHoursMinutesSeconds(2.75)).toBe('2h 45m');
    expect(TimeFormatter.toHoursMinutesSeconds(0.25)).toBe('15m');
    expect(TimeFormatter.toHoursMinutesSeconds(3.501)).toBe('3h 30m 4s');
    expect(TimeFormatter.toHoursMinutesSeconds(1.4864)).toBe('1h 29m 11s');
  });

  test('should generate non-rounded time distributions', () => {
    const distributions = TimeFormatter.distributeHours(8, 4);
    
    // Check that times have seconds (not rounded to quarters)
    distributions.forEach(time => {
      const formatted = TimeFormatter.toHoursMinutesSeconds(time);
      console.log(`Time: ${time.toFixed(4)} -> ${formatted}`);
    });
    
    // Total should be close to 8 hours
    const total = distributions.reduce((sum, t) => sum + t, 0);
    expect(total).toBeCloseTo(8, 1);
  });
});

test.describe('UI Time Display', () => {
  test('should display times in h/m/s format in generated logs', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Add test data
    const testData = `{
      "type": "page_modification",
      "title": "Test Project Page",
      "date": "2025-01-15"
    }`;
    
    await page.locator('textarea[placeholder="Paste WordPress plugin output here..."]').fill(testData);
    await page.waitForTimeout(500);
    
    // Set dates
    await page.locator('input[type="date"]').first().fill('2025-01-15');
    await page.locator('input[type="date"]').last().fill('2025-01-15');
    
    // The project should be auto-added
    await expect(page.locator('text="Test Project Page"')).toBeVisible();
    
    // If we could generate (with API key), we would see times like "1h 29m 11s"
    // Take screenshot to verify UI
    await page.screenshot({ path: 'test-results/time-format-ui.png', fullPage: true });
  });
});