import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RailwayDrawerApp from '../RailwayDrawerApp'

// Mock the complex components to focus on main app logic
vi.mock('../components/DrawArea', () => ({
  default: vi.fn(() => <div data-testid="draw-area">DrawArea Mock</div>),
}))

vi.mock('../components/Toolbox', () => ({
  default: vi.fn(() => <div data-testid="toolbox">Toolbox Mock</div>),
}))

vi.mock('../components/PropertiesPanel', () => ({
  default: vi.fn(() => <div data-testid="properties-panel">PropertiesPanel Mock</div>),
}))

vi.mock('../components/TabPanel', () => ({
  default: vi.fn(() => <div data-testid="tab-panel">TabPanel Mock</div>),
}))

// Mock html-to-image for export functionality
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
  toJpeg: vi.fn().mockResolvedValue('data:image/jpeg;base64,mock'),
  toSvg: vi.fn().mockResolvedValue('data:image/svg+xml;base64,mock'),
}))

// Mock jspdf for PDF export
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}))

describe('RailwayDrawerApp Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders main application layout', () => {
    render(<RailwayDrawerApp />)
    
    // Check that main components are rendered
    expect(screen.getByTestId('draw-area')).toBeInTheDocument()
    expect(screen.getByTestId('toolbox')).toBeInTheDocument()
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument()
    // Note: PageManager is used for page/tab management instead of TabPanel
  })

  it('shows menu bar with file operations', () => {
    render(<RailwayDrawerApp />)
    
    // Check for main menu items
    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Arrange')).toBeInTheDocument()
  })

  it('shows file menu options when hovered', async () => {
    const user = userEvent.setup()
    render(<RailwayDrawerApp />)
    
    const fileMenu = screen.getByText('File')
    await user.click(fileMenu)
    
    // Should show file operations
    expect(screen.getByText('Open Project...')).toBeInTheDocument()
    expect(screen.getByText('Save Project')).toBeInTheDocument()
  })

  it('shows view menu options when hovered', async () => {
    const user = userEvent.setup()
    render(<RailwayDrawerApp />)
    
    const viewMenu = screen.getByText('View')
    await user.click(viewMenu)
    
    // Should show view operations (zoom controls)
    expect(screen.getByText('Zoom In')).toBeInTheDocument()
    expect(screen.getByText('Zoom Out')).toBeInTheDocument()
    expect(screen.getByText('Zoom to 100%')).toBeInTheDocument()
  })

  it('displays application title', () => {
    render(<RailwayDrawerApp />)
    
    // Check for app title (might be in header or title area)
    const title = screen.getByText('Railway Drawer') || 
                 screen.getByText(/railway/i) ||
                 screen.getByRole('heading', { level: 1 })
    
    expect(title).toBeInTheDocument()
  })

  it('handles window resize gracefully', () => {
    render(<RailwayDrawerApp />)
    
    // Simulate window resize
    global.dispatchEvent(new Event('resize'))
    
    // App should still be rendered properly
    expect(screen.getByTestId('draw-area')).toBeInTheDocument()
  })

  it('manages keyboard shortcuts globally', async () => {
    const user = userEvent.setup()
    render(<RailwayDrawerApp />)
    
    // Test some basic keyboard interactions
    await user.keyboard('{Control>}n{/Control}') // Ctrl+N might create new tab
    await user.keyboard('{Control>}s{/Control}') // Ctrl+S might save
    
    // App should handle these without crashing
    expect(screen.getByTestId('draw-area')).toBeInTheDocument()
  })

  it('maintains responsive layout', () => {
    render(<RailwayDrawerApp />)
    
    // Check that layout components are present
    expect(screen.getByTestId('draw-area')).toBeInTheDocument()
    expect(screen.getByTestId('toolbox')).toBeInTheDocument()
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument()
    // Note: PageManager is used for page/tab management instead of TabPanel
    
    // Layout should be flexible (this is basic, real responsive tests would need more setup)
    const container = screen.getByTestId('draw-area').closest('div')
    expect(container).toBeInTheDocument()
  })
})
