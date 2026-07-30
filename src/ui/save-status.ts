/**
 * @file save-status.ts
 * @brief Manages the save status indicator with visual feedback
 */

import { globalNotificationManager } from './notification';

export class SaveStatusIndicator {
  private statusElement: HTMLElement;
  private currentState: 'saved' | 'unsaved' | 'saving' | 'error' = 'saved';
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.statusElement = document.querySelector('.save-status') || this.createStatusElement();
    this.updateUI('saved');
  }

  private createStatusElement(): HTMLElement {
    const container = document.querySelector('.top-bar-right');
    if (!container) {
      console.warn('Could not find top-bar-right container for save status');
      return document.createElement('div');
    }

    const element = document.createElement('div');
    element.className = 'save-status saved';
    element.textContent = 'All changes saved';
    container.insertBefore(element, container.firstChild);
    return element;
  }

  setSaving(): void {
    if (this.currentState === 'saving') return;
    this.currentState = 'saving';
    this.updateUI('saving');

    if (this.saveTimeout) clearTimeout(this.saveTimeout);
  }

  setSaved(): void {
    this.currentState = 'saved';
    this.updateUI('saved');

    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.fadeOut();
    }, 3000);
  }

  setUnsaved(): void {
    if (this.currentState === 'unsaved') return;
    this.currentState = 'unsaved';
    this.updateUI('unsaved');

    if (this.saveTimeout) clearTimeout(this.saveTimeout);
  }

  setError(message: string): void {
    this.currentState = 'error';
    this.updateUI('error', message);
    globalNotificationManager.error(`Save failed: ${message}`);
  }

  private updateUI(state: 'saved' | 'unsaved' | 'saving' | 'error', message?: string): void {
    this.statusElement.className = `save-status ${state}`;

    switch (state) {
      case 'saved':
        this.statusElement.textContent = 'All changes saved';
        break;
      case 'unsaved':
        this.statusElement.textContent = 'Unsaved changes. Click here to save.';
        this.statusElement.style.cursor = 'pointer';
        break;
      case 'saving':
        this.statusElement.textContent = 'Saving...';
        this.statusElement.style.cursor = 'default';
        break;
      case 'error':
        this.statusElement.textContent = message || 'Save failed';
        this.statusElement.style.cursor = 'default';
        break;
    }
  }

  private fadeOut(): void {
    this.statusElement.style.opacity = '0';
    this.statusElement.style.transition = 'opacity 0.5s ease-out';
    setTimeout(() => {
      if (this.currentState === 'saved') {
        this.statusElement.textContent = '';
        this.statusElement.style.opacity = '1';
      }
    }, 500);
  }

  destroy(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
  }
}

export const globalSaveStatusIndicator = new SaveStatusIndicator();

// Make globally accessible for other modules
(window as any).__saveStatusIndicator = globalSaveStatusIndicator;
