/**
 * @file useTemplateCreation.ts
 * @brief Hook for creating templates from existing diagrams
 *
 * Allows users to:
 * - Save current diagram as a template
 * - Clone existing templates
 * - Export/import templates
 * - Share templates
 */

import { useCallback, useState } from 'react';
import type { DrawElement } from '../components/Elements';
import { useTemplate } from '../contexts/TemplateContext';
import type { RailwayTemplate } from '../contexts/TemplateContext';
import { logger } from '../utils/logger';

/**
 * @interface TemplateCreationOptions
 * @brief Options for template creation
 */
export interface TemplateCreationOptions {
  elements: DrawElement[];
  connections?: Array<{
    sourceId: string;
    targetId: string;
    type: 'direct' | 'junction' | 'crossover';
  }>;
  name: string;
  description: string;
  category: 'stations' | 'junctions' | 'signaling' | 'ertms' | 'custom' | 'other';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
}

/**
 * @interface TemplateExportData
 * @brief Data structure for exporting templates
 */
export interface TemplateExportData {
  version: string;
  template: RailwayTemplate;
  exportedAt: Date;
  exportedBy: string;
}

/**
 * @hook useTemplateCreation
 * @brief Hook for creating and managing templates
 */
export const useTemplateCreation = () => {
  const templateContext = useTemplate();
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [lastCreatedTemplate, setLastCreatedTemplate] = useState<RailwayTemplate | null>(null);

  /**
   * Create a new template from current diagram
   */
  const createTemplate = useCallback(
    async (options: TemplateCreationOptions): Promise<RailwayTemplate | null> => {
      setIsCreating(true);
      setCreationError(null);

      try {
        // Validate inputs
        if (!options.name || options.name.trim().length === 0) {
          throw new Error('Template name is required');
        }

        if (!options.description || options.description.trim().length === 0) {
          throw new Error('Template description is required');
        }

        if (options.elements.length === 0) {
          throw new Error('Cannot create template from empty diagram');
        }

        // Generate thumbnail (simplified - would be actual canvas rendering)
        const thumbnail = generateThumbnail(options.elements);

        // Create template object
        const template: RailwayTemplate = {
          id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: options.name.trim(),
          description: options.description.trim(),
          category: options.category,
          elements: options.elements,
          connections: options.connections,
          difficulty: options.difficulty,
          tags: options.tags || [],
          thumbnail,
          isDefault: false,
          createdBy: 'user', // Would be actual username
          createdAt: new Date(),
          modifiedAt: new Date(),
          usageCount: 0,
        };

        // Add to context
        templateContext.addTemplate(template);

        // Save to localStorage
        await templateContext.saveTemplates();

        setLastCreatedTemplate(template);

        logger.info('useTemplateCreation', 'Template created successfully', {
          id: template.id,
          name: template.name,
          elements: template.elements.length,
        });

        return template;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setCreationError(errorMessage);
        logger.error('useTemplateCreation', 'Failed to create template', { error: errorMessage });
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [templateContext]
  );

  /**
   * Clone an existing template
   */
  const cloneTemplate = useCallback(
    async (templateId: string, newName: string): Promise<RailwayTemplate | null> => {
      try {
        const original = templateContext.getTemplate(templateId);
        if (!original) {
          throw new Error('Template not found');
        }

        const cloned: RailwayTemplate = {
          ...original,
          id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: newName,
          createdAt: new Date(),
          modifiedAt: new Date(),
          usageCount: 0,
          isDefault: false,
        };

        templateContext.addTemplate(cloned);
        await templateContext.saveTemplates();

        logger.info('useTemplateCreation', 'Template cloned', {
          originalId: original.id,
          newId: cloned.id,
        });

        return cloned;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setCreationError(errorMessage);
        logger.error('useTemplateCreation', 'Failed to clone template', { error: errorMessage });
        return null;
      }
    },
    [templateContext]
  );

  /**
   * Export template as JSON
   */
  const exportTemplate = useCallback(
    (templateId: string): TemplateExportData | null => {
      try {
        const template = templateContext.getTemplate(templateId);
        if (!template) {
          throw new Error('Template not found');
        }

        const exportData: TemplateExportData = {
          version: '1.0',
          template,
          exportedAt: new Date(),
          exportedBy: 'user', // Would be actual username
        };

        logger.info('useTemplateCreation', 'Template exported', { id: templateId });
        return exportData;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setCreationError(errorMessage);
        logger.error('useTemplateCreation', 'Failed to export template', { error: errorMessage });
        return null;
      }
    },
    [templateContext]
  );

  /**
   * Export template as JSON file (download)
   */
  const exportTemplateAsFile = useCallback(
    (templateId: string, filename?: string) => {
      try {
        const exportData = exportTemplate(templateId);
        if (!exportData) return;

        const template = exportData.template;
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `${template.name}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        logger.info('useTemplateCreation', 'Template exported as file', {
          filename: link.download,
        });
      } catch (error) {
        logger.error('useTemplateCreation', 'Failed to export template as file', { error });
      }
    },
    [exportTemplate]
  );

  /**
   * Import template from JSON data
   */
  const importTemplate = useCallback(
    async (data: string | TemplateExportData): Promise<RailwayTemplate | null> => {
      try {
        let importData: TemplateExportData;

        if (typeof data === 'string') {
          importData = JSON.parse(data);
        } else {
          importData = data;
        }

        // Validate import data
        if (!importData.template || !importData.template.id) {
          throw new Error('Invalid template data');
        }

        // Check for duplicate ID
        const existingTemplate = templateContext.getTemplate(importData.template.id);
        if (existingTemplate) {
          // Generate new ID for imported template
          importData.template.id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        importData.template.isDefault = false;
        importData.template.modifiedAt = new Date();
        importData.template.usageCount = 0;

        templateContext.addTemplate(importData.template);
        await templateContext.saveTemplates();

        logger.info('useTemplateCreation', 'Template imported', {
          id: importData.template.id,
          name: importData.template.name,
        });

        return importData.template;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setCreationError(errorMessage);
        logger.error('useTemplateCreation', 'Failed to import template', { error: errorMessage });
        return null;
      }
    },
    [templateContext]
  );

  /**
   * Import template from file
   */
  const importTemplateFromFile = useCallback(
    async (file: File): Promise<RailwayTemplate | null> => {
      try {
        const text = await file.text();
        return await importTemplate(text);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setCreationError(errorMessage);
        logger.error('useTemplateCreation', 'Failed to import template from file', {
          error: errorMessage,
        });
        return null;
      }
    },
    [importTemplate]
  );

  /**
   * Generate template thumbnail
   */
  const generateThumbnail = (elements: DrawElement[]): string => {
    // Simplified thumbnail generation
    // In production, would render elements to canvas and convert to base64
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3C/svg%3E';
  };

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback(
    async (templateId: string): Promise<boolean> => {
      try {
        templateContext.deleteTemplate(templateId);
        await templateContext.saveTemplates();

        logger.info('useTemplateCreation', 'Template deleted', { id: templateId });
        return true;
      } catch (error) {
        logger.error('useTemplateCreation', 'Failed to delete template', { error });
        return false;
      }
    },
    [templateContext]
  );

  /**
   * Get template stats
   */
  const getTemplateStats = useCallback(() => {
    return {
      total: templateContext.templates.length,
      byCategory: {
        stations: templateContext.getTemplatesByCategory('stations').length,
        junctions: templateContext.getTemplatesByCategory('junctions').length,
        signaling: templateContext.getTemplatesByCategory('signaling').length,
        ertms: templateContext.getTemplatesByCategory('ertms').length,
        custom: templateContext.getTemplatesByCategory('custom').length,
      },
      byDifficulty: {
        beginner: templateContext.getTemplatesByDifficulty('beginner').length,
        intermediate: templateContext.getTemplatesByDifficulty('intermediate').length,
        advanced: templateContext.getTemplatesByDifficulty('advanced').length,
      },
      mostPopular: templateContext.getPopularTemplates(3),
    };
  }, [templateContext]);

  return {
    // State
    isCreating,
    creationError,
    lastCreatedTemplate,

    // Actions
    createTemplate,
    cloneTemplate,
    deleteTemplate,
    importTemplate,
    importTemplateFromFile,

    // Export
    exportTemplate,
    exportTemplateAsFile,

    // Queries
    getTemplateStats,
  };
};
