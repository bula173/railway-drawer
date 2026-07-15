import { test, expect } from '@playwright/test';

test('click on connection point circle directly', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.locator('svg').first().waitFor();
  await page.waitForTimeout(1000);

  console.log('\n===== SIMPLE CONNECTOR TEST =====\n');

  // Draw two shapes
  const svg = page.locator('svg').first();
  const svgBox = await svg.boundingBox();
  if (!svgBox) throw new Error('SVG not found');

  // Shape 1
  await page.mouse.move(svgBox.x + 100, svgBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(svgBox.x + 200, svgBox.y + 180, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Shape 2
  await page.mouse.move(svgBox.x + 350, svgBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(svgBox.x + 450, svgBox.y + 180, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  console.log('✅ Drew two shapes');

  // Hover to make connection points visible
  await page.mouse.move(svgBox.x + 150, svgBox.y + 140);
  await page.waitForTimeout(500);

  // Get connection point circles
  const circles = await page.locator('svg circle').all();
  console.log(`📌 Found ${circles.length} circles`);

  if (circles.length > 0) {
    const firstCircle = circles[0];

    // Try to click directly on the circle
    console.log('🖱️  Clicking first circle directly using Playwright click()');
    try {
      await firstCircle.click({ force: true });
      console.log('✅ Click succeeded');
    } catch (err) {
      console.log('❌ Click failed:', err);
    }

    // Check console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('CONNECTION POINT') || msg.text().includes('Calling')) {
        console.log(`[Console] ${msg.text()}`);
        consoleLogs.push(msg.text());
      }
    });

    await page.waitForTimeout(500);
  }

  console.log('\n===== END TEST =====\n');
});
