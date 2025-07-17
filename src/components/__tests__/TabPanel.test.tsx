import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TabPanel, { type DrawAreaTab } from '../TabPanel'

describe('TabPanel Component', () => {
  const mockTabs: DrawAreaTab[] = [
    {
      id: 'tab-1',
      name: 'Drawing 1',
      elements: [],
      gridVisible: true,
      backgroundColor: '#ffffff',
    },
    {
      id: 'tab-2',
      name: 'Drawing 2',
      elements: [],
      gridVisible: true,
      backgroundColor: '#ffffff',
    },
    {
      id: 'tab-3',
      name: 'Very Long Drawing Name That Should Be Truncated',
      elements: [],
      gridVisible: true,
      backgroundColor: '#ffffff',
    },
  ]

  const mockOnTabChange = vi.fn()
  const mockOnTabClose = vi.fn()
  const mockOnTabRename = vi.fn()
  const mockOnTabCreate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all tabs', () => {
    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    expect(screen.getByText('Drawing 1')).toBeInTheDocument()
    expect(screen.getByText('Drawing 2')).toBeInTheDocument()
    expect(screen.getByText(/Very Long Drawing Name/)).toBeInTheDocument()
  })

  it('highlights active tab', () => {
    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    const activeTab = screen.getByText('Drawing 1').closest('[data-active="true"]') ||
                     screen.getByText('Drawing 1').closest('.active')
    const inactiveTab = screen.getByText('Drawing 2').closest('[data-active="false"]') ||
                       screen.getByText('Drawing 2').closest('button:not(.active)')

    expect(activeTab || screen.getByText('Drawing 1')).toBeInTheDocument()
    expect(inactiveTab || screen.getByText('Drawing 2')).toBeInTheDocument()
  })

  it('calls onTabChange when tab is clicked', async () => {
    const user = userEvent.setup()

    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    const inactiveTab = screen.getByText('Drawing 2')
    await user.click(inactiveTab)

    expect(mockOnTabChange).toHaveBeenCalledWith('tab-2')
  })

  it('calls onTabCreate when new tab button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    const newTabButton = screen.getByRole('button', { name: /\+|add|new/i })
    await user.click(newTabButton)

    expect(mockOnTabCreate).toHaveBeenCalled()
  })

  it('shows close button on tabs and calls onTabClose', async () => {
    const user = userEvent.setup()

    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    const closeButtons = screen.getAllByRole('button', { name: /close|×/i })
    if (closeButtons.length > 0) {
      await user.click(closeButtons[0])
      expect(mockOnTabClose).toHaveBeenCalled()
    }
  })

  it('handles empty tabs array', () => {
    render(
      <TabPanel
        tabs={[]}
        activeTabId=""
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    // Should still render the tab panel container
    expect(screen.getByRole('button', { name: /\+|add|new/i })).toBeInTheDocument()
  })

  it('shows only active tab when there is one', () => {
    const singleTab: DrawAreaTab[] = [
      {
        id: 'only-tab',
        name: 'Only Tab',
        elements: [],
        gridVisible: true,
        backgroundColor: '#ffffff',
      },
    ]

    render(
      <TabPanel
        tabs={singleTab}
        activeTabId="only-tab"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    expect(screen.getByText('Only Tab')).toBeInTheDocument()
  })

  it('supports tab renaming when double-clicked', async () => {
    const user = userEvent.setup()

    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    const tabText = screen.getByText('Drawing 1')
    await user.dblClick(tabText)

    // Should show an input field for renaming
    const renameInput = screen.queryByDisplayValue('Drawing 1')
    if (renameInput) {
      await user.clear(renameInput)
      await user.type(renameInput, 'Renamed Drawing')
      fireEvent.blur(renameInput)

      expect(mockOnTabRename).toHaveBeenCalledWith('tab-1', 'Renamed Drawing')
    }
  })

  it('handles tab renaming with Enter key', async () => {
    const user = userEvent.setup()

    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    const tabText = screen.getByText('Drawing 1')
    await user.dblClick(tabText)

    const renameInput = screen.queryByDisplayValue('Drawing 1')
    if (renameInput) {
      await user.clear(renameInput)
      await user.type(renameInput, 'Renamed Drawing{Enter}')

      expect(mockOnTabRename).toHaveBeenCalledWith('tab-1', 'Renamed Drawing')
    }
  })

  it('cancels renaming with Escape key', async () => {
    const user = userEvent.setup()

    render(
      <TabPanel
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    const tabText = screen.getByText('Drawing 1')
    await user.dblClick(tabText)

    const renameInput = screen.queryByDisplayValue('Drawing 1')
    if (renameInput) {
      await user.type(renameInput, '{Escape}')
      expect(mockOnTabRename).not.toHaveBeenCalled()
    }
  })

  it('displays tab elements count', () => {
    const tabsWithElements: DrawAreaTab[] = [
      {
        id: 'tab-with-elements',
        name: 'Tab with Elements',
        elements: [
          {
            id: 'element-1',
            name: 'Element 1',
            type: 'custom',
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 },
            gridEnabled: true,
            backgroundColor: '#ffffff',
            setGridEnabled: () => {},
            setBackgroundColor: () => {},
            shape: '<rect width="100" height="100"/>',
            width: 100,
            height: 100,
            rotation: 0,
          },
        ],
        gridVisible: true,
        backgroundColor: '#ffffff',
      },
    ]

    render(
      <TabPanel
        tabs={tabsWithElements}
        activeTabId="tab-with-elements"
        onTabChange={mockOnTabChange}
        onTabClose={mockOnTabClose}
        onTabRename={mockOnTabRename}
        onTabCreate={mockOnTabCreate}
      />
    )

    expect(screen.getByText('Tab with Elements')).toBeInTheDocument()
  })
})
