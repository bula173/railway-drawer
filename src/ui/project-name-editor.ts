import type { TabData } from './tabs';

/** Optional window global probed for the active tab (see ServiceRegistry, which replaces it). */
type WindowWithTabManager = Window & { __tabManager?: { getActiveTab?: () => TabData | null } };

export class ProjectNameEditor {
  private titleElement: HTMLElement | null;
  private isEditing = false;

  constructor() {
    this.titleElement = document.querySelector('.document-title');
    this.setupEditor();
  }

  private setupEditor(): void {
    if (!this.titleElement) return;

    this.titleElement.style.cursor = 'pointer';
    this.titleElement.addEventListener('click', () => this.startEditing());
  }

  private startEditing(): void {
    if (this.isEditing || !this.titleElement) return;

    this.isEditing = true;
    const currentName = this.titleElement.textContent || 'Untitled Diagram';

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.style.fontSize = '16px';
    input.style.fontWeight = '500';
    input.style.color = 'var(--rd-text)';
    input.style.border = '2px solid var(--rd-focus)';
    input.style.borderRadius = '4px';
    input.style.padding = '4px 8px';
    input.style.minWidth = '150px';

    // Replace title with input
    this.titleElement.innerHTML = '';
    this.titleElement.appendChild(input);
    input.focus();
    input.select();

    // Handle blur (save)
    const saveEdit = () => {
      const newName = input.value.trim() || 'Untitled Diagram';
      this.titleElement!.textContent = newName;
      this.isEditing = false;
      this.updateProjectName(newName);
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveEdit();
      } else if (e.key === 'Escape') {
        this.titleElement!.textContent = currentName;
        this.isEditing = false;
      }
    });
  }

  private updateProjectName(name: string): void {
    // Get active tab and update its project name
    const activeTab = (window as WindowWithTabManager).__tabManager?.getActiveTab?.();
    if (activeTab && activeTab.saveLoadController) {
      activeTab.saveLoadController.setProjectName(name);
    }
  }

  setTitle(name: string): void {
    if (this.titleElement && !this.isEditing) {
      this.titleElement.textContent = name;
    }
  }

  getTitle(): string {
    return this.titleElement?.textContent || 'Untitled Diagram';
  }
}
