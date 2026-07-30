export interface StencilGroup {
  id: string;
  label: string;
  enabled: boolean;
}

export class StencilManager {
  private container: HTMLElement;
  private stencils: Map<string, StencilGroup> = new Map();
  private onToggle: () => void = () => {};

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;
  }

  registerStencil(id: string, label: string, enabled: boolean = true) {
    this.stencils.set(id, { id, label, enabled });
    this.render();
  }

  setOnToggle(callback: () => void) {
    this.onToggle = callback;
  }

  isEnabled(stencilId: string): boolean {
    return this.stencils.get(stencilId)?.enabled ?? false;
  }

  toggle(stencilId: string) {
    const stencil = this.stencils.get(stencilId);
    if (stencil) {
      stencil.enabled = !stencil.enabled;
      this.onToggle();
      this.render();
    }
  }

  private render() {
    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'stencil-header';
    header.textContent = 'Shape Libraries';
    this.container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'stencil-list';

    this.stencils.forEach((stencil) => {
      const item = document.createElement('label');
      item.className = 'stencil-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = stencil.enabled;
      checkbox.addEventListener('change', () => this.toggle(stencil.id));

      const label = document.createElement('span');
      label.className = 'stencil-label';
      label.textContent = stencil.label;

      item.appendChild(checkbox);
      item.appendChild(label);
      list.appendChild(item);
    });

    this.container.appendChild(list);
  }
}
