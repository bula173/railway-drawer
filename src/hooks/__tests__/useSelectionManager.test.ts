import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectionManager } from '../useSelectionManager';
import type { DrawElement } from '../../components/Elements';

describe('useSelectionManager', () => {
  const mockElements: DrawElement[] = [
    {
      id: 'el-1',
      type: 'rectangle',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    },
    {
      id: 'el-2',
      type: 'rectangle',
      start: { x: 150, y: 150 },
      end: { x: 250, y: 250 },
    },
    {
      id: 'el-3',
      type: 'rectangle',
      start: { x: 300, y: 300 },
      end: { x: 400, y: 400 },
    },
  ] as DrawElement[];

  describe('Single Element Selection', () => {
    it('should select a single element', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElement('el-1');
      });

      expect(result.current.selectedElementIds).toContain('el-1');
      expect(result.current.selectedElementIds).toHaveLength(1);
    });

    it('should deselect element when selecting new one', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElement('el-1');
      });
      expect(result.current.selectedElementIds).toContain('el-1');

      act(() => {
        result.current.selectElement('el-2');
      });
      expect(result.current.selectedElementIds).toContain('el-2');
      expect(result.current.selectedElementIds).not.toContain('el-1');
    });
  });

  describe('Multi-Select', () => {
    it('should add to selection when addToSelection=true', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElement('el-1', true);
      });
      act(() => {
        result.current.selectElement('el-2', true);
      });

      expect(result.current.selectedElementIds).toHaveLength(2);
      expect(result.current.selectedElementIds).toContain('el-1');
      expect(result.current.selectedElementIds).toContain('el-2');
    });

    it('should toggle element with addToSelection=true', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElement('el-1', true);
      });
      expect(result.current.selectedElementIds).toContain('el-1');

      act(() => {
        result.current.selectElement('el-1', true);
      });
      expect(result.current.selectedElementIds).not.toContain('el-1');
    });
  });

  describe('Area Selection', () => {
    it('should start area selection', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      expect(result.current.isAreaSelecting).toBe(false);

      act(() => {
        result.current.startAreaSelection(0, 0);
      });

      expect(result.current.isAreaSelecting).toBe(true);
    });

    it('should clear selection on area selection start', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElement('el-1');
      });
      expect(result.current.selectedElementIds).toContain('el-1');

      act(() => {
        result.current.startAreaSelection(0, 0);
      });
      expect(result.current.selectedElementIds).toHaveLength(0);
    });

    it('should provide selection rect', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.startAreaSelection(10, 20);
        result.current.updateAreaSelection(110, 120);
      });

      const rect = result.current.selectionRect;
      expect(rect).toBeDefined();
      expect(rect?.x).toBe(10);
      expect(rect?.y).toBe(20);
      expect(rect?.width).toBe(100);
      expect(rect?.height).toBe(100);
    });
  });

  describe('Clear & Query Methods', () => {
    it('should clear selection', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElement('el-1');
        result.current.selectElement('el-2', true);
      });
      expect(result.current.selectedElementIds).toHaveLength(2);

      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectedElementIds).toHaveLength(0);
    });

    it('should check if element is selected', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElement('el-1');
      });

      expect(result.current.isSelected('el-1')).toBe(true);
      expect(result.current.isSelected('el-2')).toBe(false);
    });

    it('should get selected elements', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.selectElements(['el-1', 'el-2']);
      });

      const selected = result.current.getSelectedElements();
      expect(selected).toHaveLength(2);
      expect(selected[0].id).toBe('el-1');
      expect(selected[1].id).toBe('el-2');
    });
  });

  describe('UpdateSelection Method', () => {
    it('should update selection with updateSelection method', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      act(() => {
        result.current.updateSelection(['el-1', 'el-2']);
      });

      expect(result.current.selectedElementIds).toEqual(['el-1', 'el-2']);
    });
  });

  describe('Hover State', () => {
    it('should set and clear hover state', () => {
      const { result } = renderHook(() =>
        useSelectionManager({ elements: mockElements })
      );

      expect(result.current.hoveredElementId).toBeNull();

      act(() => {
        result.current.setHoveredElementId('el-1');
      });
      expect(result.current.isHovered('el-1')).toBe(true);

      act(() => {
        result.current.clearHover();
      });
      expect(result.current.hoveredElementId).toBeNull();
    });
  });
});
