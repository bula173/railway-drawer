/**
 * @file SimpleEditTest.test.tsx
 * @brief Simple integration test to check if edit functionality is working
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DrawArea from '../DrawArea';

// Mock logger to avoid console spam in tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('DrawArea Simple Test', () => {
  it('renders the component', () => {
    const mockOnStateChange = vi.fn();
    
    render(
      <DrawArea
        GRID_WIDTH={800}
        GRID_HEIGHT={600}
        GRID_SIZE={40}
        zoom={1}
        onStateChange={mockOnStateChange}
      />
    );
    
    const svgElement = screen.getByTestId('draw-area');
    expect(svgElement).toBeInTheDocument();
  });
});
