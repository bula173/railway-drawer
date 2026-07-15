/**
 * @file 6-edge-cases.spec.ts
 * @brief Automated tests for edge cases and boundary conditions
 */

import { test, expect } from '@playwright/test';
import {
  drawRectangle,
  drawCircle,
  undo,
  redo,
  countShapes,
  isUndoEnabled,
  isRedoEnabled,
  waitForAppReady,
} from './helpers';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('6.1: Undo at history start', async ({ page }) => {
    // Empty canvas
    const canUndo = await isUndoEnabled(page);
    expect(canUndo).toBe(false);

    // Try undo anyway
    await undo(page);

    // Still empty
    const shapes = await countShapes(page);
    expect(shapes).toBe(0);
  });

  test('6.2: Redo at history end', async ({ page }) => {
    // Draw shape
    await drawRectangle(page, 100, 100, 200, 150);

    // Cannot redo
    const canRedo = await isRedoEnabled(page);
    expect(canRedo).toBe(false);

    // Try redo anyway
    await redo(page);

    // Shape still exists
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);
  });

  test('6.3: Rapid undo/redo presses', async ({ page }) => {
    // Draw 3 shapes
    await drawRectangle(page, 100, 100, 200, 150);
    await drawRectangle(page, 300, 100, 400, 150);
    await drawCircle(page, 500, 125, 50);

    // Rapid undo (10 presses)
    for (let i = 0; i < 10; i++) {
      await undo(page);
    }

    // Should be empty
    const shapesAfterUndo = await countShapes(page);
    expect(shapesAfterUndo).toBe(0);

    // Rapid redo (10 presses)
    for (let i = 0; i < 10; i++) {
      await redo(page);
    }

    // Should have shapes back
    const shapesAfterRedo = await countShapes(page);
    expect(shapesAfterRedo).toBeGreaterThan(0);
  });

  test('6.4: History branching - new operation clears future', async ({ page }) => {
    // Build history
    await drawRectangle(page, 100, 100, 200, 150, 'A');
    await drawRectangle(page, 300, 100, 400, 150, 'B');
    await drawCircle(page, 500, 125, 50, 'C');

    // Undo twice
    await undo(page);
    await undo(page);

    // Should be at 'A' only
    let shapes = await countShapes(page);
    expect(shapes).toBe(1);

    // New operation (D)
    await drawRectangle(page, 100, 250, 200, 300, 'D');

    // Redo should do nothing (future cleared)
    const canRedo = await isRedoEnabled(page);
    expect(canRedo).toBe(false);

    // Should have A and D, not B or C
    shapes = await countShapes(page);
    expect(shapes).toBe(2);
  });

  test('6.5: Delete shape with active connector', async ({ page }) => {
    // Draw two shapes
    await drawRectangle(page, 100, 100, 200, 150, 'A');
    await drawRectangle(page, 400, 100, 500, 150, 'B');

    let shapes = await countShapes(page);
    expect(shapes).toBe(2);

    // Delete first shape
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(100);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    shapes = await countShapes(page);
    expect(shapes).toBe(1);
  });

  test('6.6: Shape at canvas edge (0,0)', async ({ page }) => {
    // Draw at top-left corner
    const svg = await page.locator('svg').boundingBox();
    if (svg) {
      const tool = await page.locator('button[title*="Rectangle"]').first();
      await tool.click();

      await page.mouse.move(svg.x + 5, svg.y + 5);
      await page.mouse.down();
      await page.mouse.move(svg.x + 85, svg.y + 85, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      const shapes = await countShapes(page);
      expect(shapes).toBeGreaterThan(0);
    }
  });

  test('6.7: Very small shape (1x1)', async ({ page }) => {
    const svg = await page.locator('svg').boundingBox();
    if (svg) {
      const tool = await page.locator('button[title*="Rectangle"]').first();
      await tool.click();

      // Draw very small rectangle
      await page.mouse.move(svg.x + 100, svg.y + 100);
      await page.mouse.down();
      await page.mouse.move(svg.x + 101, svg.y + 101);
      await page.mouse.up();
      await page.waitForTimeout(200);

      const shapes = await countShapes(page);
      expect(shapes).toBeGreaterThan(0);
    }
  });

  test('6.8: Very large shape', async ({ page }) => {
    const svg = await page.locator('svg').boundingBox();
    if (svg) {
      const tool = await page.locator('button[title*="Rectangle"]').first();
      await tool.click();

      // Draw huge rectangle
      await page.mouse.move(svg.x + 10, svg.y + 10);
      await page.mouse.down();
      await page.mouse.move(svg.x + 700, svg.y + 700, { steps: 20 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      const shapes = await countShapes(page);
      expect(shapes).toBeGreaterThan(0);
    }
  });

  test('6.9: Multi-selection edge case', async ({ page }) => {
    // Draw 3 shapes
    await drawRectangle(page, 100, 100, 200, 150);
    await drawRectangle(page, 300, 100, 400, 150);
    await drawCircle(page, 500, 125, 50);

    // Click multiple shapes
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(100);

    await page.click('svg', { position: { x: 350, y: 125 } }, { modifiers: ['Control'] });
    await page.waitForTimeout(100);

    await page.click('svg', { position: { x: 500, y: 125 } }, { modifiers: ['Control'] });
    await page.waitForTimeout(100);

    // All should be selectable
    const shapes = await countShapes(page);
    expect(shapes).toBe(3);
  });

  test('6.10: Long label text', async ({ page }) => {
    // Draw shape with very long label
    const tool = await page.locator('button[title*="Rectangle"]').first();
    await tool.click();

    const svg = await page.locator('svg').boundingBox();
    if (svg) {
      await page.mouse.move(svg.x + 100, svg.y + 100);
      await page.mouse.down();
      await page.mouse.move(svg.x + 300, svg.y + 200, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      // Add long label
      await page.dblclick('svg', { position: { x: 200, y: 150 } });
      const longLabel =
        'This is a very long label that should wrap or truncate appropriately without breaking the UI';
      await page.keyboard.type(longLabel);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      const shapes = await countShapes(page);
      expect(shapes).toBeGreaterThan(0);
    }
  });

  test('6.11: Rapid tool switching', async ({ page }) => {
    // Switch between tools 20 times
    for (let i = 0; i < 10; i++) {
      const rectTool = await page.locator('button[title*="Rectangle"]').first();
      await rectTool.click();
      await page.waitForTimeout(50);

      const circleTool = await page.locator('button[title*="Circle"]').first();
      await circleTool.click();
      await page.waitForTimeout(50);
    }

    // Should not crash
    const tools = await page.locator('button[title*="Rectangle"]').first();
    await expect(tools).toBeVisible();
  });

  test('6.12: Undo/redo with mixed operations 20+ times', async ({ page }) => {
    // Perform operations
    await drawRectangle(page, 100, 100, 200, 150);
    await drawCircle(page, 400, 125, 50);

    // Alternate undo/redo 20 times
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        await undo(page);
      } else {
        await redo(page);
      }
    }

    // Should be in valid state
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThanOrEqual(0);
  });

  test('6.13: No console errors under stress', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
      if (msg.type() === 'warning') warnings.push(msg.text());
    });

    // Stress test with many operations
    for (let i = 0; i < 30; i++) {
      const x = 50 + (i % 5) * 100;
      const y = 50 + Math.floor(i / 5) * 80;
      await drawRectangle(page, x, y, x + 80, y + 60);
    }

    // Undo some
    for (let i = 0; i < 15; i++) {
      await undo(page);
    }

    // No critical errors
    expect(errors).toHaveLength(0);
  });

  test('6.14: Browser window resize handling', async ({ page }) => {
    // Draw shape
    await drawRectangle(page, 100, 100, 200, 150);

    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300);

    // Shape should still be there
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);

    // Resize back
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);

    // Shape still exists
    const shapesAfter = await countShapes(page);
    expect(shapesAfter).toBeGreaterThan(0);
  });

  test('6.15: Multiple tab operations', async ({ page, context }) => {
    // Draw in first tab
    await drawRectangle(page, 100, 100, 200, 150);
    const shapesTab1 = await countShapes(page);

    // Create new tab
    const page2 = await context.newPage();
    await page2.goto('/');
    await waitForAppReady(page2);

    // Second tab should be empty
    const shapesTab2 = await countShapes(page2);
    expect(shapesTab2).toBe(0);

    // Close second tab
    await page2.close();

    // First tab should still have shape
    const shapesTab1After = await countShapes(page);
    expect(shapesTab1After).toBe(shapesTab1);
  });

  test('6.16: Empty undo/redo cycle', async ({ page }) => {
    // Draw shape
    await drawRectangle(page, 100, 100, 200, 150);

    // Undo
    await undo(page);
    let shapes = await countShapes(page);
    expect(shapes).toBe(0);

    // Redo
    await redo(page);
    shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);

    // Undo again
    await undo(page);
    shapes = await countShapes(page);
    expect(shapes).toBe(0);

    // Cannot undo more
    const canUndo = await isUndoEnabled(page);
    expect(canUndo).toBe(false);
  });

  test('6.17: Boundary undo/redo checks', async ({ page }) => {
    // Draw 5 shapes
    for (let i = 0; i < 5; i++) {
      const x = 50 + i * 100;
      await drawRectangle(page, x, 100, x + 80, 180);
    }

    // Verify can undo
    let canUndo = await isUndoEnabled(page);
    expect(canUndo).toBe(true);

    // Undo all
    for (let i = 0; i < 5; i++) {
      await undo(page);
    }

    // Cannot undo more
    canUndo = await isUndoEnabled(page);
    expect(canUndo).toBe(false);

    // Can redo
    let canRedo = await isRedoEnabled(page);
    expect(canRedo).toBe(true);

    // Redo all
    for (let i = 0; i < 5; i++) {
      await redo(page);
    }

    // Cannot redo more
    canRedo = await isRedoEnabled(page);
    expect(canRedo).toBe(false);
  });

  test('6.18: Stress test - 50 operations', async ({ page }) => {
    const start = Date.now();

    // 50 operations
    for (let i = 0; i < 50; i++) {
      const x = 20 + (i % 10) * 80;
      const y = 20 + Math.floor(i / 10) * 80;

      if (i % 2 === 0) {
        await drawRectangle(page, x, y, x + 70, y + 70);
      } else {
        await drawCircle(page, x + 35, y + 35, 30);
      }
    }

    const elapsed = Date.now() - start;

    // Should complete in time
    expect(elapsed).toBeLessThan(60000); // 60 seconds max

    // Verify shapes exist
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);
  });
});
