import type { TabData } from './tabs';

/** What the editor needs from the TabManager (main-editor.ts passes the real one). */
export interface ProjectNameHost {
  getActiveTab(): TabData | null;
  /** Renames the active tab's project (and its label when that is the project name) and caches it. */
  renameActiveProject(name: string): void;
}

/**
 * Click on the top-bar `.document-title` to rename the project: Enter or leaving the field keeps
 * the name, Escape restores the old one. Each tab has its own project: the title shows the active
 * tab's (TabManager.switchTab), and a rename goes to the active tab's project (file name of
 * Save/Export, `<diagram name>`) and the tab cache (per tab), so it survives a reload.
 */
export class ProjectNameEditor {
  private titleElement: HTMLElement | null;
  private isEditing = false;

  constructor(private readonly host: ProjectNameHost) {
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
    const currentName = this.host.getActiveTab()?.saveLoadController.getProjectName() ||
      this.titleElement.textContent || 'Untitled Diagram';

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

    // Enter / blur keep the name, Escape restores it; only the first of them counts (replacing the
    // input can fire blur after Enter/Escape)
    const finish = (keep: boolean): void => {
      if (!this.isEditing) return;
      this.isEditing = false;
      const newName = keep ? input.value.trim() || 'Untitled Diagram' : currentName;
      this.titleElement!.textContent = newName;
      if (keep && newName !== currentName) this.updateProjectName(newName);
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });
  }

  private updateProjectName(name: string): void {
    this.host.renameActiveProject(name);
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
