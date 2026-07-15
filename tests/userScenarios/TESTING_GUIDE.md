# User Scenario Testing Guide

## Quick Start

### What You'll Test
56+ comprehensive user scenarios covering:
- ✅ Basic shape drawing
- ✅ Brush/annotation drawing
- ✅ **Undo/Redo operations** ⭐ CRITICAL
- ✅ Connector lines and arrows
- ✅ Complex multi-feature workflows
- ✅ Edge cases and error recovery

### Where to Start
1. Open **http://localhost:3000** in a web browser
2. Open scenario files in this folder (numbered 1-6)
3. Follow the steps in each scenario
4. Check off verification points as you go

### Files Overview

| File | Scenarios | Focus | Time |
|------|-----------|-------|------|
| 1-basic-drawing.md | 5 | Drawing shapes, colors, labels | 30 min |
| 2-brush-drawing.md | 7 | Freehand annotations | 40 min |
| 3-undo-redo.md | 10 | **Undo/Redo operations** ⭐ | 45 min |
| 4-connectors.md | 10 | Connection lines and arrows | 45 min |
| 5-complex-workflows.md | 10 | Real-world workflows | 60 min |
| 6-edge-cases.md | 14 | Unusual situations, limits | 60 min |
| README.md | Guide | Navigation and overview | — |

**Total Time:** ~4 hours for all scenarios

---

## What to Test First

### ⭐ PRIORITY 1: Undo/Redo (3-undo-redo.md)

This is the **MOST CRITICAL** feature. Test these scenarios:

1. **Scenario 3.1** - Simple Undo (2 min)
   - Draw rectangle
   - Press Ctrl+Z
   - Rectangle disappears ✓

2. **Scenario 3.2** - Simple Redo (2 min)
   - From 3.1, press Ctrl+Y
   - Rectangle reappears ✓

3. **Scenario 3.5** - Mixed Operations (5 min)
   - Draw rectangle
   - Draw brush stroke
   - Undo both → check order ✓

4. **Scenario 3.3** - Multiple Undo/Redo (5 min)
   - Draw 3 shapes
   - Undo 3 times
   - Redo 3 times
   - Check each step ✓

**If all of these pass, the new unified history works!**

---

## Scenario Structure

Each scenario has this format:

```
## Scenario X.Y: [Title]

**User Goal:** What the user wants to do

**Steps:**
1. Do this first
2. Then do this
3. Verify this happens

**Expected Result:**
✅ This should happen
✅ And this
✅ And this

**Verification Points:**
- [ ] Check this worked
- [ ] Check this worked
- [ ] Check this worked
```

---

## How to Mark Progress

### For Each Scenario:
- ✅ **PASS** - All verification points checked
- ⚠️ **FAIL** - Some verification points failed
- ⏭️ **SKIP** - Feature not yet implemented

### Record Results:
```
Scenario 3.1: ✅ PASS
  - Rectangle disappears on Ctrl+Z ✓
  - Redo button enabled ✓

Scenario 3.5: ⚠️ FAIL
  - Brush stroke undoes correctly ✓
  - Rectangle disappears correctly ✗ (appeared instead)
  - State not reverted properly
```

---

## Common Issues to Watch For

### Undo/Redo Issues
- [ ] Redo doesn't work after Undo
- [ ] Wrong element gets undone
- [ ] Elements duplicate on Undo
- [ ] Undo skips operations
- [ ] History shows wrong state

### Brush Issues
- [ ] Stroke doesn't appear while drawing
- [ ] Stroke position wrong after undo
- [ ] Brush tool doesn't toggle off
- [ ] Strokes not saved
- [ ] Can't change brush properties

### General Issues
- [ ] Console errors appearing
- [ ] App becomes unresponsive
- [ ] Elements disappear unexpectedly
- [ ] UI doesn't update
- [ ] Connectors break

---

## Testing on Different Browsers

Test on all major browsers if possible:
- ✅ Chrome/Edge (Chromium-based)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (if applicable)

---

## Performance Notes

While testing, watch for:
- [ ] Lag when drawing
- [ ] Stuttering on undo/redo
- [ ] Slow response to clicks
- [ ] App freezing
- [ ] Memory usage climbing

Use browser DevTools:
- F12 → Performance tab
- Monitor FPS while drawing
- Check memory usage (Console)

---

## Reporting Issues

When you find a problem:

```
**Scenario:** 3.5 - Mixed Operations
**Step:** 5 (after drawing brush stroke)
**Expected:** Stroke disappears on Ctrl+Z
**Actual:** Stroke remains, rectangle disappears instead
**Browser:** Chrome 120
**OS:** Windows 11
**Steps to Reproduce:**
1. Draw rectangle
2. Press B for brush
3. Draw stroke on canvas
4. Press Ctrl+Z
5. Notice wrong element undone
```

---

## Architecture Context

### Why Unified History?
Previous implementation had **two separate histories** (elements + brush), causing:
- Redo not working with mixed operations
- Conflicting state
- User confusion

**New Design:** Single unified history
- Each step = complete canvas state (elements + brushes)
- LIFO semantics (Last In, First Out)
- Clear, predictable behavior
- Works like other drawing apps (Figma, Adobe)

See: [UNDO_REDO_ARCHITECTURE.md](../../UNDO_REDO_ARCHITECTURE.md)

---

## Success Criteria

✅ **All scenarios in 3-undo-redo.md PASS**
- This proves the unified history works
- Covers all critical undo/redo cases
- Mixed operations work correctly

✅ **All scenarios in 1-basic-drawing.md PASS**
- Basic functionality works
- Foundation for other features

✅ **All scenarios in 2-brush-drawing.md PASS**
- Brush tool works
- Can be undone/redone

✅ **Scenario 5.4 PASSES**
- Complex multi-operation history works
- No state corruption with 10+ operations

✅ **No console errors**
- App is stable
- No hidden bugs

---

## Timeline

Recommended testing order and time:

```
Day 1 (2 hours):
├── 1-basic-drawing.md (30 min)
├── 3-undo-redo.md (45 min) ⭐
└── 2-brush-drawing.md (40 min)

Day 2 (2 hours):
├── 4-connectors.md (45 min)
├── 5-complex-workflows.md (60 min)
└── 6-edge-cases.md (15 min - select critical ones)
```

---

## FAQ

**Q: Do I need to test all 56 scenarios?**
A: Start with priorities (Scenarios 3, 1, 2). Others are nice-to-have.

**Q: What if a scenario fails?**
A: Take a screenshot, note the issue, and check if it's in the known issues list.

**Q: Can I automate these?**
A: Yes! Playwright or Cypress could automate most scenarios. Currently we have 43 unit tests (Vitest).

**Q: How often should I test?**
A: After any code changes, especially in DrawArea.tsx or history-related code.

**Q: What's the most important scenario?**
A: **Scenario 3.5** - Mixed Operations. If this passes, the new unified history works!

---

## Tools You Might Need

- **Browser DevTools** - F12 for console, performance
- **Screenshot Tool** - Print Screen or browser tools
- **Checklist App** - Notion, Joplin, or Markdown editor
- **Git** - To check what changed
- **Terminal** - To check for console errors

---

## Resources

- 📖 [Architecture Design](../../UNDO_REDO_ARCHITECTURE.md)
- 📖 [Fix Summary](../../UNDO_REDO_FIX_SUMMARY.md)
- 📖 [README.md](./README.md) - Scenario overview
- 💻 [Source Code](../../src/components/DrawArea.tsx)
- ✅ [Unit Tests](../../src/components/__tests__/)

---

## Contact/Questions

If you encounter issues or have questions:
1. Check the scenario README.md
2. Review the architecture docs
3. Check browser console (F12)
4. Look at recent git commits
5. Check issue tracker

---

**Good luck with testing!** 🎉
