import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DrawArea, { type DrawAreaRef } from '../DrawArea';
import type { DrawElement } from '../Elements';

// Mock the Elements module to avoid complex SVG rendering in tests
vi.mock('../Elements', () => ({
  RenderElement: ({ el, handlePointerDown }: any) => (
    <g data-testid={`element-${el.id}`} onPointerDown={(e) => handlePointerDown(e, el)}>
      <rect x={el.start.x} y={el.start.y} width="50" height="50" />
    </g>
  )
}));

describe('DrawArea Element State Management', () => {
  const defaultProps = {
    GRID_WIDTH: 800,
    GRID_HEIGHT: 600,
    GRID_SIZE: 20,
    zoom: 1,
  };

  let drawAreaRef: React.RefObject<DrawAreaRef>;

  beforeEach(() => {
    drawAreaRef = React.createRef<DrawAreaRef>() as React.RefObject<DrawAreaRef>;
    vi.clearAllMocks();
  });

  const createTestElement = (id: string, name: string = 'Test Element'): DrawElement => ({
    id,
    name,
    type: 'custom',
    start: { x: 100, y: 100 },
    end: { x: 150, y: 150 },
    gridEnabled: true,
    backgroundColor: '#ffffff',
    setGridEnabled: vi.fn(),
    setBackgroundColor: vi.fn(),
    shape: '<rect width="50" height="50" fill="blue"/>',
    width: 50,
    height: 50,
    rotation: 0,
  });

  it('should maintain element state correctly', async () => {
    render(<DrawArea ref={drawAreaRef} {...defaultProps} />);
    
    // Test 1: Add element
    const testElement = createTestElement('test-1');
    drawAreaRef.current?.setElements([testElement]);
    
    await waitFor(() => {
      expect(drawAreaRef.current?.getElements()).toHaveLength(1);
      expect(drawAreaRef.current?.getElements()[0].id).toBe('test-1');
    });

    // Test 2: Update element with styles (the problematic case)
    const updatedElement = {
      ...testElement,
      styles: {
        fill: '#ff0000',
        opacity: 0.5,
      }
    };

    drawAreaRef.current?.setElements([updatedElement]);
    
    await waitFor(() => {
      const elements = drawAreaRef.current?.getElements();
      expect(elements).toHaveLength(1);
      expect(elements?.[0].id).toBe('test-1');
      expect(elements?.[0].styles?.fill).toBe('#ff0000');
      expect(elements?.[0].styles?.opacity).toBe(0.5);
    });

    // Test 3: Multiple style updates
    for (let i = 0; i < 5; i++) {
      const multiUpdatedElement = {
        ...testElement,
        styles: {
          fill: `#ff${i}${i}${i}${i}`,
          opacity: 0.1 * (i + 1),
        }
      };

      drawAreaRef.current?.setElements([multiUpdatedElement]);
      
      await waitFor(() => {
        const elements = drawAreaRef.current?.getElements();
        expect(elements).toHaveLength(1);
        expect(elements?.[0].id).toBe('test-1');
        expect(elements?.[0].styles?.opacity).toBe(0.1 * (i + 1));
      });
    }
  });

  it('should handle multiple elements with individual updates', async () => {
    render(<DrawArea ref={drawAreaRef} {...defaultProps} />);
    
    const element1 = createTestElement('multi-1', 'Element 1');
    const element2 = createTestElement('multi-2', 'Element 2');
    
    // Add both elements
    drawAreaRef.current?.setElements([element1, element2]);
    
    await waitFor(() => {
      expect(drawAreaRef.current?.getElements()).toHaveLength(2);
    });

    // Update only the first element
    const updatedElement1 = {
      ...element1,
      styles: { fill: '#00ff00' }
    };

    drawAreaRef.current?.setElements([updatedElement1, element2]);
    
    await waitFor(() => {
      const elements = drawAreaRef.current?.getElements();
      expect(elements).toHaveLength(2);
      expect(elements?.[0].styles?.fill).toBe('#00ff00');
      expect(elements?.[1].styles).toBeUndefined(); // Second element unchanged
    });

    // Update only the second element
    const updatedElement2 = {
      ...element2,
      styles: { fill: '#0000ff' }
    };

    drawAreaRef.current?.setElements([updatedElement1, updatedElement2]);
    
    await waitFor(() => {
      const elements = drawAreaRef.current?.getElements();
      expect(elements).toHaveLength(2);
      expect(elements?.[0].styles?.fill).toBe('#00ff00');
      expect(elements?.[1].styles?.fill).toBe('#0000ff');
    });
  });

  it('should preserve all element properties during updates', async () => {
    render(<DrawArea ref={drawAreaRef} {...defaultProps} />);
    
    const originalElement = createTestElement('preserve-test');
    originalElement.textRegions = [
      { id: 'text-1', text: 'Original text', x: 10, y: 20, width: 100, height: 30 }
    ];
    
    drawAreaRef.current?.setElements([originalElement]);
    
    await waitFor(() => {
      expect(drawAreaRef.current?.getElements()).toHaveLength(1);
    });

    // Update with styles while preserving other properties
    const updatedElement = {
      ...originalElement,
      styles: { fill: '#purple', strokeWidth: 3 }
    };

    drawAreaRef.current?.setElements([updatedElement]);
    
    await waitFor(() => {
      const elements = drawAreaRef.current?.getElements();
      expect(elements).toHaveLength(1);
      
      const element = elements[0];
      expect(element.id).toBe('preserve-test');
      expect(element.name).toBe('Test Element');
      expect(element.shape).toBe('<rect width="50" height="50" fill="blue"/>');
      expect(element.textRegions).toHaveLength(1);
      expect(element.textRegions?.[0].text).toBe('Original text');
      expect(element.styles?.fill).toBe('#purple');
      expect(element.styles?.strokeWidth).toBe(3);
    });
  });
});
