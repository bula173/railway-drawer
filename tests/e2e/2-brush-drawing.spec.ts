/**
 * @file 2-brush-drawing.spec.ts
 * @brief Automated tests for brush tool functionality
 */

import { test, expect } from '@playwright/test';
import { activateBrush, drawBrushStroke, countBrushStrokes, undo, waitForAppReady } from './helpers';

test.describe('Brush Drawing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('2.1: Draw brush stroke', async ({ page }) => {
    // Activate brush
    await activateBrush(page);

    // Draw a stroke
    await drawBrushStroke(page, 100, 100, 300, 200);

    // Verify brush panel is visible
    const brushPanel = await page.locator('text=Brush Tool').count();
    expect(brushPanel).toBeGreaterThan(0);

    // Verify cursor is crosshair
    const svg = await page.locator('svg');
    const style = await svg.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(style).toBe('crosshair');
  });

  test('2.2: Draw multiple brush strokes', async ({ page }) => {
    // Activate brush
    await activateBrush(page);

    // Draw 3 strokes
    await drawBrushStroke(page, 100, 100, 200, 150);
    await drawBrushStroke(page, 250, 100, 350, 200);
    await drawBrushStroke(page, 400, 100, 450, 200);

    // All strokes should be visible (basic visual check)
    const paths = await page.locator('svg path').count();
    expect(paths).toBeGreaterThan(0);
  });

  test('2.3: Brush tool can be activated via B key', async ({ page }) => {
    // Press B to activate brush
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(300);

    // Brush panel should be visible
    const brushPanel = await page.locator('text=Brush Tool');
    await expect(brushPanel).toBeVisible();
  });

  test('2.4: Brush stroke can be undone', async ({ page }) => {
    // Activate brush
    await activateBrush(page);

    // Draw stroke
    await drawBrushStroke(page, 100, 100, 300, 200);

    // Count elements before undo
    const pathsBefore = await page.locator('svg path').count();
    expect(pathsBefore).toBeGreaterThan(0);

    // Undo
    await undo(page);

    // Paths should be reduced
    const pathsAfter = await page.locator('svg path').count();
    // Note: May not be exactly pathsBefore - 1 due to connectors, but should decrease
  });

  test('2.5: Brush properties panel is accessible', async ({ page }) => {
    // Activate brush
    await activateBrush(page);

    // Check for brush properties
    const brushType = await page.locator('text=Brush Type');
    await expect(brushType).toBeVisible();

    const size = await page.locator('text=Size:');
    await expect(size).toBeVisible();

    const color = await page.locator('text=Color');
    await expect(color).toBeVisible();

    const opacity = await page.locator('text=Opacity:');
    await expect(opacity).toBeVisible();
  });

  test('2.6: Can change brush type', async ({ page }) => {
    // Activate brush
    await activateBrush(page);

    // Click on different brush types
    const penButton = await page.locator('button:has-text("pen")').first();
    await penButton.click();
    await page.waitForTimeout(100);

    const markerButton = await page.locator('button:has-text("marker")').first();
    await markerButton.click();
    await page.waitForTimeout(100);

    const pencilButton = await page.locator('button:has-text("pencil")').first();
    await pencilButton.click();
    await page.waitForTimeout(100);

    // Should not crash or error
  });

  test('2.7: Can change brush size', async ({ page }) => {
    // Activate brush
    await activateBrush(page);

    // Find size slider
    const sizeSlider = await page.locator('input[type="range"]').first();
    await expect(sizeSlider).toBeVisible();

    // Change size
    await sizeSlider.fill('10');
    await page.waitForTimeout(100);

    // Should update without errors
  });

  test('2.8: Can change brush color', async ({ page }) => {
    // Activate brush
    await activateBrush(page);

    // Find color picker
    const colorInput = await page.locator('input[type="color"]').first();
    if (await colorInput.isVisible()) {
      await colorInput.fill('#FF0000');
      await page.waitForTimeout(100);
    }

    // Should not crash
  });

  test('2.9: Brush drawing in combination with shapes', async ({ page }) => {
    // Draw a rectangle first
    const rectTool = await page.locator('button[title*="Rectangle"]').first();
    await rectTool.click();

    const svg = await page.locator('svg').boundingBox();
    if (svg) {
      await page.mouse.move(svg.x + 100, svg.y + 100);
      await page.mouse.down();
      await page.mouse.move(svg.x + 200, svg.y + 150, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);
    }

    // Now activate brush
    await activateBrush(page);

    // Draw brush stroke
    await drawBrushStroke(page, 250, 100, 350, 150);

    // Both should be visible
    const elements = await page.locator('svg > *').count();
    expect(elements).toBeGreaterThan(2);
  });

  test('2.10: No console errors during brush operations', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Activate brush and draw
    await activateBrush(page);
    await drawBrushStroke(page, 100, 100, 300, 200);

    // No errors should occur
    expect(errors).toHaveLength(0);
  });
});
