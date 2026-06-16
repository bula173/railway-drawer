import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragManager } from '../useDragManager';
import type { DrawElement } from '../../components/Elements';

describe('useDragManager', () => {
  const mockSvgRect = {
    left: 0,
    top: 0,
    width: 1000,
    height: 800,
  } as DOMRect;

  describe('Drag State', () => {
    it('should start drag', () => {
      const { result } = renderHook(() => useDragManager());

      expect(result.current.isDragging).toBe(false);

      act(() => {
        result.current.startDrag('el-1', 100, 100, mockSvgRect);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.draggingElementId).toBe('el-1');
    });

    it('should end drag', () => {
      const { result } = renderHook(() => useDragManager());

      act(() => {
        result.current.startDrag('el-1', 100, 100, mockSvgRect);
      });
      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.endDrag();
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggingElementId).toBeNull();
    });
  });

  describe('Grid Snapping', () => {
    it('should snap to grid when enabled', () => {
      const { result } = renderHook(() =>
        useDragManager({ gridSize: 40, snapToGrid: true })
      );

      const offset = result.current.calculateDragOffset(
        150,
        150,
        mockSvgRect,
        { x: 100, y: 100 }
      );

      // 50 pixels should snap to 40 (closest multiple of 40)
      expect(offset.x).toBe(40);
      expect(offset.y).toBe(40);
    });

    it('should not snap when disabled', () => {
      const { result } = renderHook(() =>
        useDragManager({ snapToGrid: false })
      );

      const offset = result.current.calculateDragOffset(
        150,
        150,
        mockSvgRect,
        { x: 100, y: 100 }
      );

      expect(offset.x).toBe(50);
      expect(offset.y).toBe(50);
    });
  });

  describe('Initial Positions', () => {
    it('should record initial positions', () => {
      const { result } = renderHook(() => useDragManager());

      const elements = [
        {
          id: 'el-1',
          type: 'rectangle',
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
        },
      ] as DrawElement[];

      act(() => {
        result.current.recordInitialPositions(elements);
      });

      const initial = result.current.getInitialPosition('el-1');
      expect(initial).toBeDefined();
      expect(initial?.start).toEqual({ x: 0, y: 0 });
      expect(initial?.end).toEqual({ x: 100, y: 100 });
    });

    it('should return null for unknown element', () => {
      const { result } = renderHook(() => useDragManager());

      const initial = result.current.getInitialPosition('unknown');
      expect(initial).toBeFalsy();
    });
  });

  describe('Configuration', () => {
    it('should use configured grid size', () => {
      const { result } = renderHook(() =>
        useDragManager({ gridSize: 50 })
      );

      expect(result.current.gridSize).toBe(50);
    });

    it('should reflect snap setting', () => {
      const { result } = renderHook(() =>
        useDragManager({ snapToGrid: true })
      );

      expect(result.current.snapToGrid).toBe(true);
    });
  });
});
