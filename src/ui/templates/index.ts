/**
 * @file index.ts
 * @brief Diagram templates: built-in ERTMS scenarios and user templates (public API).
 */
export type { DiagramTemplate } from './template-types';
export { templateMatches, templateToPaletteEntry } from './template-types';
export { countDrawableCells, isTemplateLibraryEntry, modelLabels, originalScenarioNumber, REMOVED_ERTMS_SCENARIOS, splitErtmsLibrary, TEMPLATE_CELL_THRESHOLD } from './ertms-templates';
export type { ErtmsLibrarySplit } from './ertms-templates';
export {
  normalizeTemplateName,
  TemplateStorageError,
  TemplateStore,
  TEMPLATES_STORAGE_KEY,
  TEMPLATES_STORAGE_VERSION,
} from './template-store';
export type { NewTemplate } from './template-store';
export { collectTemplateCells, extractTemplate } from './template-extract';
export type { ExtractedTemplate } from './template-extract';
export { insertTemplate, openTemplateAsNewDiagram, saveAsTemplate } from './template-actions';
export type { SaveAsTemplateOptions, TemplateNotifier, TemplateTabHost } from './template-actions';
export { confirmTemplateDialog, promptTemplateDetails } from './template-dialogs';
export type { TemplateDetails, TemplateDetailsOptions } from './template-dialogs';
export { createTemplatesPanel, TEMPLATE_DRAG_TYPE, TEMPLATES_EXPORT_FILE } from './templates-panel';
export type { TemplatesPanel, TemplatesPanelOptions } from './templates-panel';
