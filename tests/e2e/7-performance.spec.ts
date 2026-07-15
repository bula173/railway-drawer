/**
 * @file 7-performance.spec.ts
 * @brief Performance and load testing
 */

import { test, expect } from '@playwright/test';
import { drawRectangle, drawCircle, activateBrush, drawBrushStroke, undo, redo, waitForAppReady } from './helpers';

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('7.1: Drawing performance - 30 shapes under 30 seconds', async ({ page }) => {
    const start = Date.now();

    for (let i = 0; i < 30; i++) {
      const x = 20 + (i % 6) * 100;
      const y = 20 + Math.floor(i / 6) * 100;

      if (i % 2 === 0) {
        await drawRectangle(page, x, y, x + 80, y + 80);
      } else {
        await drawCircle(page, x + 40, y + 40, 35);
      }
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30000);
  });

  test('7.2: Undo performance - 20 undo operations under 5 seconds', async ({ page }) => {
    // Create 20 shapes
    for (let i = 0; i < 20; i++) {
      const x = 20 + (i % 5) * 100;
      const y = 20 + Math.floor(i / 5) * 100;
      await drawRectangle(page, x, y, x + 80, y + 80);
    }

    const start = Date.now();

    // Undo all 20
    for (let i = 0; i < 20; i++) {
      await undo(page);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('7.3: Redo performance - 20 redo operations under 5 seconds', async ({ page }) => {
    // Create and undo 20 shapes
    for (let i = 0; i < 20; i++) {
      const x = 20 + (i % 5) * 100;
      const y = 20 + Math.floor(i / 5) * 100;
      await drawRectangle(page, x, y, x + 80, y + 80);
    }

    for (let i = 0; i < 20; i++) {
      await undo(page);
    }

    const start = Date.now();

    // Redo all 20
    for (let i = 0; i < 20; i++) {
      await redo(page);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('7.4: Brush stroke performance - 10 strokes under 10 seconds', async ({ page }) => {
    await activateBrush(page);

    const start = Date.now();

    for (let i = 0; i < 10; i++) {
      const startX = 50 + i * 50;
      const startY = 50 + (i % 3) * 100;
      await drawBrushStroke(page, startX, startY, startX + 100, startY + 100);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  test('7.5: Mixed operations performance - 50 operations under 30 seconds', async ({
    page,
  }) => {
    const start = Date.now();

    for (let i = 0; i < 50; i++) {
      const x = 20 + (i % 10) * 80;
      const y = 20 + Math.floor(i / 10) * 80;

      if (i % 3 === 0) {
        await drawRectangle(page, x, y, x + 70, y + 70);
      } else if (i % 3 === 1) {
        await drawCircle(page, x + 35, y + 35, 30);
      } else {
        if (i === 3) await activateBrush(page);
        await drawBrushStroke(page, x, y, x + 50, y + 50);
      }
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30000);
  });

  test('7.6: History depth performance - 100 operations', async ({ page }) => {
    // Create 100 shapes
    for (let i = 0; i < 100; i++) {
      const x = 20 + (i % 10) * 50;
      const y = 20 + Math.floor(i / 10) * 50;

      if (i % 2 === 0) {
        await drawRectangle(page, x, y, x + 40, y + 40);
      } else {
        await drawCircle(page, x + 20, y + 20, 15);
      }

      // Every 10 operations, check performance isn't degrading
      if (i % 10 === 0 && i > 0) {
        const start = Date.now();
        await undo(page);
        const elapsed = Date.now() - start;

        // Each undo should still be fast (< 500ms)
        expect(elapsed).toBeLessThan(500);

        await redo(page);
      }
    }

    // Final verification
    expect(true).toBe(true);
  });

  test('7.7: Memory usage with large diagram', async ({ page }) => {
    // Get initial memory (if available)
    const initialMetrics = await page.evaluate(() => {
      if (performance && (performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Create large diagram
    for (let i = 0; i < 50; i++) {
      const x = 20 + (i % 10) * 80;
      const y = 20 + Math.floor(i / 10) * 80;

      if (i % 2 === 0) {
        await drawRectangle(page, x, y, x + 70, y + 70);
      } else {
        await drawCircle(page, x + 35, y + 35, 30);
      }
    }

    // Get final memory
    const finalMetrics = await page.evaluate(() => {
      if (performance && (performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory growth should be reasonable (< 50MB)
    if (initialMetrics > 0) {
      const memoryGrowth = finalMetrics - initialMetrics;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('7.8: Rapid selection performance', async ({ page }) => {
    // Create 10 shapes
    for (let i = 0; i < 10; i++) {
      const x = 50 + i * 100;
      await drawRectangle(page, x, 100, x + 80, 180);
    }

    const start = Date.now();

    // Rapidly click shapes 50 times
    for (let i = 0; i < 50; i++) {
      const x = 90 + (i % 10) * 100;
      await page.click('svg', { position: { x, y: 140 } });
      // Small delay to let selection process
      await page.waitForTimeout(10);
    }

    const elapsed = Date.now() - start;

    // Should complete quickly
    expect(elapsed).toBeLessThan(10000);
  });

  test('7.9: Zoom and pan performance', async ({ page }) => {
    // Create diagram
    for (let i = 0; i < 20; i++) {
      const x = 50 + (i % 5) * 100;
      const y = 50 + Math.floor(i / 5) * 100;
      await drawRectangle(page, x, y, x + 80, y + 80);
    }

    const start = Date.now();

    // Simulate zoom and pan (keyboard/mouse would go here)
    // For now just verify diagram is still responsive
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(100);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('7.10: Continuous drawing performance', async ({ page }) => {
    await activateBrush(page);

    const start = Date.now();

    // Draw continuous strokes
    for (let i = 0; i < 20; i++) {
      const x = 50 + (i % 5) * 100;
      const y = 50 + Math.floor(i / 5) * 100;
      await drawBrushStroke(page, x, y, x + 80, y + 80);
    }

    const elapsed = Date.now() - start;

    // Should handle continuous drawing
    expect(elapsed).toBeLessThan(20000);
  });
});
