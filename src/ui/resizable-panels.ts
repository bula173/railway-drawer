export class ResizablePanels {
  constructor() {
    this.initializeResizeHandles();
  }

  private initializeResizeHandles(): void {
    // Create and attach resize handles for left and right panels
    this.attachResizeHandle('leftpanel-container', 'right');
    this.attachResizeHandle('rightpanel-container', 'left');
  }

  private attachResizeHandle(panelId: string, position: 'left' | 'right'): void {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    // Create resize handle
    const handle = document.createElement('div');
    handle.className = 'panel-resize-handle';
    handle.style.position = 'absolute';
    handle.style.top = '0';
    handle.style.bottom = '0';
    handle.style.width = '4px';
    handle.style.cursor = position === 'right' ? 'col-resize' : 'col-resize';
    handle.style.backgroundColor = '#e0e0e0';
    handle.style.transition = 'background-color 0.2s';
    handle.style[position] = '0';
    handle.style.userSelect = 'none';

    // Hover effect
    handle.addEventListener('mouseenter', () => {
      handle.style.backgroundColor = '#0066cc';
    });

    handle.addEventListener('mouseleave', () => {
      handle.style.backgroundColor = '#e0e0e0';
    });

    // Resize logic
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      let newWidth = startWidth;

      if (position === 'right') {
        newWidth = startWidth + deltaX;
      } else {
        newWidth = startWidth - deltaX;
      }

      // Set minimum and maximum widths
      const minWidth = 180;
      const maxWidth = 500;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        panel.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    // Append handle to panel container
    panel.style.position = 'relative';
    panel.appendChild(handle);
  }
}
