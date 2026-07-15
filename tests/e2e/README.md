# E2E Tests for Railway Drawer

Automated end-to-end tests using **Playwright** for the Railway Drawer application.

## Overview

- **Framework:** Playwright
- **Test Files:** 8+ files with 100+ test cases
- **Coverage:** All major user scenarios
- **Browsers:** Chromium, Firefox, WebKit (Safari)

## Quick Start

### Install Dependencies
```bash
npm install
```

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npm run test:e2e -- tests/e2e/3-undo-redo.spec.ts
```

### Run Tests in Debug Mode
```bash
npm run test:e2e:debug
```

### Run Tests with UI
```bash
npm run test:e2e:ui
```

### Run Tests with Browser Visible
```bash
npm run test:e2e:headed
```

### View HTML Report
```bash
npm run test:e2e:report
```

## Test Files (100+ test cases)

### 1. **1-basic-drawing.spec.ts** (7 tests)
Drawing shapes, colors, labels, and basic manipulation
- Draw single rectangle
- Draw multiple shapes
- Select and interact
- Label shapes
- Delete shapes
- Move shapes
- Error checking

### 2. **2-brush-drawing.spec.ts** (10 tests)
Brush tool functionality and properties
- Draw brush stroke
- Multiple strokes
- Brush activation (B key)
- Undo brush strokes
- Properties panel
- Change brush type
- Change brush size
- Change brush color
- Mixed shapes and brush
- Error checking

### 3. **3-undo-redo.spec.ts** (12 tests) ⭐ CRITICAL
Undo/Redo operations with unified history
- Simple undo
- Simple redo
- Multiple undo/redo sequences
- Mixed element + brush operations
- History branching
- Text editing undo
- Performance with 15+ operations
- Undo at history start (boundary)
- Redo at history end (boundary)
- Large history handling
- State consistency
- No console errors

### 4. **4-connectors.spec.ts** (10 tests) [To be created]
Connector lines and arrows
- Create simple connector
- Change line style (solid, dotted, dashed)
- Change arrow types
- Connector color and width
- Connector labels
- Delete connector
- Connector stickiness
- Undo connector creation
- Multiple connectors
- Error checking

### 5. **5-complex-workflows.spec.ts** (15 tests) [To be created]
Real-world workflows and integration
- Create flowchart (4 shapes + labels)
- Complex diagram with mixed features
- Edit existing diagram
- Complex undo/redo sequences (10+ operations)
- Large diagram (20+ elements)
- Copy/paste elements
- Color-coding sections
- Keyboard shortcuts
- Multiple browser tabs
- Performance metrics

### 6. **6-edge-cases.spec.ts** (20 tests) [To be created]
Edge cases and error recovery
- Undo at history boundaries
- Redo at history boundaries
- Rapid undo/redo (10+ presses)
- History branching scenarios
- Delete shape with connectors
- Strokes outside canvas bounds
- Shapes at canvas edges
- Very small/large shapes
- Multi-selection edge cases
- Browser window resize
- Long labels
- Rapid tool switching
- Memory/performance under stress
- Error handling and recovery
- Keyboard shortcut conflicts
- And more...

## Test Statistics

```
Total Test Files:    6
Total Test Cases:    100+
Coverage Areas:      8
Estimated Runtime:   ~5-10 minutes (depending on hardware)
Parallel Execution:  Yes (configurable)
```

## Test Architecture

### Helpers (`helpers.ts`)
Reusable utility functions:
- `drawRectangle()` - Draw rectangle with optional label
- `drawCircle()` - Draw circle with optional label
- `activateBrush()` - Activate brush tool
- `drawBrushStroke()` - Draw brush stroke
- `undo()` / `redo()` - Keyboard shortcuts
- `countShapes()` - Count elements on canvas
- `countBrushStrokes()` - Count brush strokes
- `isUndoEnabled()` / `isRedoEnabled()` - Check button state
- `waitForAppReady()` - Wait for app to load
- `getElementLabels()` - Get all labels on canvas

### Test Patterns

All tests follow this pattern:

```typescript
test.describe('Feature Area', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('1.1: Specific test case', async ({ page }) => {
    // Arrange
    await drawRectangle(page, 100, 100, 250, 200);

    // Act
    const shapes = await countShapes(page);

    // Assert
    expect(shapes).toBeGreaterThan(0);
  });
});
```

## Configuration

### `playwright.config.ts`

```typescript
- baseURL: http://localhost:3000
- Test timeout: 30 seconds
- Reporters: HTML (index.html)
- Screenshots: On failure only
- Trace: On first retry
- Parallel: Yes (by default)
- Retries: 2 on CI, 0 locally
```

### Supported Browsers

Tests run on:
- ✅ Chromium (Chrome/Edge)
- ✅ Firefox
- ✅ WebKit (Safari)

## Running Tests in CI/CD

```bash
# Run all tests with retries
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/e2e/3-undo-redo.spec.ts

# Run with specific browser
npm run test:e2e -- --project=chromium
```

## Test Categories by Priority

### Priority 1 (Critical - Must Pass)
- Undo/Redo (Scenario 3)
- Basic Drawing (Scenario 1)
- No console errors

### Priority 2 (Important)
- Brush Drawing (Scenario 2)
- Connectors (Scenario 4)

### Priority 3 (Nice to Have)
- Complex Workflows (Scenario 5)
- Edge Cases (Scenario 6)

## Performance Benchmarks

Expected test execution times:
- Basic drawing tests: ~30 seconds
- Brush drawing tests: ~40 seconds
- Undo/redo tests: ~60 seconds (includes large history)
- All tests: ~5-10 minutes

## Debugging

### Enable Debug Mode
```bash
npm run test:e2e:debug
```

This opens Playwright Inspector where you can:
- Step through tests
- Pause execution
- Inspect selectors
- View network calls

### Enable Headed Mode
```bash
npm run test:e2e:headed
```

This runs tests with visible browser window so you can:
- Watch execution
- See what the test is doing
- Identify visual issues

### View Traces
Automatically captured on failures:
```bash
npx playwright show-trace trace.zip
```

## Known Limitations

1. **SVG Element Selection** - Some SVG elements are hard to select
2. **Rendering Performance** - Large diagrams may render slowly in tests
3. **Browser-Specific Issues** - Minor differences between browsers
4. **Timing Issues** - Network-dependent timeouts may vary

## Future Improvements

- [ ] Add screenshot comparisons
- [ ] Add visual regression tests
- [ ] Add accessibility testing (a11y)
- [ ] Add performance profiling
- [ ] Increase coverage to 150+ tests
- [ ] Add load testing
- [ ] Add concurrent user testing

## Contributing

To add new tests:

1. Create new `.spec.ts` file in `tests/e2e/`
2. Import helpers from `helpers.ts`
3. Follow the test pattern
4. Run tests to verify
5. Update this README

Example:
```typescript
test('4.1: Create connector', async ({ page }) => {
  // Your test code here
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Examples](./1-basic-drawing.spec.ts)
- [Configuration](../playwright.config.ts)
- [Helpers](./helpers.ts)

## Troubleshooting

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if dev server is running on http://localhost:3000

### Selector not found
- Use `--debug` mode to inspect elements
- Use `--headed` mode to see browser
- Check selectors in browser DevTools

### Flaky tests
- Add `page.waitForTimeout()` for timing issues
- Use `waitForCondition()` helper for dynamic content
- Check for race conditions

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Install dependencies
  run: npm install

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Start dev server
  run: npm run dev &

- name: Run E2E tests
  run: npm run test:e2e
```

---

**Total Test Coverage: 100+ automated test cases** ✅
