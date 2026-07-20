import { Graph } from '@maxgraph/core';

export class PropertiesPanel {
  private graph: Graph;
  private contentElement: HTMLElement;

  constructor(graph: Graph, contentElementId: string) {
    this.graph = graph;
    this.contentElement = document.getElementById(contentElementId)!;

    // Listen to selection changes
    this.graph.getSelectionModel().addListener('change', () => {
      this.update();
    });
  }

  update() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) {
      this.showPlaceholder();
      return;
    }

    this.renderProperties(cells[0]);
  }

  private showPlaceholder() {
    this.contentElement.innerHTML = '<p style="color: #999; font-size: 12px; padding: 12px;">Click element to edit</p>';
  }

  private renderProperties(cell: any) {
    const geo = cell.geometry;
    const style = this.graph.getCellStyle(cell);

    this.contentElement.innerHTML = `
      <div style="padding: 8px; font-size: 12px;">
        <div style="margin-bottom: 12px;">
          <strong>${cell.value || 'Cell'}</strong>
        </div>

        <div style="margin-bottom: 8px;">
          <label style="display: block; margin-bottom: 2px; font-weight: 600;">Position</label>
          <div style="display: flex; gap: 4px;">
            <label>X: <input type="number" class="prop-input" id="prop-x" value="${Math.round(geo?.x || 0)}" /></label>
            <label>Y: <input type="number" class="prop-input" id="prop-y" value="${Math.round(geo?.y || 0)}" /></label>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <label style="display: block; margin-bottom: 2px; font-weight: 600;">Size</label>
          <div style="display: flex; gap: 4px;">
            <label>W: <input type="number" class="prop-input" id="prop-w" value="${Math.round(geo?.width || 80)}" /></label>
            <label>H: <input type="number" class="prop-input" id="prop-h" value="${Math.round(geo?.height || 60)}" /></label>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <label style="display: block; margin-bottom: 2px; font-weight: 600;">Style</label>
          <label>Fill: <input type="color" class="prop-input" id="prop-fill" value="${style.fillColor || '#ffffff'}" /></label>
        </div>
      </div>
    `;

    this.wireUpHandlers(cell);
  }

  private wireUpHandlers(cell: any) {
    const geo = cell.geometry;

    document.getElementById('prop-x')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.x = value;
      this.graph.refresh();
    });

    document.getElementById('prop-y')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.y = value;
      this.graph.refresh();
    });

    document.getElementById('prop-w')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.width = value;
      this.graph.refresh();
    });

    document.getElementById('prop-h')?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      geo!.height = value;
      this.graph.refresh();
    });

    document.getElementById('prop-fill')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const style = this.graph.getCellStyle(cell);
      style.fillColor = value;
      this.graph.model.setStyle(cell, style);
      this.graph.refresh();
    });
  }
}
