import React, { useState } from 'react';
import '../styles/editMenu.css';

interface EditMenuProps {
  /** Can undo action */
  canUndo: boolean;
  /** Can redo action */
  canRedo: boolean;
  /** Has selected elements */
  hasSelection: boolean;
  /** Has copied elements */
  hasCopiedElements: boolean;
  /** Undo callback */
  onUndo: () => void;
  /** Redo callback */
  onRedo: () => void;
  /** Copy callback */
  onCopy: () => void;
  /** Cut callback */
  onCut: () => void;
  /** Paste callback */
  onPaste: () => void;
  /** Delete callback */
  onDelete: () => void;
  /** Select all callback */
  onSelectAll: () => void;
}

/**
 * @brief Edit menu component with standard edit operations
 * @details Provides a dropdown menu with undo, redo, cut, copy, paste, delete, and select all options
 */
export const EditMenu: React.FC<EditMenuProps> = ({
  canUndo,
  canRedo,
  hasSelection,
  hasCopiedElements,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onSelectAll
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  const handleMenuItemClick = (action: () => void) => {
    action();
    closeMenu();
  };

  return (
    <div className="edit-menu">
      <button 
        className="edit-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        Edit
      </button>
      
      {isOpen && (
        <>
          <div className="edit-menu-overlay" onClick={closeMenu} />
          <div className="edit-menu-dropdown">
            <button
              className={`edit-menu-item ${!canUndo ? 'disabled' : ''}`}
              onClick={() => canUndo && handleMenuItemClick(onUndo)}
              disabled={!canUndo}
            >
              <span className="edit-menu-item-text">Undo</span>
              <span className="edit-menu-item-shortcut">Ctrl+Z</span>
            </button>

            <button
              className={`edit-menu-item ${!canRedo ? 'disabled' : ''}`}
              onClick={() => canRedo && handleMenuItemClick(onRedo)}
              disabled={!canRedo}
            >
              <span className="edit-menu-item-text">Redo</span>
              <span className="edit-menu-item-shortcut">Ctrl+Y</span>
            </button>

            <div className="edit-menu-separator" />

            <button
              className={`edit-menu-item ${!hasSelection ? 'disabled' : ''}`}
              onClick={() => hasSelection && handleMenuItemClick(onCut)}
              disabled={!hasSelection}
            >
              <span className="edit-menu-item-text">Cut</span>
              <span className="edit-menu-item-shortcut">Ctrl+X</span>
            </button>

            <button
              className={`edit-menu-item ${!hasSelection ? 'disabled' : ''}`}
              onClick={() => hasSelection && handleMenuItemClick(onCopy)}
              disabled={!hasSelection}
            >
              <span className="edit-menu-item-text">Copy</span>
              <span className="edit-menu-item-shortcut">Ctrl+C</span>
            </button>

            <button
              className={`edit-menu-item ${!hasCopiedElements ? 'disabled' : ''}`}
              onClick={() => hasCopiedElements && handleMenuItemClick(onPaste)}
              disabled={!hasCopiedElements}
            >
              <span className="edit-menu-item-text">Paste</span>
              <span className="edit-menu-item-shortcut">Ctrl+V</span>
            </button>

            <div className="edit-menu-separator" />

            <button
              className={`edit-menu-item ${!hasSelection ? 'disabled' : ''}`}
              onClick={() => hasSelection && handleMenuItemClick(onDelete)}
              disabled={!hasSelection}
            >
              <span className="edit-menu-item-text">Delete</span>
              <span className="edit-menu-item-shortcut">Del</span>
            </button>

            <div className="edit-menu-separator" />

            <button
              className="edit-menu-item"
              onClick={() => handleMenuItemClick(onSelectAll)}
            >
              <span className="edit-menu-item-text">Select All</span>
              <span className="edit-menu-item-shortcut">Ctrl+A</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
