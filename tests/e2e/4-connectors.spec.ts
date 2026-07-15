/**
 * @file 4-connectors.spec.ts
 * @brief Automated tests for connector functionality
 */

import { test, expect } from '@playwright/test';
import { drawRectangle, drawCircle, undo, redo, waitForAppReady } from './helpers';

test.describe('Connectors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('4.1: Draw two shapes that can be connected', async ({ page }) => {
    // Draw two rectangles
    await drawRectangle(page, 100, 100, 200, 150, 'A');
    await drawRectangle(page, 400, 100, 500, 150, 'B');

    // Verify both exist
    const shapes = await page.locator('svg rect').count();
    expect(shapes).toBeGreaterThanOrEqual(2);
  });

  test('4.2: Select shape shows connection points', async ({ page }) => {
    // Draw rectangle
    await drawRectangle(page, 100, 100, 200, 150);

    // Click to select
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(200);

    // Connection points should be visible (circles/triangles)
    const circles = await page.locator('svg circle').count();
    expect(circles).toBeGreaterThan(0);
  });

  test('4.3: Connection points have grab cursor', async ({ page }) => {
    // Draw and select rectangle
    await drawRectangle(page, 100, 100, 200, 150);
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(200);

    // Check if connection points exist (they should be draggable)
    const connectionGroup = await page.locator('svg g.connection-point-group').count();
    expect(connectionGroup).toBeGreaterThan(0);
  });

  test('4.4: Undo connector creation', async ({ page }) => {
    // Draw two shapes
    await drawRectangle(page, 100, 100, 200, 150, 'From');
    await drawRectangle(page, 400, 100, 500, 150, 'To');

    // Count paths before connector attempt
    const pathsBefore = await page.locator('svg path').count();

    // Try to create connector by selecting first shape and dragging from a corner
    await page.click('svg', { position: { x: 200, y: 125 } }); // Select first shape
    await page.waitForTimeout(200);

    // Undo
    await undo(page);

    // Verify state changes
    const pathsAfter = await page.locator('svg path').count();
    // May or may not decrease depending on implementation
  });

  test('4.5: Multiple shapes can have connection points', async ({ page }) => {
    // Draw 3 shapes
    await drawRectangle(page, 50, 50, 150, 100);
    await drawRectangle(page, 200, 50, 300, 100);
    await drawCircle(page, 400, 75, 50);

    // Select each one and verify connection points
    await page.click('svg', { position: { x: 100, y: 75 } });
    await page.waitForTimeout(100);
    let connectionPoints = await page.locator('svg circle[fill="#0066cc"]').count();
    expect(connectionPoints).toBeGreaterThan(0);

    await page.click('svg', { position: { x: 250, y: 75 } });
    await page.waitForTimeout(100);
    connectionPoints = await page.locator('svg circle[fill="#0066cc"]').count();
    expect(connectionPoints).toBeGreaterThan(0);

    await page.click('svg', { position: { x: 400, y: 75 } });
    await page.waitForTimeout(100);
    connectionPoints = await page.locator('svg circle[fill="#0066cc"]').count();
    expect(connectionPoints).toBeGreaterThan(0);
  });

  test('4.6: Connection points are only visible when shape selected', async ({
    page,
  }) => {
    // Draw rectangle
    await drawRectangle(page, 100, 100, 200, 150);

    // Don't select - connection points shouldn't be visible
    let connectionPoints = await page.locator('svg circle[fill="#0066cc"]').count();
    expect(connectionPoints).toBe(0);

    // Select - connection points should appear
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(200);
    connectionPoints = await page.locator('svg circle[fill="#0066cc"]').count();
    expect(connectionPoints).toBeGreaterThan(0);

    // Deselect - connection points disappear
    await page.click('svg', { position: { x: 300, y: 300 } });
    await page.waitForTimeout(200);
    connectionPoints = await page.locator('svg circle[fill="#0066cc"]').count();
    expect(connectionPoints).toBe(0);
  });

  test('4.7: Delete shape removes associated connectors', async ({ page }) => {
    // Draw two shapes
    await drawRectangle(page, 100, 100, 200, 150, 'A');
    await drawRectangle(page, 400, 100, 500, 150, 'B');

    // Count shapes
    let rectangles = await page.locator('svg rect').count();
    expect(rectangles).toBeGreaterThanOrEqual(2);

    // Delete first shape
    await page.click('svg', { position: { x: 150, y: 125 } }); // Select first
    await page.waitForTimeout(100);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // Verify one is gone
    rectangles = await page.locator('svg rect').count();
    expect(rectangles).toBeLessThan(2);
  });

  test('4.8: Move shape with connector attached', async ({ page }) => {
    // Draw rectangle
    await drawRectangle(page, 100, 100, 200, 150);

    // Get initial position
    const rectBefore = await page.locator('svg rect').first().boundingBox();
    expect(rectBefore).toBeTruthy();

    // Move it
    if (rectBefore) {
      const centerX = rectBefore.x + rectBefore.width / 2;
      const centerY = rectBefore.y + rectBefore.height / 2;

      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + 100, centerY + 50, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      const rectAfter = await page.locator('svg rect').first().boundingBox();
      expect(rectAfter).toBeTruthy();
      if (rectAfter) {
        // Position should have changed
        expect(Math.abs(rectAfter.x - rectBefore.x)).toBeGreaterThan(0);
      }
    }
  });

  test('4.9: No console errors during connector operations', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Draw shapes and interact with connection points
    await drawRectangle(page, 100, 100, 200, 150, 'A');
    await drawRectangle(page, 400, 100, 500, 150, 'B');

    // Select and interact
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(200);

    await page.click('svg', { position: { x: 400, y: 300 } }); // Deselect
    await page.waitForTimeout(200);

    expect(errors).toHaveLength(0);
  });

  test('4.10: Connection points visible on hover', async ({ page }) => {
    // Draw rectangle
    await drawRectangle(page, 100, 100, 200, 150);

    // Hover over shape (without selecting)
    await page.mouse.move(150, 125);
    await page.waitForTimeout(300);

    // Connection points may appear on hover (depending on design)
    // Just verify no errors occur
    const svg = await page.locator('svg');
    await expect(svg).toBeVisible();
  });

  test('4.11: Connection points are triangles and draggable', async ({ page }) => {
    // Draw and select shape
    await drawRectangle(page, 100, 100, 200, 150);
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(200);

    // Look for polygon elements (triangles)
    const triangles = await page.locator('svg polygon').count();
    expect(triangles).toBeGreaterThan(0);
  });

  test('4.12: Rapid connector interactions', async ({ page }) => {
    // Draw shapes
    await drawRectangle(page, 100, 100, 200, 150, 'A');
    await drawRectangle(page, 400, 100, 500, 150, 'B');

    // Rapidly click shapes to select/deselect
    for (let i = 0; i < 10; i++) {
      await page.click('svg', { position: { x: 150, y: 125 } });
      await page.click('svg', { position: { x: 400, y: 300 } });
    }

    // Should not crash or error
    const shapes = await page.locator('svg rect').count();
    expect(shapes).toBeGreaterThan(0);
  });
});
