/**
 * @file TemplateContext.tsx
 * @brief Context for managing railway diagram templates using toolboxConfig shapes
 *
 * Provides pre-built templates composed of shapes from toolboxConfig.json
 */

import React, { createContext, useCallback, useState, useEffect } from 'react';
import type { DrawElement } from '../components/Elements';
import { logger } from '../utils/logger';
import toolboxConfig from '../assets/toolboxConfig.json';

/**
 * @interface RailwayTemplate
 * @brief A pre-designed railway diagram template
 */
export interface RailwayTemplate {
  id: string;
  name: string;
  description: string;
  category: 'stations' | 'junctions' | 'signaling' | 'ertms' | 'custom' | 'other';
  elements: DrawElement[];
  connections?: Array<{
    sourceId: string;
    targetId: string;
    type: 'direct' | 'junction' | 'crossover';
  }>;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  thumbnail?: string;
  isDefault: boolean;
  createdBy?: string;
  createdAt: Date;
  modifiedAt: Date;
  usageCount: number;
  rating?: number;
}

/**
 * @interface TemplateContextType
 * @brief Template context value
 */
export interface TemplateContextType {
  templates: RailwayTemplate[];
  searchQuery: string;
  selectedCategory: string | null;
  selectedDifficulty: string | null;

  addTemplate: (template: RailwayTemplate) => void;
  updateTemplate: (id: string, updates: Partial<RailwayTemplate>) => void;
  deleteTemplate: (id: string) => void;

  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedDifficulty: (difficulty: string | null) => void;
  searchTemplates: (query: string, category?: string, difficulty?: string) => RailwayTemplate[];
  recordTemplateUsage: (id: string) => void;

  saveTemplates: () => Promise<void>;
  loadTemplates: () => Promise<void>;
}

/**
 * Create the context
 */
export const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

/**
 * @interface TemplateProviderProps
 * @brief Props for TemplateProvider
 */
export interface TemplateProviderProps {
  children: React.ReactNode;
}

/**
 * @component TemplateProvider
 * @brief Provider component for template context
 */
export const TemplateProvider: React.FC<TemplateProviderProps> = ({ children }) => {
  const [templates, setTemplates] = useState<RailwayTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  /**
   * Initialize with default templates
   */
  useEffect(() => {
    logger.info('TemplateProvider', 'Initializing with default templates');
    initializeDefaultTemplates();
  }, []);

  /**
   * Helper function to find shape by name from toolboxConfig
   */
  const findShapeByName = useCallback((name: string): DrawElement | null => {
    const shape = (toolboxConfig as any[]).find(s => s.name === name);
    if (!shape) return null;
    return {
      ...shape,
      id: `${shape.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }, []);

  /**
   * Helper to position shapes
   */
  const positionShape = (shape: DrawElement | null, x: number, y: number): DrawElement | null => {
    if (!shape) return null;
    const width = Math.abs(shape.end.x - shape.start.x) || 100;
    const height = Math.abs(shape.end.y - shape.start.y) || 50;
    return {
      ...shape,
      start: { x, y },
      end: { x: x + width, y: y + height },
    };
  };

  /**
   * Create default railway templates using shapes from toolboxConfig
   */
  const initializeDefaultTemplates = useCallback(() => {
    const defaultTemplates: RailwayTemplate[] = [
      // STATIONS
      {
        id: 'station-simple-2platform',
        name: 'Simple 2-Platform Station',
        description: 'Basic railway station with 2 platforms and main line passing through',
        category: 'stations',
        elements: [
          positionShape(findShapeByName('Track'), 50, 150),
          positionShape(findShapeByName('Platform'), 100, 100),
          positionShape(findShapeByName('Platform'), 100, 200),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'beginner',
        tags: ['station', 'platform', 'simple', 'beginner'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'station-complex-4platform',
        name: 'Complex Station (4 Platforms)',
        description: 'Multi-platform station with grade separation and multiple lines',
        category: 'stations',
        elements: [
          positionShape(findShapeByName('Track'), 50, 80),
          positionShape(findShapeByName('Double Track'), 50, 150),
          positionShape(findShapeByName('Platform'), 100, 100),
          positionShape(findShapeByName('Platform'), 100, 180),
          positionShape(findShapeByName('Platform'), 100, 260),
          positionShape(findShapeByName('Platform'), 100, 340),
          positionShape(findShapeByName('Track'), 50, 410),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['station', 'platform', 'complex', 'multi-level'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'station-island-platform',
        name: 'Island Platform Station',
        description: 'Station with island platform between two main lines',
        category: 'stations',
        elements: [
          positionShape(findShapeByName('Track'), 50, 100),
          positionShape(findShapeByName('Platform'), 100, 150),
          positionShape(findShapeByName('Track'), 50, 200),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['station', 'platform', 'island', 'intermediate'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },

      // JUNCTIONS
      {
        id: 'junction-diamond',
        name: 'Diamond Crossing',
        description: 'Diamond-shaped junction where two lines cross without merging',
        category: 'junctions',
        elements: [
          positionShape(findShapeByName('Track'), 50, 100),
          positionShape(findShapeByName('Track'), 200, 100),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['junction', 'crossing', 'diamond', 'intermediate'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'junction-3way',
        name: 'Three-Way Junction',
        description: 'Three lines meeting at a point with two merge/diverge switches',
        category: 'junctions',
        elements: [
          positionShape(findShapeByName('Track'), 50, 100),
          positionShape(findShapeByName('Track'), 150, 50),
          positionShape(findShapeByName('Track'), 150, 150),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['junction', 'three-way', 'intermediate'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'junction-double-crossover',
        name: 'Double Crossover',
        description: 'Two parallel tracks with crossover switches at both ends',
        category: 'junctions',
        elements: [
          positionShape(findShapeByName('Track'), 50, 80),
          positionShape(findShapeByName('Track'), 50, 160),
          positionShape(findShapeByName('Double Track'), 100, 120),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['junction', 'crossover', 'double', 'advanced'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },

      // SIGNALING
      {
        id: 'signaling-3aspect',
        name: '3-Aspect Signal System',
        description: 'Traditional 3-aspect signaling (Red, Yellow, Green) with main and distant signals',
        category: 'signaling',
        elements: [
          positionShape(findShapeByName('Track'), 50, 150),
          positionShape(findShapeByName('Railway Signal'), 100, 80),
          positionShape(findShapeByName('Railway Signal'), 200, 80),
          positionShape(findShapeByName('Railway Signal'), 300, 80),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'beginner',
        tags: ['signaling', 'signal', '3-aspect', 'traditional'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'signaling-4aspect',
        name: '4-Aspect Signal System',
        description: 'Advanced 4-aspect signaling with enhanced speed control',
        category: 'signaling',
        elements: [
          positionShape(findShapeByName('Track'), 50, 150),
          positionShape(findShapeByName('Railway Signal'), 80, 80),
          positionShape(findShapeByName('Railway Signal'), 150, 80),
          positionShape(findShapeByName('Railway Signal'), 220, 80),
          positionShape(findShapeByName('Railway Signal'), 290, 80),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['signaling', 'signal', '4-aspect', 'advanced'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'signaling-shunting',
        name: 'Shunting Signal System',
        description: 'Shunting signals for railway yards and depot areas',
        category: 'signaling',
        elements: [
          positionShape(findShapeByName('Track'), 50, 100),
          positionShape(findShapeByName('Shunting Signal'), 100, 50),
          positionShape(findShapeByName('Track'), 50, 150),
          positionShape(findShapeByName('Shunting Signal'), 100, 200),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'beginner',
        tags: ['signaling', 'shunting', 'yard', 'depot'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },

      // ERTMS
      {
        id: 'ertms-level2',
        name: 'ERTMS Level 2 Configuration',
        description: 'European Railway Traffic Management System Level 2 with trackside signaling',
        category: 'ertms',
        elements: [
          positionShape(findShapeByName('Track'), 50, 150),
          positionShape(findShapeByName('Railway Signal'), 100, 100),
          positionShape(findShapeByName('Railway Signal'), 200, 100),
          positionShape(findShapeByName('Railway Signal'), 300, 100),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['ERTMS', 'level2', 'modern', 'european'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'ertms-level3',
        name: 'ERTMS Level 3 Configuration',
        description: 'European Railway Traffic Management System Level 3 with in-cab signaling',
        category: 'ertms',
        elements: [
          positionShape(findShapeByName('Track'), 50, 150),
          positionShape(findShapeByName('Station Sign'), 150, 100),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['ERTMS', 'level3', 'modern', 'european', 'in-cab'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
    ];

    logger.info('TemplateProvider', 'Initialized default templates', {
      count: defaultTemplates.length,
      totalElements: defaultTemplates.reduce((sum, t) => sum + t.elements.length, 0),
    });

    setTemplates(defaultTemplates);
  }, [findShapeByName, positionShape]);

  /**
   * Add a new template
   */
  const addTemplate = useCallback((template: RailwayTemplate) => {
    logger.info('TemplateProvider', 'Adding template', { id: template.id, name: template.name });
    setTemplates(prev => [...prev, template]);
  }, []);

  /**
   * Update a template
   */
  const updateTemplate = useCallback((id: string, updates: Partial<RailwayTemplate>) => {
    logger.info('TemplateProvider', 'Updating template', { id });
    setTemplates(prev =>
      prev.map(t =>
        t.id === id ? { ...t, ...updates, modifiedAt: new Date() } : t
      )
    );
  }, []);

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback((id: string) => {
    logger.info('TemplateProvider', 'Deleting template', { id });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  /**
   * Search templates
   */
  const searchTemplates = useCallback(
    (query: string, category?: string, difficulty?: string): RailwayTemplate[] => {
      const lowerQuery = query.toLowerCase();

      return templates.filter(template => {
        if (category && template.category !== category) return false;
        if (difficulty && template.difficulty !== difficulty) return false;

        if (query.trim()) {
          const searchText = `${template.name} ${template.description} ${template.tags.join(' ')}`.toLowerCase();
          if (!searchText.includes(lowerQuery)) return false;
        }

        return true;
      });
    },
    [templates]
  );

  /**
   * Record template usage
   */
  const recordTemplateUsage = useCallback((id: string) => {
    setTemplates(prev =>
      prev.map(t =>
        t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t
      )
    );
  }, []);

  /**
   * Save templates (placeholder)
   */
  const saveTemplates = useCallback(async () => {
    logger.info('TemplateProvider', 'Saving templates');
  }, []);

  /**
   * Load templates (placeholder)
   */
  const loadTemplates = useCallback(async () => {
    logger.info('TemplateProvider', 'Loading templates');
  }, []);

  const value: TemplateContextType = {
    templates,
    searchQuery,
    selectedCategory,
    selectedDifficulty,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setSearchQuery,
    setSelectedCategory,
    setSelectedDifficulty,
    searchTemplates,
    recordTemplateUsage,
    saveTemplates,
    loadTemplates,
  };

  return (
    <TemplateContext.Provider value={value}>
      {children}
    </TemplateContext.Provider>
  );
};

/**
 * @hook useTemplate
 * @brief Hook to use the template context
 */
export const useTemplate = (): TemplateContextType => {
  const context = React.useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplate must be used within TemplateProvider');
  }
  return context;
};
