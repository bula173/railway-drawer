# Project Memory Index

Quick reference to key documentation and resources for the Railway Drawer architectural improvements.

## Status & Plans
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — Complete project status (88% done, 7/8 phases)
- [PHASE4_PART2_IMPLEMENTATION.md](PHASE4_PART2_IMPLEMENTATION.md) — Step-by-step execution guide for final phase

## Implementation Resources
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) — Detailed integration strategy (older, use PHASE4_PART2_IMPLEMENTATION.md first)
- [src/components/DrawAreaRefactored.tsx](src/components/DrawAreaRefactored.tsx) — Reference implementation showing hook integration pattern
- [src/hooks/useDrawAreaIntegration.ts](src/hooks/useDrawAreaIntegration.ts) — Combined manager hooks hook

## Analysis & Reviews
- [CODE_REVIEW.md](CODE_REVIEW.md) — Comprehensive architectural issues analysis
- [REVIEW_SUMMARY.md](REVIEW_SUMMARY.md) — Executive summary of improvements
- [PHASE_PROGRESS.md](PHASE_PROGRESS.md) — Detailed phase-by-phase progress

## Key Manager Hooks (All Tested & Ready)
- `src/hooks/useSelectionManager.ts` — Selection, multi-select, area selection, hover
- `src/hooks/useDragManager.ts` — Dragging with grid snapping
- `src/hooks/useResizeManager.ts` — Resizing with mirroring and min-size
- `src/hooks/useHistoryManager.ts` — Undo/redo with debouncing and pruning

## Next Action
To complete the project:
1. Read [PHASE4_PART2_IMPLEMENTATION.md](PHASE4_PART2_IMPLEMENTATION.md) (detailed step-by-step guide)
2. Follow Phase 4 Part 2a-2d (integrate each manager one at a time)
3. Test after each integration
4. Result: DrawArea reduced from 2,927 → ~600 lines

**Time Required:** 2-3 days (4-8 hours of focused work)

**Difficulty:** Medium (large component, but all utilities are tested)
