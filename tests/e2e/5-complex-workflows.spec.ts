/**
 * @file 5-complex-workflows.spec.ts
 * @brief Automated tests for complex real-world workflows
 */

import { test, expect } from '@playwright/test';
import {
  drawRectangle,
  drawCircle,
  activateBrush,
  drawBrushStroke,
  undo,
  redo,
  countShapes,
  waitForAppReady,
  getElementLabels,
} from './helpers';

test.describe('Complex Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('5.1: Create simple flowchart', async ({ page }) => {
    // Draw 4 rectangles in vertical layout
    await drawRectangle(page, 150, 50, 250, 100, 'Start');
    await drawRectangle(page, 150, 150, 250, 200, 'Process A');
    await drawRectangle(page, 150, 250, 250, 300, 'Process B');
    await drawRectangle(page, 150, 350, 250, 400, 'End');

    // Verify all exist
    const labels = await getElementLabels(page);
    expect(labels).toContain('Start');
    expect(labels).toContain('Process A');
    expect(labels).toContain('Process B');
    expect(labels).toContain('End');
  });

  test('5.2: Create diagram with mixed shapes', async ({ page }) => {
    // Draw database (rectangle)
    await drawRectangle(page, 50, 100, 150, 150, 'Database');

    // Draw server (circle)
    await drawCircle(page, 300, 125, 50, 'Server');

    // Draw client (rectangle)
    await drawRectangle(page, 450, 100, 550, 150, 'Client');

    // Verify all exist
    const shapes = await countShapes(page);
    expect(shapes).toBe(3);
  });

  test('5.3: Edit shape labels', async ({ page }) => {
    // Draw shape
    await drawRectangle(page, 100, 100, 200, 150, 'Original');

    // Verify label
    let labels = await getElementLabels(page);
    expect(labels).toContain('Original');

    // Double-click to edit (approximate location)
    await page.dblclick('svg text');
    await page.waitForTimeout(200);

    // Clear and type new label
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Updated');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Verify new label
    labels = await getElementLabels(page);
    expect(labels).toContain('Updated');
  });

  test('5.4: Complex undo/redo with 10+ operations', async ({ page }) => {
    // Perform 10 operations
    for (let i = 0; i < 10; i++) {
      const x = 50 + (i % 3) * 150;
      const y = 50 + Math.floor(i / 3) * 100;
      await drawRectangle(page, x, y, x + 80, y + 80, `Box${i}`);
    }

    // Should have 10 shapes
    let shapes = await countShapes(page);
    expect(shapes).toBe(10);

    // Undo all 10
    for (let i = 0; i < 10; i++) {
      await undo(page);
    }

    shapes = await countShapes(page);
    expect(shapes).toBe(0);

    // Redo all 10
    for (let i = 0; i < 10; i++) {
      await redo(page);
    }

    shapes = await countShapes(page);
    expect(shapes).toBe(10);
  });

  test('5.5: Large diagram with 20+ elements', async ({ page }) => {
    // Draw 20 shapes
    for (let i = 0; i < 20; i++) {
      const x = 20 + (i % 5) * 120;
      const y = 20 + Math.floor(i / 5) * 100;

      if (i % 2 === 0) {
        await drawRectangle(page, x, y, x + 100, y + 80);
      } else {
        await drawCircle(page, x + 50, y + 40, 40);
      }
    }

    // Count all shapes
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThanOrEqual(20);
  });

  test('5.6: Brush annotations on diagram', async ({ page }) => {
    // Draw shapes
    await drawRectangle(page, 100, 100, 200, 150, 'Task');
    await drawCircle(page, 400, 125, 50, 'Decision');

    // Activate brush and add annotations
    await activateBrush(page);
    await drawBrushStroke(page, 250, 100, 350, 150);
    await drawBrushStroke(page, 350, 150, 450, 200);

    // Should have shapes and strokes
    const shapes = await countShapes(page);
    expect(shapes).toBe(2);
  });

  test('5.7: Copy and paste workflow', async ({ page }) => {
    // Draw shape
    await drawRectangle(page, 100, 100, 200, 150, 'Original');

    // Select
    await page.click('svg', { position: { x: 150, y: 125 } });
    await page.waitForTimeout(100);

    // Copy
    await page.keyboard.press('Control+C');
    await page.waitForTimeout(100);

    // Paste multiple times
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+V');
    await page.waitForTimeout(200);

    // Should have multiple copies
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(1);
  });

  test('5.8: Color-coded sections', async ({ page }) => {
    // Draw section A (red)
    await drawRectangle(page, 50, 50, 150, 150, 'Section A');

    // Draw section B (blue)
    await drawRectangle(page, 200, 50, 300, 150, 'Section B');

    // Draw connection area (purple/neutral)
    await drawCircle(page, 175, 75, 30, 'Bridge');

    const shapes = await countShapes(page);
    expect(shapes).toBe(3);
  });

  test('5.9: Keyboard shortcuts workflow', async ({ page }) => {
    // Draw shape
    await drawRectangle(page, 100, 100, 200, 150, 'Shape1');

    // Test keyboard shortcuts
    // Select all
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(100);

    // Copy
    await page.keyboard.press('Control+C');
    await page.waitForTimeout(100);

    // Paste
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(200);

    // Undo
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(100);

    // Redo
    await page.keyboard.press('Control+Y');
    await page.waitForTimeout(100);

    // Should work without errors
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);
  });

  test('5.10: Switch between tools frequently', async ({ page }) => {
    // Draw with rectangle tool
    await drawRectangle(page, 100, 100, 200, 150);

    // Switch to circle tool
    const circleTool = await page.locator('button[title*="Circle"]').first();
    await circleTool.click();
    await drawCircle(page, 400, 125, 50);

    // Switch to brush
    await activateBrush(page);
    await drawBrushStroke(page, 50, 50, 150, 150);

    // Back to rectangle
    const rectTool = await page.locator('button[title*="Rectangle"]').first();
    await rectTool.click();
    await drawRectangle(page, 500, 100, 600, 150);

    // Should have all elements
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);
  });

  test('5.11: Rapid editing operations', async ({ page }) => {
    // Draw initial shape
    await drawRectangle(page, 100, 100, 200, 150, 'Rapid');

    // Rapidly edit: move, undo, redo
    for (let i = 0; i < 5; i++) {
      await undo(page);
      await redo(page);
    }

    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);
  });

  test('5.12: Long workflow with state consistency', async ({ page }) => {
    // Complex multi-step workflow
    await drawRectangle(page, 100, 100, 200, 150, 'A');
    await drawRectangle(page, 300, 100, 400, 150, 'B');
    await activateBrush(page);
    await drawBrushStroke(page, 250, 100, 300, 150);
    await drawRectangle(page, 100, 250, 200, 300, 'C');
    await undo(page);
    await redo(page);
    await activateBrush(page);
    await drawBrushStroke(page, 50, 50, 150, 150);

    // Verify state is consistent
    const shapes = await countShapes(page);
    expect(shapes).toBeGreaterThan(0);
  });

  test('5.13: Error recovery during workflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Perform complex workflow
    await drawRectangle(page, 100, 100, 200, 150);
    await drawCircle(page, 400, 125, 50);
    await activateBrush(page);
    await drawBrushStroke(page, 250, 100, 350, 150);

    // No errors should occur
    expect(errors).toHaveLength(0);
  });

  test('5.14: Large history performance', async ({ page }) => {
    const start = Date.now();

    // Create 20 shapes
    for (let i = 0; i < 20; i++) {
      const x = 50 + (i % 5) * 100;
      const y = 50 + Math.floor(i / 5) * 80;
      await drawRectangle(page, x, y, x + 80, y + 60);
    }

    // Undo all
    for (let i = 0; i < 20; i++) {
      await undo(page);
    }

    // Redo all
    for (let i = 0; i < 20; i++) {
      await redo(page);
    }

    const elapsed = Date.now() - start;

    // Should complete in reasonable time (< 30 seconds)
    expect(elapsed).toBeLessThan(30000);
  });

  test('5.15: Complete flowchart creation', async ({ page }) => {
    // Create a complete flowchart with all elements
    await drawRectangle(page, 150, 20, 250, 70, 'Start');
    await drawRectangle(page, 150, 90, 250, 140, 'Step 1');
    await drawRectangle(page, 150, 160, 250, 210, 'Step 2');
    await drawCircle(page, 200, 250, 40, 'Decision');
    await drawRectangle(page, 150, 310, 250, 360, 'Step 3');
    await drawRectangle(page, 150, 390, 250, 440, 'End');

    // Add annotations
    await activateBrush(page);
    await drawBrushStroke(page, 260, 50, 320, 100);

    // Verify completion
    const labels = await getElementLabels(page);
    expect(labels.length).toBeGreaterThan(5);
  });
});
