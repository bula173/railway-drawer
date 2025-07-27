import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnhancedPropertiesPanel from '../EnhancedPropertiesPanel';
import type { DrawAreaRef } from '../DrawArea';
import type { DrawElement } from '../Elements';

// Mock DrawArea ref with correct interface
const mockDrawAreaRef: React.RefObject<DrawAreaRef> = {
  current: {
    getSvgElement: vi.fn(() => null),
    getElements: vi.fn(() => []),
    setElements: vi.fn(),
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
  }
};

describe('EnhancedPropertiesPanel Component', () => {
  const mockElement: DrawElement = {
    id: 'test-element-1',
    name: 'Test Element',
    type: 'custom',
    start: { x: 100, y: 100 },
    end: { x: 200, y: 200 },
    gridEnabled: true,
    backgroundColor: '#ffffff',
    setGridEnabled: () => {},
    setBackgroundColor: () => {},
    shape: '<rect width="100" height="100" fill="blue"/>',
    width: 100,
    height: 100,
    rotation: 0,
    styles: {
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 2
    }
  };

  const mockOnElementChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    if (mockDrawAreaRef.current) {
      vi.mocked(mockDrawAreaRef.current.getElements).mockReturnValue([mockElement]);
    }
  });

  it('renders canvas settings when no element is selected', () => {
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={null}
        onElementChange={mockOnElementChange}
      />
    );

    expect(screen.getByText('Canvas Properties')).toBeInTheDocument();
    expect(screen.getByLabelText('Canvas background color')).toBeInTheDocument();
    expect(screen.getByLabelText('Grid visibility')).toBeInTheDocument();
  });

  it('shows properties form when element is selected', () => {
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );

    expect(screen.getByText('Element Properties')).toBeInTheDocument();
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('style')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('arrange')).toBeInTheDocument();
  });

  it('updates element name when input changes', async () => {
    const user = userEvent.setup();
    
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Element');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Element Name');

    // Wait for debounced update (EnhancedPropertiesPanel uses debouncing)
    await new Promise(resolve => setTimeout(resolve, 600)); // Wait for debounce delay

    expect(mockDrawAreaRef.current?.setElements).toHaveBeenCalled();
  });

  it('handles null drawAreaRef gracefully', () => {
    const nullRef: React.RefObject<DrawAreaRef | null> = { current: null };
    
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={nullRef as React.RefObject<DrawAreaRef>}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );

    expect(screen.getByText('Element Properties')).toBeInTheDocument();
  });

  it('displays element properties correctly in General tab', () => {
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );
    
    // General tab should be active by default
    expect(screen.getByText('test-element-1')).toBeInTheDocument();
    expect(screen.getByText('custom')).toBeInTheDocument();
    expect(screen.getByText('(100, 100)')).toBeInTheDocument();
    expect(screen.getByText('100 × 100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Element')).toBeInTheDocument();
  });

  it('switches to Style tab and shows style controls', async () => {
    const user = userEvent.setup();
    
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );

    // Click on Style tab
    const styleTab = screen.getByText('style');
    await user.click(styleTab);

        // Should show style controls
    expect(screen.getByLabelText('Fill color')).toBeInTheDocument();
    expect(screen.getByLabelText('Stroke color')).toBeInTheDocument();
    expect(screen.getByLabelText('Stroke width')).toBeInTheDocument();
    expect(screen.getByLabelText('Opacity')).toBeInTheDocument();
  });

  it('updates properties and calls setElements', async () => {
    const user = userEvent.setup();
    
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );

    // Switch to Style tab
    const styleTab = screen.getByText('style');
    await user.click(styleTab);

    // Update fill color (color inputs work differently)
    const fillInput = screen.getByDisplayValue('#ff0000');
    await user.click(fillInput);
    
    // For color inputs, we can change the value directly
    fireEvent.change(fillInput, { target: { value: '#00ff00' } });

    // Wait for debounced update (EnhancedPropertiesPanel uses debouncing)
    await new Promise(resolve => setTimeout(resolve, 600)); // Wait for debounce delay

    expect(mockDrawAreaRef.current?.setElements).toHaveBeenCalled();
  });

  it('switches to Text tab and shows appropriate content', async () => {
    const user = userEvent.setup();
    
    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );

    // Click on Text tab
    const textTab = screen.getByText('text');
    await user.click(textTab);

    // Should show "No text regions found" message for elements without text
    expect(screen.getByText('No text regions found')).toBeInTheDocument();
  });

  it('resets form when element selection changes', () => {
    const { rerender } = render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    );

    expect(screen.getByDisplayValue('Test Element')).toBeInTheDocument();

    rerender(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={null}
        onElementChange={mockOnElementChange}
      />
    );

    expect(screen.getByText('Canvas Properties')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Test Element')).not.toBeInTheDocument();
  });

  it('allows empty element names', async () => {
    const user = userEvent.setup();
    const mockOnElementChange = vi.fn();
    const mockSetElements = vi.fn();
    
    const mockDrawAreaRef = {
      current: {
        setElements: mockSetElements,
        getElements: () => [],
        getSvgElement: () => null,
        setGridVisible: vi.fn(),
        getGridVisible: () => true,
        setBackgroundColor: vi.fn(),
        getBackgroundColor: () => '#ffffff',
        getSelectedElement: () => undefined,
        getSelectedElementIds: () => [],
        setSelectedElementIds: vi.fn(),
        getCopiedElements: () => [],
        setCopiedElements: vi.fn(),
        copySelectedElements: vi.fn(),
        pasteElements: vi.fn(),
        cutSelectedElements: vi.fn(),
      }
    };
    
    const testElement: DrawElement = {
      id: 'test-1',
      name: 'Test Element',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      start: { x: 10, y: 10 },
      end: { x: 110, y: 60 }
    };

    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={testElement}
        onElementChange={mockOnElementChange}
      />
    );

    // Get the name input and clear it completely
    const nameInput = screen.getByDisplayValue('Test Element');
    await user.clear(nameInput);
    
    // Wait for debounced update
    await new Promise(resolve => setTimeout(resolve, 600));

    // Verify that the element change was called with empty name
    expect(mockOnElementChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ...testElement,
        name: ''
      })
    );
  });

  it('resets styles to default when reset button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnElementChange = vi.fn();
    const mockSetElements = vi.fn();
    
    const mockDrawAreaRef = {
      current: {
        setElements: mockSetElements,
        getElements: () => [],
        getSvgElement: () => null,
        setGridVisible: vi.fn(),
        getGridVisible: () => true,
        setBackgroundColor: vi.fn(),
        getBackgroundColor: () => '#ffffff',
        getSelectedElement: () => undefined,
        getSelectedElementIds: () => [],
        setSelectedElementIds: vi.fn(),
        getCopiedElements: () => [],
        setCopiedElements: vi.fn(),
        copySelectedElements: vi.fn(),
        pasteElements: vi.fn(),
        cutSelectedElements: vi.fn(),
      }
    };
    
    const testElement: DrawElement = {
      id: 'test-1',
      name: 'Test Element',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      start: { x: 10, y: 10 },
      end: { x: 110, y: 60 },
      styles: {
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 5,
        opacity: 0.5,
      }
    };

    render(
      <EnhancedPropertiesPanel
        drawAreaRef={mockDrawAreaRef}
        selectedElement={testElement}
        onElementChange={mockOnElementChange}
      />
    );

    // Switch to Style tab
    const styleTab = screen.getByRole('tab', { name: /style/i });
    await user.click(styleTab);

    // Find and click the reset button
    const resetButton = screen.getByRole('button', { name: /reset styles to original toolbox/i });
    await user.click(resetButton);
    
    // Wait for debounced update
    await new Promise(resolve => setTimeout(resolve, 600));

    // Verify that the element change was called with styles set to undefined (original toolbox styles)
    expect(mockOnElementChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ...testElement,
        styles: undefined // Styles should be undefined to use original toolbox styles
      })
    );
  });
});