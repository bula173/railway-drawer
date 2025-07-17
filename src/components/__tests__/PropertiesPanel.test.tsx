import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertiesPanel from '../PropertiesPanel'
import type { DrawAreaRef } from '../DrawArea'
import type { DrawElement } from '../Elements'

// Mock DrawArea ref with correct interface
const mockDrawAreaRef: DrawAreaRef = {
  getSvgElement: vi.fn(),
  getElements: vi.fn(),
  setElements: vi.fn(),
  setGridVisible: vi.fn(),
  getGridVisible: vi.fn(() => true),
  setBackgroundColor: vi.fn(),
  getBackgroundColor: vi.fn(() => '#ffffff'),
  getSelectedElement: vi.fn(),
  getSelectedElementIds: vi.fn(),
  copySelectedElements: vi.fn(),
  cutSelectedElements: vi.fn(),
  pasteElements: vi.fn(),
  getCopiedElements: vi.fn(),
  setCopiedElements: vi.fn(),
}

describe('PropertiesPanel Component', () => {
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
  }

  const mockOnElementChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error - Mock the function
    mockDrawAreaRef.getElements.mockReturnValue([mockElement])
  })

  it('renders canvas settings when no element is selected', () => {
    render(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={undefined}
      />
    )
    
    expect(screen.getByText(/canvas settings/i)).toBeInTheDocument()
  })

  it('shows properties form when element is selected', () => {
    render(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    )
    
    expect(screen.getByDisplayValue('Test Element')).toBeInTheDocument()
  })

  it('updates element name when input changes', async () => {
    render(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    )
    
    const nameInput = screen.getByDisplayValue('Test Element')
    
    // Change the name
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })
    fireEvent.blur(nameInput)
    
    // Check that the callback was called with the updated name
    expect(mockOnElementChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated Name' })
    )
  })

  it('handles null drawAreaRef gracefully', () => {
    render(
      <PropertiesPanel 
        drawAreaRef={{ current: null }} 
        selectedElement={undefined}
      />
    )
    
    expect(screen.getByText(/canvas settings/i)).toBeInTheDocument()
  })

  it('displays element properties correctly', () => {
    const elementWithStyles: DrawElement = {
      ...mockElement,
      styles: {
        fill: '#ff0000',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 0.8
      }
    }
    
    render(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={elementWithStyles}
        onElementChange={mockOnElementChange}
      />
    )
    
    expect(screen.getByDisplayValue('Test Element')).toBeInTheDocument()
    expect(screen.getByDisplayValue('#ff0000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('#000000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0.8')).toBeInTheDocument()
  })

  it('updates properties and calls onElementChange', async () => {
    render(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    )
    
    // Test updating fill color - find by the color input type
    const colorInputs = screen.getAllByDisplayValue('#3b82f6')
    const fillInput = colorInputs[0] // First color input should be fill
    fireEvent.change(fillInput, { target: { value: '#ff0000' } })
    fireEvent.blur(fillInput)
    
    expect(mockOnElementChange).toHaveBeenCalled()
  })

  it('preserves existing styles when adding new ones', async () => {
    const elementWithStyles: DrawElement = {
      ...mockElement,
      styles: {
        fill: 'blue',
        stroke: 'black'
      }
    }
    
    const user = userEvent.setup()
    
    render(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={elementWithStyles}
        onElementChange={mockOnElementChange}
      />
    )
    
    const opacityInput = screen.getByDisplayValue('1')
    await user.clear(opacityInput)
    await user.type(opacityInput, '0.8')
    fireEvent.blur(opacityInput)
    
    expect(mockOnElementChange).toHaveBeenCalled()
  })

  it('resets form when element selection changes', () => {
    const { rerender } = render(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={mockElement}
        onElementChange={mockOnElementChange}
      />
    )
    
    expect(screen.getByDisplayValue('Test Element')).toBeInTheDocument()
    
    const newElement: DrawElement = {
      ...mockElement,
      id: 'new-element',
      name: 'New Element'
    }
    
    rerender(
      <PropertiesPanel 
        drawAreaRef={{ current: mockDrawAreaRef }} 
        selectedElement={newElement}
        onElementChange={mockOnElementChange}
      />
    )
    
    expect(screen.getByDisplayValue('New Element')).toBeInTheDocument()
  })
})
