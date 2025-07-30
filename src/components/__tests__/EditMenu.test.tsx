import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditMenu } from '../EditMenu';

describe('EditMenu Component', () => {
  const mockCallbacks = {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onPaste: vi.fn(),
    onDelete: vi.fn(),
    onSelectAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Edit button', () => {
    render(
      <EditMenu
        canUndo={false}
        canRedo={false}
        hasSelection={false}
        hasCopiedElements={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('shows dropdown menu when Edit button is clicked', () => {
    render(
      <EditMenu
        canUndo={true}
        canRedo={true}
        hasSelection={true}
        hasCopiedElements={true}
        {...mockCallbacks}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    expect(screen.getByText('Undo')).toBeInTheDocument();
    expect(screen.getByText('Redo')).toBeInTheDocument();
    expect(screen.getByText('Cut')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Paste')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  it('enables/disables menu items based on state', () => {
    render(
      <EditMenu
        canUndo={false}
        canRedo={false}
        hasSelection={false}
        hasCopiedElements={false}
        {...mockCallbacks}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    // Should be disabled when no state allows it
    expect(screen.getByText('Undo').closest('button')).toHaveClass('disabled');
    expect(screen.getByText('Redo').closest('button')).toHaveClass('disabled');
    expect(screen.getByText('Cut').closest('button')).toHaveClass('disabled');
    expect(screen.getByText('Copy').closest('button')).toHaveClass('disabled');
    expect(screen.getByText('Paste').closest('button')).toHaveClass('disabled');
    expect(screen.getByText('Delete').closest('button')).toHaveClass('disabled');
    
    // Select All should always be enabled
    expect(screen.getByText('Select All').closest('button')).not.toHaveClass('disabled');
  });

  it('calls correct callbacks when menu items are clicked', () => {
    render(
      <EditMenu
        canUndo={true}
        canRedo={true}
        hasSelection={true}
        hasCopiedElements={true}
        {...mockCallbacks}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    fireEvent.click(screen.getByText('Undo'));
    expect(mockCallbacks.onUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(editButton);
    fireEvent.click(screen.getByText('Redo'));
    expect(mockCallbacks.onRedo).toHaveBeenCalledTimes(1);

    fireEvent.click(editButton);
    fireEvent.click(screen.getByText('Copy'));
    expect(mockCallbacks.onCopy).toHaveBeenCalledTimes(1);

    fireEvent.click(editButton);
    fireEvent.click(screen.getByText('Cut'));
    expect(mockCallbacks.onCut).toHaveBeenCalledTimes(1);

    fireEvent.click(editButton);
    fireEvent.click(screen.getByText('Paste'));
    expect(mockCallbacks.onPaste).toHaveBeenCalledTimes(1);

    fireEvent.click(editButton);
    fireEvent.click(screen.getByText('Delete'));
    expect(mockCallbacks.onDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(editButton);
    fireEvent.click(screen.getByText('Select All'));
    expect(mockCallbacks.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('shows correct keyboard shortcuts', () => {
    render(
      <EditMenu
        canUndo={true}
        canRedo={true}
        hasSelection={true}
        hasCopiedElements={true}
        {...mockCallbacks}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    expect(screen.getByText('Ctrl+Z')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Y')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+X')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+V')).toBeInTheDocument();
    expect(screen.getByText('Del')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+A')).toBeInTheDocument();
  });

  it('closes menu when overlay is clicked', () => {
    render(
      <EditMenu
        canUndo={true}
        canRedo={true}
        hasSelection={true}
        hasCopiedElements={true}
        {...mockCallbacks}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    expect(screen.getByText('Undo')).toBeInTheDocument();

    const overlay = document.querySelector('.edit-menu-overlay');
    expect(overlay).toBeInTheDocument();
    
    fireEvent.click(overlay!);
    
    expect(screen.queryByText('Undo')).not.toBeInTheDocument();
  });
});
