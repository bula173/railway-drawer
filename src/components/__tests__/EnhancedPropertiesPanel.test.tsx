/**
 * @file EnhancedPropertiesPanel.test.tsx
 * @brief Test suite for the EnhancedPropertiesPanel component
 * 
 * Tests cover all tabs, validation, user interactions, and error handling
 * to ensure the properties panel works correctly across all scenarios.
 * 
 * @author Railway Drawer Team
 * @date 2025
 * @version 1.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnhancedPropertiesPanel from '../EnhancedPropertiesPanel';
import type { DrawElement, DrawAreaRef } from '../../types/index';

// Mock the logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock utils
vi.mock('../../utils', () => ({
  debounce: (fn: (...args: unknown[]) => unknown) => {
    // Return a function that calls the original immediately for tests
    return (...args: unknown[]) => fn(...args);
  },
  isDefined: (value: unknown) => value !== undefined && value !== null,
  removeUndefined: (obj: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) cleaned[key] = obj[key];
    });
    return cleaned;
  },
}));

describe('EnhancedPropertiesPanel', () => {
  let mockDrawAreaRef: React.RefObject<DrawAreaRef>;
  let mockOnElementChange: ReturnType<typeof vi.fn>;
  let mockOnValidationError: ReturnType<typeof vi.fn>;

  // Sample test element
  const mockElement: DrawElement = {
    id: 'test-element-123',
    type: 'rectangle',
    name: 'Test Rectangle',
    start: { x: 10, y: 20 },
    end: { x: 110, y: 120 },
    width: 100,
    height: 100,
    styles: {
      fill: '#3b82f6',
      stroke: '#1e293b',
      strokeWidth: 2,
      opacity: 1,
    },
    shapeElements: [
      {
        id: 'shape-1',
        svg: '<rect width="100" height="100" />',
        textRegions: [
          {
            id: 'text-1',
            text: 'Sample text',
            x: 10,
            y: 20,
            width: 80,
            height: 20,
            fontSize: 14,
            align: 'left',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    mockOnElementChange = vi.fn();
    mockOnValidationError = vi.fn();
    
    mockDrawAreaRef = {
      current: {
        getSvgElement: vi.fn().mockReturnValue(null),
        getElements: vi.fn().mockReturnValue([]),
        setElements: vi.fn(),
        updateElements: vi.fn(),
        setGridVisible: vi.fn(),
        getGridVisible: vi.fn().mockReturnValue(true),
        setBackgroundColor: vi.fn(),
        getBackgroundColor: vi.fn().mockReturnValue('#ffffff'),
        getSelectedElement: vi.fn().mockReturnValue(undefined),
        getSelectedElementIds: vi.fn().mockReturnValue([]),
        copySelectedElements: vi.fn(),
        cutSelectedElements: vi.fn(),
        pasteElements: vi.fn(),
        getCopiedElements: vi.fn().mockReturnValue([]),
        setCopiedElements: vi.fn(),
        // Edit operations
        undo: vi.fn(),
        redo: vi.fn(),
        deleteSelectedElements: vi.fn(),
        selectAllElements: vi.fn(),
        canUndo: vi.fn().mockReturnValue(false),
        canRedo: vi.fn().mockReturnValue(false),
      } as DrawAreaRef,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing when no element is selected', () => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={null}
          onElementChange={mockOnElementChange}
        />
      );

      expect(screen.getByText('Canvas Properties')).toBeInTheDocument();
    });

    it('renders all tabs when an element is selected', () => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
        />
      );

      expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /style/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /text/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /arrange/i })).toBeInTheDocument();
    });
  });

  describe('General Tab', () => {
    beforeEach(() => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
          onValidationError={mockOnValidationError}
        />
      );
    });

    it('displays element information correctly', () => {
      expect(screen.getByText('test-element-123')).toBeInTheDocument();
      expect(screen.getByText('rectangle')).toBeInTheDocument();
    });

    it('allows editing element name', async () => {
      const nameInput = screen.getByDisplayValue('Test Rectangle');
      
      fireEvent.change(nameInput, { target: { value: 'Updated Rectangle' } });

      await waitFor(() => {
        expect(mockDrawAreaRef.current?.updateElements).toHaveBeenCalled();
      });
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
        />
      );
    });

    it('switches between tabs correctly', async () => {
      const user = userEvent.setup();

      // Switch to style tab
      await user.click(screen.getByRole('tab', { name: /style/i }));
      expect(screen.getByRole('tab', { name: /style/i })).toHaveAttribute('aria-selected', 'true');

      // Switch to text tab
      await user.click(screen.getByRole('tab', { name: /text/i }));
      expect(screen.getByRole('tab', { name: /text/i })).toHaveAttribute('aria-selected', 'true');

      // Switch to arrange tab
      await user.click(screen.getByRole('tab', { name: /arrange/i }));
      expect(screen.getByRole('tab', { name: /arrange/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Style Tab', () => {
    beforeEach(() => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
        />
      );

      // Switch to style tab
      fireEvent.click(screen.getByRole('tab', { name: /style/i }));
    });

    it('allows changing fill color', async () => {
      const fillInput = screen.getByLabelText(/fill color/i);

      fireEvent.change(fillInput, { target: { value: '#ff0000' } });

      await waitFor(() => {
        expect(mockDrawAreaRef.current?.updateElements).toHaveBeenCalled();
      });
    });

    it('allows changing stroke properties', async () => {
      const strokeInput = screen.getByLabelText(/stroke color/i);

      fireEvent.change(strokeInput, { target: { value: '#00ff00' } });

      await waitFor(() => {
        expect(mockDrawAreaRef.current?.updateElements).toHaveBeenCalled();
      });
    });
  });

  describe('Text Tab', () => {
    beforeEach(() => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
        />
      );

      // Switch to text tab
      fireEvent.click(screen.getByRole('tab', { name: /text/i }));
    });

    it('displays text regions', () => {
      expect(screen.getByDisplayValue('Sample text')).toBeInTheDocument();
    });

    it('allows editing text content', async () => {
      const textInput = screen.getByDisplayValue('Sample text');

      fireEvent.change(textInput, { target: { value: 'Updated text' } });

      await waitFor(() => {
        expect(mockDrawAreaRef.current?.updateElements).toHaveBeenCalled();
      });
    });
  });

  describe('Arrange Tab', () => {
    beforeEach(() => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
        />
      );

      // Switch to arrange tab
      fireEvent.click(screen.getByRole('tab', { name: /arrange/i }));
    });

    it('displays position and size controls', () => {
      expect(screen.getByLabelText(/x position/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/y position/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/height/i)).toBeInTheDocument();
    });

    it('allows changing position', async () => {
      const xInput = screen.getByLabelText(/x position/i);

      fireEvent.change(xInput, { target: { value: '50' } });

      await waitFor(() => {
        expect(mockDrawAreaRef.current?.updateElements).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing drawAreaRef gracefully', async () => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={{ current: null }}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
          onValidationError={mockOnValidationError}
        />
      );

      const nameInput = screen.getByDisplayValue('Test Rectangle');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      await waitFor(() => {
        expect(mockOnValidationError).toHaveBeenCalledWith(
          'Failed to update element. Please try again.'
        );
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      render(
        <EnhancedPropertiesPanel
          drawAreaRef={mockDrawAreaRef}
          selectedElement={mockElement}
          onElementChange={mockOnElementChange}
        />
      );
    });

    it('has proper ARIA labels', () => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });

    it('has proper form labels', () => {
      expect(screen.getByLabelText(/element name/i)).toBeInTheDocument();
      
      // Switch to arrange tab to check position/dimension labels
      fireEvent.click(screen.getByRole('tab', { name: /arrange/i }));
      expect(screen.getByLabelText(/x position/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/y position/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/height/i)).toBeInTheDocument();
    });
  });
});
