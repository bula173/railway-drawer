/**
 * @file TextAreaInteraction.test.tsx
 * @brief Unit tests for text area editing and shape selection interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenderElement } from '../Elements';
import type { DrawElement } from '../Elements';

describe('TextArea Interaction Tests', () => {
  let mockElement: DrawElement;
  let mockCallbacks: {
    updateElement: (el: DrawElement) => void;
    handlePointerDown: (e: React.PointerEvent, el: DrawElement) => void;
    setHoveredElementId: (id: string | null) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
  };

  beforeEach(() => {
    // Create a basic test element
    mockElement = {
      id: 'test-element',
      type: 'rectangle',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      text: '', // Empty text initially
      name: 'Test Shape',
      styles: { fill: '#0066cc', stroke: '#000', strokeWidth: 2 },
      isLineBased: false,
      rotation: 0,
      layerId: 'default'
    };

    // Mock the callback functions
    mockCallbacks = {
      updateElement: vi.fn(),
      handlePointerDown: vi.fn(),
      setHoveredElementId: vi.fn(),
    };
  });

  it('should NOT show textarea on single click', async () => {
    const { container } = render(
      <svg>
        <RenderElement
          el={mockElement}
          isSelected={true}
          hoveredElementId={null}
          setHoveredElementId={mockCallbacks.setHoveredElementId}
          allElements={[mockElement]}
          updateElement={mockCallbacks.updateElement}
          handlePointerDown={mockCallbacks.handlePointerDown}
          startEditingWithChar={undefined}
        />
      </svg>
    );

    // Find the element group
    const elementGroup = container.querySelector('.element-container');
    expect(elementGroup).toBeTruthy();

    // Click on the element
    if (elementGroup) {
      fireEvent.pointerDown(elementGroup, { button: 0 });
    }

    // Check that textarea is NOT visible
    const textarea = screen.queryByRole('textbox');
    expect(textarea).not.toBeInTheDocument();
  });

  it('should show textarea when typing while shape is selected', async () => {
    const { container } = render(
      <svg>
        <RenderElement
          el={mockElement}
          isSelected={true}
          hoveredElementId={null}
          setHoveredElementId={mockCallbacks.setHoveredElementId}
          allElements={[mockElement]}
          updateElement={mockCallbacks.updateElement}
          handlePointerDown={mockCallbacks.handlePointerDown}
          startEditingWithChar="a" // Simulate typing 'a'
        />
      </svg>
    );

    // Wait for textarea to appear
    await waitFor(() => {
      const textarea = screen.queryByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });
  });

  it('should NOT duplicate first character in textarea', async () => {
    const { rerender } = render(
      <svg>
        <RenderElement
          el={mockElement}
          isSelected={true}
          hoveredElementId={null}
          setHoveredElementId={mockCallbacks.setHoveredElementId}
          allElements={[mockElement]}
          updateElement={mockCallbacks.updateElement}
          handlePointerDown={mockCallbacks.handlePointerDown}
          startEditingWithChar="v" // Type 'v'
        />
      </svg>
    );

    // Wait for textarea to appear and check its value
    await waitFor(() => {
      const textarea = screen.queryByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      // Should have just 'v', not 'vv'
      expect(textarea.value).toBe('v');
      expect(textarea.value).not.toBe('vv');
    });
  });

  it('should place cursor at end of text when editing starts', async () => {
    mockElement.text = 'existing text '; // Existing text

    const { rerender } = render(
      <svg>
        <RenderElement
          el={mockElement}
          isSelected={true}
          hoveredElementId={null}
          setHoveredElementId={mockCallbacks.setHoveredElementId}
          allElements={[mockElement]}
          updateElement={mockCallbacks.updateElement}
          handlePointerDown={mockCallbacks.handlePointerDown}
          startEditingWithChar="a" // Type 'a'
        />
      </svg>
    );

    await waitFor(() => {
      const textarea = screen.queryByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      // Cursor should be at the end (after 'existing text a')
      expect(textarea.selectionStart).toBe(textarea.value.length);
      expect(textarea.selectionEnd).toBe(textarea.value.length);
    });
  });

  it('should render textarea with correct CSS styles', async () => {
    const { container } = render(
      <svg>
        <RenderElement
          el={mockElement}
          isSelected={true}
          hoveredElementId={null}
          setHoveredElementId={mockCallbacks.setHoveredElementId}
          allElements={[mockElement]}
          updateElement={mockCallbacks.updateElement}
          handlePointerDown={mockCallbacks.handlePointerDown}
          startEditingWithChar="t"
        />
      </svg>
    );

    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      // Check that textarea has proper styling
      expect(textarea.style.padding).toBe('8px');
      expect(textarea.style.width).toBe('100%');
      expect(textarea.style.fontFamily).toContain('Arial');
    });
  });

  it('should handle cursor position at end of existing text', async () => {
    // Create element with existing text
    const elementWithText = { ...mockElement, text: 'Hello ' };

    const { container } = render(
      <svg>
        <RenderElement
          el={elementWithText}
          isSelected={true}
          hoveredElementId={null}
          setHoveredElementId={mockCallbacks.setHoveredElementId}
          allElements={[elementWithText]}
          updateElement={mockCallbacks.updateElement}
          handlePointerDown={mockCallbacks.handlePointerDown}
          startEditingWithChar="W"
        />
      </svg>
    );

    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      // Should contain 'Hello W' (existing text + first keystroke)
      expect(textarea.value).toContain('Hello');
      expect(textarea.value).toContain('W');
      // Cursor should be at end
      expect(textarea.selectionStart).toBe(textarea.value.length);
    });
  });

  it('should save text on blur event', async () => {
    const { rerender } = render(
      <svg>
        <RenderElement
          el={mockElement}
          isSelected={true}
          hoveredElementId={null}
          setHoveredElementId={mockCallbacks.setHoveredElementId}
          allElements={[mockElement]}
          updateElement={mockCallbacks.updateElement}
          handlePointerDown={mockCallbacks.handlePointerDown}
          startEditingWithChar="t"
        />
      </svg>
    );

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).toBeInTheDocument();
    });

    // Type something
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'blur test' } });

    // Trigger blur
    fireEvent.blur(textarea);

    // updateElement should be called to save the text
    await waitFor(() => {
      expect(mockCallbacks.updateElement).toHaveBeenCalled();
    });
  });
});
