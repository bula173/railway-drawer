interface ShapeDefinition {
  id: string;
  label: string;
  icon: string;
  group: string;
  style?: any;
  width?: number;
  height?: number;
}

export class ShapesPalette {
  private container: HTMLElement;
  private shapes: ShapeDefinition[] = [
    // Basic shapes
    {
      id: 'rectangle',
      label: 'Rectangle',
      icon: '▭',
      group: 'Basic',
      width: 100,
      height: 60,
      style: { fillColor: '#e1d5e7', strokeColor: '#9673a6' },
    },
    {
      id: 'circle',
      label: 'Circle',
      icon: '●',
      group: 'Basic',
      width: 80,
      height: 80,
      style: { shape: 'ellipse', fillColor: '#d4e6f1', strokeColor: '#3498db' },
    },
    {
      id: 'diamond',
      label: 'Diamond',
      icon: '◇',
      group: 'Basic',
      width: 80,
      height: 80,
      style: { shape: 'diamond', fillColor: '#f9e79f', strokeColor: '#f39c12' },
    },
    {
      id: 'triangle',
      label: 'Triangle',
      icon: '△',
      group: 'Basic',
      width: 80,
      height: 80,
      style: { shape: 'triangle', fillColor: '#f8b88b', strokeColor: '#e67e22' },
    },
    // Flowchart shapes
    {
      id: 'process',
      label: 'Process',
      icon: '▬',
      group: 'Flowchart',
      width: 100,
      height: 60,
      style: { fillColor: '#dda0dd', strokeColor: '#8b008b' },
    },
    {
      id: 'decision',
      label: 'Decision',
      icon: '◇',
      group: 'Flowchart',
      width: 100,
      height: 100,
      style: { shape: 'diamond', fillColor: '#ffd700', strokeColor: '#ffa500' },
    },
    {
      id: 'cylinder',
      label: 'Cylinder',
      icon: '⊗',
      group: 'Flowchart',
      width: 80,
      height: 80,
      style: { shape: 'cylinder', fillColor: '#87ceeb', strokeColor: '#4682b4' },
    },
    {
      id: 'parallelogram',
      label: 'Parallelogram',
      icon: '⬠',
      group: 'Flowchart',
      width: 100,
      height: 60,
      style: { fillColor: '#98fb98', strokeColor: '#228b22' },
    },
    // Connectors
    {
      id: 'line',
      label: 'Line',
      icon: '—',
      group: 'Connectors',
      width: 100,
      height: 1,
      style: { shape: 'line', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
    },
    {
      id: 'arrow',
      label: 'Arrow',
      icon: '→',
      group: 'Connectors',
      width: 100,
      height: 60,
      style: {
        shape: 'customArrow',
        fillColor: 'none',
        strokeColor: '#2c3e50',
        strokeWidth: 2,
      },
    },
  ];

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.render();
  }

  private render() {
    this.container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'shapes-grid';

    this.shapes.forEach((shape) => {
      const item = this.createShapeItem(shape);
      grid.appendChild(item);
    });

    this.container.appendChild(grid);
  }

  private createShapeItem(shape: ShapeDefinition): HTMLElement {
    const item = document.createElement('div');
    item.className = 'shape-item';
    item.draggable = true;
    item.dataset.shapeId = shape.id;
    item.title = shape.label;

    item.innerHTML = `
      <div class="shape-icon">${shape.icon}</div>
      <div class="shape-label">${shape.label}</div>
    `;

    item.addEventListener('dragstart', (e) => {
      const dataTransfer = e.dataTransfer!;
      dataTransfer.effectAllowed = 'copy';
      dataTransfer.setData('application/x-shape-id', shape.id);
      dataTransfer.setData('application/x-shape-json', JSON.stringify(shape));
    });

    return item;
  }


}
