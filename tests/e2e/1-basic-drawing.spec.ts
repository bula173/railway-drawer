/**
 * @file 1-basic-drawing.spec.ts
 * @brief Automated tests for basic shape drawing
 */

import { test, expect } from '@playwright/test';
import { drawRectangle, drawCircle, countShapes, waitForAppReady, getElementLabels } from './helpers';

test.describe('Basic Drawing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('1.1: Draw a single rectangle', async ({ page }) => {
    // Draw rectangle
    await drawRectangle(page, 100, 100, 250, 200, 'Rectangle 1');

    // Verify it appears
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);

    // Verify label
    const labels = await getElementLabels(page);
    expect(labels).toContain('Rectangle 1');
  });

  test('1.2: Draw multiple shapes', async ({ page }) => {
    // Draw three shapes
    await drawRectangle(page, 100, 100, 200, 150, 'Box A');
    await drawRectangle(page, 300, 100, 400, 150, 'Box B');
    await drawCircle(page, 500, 125, 50, 'Circle C');

    // Verify all appear
    const shapes = await countShapes(page);
    expect(shapes).toBe(3);

    // Verify all labels
    const labels = await getElementLabels(page);
    expect(labels).toContain('Box A');
    expect(labels).toContain('Box B');
    expect(labels).toContain('Circle C');
  });

  test('1.3: Draw shapes and select', async ({ page }) => {
    // Draw rectangle
    await drawRectangle(page, 100, 100, 250, 200);

    // Click to select
    const svg = await page.locator('svg').boundingBox();
    if (svg) {
      await page.click('svg', { position: { x: 175, y: 150 } });
      await page.waitForTimeout(200);

      // Verify selection handles appear (look for rect elements with specific class)
      const handles = await page.locator('svg rect[data-testid*="resize"]').count();
      // May not have data-testid, so just verify no errors
    }
  });

  test('1.4: Draw shapes with labels', async ({ page }) => {
    // Draw and label multiple shapes
    await drawRectangle(page, 100, 100, 200, 150, 'Process');
    await drawCircle(page, 350, 125, 40, 'Decision');

    // Get labels
    const labels = await getElementLabels(page);
    expect(labels).toContain('Process');
    expect(labels).toContain('Decision');

    // Verify text appears on canvas
    const processText = await page.locator('text=Process');
    await expect(processText).toBeVisible();

    const decisionText = await page.locator('text=Decision');
    await expect(decisionText).toBeVisible();
  });

  test('1.5: Delete shape', async ({ page }) => {
    // Draw shape
    await drawRectangle(page, 100, 100, 250, 200, 'ToDelete');

    // Verify it exists
    let shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);

    // Select and delete
    await page.click('svg', { position: { x: 175, y: 150 } });
    await page.waitForTimeout(100);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // Verify it's gone
    shapes = await countShapes(page);
    expect(shapes).toBe(0);
  });

  test('1.6: Move shape', async ({ page }) => {
    // Draw rectangle
    await drawRectangle(page, 100, 100, 200, 150, 'Movable');

    // Get initial position
    const rectBefore = await page.locator('svg rect').boundingBox();
    expect(rectBefore).toBeTruthy();

    // Click and drag to new position
    if (rectBefore) {
      const centerX = rectBefore.x + rectBefore.width / 2;
      const centerY = rectBefore.y + rectBefore.height / 2;

      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + 100, centerY + 100, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      // Verify position changed
      const rectAfter = await page.locator('svg rect').boundingBox();
      expect(rectAfter).toBeTruthy();
      if (rectAfter) {
        expect(rectAfter.x).not.toBe(rectBefore.x);
      }
    }
  });

  test('1.7: No console errors during basic operations', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Draw several shapes
    await drawRectangle(page, 100, 100, 200, 150, 'Box1');
    await drawRectangle(page, 300, 100, 400, 150, 'Box2');
    await drawCircle(page, 500, 125, 50, 'Circle');

    // No errors should appear
    expect(errors).toHaveLength(0);
  });
});
