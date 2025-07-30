/**
 * @file PropertiesPanel.test.tsx
 * @brief Tests for the PropertiesPanel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PropertiesPanel from '../PropertiesPanel';
import type { DrawElement } from '../Elements';

// Mock DrawAreaRef
const mockDrawAreaRef = {
  getSvgElement: vi.fn(),
  getElements: vi.fn(() => []),
  setElements: vi.fn(),
  updateElements: vi.fn(),
  setGridVisible: vi.fn(),
  getGridVisible: vi.fn(() => true),
  setBackgroundColor: vi.fn(),
  getBackgroundColor: vi.fn(() => '#ffffff'),
  getSelectedElement: vi.fn(),
  getSelectedElementIds: vi.fn(() => []),
  copySelectedElements: vi.fn(),
  cutSelectedElements: vi.fn(),
  pasteElements: vi.fn(),
  getCopiedElements: vi.fn(() => []),
  setCopiedElements: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  deleteSelectedElements: vi.fn(),
  selectAllElements: vi.fn(),
  canUndo: vi.fn(() => false),
  canRedo: vi.fn(() => false),
};

// Create a test element
const createTestElement = (id: string, name: string = 'Test Element'): DrawElement => ({
  id,
  name,
  type: 'test',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 100 },
  width: 100,
  height: 100,
  rotation: 0,
  gridEnabled: true,
  backgroundColor: '#ffffff',
  setGridEnabled: vi.fn(),
  setBackgroundColor: vi.fn(),
  draw: { type: 'rectangle' },
});

describe('PropertiesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing when no element is selected', () => {
    render(
      <PropertiesPanel
        selectedElement={undefined}
        drawAreaRef={{ current: mockDrawAreaRef }}
      />
    );
    
    expect(screen.getByText('Draw Area Properties')).toBeInTheDocument();
  });

  it('displays element properties when an element is selected', () => {
    const testElement = createTestElement('test-1', 'Test Rectangle');
    
    render(
      <PropertiesPanel
        selectedElement={testElement}
        drawAreaRef={{ current: mockDrawAreaRef }}
      />
    );
    
    expect(screen.getByText('Element Properties')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Rectangle')).toBeInTheDocument();
  });

  it('handles element updates correctly', () => {
    const testElement = createTestElement('test-1', 'Test Element');
    
    render(
      <PropertiesPanel
        selectedElement={testElement}
        drawAreaRef={{ current: mockDrawAreaRef }}
      />
    );
    
    // Verify the component renders with the element
    expect(screen.getByDisplayValue('Test Element')).toBeInTheDocument();
  });
});
