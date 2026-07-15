import { test, expect } from '@playwright/test';

test.describe('Connector Diagnostic', () => {
  test('diagnose connector feature', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.locator('svg').first().waitFor();
    await page.waitForTimeout(1000);

    console.log('\n===== DIAGNOSTIC START =====\n');

    // Check what buttons exist
    const buttons = await page.locator('button').all();
    console.log(`📌 Total buttons found: ${buttons.length}`);

    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const button = buttons[i];
      const title = await button.getAttribute('title');
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      console.log(`   Button ${i}: title="${title}" aria="${ariaLabel}" text="${text}"`);
    }

    // Draw a shape by dragging on canvas directly
    console.log('\n📍 Drawing shape directly on canvas');
    const svg = page.locator('svg').first();
    const svgBox = await svg.boundingBox();
    if (!svgBox) throw new Error('SVG not found');

    await page.mouse.move(svgBox.x + 100, svgBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 200, svgBox.y + 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const rects = await page.locator('svg rect').count();
    console.log(`✅ Rectangles in SVG: ${rects}`);

    // Draw second shape
    await page.mouse.move(svgBox.x + 300, svgBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 400, svgBox.y + 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const rects2 = await page.locator('svg rect').count();
    console.log(`✅ Rectangles after 2nd shape: ${rects2}`);

    // Check connection points
    console.log('\n📌 Checking for connection points');
    await page.mouse.move(svgBox.x + 150, svgBox.y + 140);
    await page.waitForTimeout(500);

    const circles = await page.locator('svg circle').count();
    console.log(`   Connection point circles: ${circles}`);

    // Check SVG structure
    const svgHtml = await svg.innerHTML();
    const hasCircles = svgHtml.includes('<circle');
    const hasConnectorPaths = svgHtml.includes('class="connectors"');
    console.log(`   SVG has <circle> elements: ${hasCircles}`);
    console.log(`   SVG has .connectors group: ${hasConnectorPaths}`);

    // Try clicking on a connection point
    console.log('\n📌 Attempting to click connection point');
    const connectionPoints = await page.locator('svg circle').all();
    if (connectionPoints.length > 0) {
      console.log(`   Found ${connectionPoints.length} circles, clicking first one`);
      const circle = connectionPoints[0];
      const box = await circle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
        await page.mouse.down();
        console.log('   Mouse down on connection point');
        await page.waitForTimeout(300);
        await page.mouse.move(svgBox.x + 350, svgBox.y + 140, { steps: 5 });
        console.log('   Dragging...');
        await page.waitForTimeout(300);
        await page.mouse.up();
        console.log('   Mouse up');
      }
    } else {
      console.log('   ❌ No connection points found!');
    }

    // Check for connectors
    console.log('\n📌 Checking for connectors');
    const lines = await page.locator('svg line').count();
    const paths = await page.locator('svg path').count();
    console.log(`   SVG lines: ${lines}`);
    console.log(`   SVG paths: ${paths}`);

    // Get all elements in SVG
    const g_elements = await page.locator('svg > g').count();
    console.log(`   SVG <g> groups: ${g_elements}`);

    // List all groups
    const groups = await page.locator('svg > g').all();
    for (let i = 0; i < Math.min(groups.length, 5); i++) {
      const className = await groups[i].getAttribute('class');
      console.log(`     Group ${i}: class="${className}"`);
    }

    console.log('\n===== DIAGNOSTIC END =====\n');
  });
});
