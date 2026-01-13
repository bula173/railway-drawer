import type { DrawAreaTab } from '../components/TabPanel';

const STORAGE_KEY = 'railway-drawer-project';
const PROJECT_NAME_KEY = 'railway-drawer-project-name';

export interface StoredProject {
  pages: DrawAreaTab[];
  projectName: string;
  timestamp: number;
}

/**
 * Save project to localStorage
 */
export const saveToLocalStorage = (pages: DrawAreaTab[], projectName: string): void => {
  try {
    const project: StoredProject = {
      pages,
      projectName,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch (error) {
    // Fail silently if storage quota exceeded
    console.warn('Failed to save to localStorage:', error);
  }
};

/**
 * Load project from localStorage
 */
export const loadFromLocalStorage = (): StoredProject | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as StoredProject;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
};

/**
 * Clear project from localStorage
 */
export const clearLocalStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
};

/**
 * Check if a saved project exists in localStorage
 */
export const hasSavedProject = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch (error) {
    return false;
  }
};
