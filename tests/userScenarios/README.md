# User Scenario Tests

This directory contains comprehensive user scenario tests for the Railway Drawer application. These scenarios describe real-world usage patterns and test cases that users will encounter.

## Overview

User scenarios are organized by feature area and complexity:

### 1. [Basic Drawing](./1-basic-drawing.md)
Covers the fundamental drawing operations that all users perform:
- Drawing single shapes
- Drawing multiple shapes
- Using colors
- Labeling shapes
- Basic shape manipulation

**Test Count:** 5 scenarios
**Key Focus:** Core functionality, basic workflows

### 2. [Brush Drawing](./2-brush-drawing.md)
Covers the brush tool for freehand annotations:
- Drawing brush strokes
- Changing brush type (5 types: Freehand, Pen, Marker, Pencil, Annotation)
- Adjusting brush properties (size, color, opacity, smoothing)
- Pressure sensitivity
- Temporary annotations

**Test Count:** 7 scenarios
**Key Focus:** Brush tool usability, configuration options

### 3. [Undo/Redo Operations](./3-undo-redo.md) ⭐ CRITICAL
Covers undo/redo functionality - the **most important** feature:
- Simple undo/redo
- Multiple undo/redo sequences
- Undo after modifications
- Mixed element + brush operations
- Undo with copy/paste
- Undo with text editing
- History branching (new operation after undo)
- Large undo histories
- **UNIFIED HISTORY:** All operations tracked in single history

**Test Count:** 10 scenarios
**Key Focus:** History correctness, LIFO behavior, state consistency

### 4. [Connectors](./4-connectors.md)
Covers connector lines and arrows:
- Creating simple connectors
- Connector line styles (solid, dotted, dashed)
- Arrow styles (none, standard, block, classic, circle, diamond)
- Connector color and width
- Connector labels
- Connector deletion
- Connector stickiness (follows shapes)
- Multiple connectors from same shape

**Test Count:** 10 scenarios
**Key Focus:** Connection management, visual styling

### 5. [Complex Workflows](./5-complex-workflows.md)
Covers realistic, multi-step user workflows:
- Creating flowcharts
- Creating complex diagrams
- Editing existing diagrams
- Large diagram handling (20+ elements)
- Copy/paste for diagram reuse
- Color coding sections
- Diagram review and feedback
- Keyboard shortcuts workflow

**Test Count:** 10 scenarios
**Key Focus:** Real-world usage, integration of multiple features

### 6. [Edge Cases and Error Recovery](./6-edge-cases.md)
Covers unusual situations and error handling:
- Undo/redo at history boundaries
- History branching
- Rapid undo/redo sequences
- Very large histories (100+ operations)
- Orphaned connectors
- Strokes outside canvas
- Shapes at canvas edges
- Degenerate shapes (very small/large)
- Multiple selection edge cases
- Performance under stress

**Test Count:** 14 scenarios
**Key Focus:** Robustness, error handling, performance

---

## Total Test Coverage

**Total Scenarios: 56+ comprehensive user scenarios**

## How to Use These Tests

### Manual Testing
1. Open http://localhost:3000/
2. Follow the numbered steps in each scenario
3. Check off each verification point as you test
4. Note any failures or unexpected behavior

### Test Execution Format

Each scenario follows this structure:

```
## Scenario X.Y: [Title]

**User Goal:** [What the user is trying to accomplish]

**Steps:**
1. [Step 1]
2. [Step 2]
...

**Expected Result:**
- ✅ [Expected outcome 1]
- ✅ [Expected outcome 2]
...

**Verification Points:**
- [ ] [Verification 1]
- [ ] [Verification 2]
...
```

### Checklist Usage
- Print or open these files in a checklist app
- Mark `[X]` as you verify each point
- Note any failures with:
  - Scenario number
  - Verification point
  - Expected vs. actual
  - Screenshot if needed
  - Browser/OS info

---

## Critical Focus Areas

### Priority 1: UNDO/REDO (Scenario 3)
The unified history implementation is critical. Ensure:
- ✅ Every operation is traceable
- ✅ LIFO (Last In, First Out) behavior
- ✅ Mixed element + brush operations work
- ✅ History branching works correctly
- ✅ Large histories (100+) remain performant
- ✅ Redo actually works with mixed operations

### Priority 2: BASIC DRAWING (Scenario 1)
Ensure core features work:
- ✅ All shape types draw
- ✅ Colors apply correctly
- ✅ Labels persist
- ✅ Selection/deselection works

### Priority 3: BRUSH DRAWING (Scenario 2)
Ensure brush functionality works:
- ✅ All 5 brush types distinct
- ✅ Size/color/opacity adjustable
- ✅ Strokes can be undone
- ✅ Temporary annotations work

---

## Automated Testing Opportunity

Many of these scenarios could be automated:
- ✅ Scenario 3 (Undo/Redo) - AUTOMATED via Vitest (43 tests pass)
- ⏳ Scenario 1-6 - Could use Playwright or Cypress for E2E tests
- ⏳ Performance tests - Could use Lighthouse or custom benchmarks

Current Test Coverage:
- **Unit Tests:** 43 tests (BrushHistory, UndoRedo, DrawArea integration)
- **Scenario Tests:** 56+ scenarios (this directory)
- **Gap:** E2E/integration tests could automate scenario validation

---

## Reporting Issues

When testing, report issues with:

1. **Scenario Number** (e.g., 3.5)
2. **Steps to Reproduce**
3. **Expected vs. Actual**
4. **Verification Points Failed**
5. **Environment:**
   - Browser (Chrome, Firefox, Safari)
   - OS (Windows, macOS, Linux)
   - Build/version
6. **Screenshots/Videos** (if applicable)

---

## Architecture Notes

### Unified History Design
The app now uses a **unified history system** where each undo/redo step contains:
```typescript
interface HistoryState {
  elements: DrawElement[];      // All shapes
  brushStrokes: BrushStroke[];  // All brush annotations
  timestamp: number;             // When created
}
```

This ensures:
- ✅ Mixed operations work correctly
- ✅ No priority conflicts
- ✅ LIFO semantics are clear
- ✅ Easy to understand and maintain

See: [UNDO_REDO_FIX_SUMMARY.md](../UNDO_REDO_FIX_SUMMARY.md)

---

## Quick Links

- **Architecture Design:** [UNDO_REDO_ARCHITECTURE.md](../UNDO_REDO_ARCHITECTURE.md)
- **Fix Summary:** [UNDO_REDO_FIX_SUMMARY.md](../UNDO_REDO_FIX_SUMMARY.md)
- **Source Code:** [src/components/DrawArea.tsx](../src/components/DrawArea.tsx)
- **Unit Tests:** [src/components/__tests__/](../src/components/__tests__/)

---

## Scenario Matrix

| Scenario | Feature | Difficulty | Priority | Status |
|----------|---------|-----------|----------|--------|
| 1.1-1.5 | Basic Drawing | Easy | High | Ready |
| 2.1-2.7 | Brush Drawing | Medium | High | Ready |
| 3.1-3.10 | Undo/Redo | Medium | **CRITICAL** | Ready ⭐ |
| 4.1-4.10 | Connectors | Medium | High | Ready |
| 5.1-5.10 | Complex Workflows | Hard | Medium | Ready |
| 6.1-6.14 | Edge Cases | Hard | Medium | Ready |

---

## Testing Timeline

Suggested testing order:
1. **Phase 1:** Basic Drawing (Scenario 1) - 30 min
2. **Phase 2:** Undo/Redo (Scenario 3) - 45 min ⭐ FOCUS HERE
3. **Phase 3:** Brush Drawing (Scenario 2) - 40 min
4. **Phase 4:** Connectors (Scenario 4) - 45 min
5. **Phase 5:** Complex Workflows (Scenario 5) - 60 min
6. **Phase 6:** Edge Cases (Scenario 6) - 60 min

**Total Time:** ~4 hours for comprehensive manual testing

---

## Maintenance

These scenarios should be updated when:
- New features are added
- Existing features are modified
- Bugs are discovered (add as edge case)
- User feedback suggests new scenarios
- Architecture changes (document impact)

---

## Contact

For questions about these scenarios, refer to:
- Feature documentation
- Architecture docs (UNDO_REDO_ARCHITECTURE.md)
- Source code comments
- Issue tracker
