/**
 * @file helpers.ts
 * @brief Playwright test helper functions for Railway Drawer
 */

import { Page, expect } from '@playwright/test';

/**
 * Draw a rectangle on the canvas
 */
export async function drawRectangle(
  page: Page,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  name?: string
) {
  // Ensure rectangle tool is selected
  await page.click('button[title*="Rectangle"]');

  // Get SVG bounds
  const svg = await page.locator('svg').boundingBox();
  if (!svg) throw new Error('SVG not found');

  // Draw rectangle
  await page.mouse.move(svg.x + x1, svg.y + y1);
  await page.mouse.down();
  await page.mouse.move(svg.x + x2, svg.y + y2, { steps: 10 });
  await page.mouse.up();

  // Wait for element to appear
  await page.waitForTimeout(200);

  if (name) {
    // Label the shape
    await page.dblclick('svg', { position: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } });
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }
}

/**
 * Draw a circle on the canvas
 */
export async function drawCircle(
  page: Page,
  cx: number,
  cy: number,
  radius: number,
  name?: string
) {
  // Ensure circle tool is selected
  await page.click('button[title*="Circle"]');

  const svg = await page.locator('svg').boundingBox();
  if (!svg) throw new Error('SVG not found');

  // Draw circle
  await page.mouse.move(svg.x + cx - radius, svg.y + cy);
  await page.mouse.down();
  await page.mouse.move(svg.x + cx + radius, svg.y + cy, { steps: 10 });
  await page.mouse.up();

  await page.waitForTimeout(200);

  if (name) {
    await page.dblclick('svg', { position: { x: cx, y: cy } });
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }
}

/**
 * Activate brush tool
 */
export async function activateBrush(page: Page) {
  // Press B for brush tool
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(200);
}

/**
 * Draw a brush stroke
 */
export async function drawBrushStroke(
  page: Page,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const svg = await page.locator('svg').boundingBox();
  if (!svg) throw new Error('SVG not found');

  await page.mouse.move(svg.x + x1, svg.y + y1);
  await page.mouse.down();
  await page.mouse.move(svg.x + x2, svg.y + y2, { steps: 20 });
  await page.mouse.up();

  await page.waitForTimeout(200);
}

/**
 * Undo last action
 */
export async function undo(page: Page) {
  await page.keyboard.press('Control+Z');
  await page.waitForTimeout(200);
}

/**
 * Redo last action
 */
export async function redo(page: Page) {
  await page.keyboard.press('Control+Y');
  await page.waitForTimeout(200);
}

/**
 * Count shapes on canvas (by counting text elements)
 */
export async function countShapes(page: Page): Promise<number> {
  const shapes = await page.locator('svg text').count();
  return shapes;
}

/**
 * Count brush strokes on canvas (by counting path elements with class)
 */
export async function countBrushStrokes(page: Page): Promise<number> {
  const strokes = await page.locator('svg path[stroke-width]').count();
  return strokes;
}

/**
 * Select a shape by clicking on it
 */
export async function selectShape(page: Page, index: number = 0) {
  const shapes = await page.locator('svg rect, svg circle').all();
  if (shapes[index]) {
    await shapes[index].click();
    await page.waitForTimeout(100);
  }
}

/**
 * Check if undo button is enabled
 */
export async function isUndoEnabled(page: Page): Promise<boolean> {
  const button = await page.locator('button[title*="Undo"]').first();
  const disabled = await button.evaluate((el) =>
    el.getAttribute('disabled') !== null || el.classList.contains('disabled')
  );
  return !disabled;
}

/**
 * Check if redo button is enabled
 */
export async function isRedoEnabled(page: Page): Promise<boolean> {
  const button = await page.locator('button[title*="Redo"]').first();
  const disabled = await button.evaluate((el) =>
    el.getAttribute('disabled') !== null || el.classList.contains('disabled')
  );
  return !disabled;
}

/**
 * Wait for app to load
 */
export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait for the main canvas SVG (first large SVG element, not toolbar icons)
  await page.locator('svg').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

/**
 * Get all element labels
 */
export async function getElementLabels(page: Page): Promise<string[]> {
  const labels = await page.locator('svg text').allTextContents();
  return labels.filter((text) => text.trim().length > 0);
}
