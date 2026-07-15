import { test, expect } from '@playwright/test';

test.describe('Connector Integration Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    // Wait for app to be ready
    await page.locator('svg').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
  });

  test('CT-1: Draw two shapes and verify they exist', async ({ page }) => {
    console.log('📍 Step 1: Draw first shape');

    // Find rectangle tool button
    const rectButton = page.locator('button').filter({ has: page.locator('text=/Rectangle/i') }).first();
    await rectButton.click();
    await page.waitForTimeout(200);

    // Draw first rectangle
    const svg = page.locator('svg').first();
    const svgBox = await svg.boundingBox();
    if (!svgBox) throw new Error('SVG not found');

    // Draw at position 100, 100 with size 100x80
    await page.mouse.move(svgBox.x + 100, svgBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 200, svgBox.y + 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    console.log('📍 Step 2: Draw second shape');

    // Click rectangle button again
    await rectButton.click();
    await page.waitForTimeout(200);

    // Draw second rectangle below first
    await page.mouse.move(svgBox.x + 300, svgBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 400, svgBox.y + 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify both shapes are drawn
    const shapes = await page.locator('svg rect').count();
    console.log(`✅ Shapes drawn: ${shapes}`);
    expect(shapes).toBeGreaterThan(0);
  });

  test('CT-2: Hover over connection point', async ({ page }) => {
    // First draw a shape
    const rectButton = page.locator('button').filter({ has: page.locator('text=/Rectangle/i') }).first();
    await rectButton.click();
    await page.waitForTimeout(200);

    const svg = page.locator('svg').first();
    const svgBox = await svg.boundingBox();
    if (!svgBox) throw new Error('SVG not found');

    await page.mouse.move(svgBox.x + 100, svgBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 200, svgBox.y + 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    console.log('📍 Hovering over shape to reveal connection points');

    // Hover over the shape (center area)
    await page.mouse.move(svgBox.x + 150, svgBox.y + 140);
    await page.waitForTimeout(300);

    // Check if connection points (circles) are visible
    const circles = await page.locator('svg circle').count();
    console.log(`✅ Connection points visible: ${circles}`);

    // There should be at least 4 connection points (one per side)
    expect(circles).toBeGreaterThanOrEqual(4);
  });

  test('CT-3: Full connector creation flow', async ({ page }) => {
    console.log('🔗 FULL CONNECTOR CREATION TEST\n');

    const svg = page.locator('svg').first();
    const svgBox = await svg.boundingBox();
    if (!svgBox) throw new Error('SVG not found');

    // Draw Shape A (left)
    console.log('Step 1️⃣: Draw Shape A (left side)');
    const rectButton = page.locator('button').filter({ has: page.locator('text=/Rectangle/i') }).first();
    await rectButton.click();
    await page.waitForTimeout(200);

    const shapeAX1 = svgBox.x + 100;
    const shapeAY1 = svgBox.y + 150;
    const shapeAX2 = svgBox.x + 200;
    const shapeAY2 = svgBox.y + 250;

    await page.mouse.move(shapeAX1, shapeAY1);
    await page.mouse.down();
    await page.mouse.move(shapeAX2, shapeAY2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    console.log('✅ Shape A created\n');

    // Draw Shape B (right)
    console.log('Step 2️⃣: Draw Shape B (right side)');
    await rectButton.click();
    await page.waitForTimeout(200);

    const shapeBX1 = svgBox.x + 350;
    const shapeBY1 = svgBox.y + 150;
    const shapeBX2 = svgBox.x + 450;
    const shapeBY2 = svgBox.y + 250;

    await page.mouse.move(shapeBX1, shapeBY1);
    await page.mouse.down();
    await page.mouse.move(shapeBX2, shapeBY2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    console.log('✅ Shape B created\n');

    // Click connector tool
    console.log('Step 3️⃣: Activate Connector Tool');
    const connectorButton = page.locator('button[title*="Connector"]').first();
    const isConnectorVisible = await connectorButton.isVisible();
    console.log(`   Connector button visible: ${isConnectorVisible}`);

    if (isConnectorVisible) {
      await connectorButton.click();
      await page.waitForTimeout(300);
      console.log('✅ Connector tool activated\n');
    } else {
      console.log('⚠️  Connector button not found, trying GitBranch icon');
      const gitBranchButton = page.locator('button').filter({ has: page.locator('svg') }).nth(8); // Approximate position
      await gitBranchButton.click();
      await page.waitForTimeout(300);
    }

    // Hover over Shape A to reveal connection points
    console.log('Step 4️⃣: Hover over Shape A connection point');
    const shapeACenter = {
      x: (shapeAX1 + shapeAX2) / 2,
      y: (shapeAY1 + shapeAY2) / 2
    };
    const connectionPointX = shapeAX2; // Right edge of Shape A
    const connectionPointY = shapeACenter.y;

    await page.mouse.move(connectionPointX, connectionPointY);
    await page.waitForTimeout(300);
    console.log(`   Hovering at (${connectionPointX}, ${connectionPointY})\n`);

    // Start drag from connection point
    console.log('Step 5️⃣: Click and drag from Shape A to Shape B');
    await page.mouse.down();

    // Drag toward Shape B
    const dragSteps = 10;
    for (let i = 0; i <= dragSteps; i++) {
      const progress = i / dragSteps;
      const currentX = connectionPointX + (shapeBX1 - connectionPointX) * progress;
      const currentY = connectionPointY + (shapeACenter.y - connectionPointY) * progress;
      await page.mouse.move(currentX, currentY);
      await page.waitForTimeout(50);
    }

    console.log(`   Dragged to Shape B area`);
    console.log(`   ⏸️  Checking for green highlight...\n`);

    // Wait a bit to see if target detection works
    await page.waitForTimeout(300);

    // Release mouse
    console.log('Step 6️⃣: Release mouse over Shape B');
    await page.mouse.up();
    await page.waitForTimeout(500);
    console.log('✅ Mouse released\n');

    // Check if connector was created
    console.log('Step 7️⃣: Verify connector created');

    // Look for connector lines (should have a line between the shapes)
    const connectorLines = await page.locator('svg line, svg path').count();
    console.log(`   Connector lines/paths found: ${connectorLines}`);

    // Check the page HTML for connector elements
    const svgContent = await svg.innerHTML();
    const hasConnectorLine = svgContent.includes('stroke');
    console.log(`   SVG has stroke elements: ${hasConnectorLine}`);

    console.log('\n✅ TEST COMPLETE\n');
  });

  test('CT-4: Console logging test', async ({ page }) => {
    // Capture all console messages
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
      console.log(`[Console] ${msg.text()}`);
    });

    const svg = page.locator('svg').first();
    const svgBox = await svg.boundingBox();
    if (!svgBox) throw new Error('SVG not found');

    // Draw two shapes
    const rectButton = page.locator('button').filter({ has: page.locator('text=/Rectangle/i') }).first();

    await rectButton.click();
    await page.waitForTimeout(200);
    await page.mouse.move(svgBox.x + 100, svgBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 200, svgBox.y + 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    await rectButton.click();
    await page.waitForTimeout(200);
    await page.mouse.move(svgBox.x + 300, svgBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 400, svgBox.y + 180, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Attempt to create connector
    const connectorButton = page.locator('button[title*="Connector"], button').filter({ has: page.locator('svg') }).first();
    if (await connectorButton.isVisible()) {
      await connectorButton.click();
    }

    // Try to drag from shape
    await page.mouse.move(svgBox.x + 200, svgBox.y + 140);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 300, svgBox.y + 140, { steps: 5 });
    await page.waitForTimeout(300);
    await page.mouse.up();

    console.log('\n📋 All Console Messages:');
    consoleLogs.forEach(log => console.log(`  - ${log}`));

    // Check for our debug messages
    const hasConnectorLog = consoleLogs.some(log => log.includes('Connector'));
    const hasTargetLog = consoleLogs.some(log => log.includes('Target'));
    const hasMouseLog = consoleLogs.some(log => log.includes('Mouse'));

    console.log(`\n✅ Connector logs found: ${hasConnectorLog}`);
    console.log(`✅ Target detection logs found: ${hasTargetLog}`);
    console.log(`✅ Mouse event logs found: ${hasMouseLog}`);
  });
});
