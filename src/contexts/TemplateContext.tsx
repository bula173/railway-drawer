/**
 * @file TemplateContext.tsx
 * @brief Context for managing railway diagram templates using maxGraphShapes
 *
 * Provides pre-built templates composed of shapes from maxGraphShapes
 */

import React, { createContext, useCallback, useState, useEffect } from 'react';
import type { DrawElement } from '../components/Elements';
import { logger } from '../utils/logger';
import { getAllMaxGraphShapes } from '../config/maxGraphShapes';

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
  getTemplate: (id: string) => RailwayTemplate | undefined;
  getTemplatesByCategory: (category: string) => RailwayTemplate[];
  getTemplatesByDifficulty: (difficulty: string) => RailwayTemplate[];
  getPopularTemplates: (limit?: number) => RailwayTemplate[];

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
   * Helper function to find shape by name from maxGraphShapes
   */
  const findShapeByName = useCallback((name: string): DrawElement | null => {
    const allShapes = getAllMaxGraphShapes();
    const shape = allShapes.find(s => s.name === name) as any;
    if (!shape) {
      logger.warn('TemplateProvider', `Shape not found: ${name}, using Rectangle as fallback`);
      // Fallback to Rectangle if shape not found
      const fallback = allShapes.find(s => s.name === 'Rectangle') as any;
      if (!fallback) return null;
      return {
        ...fallback,
        id: `${fallback.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
    }
    return {
      ...shape,
      id: `${shape.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }, []);

  /**
   * Helper to position shapes
   */
  const positionShape = (shape: DrawElement | null | undefined, x: number, y: number): DrawElement | null => {
    if (!shape || !shape.start || !shape.end) return null;
    const width = Math.abs(shape.end.x - shape.start.x) || 100;
    const height = Math.abs(shape.end.y - shape.start.y) || 50;
    return {
      ...shape,
      start: { x, y },
      end: { x: x + width, y: y + height },
    };
  };

  /**
   * Helper to position shape with custom dimensions
   */
  const positionShapeCustom = (shape: DrawElement | null | undefined, x: number, y: number, width?: number, height?: number): DrawElement | null => {
    if (!shape) return null;
    const w = width || Math.abs(shape.end.x - shape.start.x) || 100;
    const h = height || Math.abs(shape.end.y - shape.start.y) || 50;
    return {
      ...shape,
      start: { x, y },
      end: { x: x + w, y: y + h },
    };
  };

  /**
   * Create default railway templates using shapes from maxGraphShapes
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
          positionShapeCustom(findShapeByName('Track'), 50, 150, 400, 30),
          positionShapeCustom(findShapeByName('Platform'), 80, 100, 150, 30),
          positionShapeCustom(findShapeByName('Platform'), 80, 200, 150, 30),
          positionShapeCustom(findShapeByName('Rectangle'), 250, 120, 80, 100),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'beginner',
        tags: ['station', 'platform', 'track', 'simple'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'station-complex-4platform',
        name: 'Complex Station (4 Platforms)',
        description: 'Multi-platform station with 4 platforms and main tracks',
        category: 'stations',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 50, 400, 30),
          positionShapeCustom(findShapeByName('Platform'), 80, 120, 150, 30),
          positionShapeCustom(findShapeByName('Platform'), 80, 180, 150, 30),
          positionShapeCustom(findShapeByName('Platform'), 80, 240, 150, 30),
          positionShapeCustom(findShapeByName('Platform'), 80, 300, 150, 30),
          positionShapeCustom(findShapeByName('Rectangle'), 250, 100, 100, 220),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['station', 'platform', 'track', 'complex'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'station-island-platform',
        name: 'Island Platform Station',
        description: 'Station with island platform between two tracks',
        category: 'stations',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 100, 300, 30),
          positionShapeCustom(findShapeByName('Platform'), 120, 160, 200, 40),
          positionShapeCustom(findShapeByName('Track'), 50, 220, 300, 30),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['station', 'platform', 'island', 'track'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },

      // JUNCTIONS
      {
        id: 'junction-points',
        name: 'Simple Points Junction',
        description: 'Single track with junction points for line divergence',
        category: 'junctions',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 150, 400, 30),
          positionShapeCustom(findShapeByName('Arrow Right'), 180, 80, 80, 30),
          positionShapeCustom(findShapeByName('Arrow Right'), 180, 200, 80, 30),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'beginner',
        tags: ['junction', 'points', 'track'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'junction-double-track',
        name: 'Double Track Junction',
        description: 'Two parallel tracks with cross-connections',
        category: 'junctions',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 100, 350, 30),
          positionShapeCustom(findShapeByName('Track'), 50, 200, 350, 30),
          positionShapeCustom(findShapeByName('Double Arrow Right'), 150, 150, 80, 30),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['junction', 'double-track', 'parallel'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'junction-crossover',
        name: 'Crossover Junction',
        description: 'Two tracks with crossover connections at both ends',
        category: 'junctions',
        elements: [
          positionShapeCustom(findShapeByName('Double Track'), 50, 100, 300, 60),
          positionShapeCustom(findShapeByName('Arrow Right'), 150, 85, 70, 30),
          positionShapeCustom(findShapeByName('Arrow Right'), 250, 135, 70, 30),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['junction', 'crossover', 'double-track'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },

      // SIGNALING
      {
        id: 'signaling-railway-signal',
        name: 'Railway Signal System',
        description: 'Traditional railway signaling with fixed signal posts',
        category: 'signaling',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 150, 400, 30),
          positionShapeCustom(findShapeByName('Railway Signal'), 80, 80, 30, 50),
          positionShapeCustom(findShapeByName('Railway Signal'), 180, 80, 30, 50),
          positionShapeCustom(findShapeByName('Railway Signal'), 280, 80, 30, 50),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'beginner',
        tags: ['signaling', 'signal', 'railway', 'traditional'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'signaling-shunting',
        name: 'Shunting Signals',
        description: 'Shunting signals for railway yards and switching areas',
        category: 'signaling',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 100, 350, 30),
          positionShapeCustom(findShapeByName('Track'), 50, 180, 350, 30),
          positionShapeCustom(findShapeByName('Shunting Signal'), 80, 40, 30, 40),
          positionShapeCustom(findShapeByName('Shunting Signal'), 180, 220, 30, 40),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'beginner',
        tags: ['signaling', 'shunting', 'yard'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },

      // ERTMS
      {
        id: 'ertms-level2',
        name: 'ERTMS Level 2 Configuration',
        description: 'European Railway Traffic Management System Level 2 with trackside signaling and balises',
        category: 'ertms',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 150, 450, 30),
          positionShapeCustom(findShapeByName('ERTMS Single Balise'), 100, 80, 40, 50),
          positionShapeCustom(findShapeByName('ERTMS Single Balise'), 200, 80, 40, 50),
          positionShapeCustom(findShapeByName('ERTMS Marker'), 300, 80, 40, 50),
          positionShapeCustom(findShapeByName('ERTMS Marker'), 400, 80, 40, 50),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['ERTMS', 'level2', 'signaling', 'balise', 'modern'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'ertms-level3',
        name: 'ERTMS Level 3 Configuration',
        description: 'ERTMS Level 3 with RBC (Radio Block Center) and in-cab signaling',
        category: 'ertms',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 150, 400, 30),
          positionShapeCustom(findShapeByName('ERTMS RBC'), 150, 50, 80, 60),
          positionShapeCustom(findShapeByName('ERTMS Euroradio Antenna'), 300, 50, 60, 60),
          positionShapeCustom(findShapeByName('ERTMS Double Balise'), 200, 220, 60, 40),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'advanced',
        tags: ['ERTMS', 'level3', 'RBC', 'radioblock', 'modern'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      // OTHER TEMPLATES
      {
        id: 'level-crossing',
        name: 'Level Crossing',
        description: 'Railway and road intersection with crossing equipment',
        category: 'other',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 150, 400, 30),
          positionShapeCustom(findShapeByName('ERTMS Level Crossing'), 150, 80, 100, 100),
          positionShapeCustom(findShapeByName('Railway Signal'), 80, 50, 30, 50),
          positionShapeCustom(findShapeByName('Railway Signal'), 380, 50, 30, 50),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['crossing', 'level-crossing', 'safety', 'signaling'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'depot-maintenance',
        name: 'Maintenance Depot',
        description: 'Railway maintenance facility with multiple tracks and shunting',
        category: 'other',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 80, 350, 30),
          positionShapeCustom(findShapeByName('Track'), 50, 140, 350, 30),
          positionShapeCustom(findShapeByName('Track'), 50, 200, 350, 30),
          positionShapeCustom(findShapeByName('Double Arrow Right'), 150, 110, 70, 30),
          positionShapeCustom(findShapeByName('Double Arrow Right'), 150, 170, 70, 30),
          positionShapeCustom(findShapeByName('Rectangle'), 300, 100, 100, 150),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['depot', 'maintenance', 'yard', 'shunting'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
      {
        id: 'axle-counter-section',
        name: 'Axle Counter Section',
        description: 'Track section with ERTMS axle counters for train detection',
        category: 'ertms',
        elements: [
          positionShapeCustom(findShapeByName('Track'), 50, 150, 400, 30),
          positionShapeCustom(findShapeByName('ERTMS Axle Counter'), 100, 80, 50, 50),
          positionShapeCustom(findShapeByName('ERTMS Axle Counter'), 250, 80, 50, 50),
          positionShapeCustom(findShapeByName('ERTMS Marker'), 175, 220, 40, 50),
        ].filter(Boolean) as DrawElement[],
        difficulty: 'intermediate',
        tags: ['ERTMS', 'axle-counter', 'detection', 'modern'],
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
  }, [findShapeByName, positionShapeCustom, positionShape]);

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

  /**
   * Get a single template by ID
   */
  const getTemplate = useCallback((id: string): RailwayTemplate | undefined => {
    return templates.find(t => t.id === id);
  }, [templates]);

  /**
   * Get templates by category
   */
  const getTemplatesByCategory = useCallback((category: string): RailwayTemplate[] => {
    return templates.filter(t => t.category === category);
  }, [templates]);

  /**
   * Get templates by difficulty
   */
  const getTemplatesByDifficulty = useCallback((difficulty: string): RailwayTemplate[] => {
    return templates.filter(t => t.difficulty === difficulty);
  }, [templates]);

  /**
   * Get most popular templates by usage count
   */
  const getPopularTemplates = useCallback((limit = 5): RailwayTemplate[] => {
    return [...templates].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, limit);
  }, [templates]);

  const value: TemplateContextType = {
    templates,
    searchQuery,
    selectedCategory,
    selectedDifficulty,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    getTemplatesByCategory,
    getTemplatesByDifficulty,
    getPopularTemplates,
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
