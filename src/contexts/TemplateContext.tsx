/**
 * @file TemplateContext.tsx
 * @brief Context for managing railway diagram templates
 *
 * Provides pre-built and custom templates for quick-start diagrams:
 * - Station layouts
 * - Railway junctions
 * - Signaling systems
 * - ERTMS configurations
 * - Custom user templates
 */

import React, { createContext, useCallback, useState, useEffect } from 'react';
import type { DrawElement } from '../components/Elements';
import { logger } from '../utils/logger';

/**
 * @interface RailwayTemplate
 * @brief A pre-designed railway diagram template
 */
export interface RailwayTemplate {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Detailed description */
  description: string;
  /** Category for organization */
  category: 'stations' | 'junctions' | 'signaling' | 'ertms' | 'custom' | 'other';
  /** Elements to be added to canvas */
  elements: DrawElement[];
  /** Pre-defined connections between elements */
  connections?: Array<{
    sourceId: string;
    targetId: string;
    type: 'direct' | 'junction' | 'crossover';
  }>;
  /** Difficulty level */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** Tags for searching */
  tags: string[];
  /** Thumbnail image URL or base64 */
  thumbnail?: string;
  /** Whether this is a built-in template */
  isDefault: boolean;
  /** Creator of the template */
  createdBy?: string;
  /** Creation date */
  createdAt: Date;
  /** Last modified date */
  modifiedAt: Date;
  /** Number of uses */
  usageCount: number;
  /** Rating 1-5 (if user-submitted) */
  rating?: number;
}

/**
 * @interface TemplateContextType
 * @brief Template context value
 */
export interface TemplateContextType {
  /** All available templates */
  templates: RailwayTemplate[];
  /** Search query */
  searchQuery: string;
  /** Selected category filter */
  selectedCategory: string | null;
  /** Selected difficulty filter */
  selectedDifficulty: string | null;

  // Template Operations
  addTemplate: (template: RailwayTemplate) => void;
  updateTemplate: (id: string, updates: Partial<RailwayTemplate>) => void;
  deleteTemplate: (id: string) => void;

  // Search Operations
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedDifficulty: (difficulty: string | null) => void;
  searchTemplates: (query: string, category?: string, difficulty?: string) => RailwayTemplate[];

  // Query Operations
  getTemplatesByCategory: (category: string) => RailwayTemplate[];
  getTemplatesByDifficulty: (difficulty: string) => RailwayTemplate[];
  getTemplate: (id: string) => RailwayTemplate | null;
  getPopularTemplates: (limit: number) => RailwayTemplate[];

  // Usage tracking
  recordTemplateUsage: (id: string) => void;

  // Persistence
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
   * Create default railway templates
   */
  const initializeDefaultTemplates = useCallback(() => {
    const defaultTemplates: RailwayTemplate[] = [
      // STATIONS
      {
        id: 'station-simple-2platform',
        name: 'Simple 2-Platform Station',
        description: 'Basic railway station with 2 platforms and main line passing through',
        category: 'stations',
        elements: createSimpleTwoplatformElements(),
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
        elements: createComplexFourPlatformElements(),
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
        elements: createIslandPlatformElements(),
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
        elements: createDiamondCrossingElements(),
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
        elements: createThreeWayJunctionElements(),
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
        elements: createDoubleCrossoverElements(),
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
        elements: createThreeAspectSignalingElements(),
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
        elements: createFourAspectSignalingElements(),
        difficulty: 'intermediate',
        tags: ['signaling', 'signal', '4-aspect', 'advanced'],
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
        elements: createERTMSLevel2Elements(),
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
        elements: createERTMSLevel3Elements(),
        difficulty: 'advanced',
        tags: ['ERTMS', 'level3', 'modern', 'european', 'in-cab'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        usageCount: 0,
      },
    ];

    setTemplates(defaultTemplates);
  }, []);

  /**
   * Generate unique ID for template elements
   */
  const generateId = (): string => `elem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Create elements for simple 2-platform station
   */
  const createSimpleTwoplatformElements = (): DrawElement[] => {
    return [
      // Main line through station
      { id: generateId(), type: 'track', name: 'Main Line', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Platform 1
      { id: generateId(), type: 'platform', name: 'Platform 1', start: { x: 100, y: 100 }, end: { x: 300, y: 100 } },
      // Track for Platform 1
      { id: generateId(), type: 'track', name: 'Platform 1 Track', start: { x: 100, y: 130 }, end: { x: 300, y: 130 } },
      // Platform 2
      { id: generateId(), type: 'platform', name: 'Platform 2', start: { x: 100, y: 170 }, end: { x: 300, y: 170 } },
      // Track for Platform 2
      { id: generateId(), type: 'track', name: 'Platform 2 Track', start: { x: 100, y: 200 }, end: { x: 300, y: 200 } },
    ];
  };

  /**
   * Create elements for complex 4-platform station
   */
  const createComplexFourPlatformElements = (): DrawElement[] => {
    return [
      // Main line 1
      { id: generateId(), type: 'track', name: 'Main Line 1', start: { x: 50, y: 100 }, end: { x: 400, y: 100 } },
      // Platform 1
      { id: generateId(), type: 'platform', name: 'Platform 1', start: { x: 100, y: 60 }, end: { x: 350, y: 60 } },
      { id: generateId(), type: 'track', name: 'P1 Track', start: { x: 100, y: 80 }, end: { x: 350, y: 80 } },
      // Platform 2
      { id: generateId(), type: 'platform', name: 'Platform 2', start: { x: 100, y: 120 }, end: { x: 350, y: 120 } },
      { id: generateId(), type: 'track', name: 'P2 Track', start: { x: 100, y: 140 }, end: { x: 350, y: 140 } },
      // Platform 3
      { id: generateId(), type: 'platform', name: 'Platform 3', start: { x: 100, y: 160 }, end: { x: 350, y: 160 } },
      { id: generateId(), type: 'track', name: 'P3 Track', start: { x: 100, y: 180 }, end: { x: 350, y: 180 } },
      // Platform 4
      { id: generateId(), type: 'platform', name: 'Platform 4', start: { x: 100, y: 200 }, end: { x: 350, y: 200 } },
      { id: generateId(), type: 'track', name: 'P4 Track', start: { x: 100, y: 220 }, end: { x: 350, y: 220 } },
      // Main line 2
      { id: generateId(), type: 'track', name: 'Main Line 2', start: { x: 50, y: 250 }, end: { x: 400, y: 250 } },
    ];
  };

  /**
   * Create elements for island platform
   */
  const createIslandPlatformElements = (): DrawElement[] => {
    return [
      // Line 1
      { id: generateId(), type: 'track', name: 'Line 1', start: { x: 50, y: 100 }, end: { x: 350, y: 100 } },
      // Island platform
      { id: generateId(), type: 'platform', name: 'Island Platform', start: { x: 100, y: 130 }, end: { x: 300, y: 130 } },
      // Line 2
      { id: generateId(), type: 'track', name: 'Line 2', start: { x: 50, y: 160 }, end: { x: 350, y: 160 } },
      // Connection tracks
      { id: generateId(), type: 'track', name: 'Connection 1', start: { x: 100, y: 100 }, end: { x: 100, y: 130 } },
      { id: generateId(), type: 'track', name: 'Connection 2', start: { x: 300, y: 100 }, end: { x: 300, y: 130 } },
      { id: generateId(), type: 'track', name: 'Connection 3', start: { x: 100, y: 160 }, end: { x: 100, y: 130 } },
      { id: generateId(), type: 'track', name: 'Connection 4', start: { x: 300, y: 160 }, end: { x: 300, y: 130 } },
    ];
  };

  /**
   * Create elements for diamond crossing
   */
  const createDiamondCrossingElements = (): DrawElement[] => {
    return [
      // Line 1 horizontal
      { id: generateId(), type: 'track', name: 'Line 1', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Line 2 vertical (crossing)
      { id: generateId(), type: 'track', name: 'Line 2', start: { x: 200, y: 50 }, end: { x: 200, y: 250 } },
      // Diamond crossing point (visual indicator)
      { id: generateId(), type: 'junction', name: 'Crossing', start: { x: 190, y: 140 }, end: { x: 210, y: 160 } },
    ];
  };

  /**
   * Create elements for 3-way junction
   */
  const createThreeWayJunctionElements = (): DrawElement[] => {
    return [
      // Line 1 (horizontal)
      { id: generateId(), type: 'track', name: 'Main Line', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Line 2 (branch going up-right)
      { id: generateId(), type: 'track', name: 'Branch 1', start: { x: 200, y: 150 }, end: { x: 350, y: 50 } },
      // Line 3 (branch going down-right)
      { id: generateId(), type: 'track', name: 'Branch 2', start: { x: 200, y: 150 }, end: { x: 350, y: 250 } },
      // Junction point
      { id: generateId(), type: 'junction', name: 'Three-Way Switch', start: { x: 190, y: 140 }, end: { x: 210, y: 160 } },
    ];
  };

  /**
   * Create elements for double crossover
   */
  const createDoubleCrossoverElements = (): DrawElement[] => {
    return [
      // Track 1 main
      { id: generateId(), type: 'track', name: 'Track 1', start: { x: 50, y: 100 }, end: { x: 350, y: 100 } },
      // Track 2 main
      { id: generateId(), type: 'track', name: 'Track 2', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Crossover switch 1 left
      { id: generateId(), type: 'switch', name: 'Switch 1', start: { x: 100, y: 100 }, end: { x: 100, y: 150 } },
      // Crossover switch 2 left
      { id: generateId(), type: 'switch', name: 'Switch 2', start: { x: 120, y: 100 }, end: { x: 120, y: 150 } },
      // Crossover switch 3 right
      { id: generateId(), type: 'switch', name: 'Switch 3', start: { x: 300, y: 100 }, end: { x: 300, y: 150 } },
      // Crossover switch 4 right
      { id: generateId(), type: 'switch', name: 'Switch 4', start: { x: 320, y: 100 }, end: { x: 320, y: 150 } },
    ];
  };

  /**
   * Create elements for 3-aspect signaling
   */
  const createThreeAspectSignalingElements = (): DrawElement[] => {
    return [
      // Track
      { id: generateId(), type: 'track', name: 'Track', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Distant signal
      { id: generateId(), type: 'signal', name: 'Distant Signal', start: { x: 100, y: 100 }, end: { x: 100, y: 120 } },
      // Main signal 1
      { id: generateId(), type: 'signal', name: 'Main Signal 1', start: { x: 200, y: 100 }, end: { x: 200, y: 120 } },
      // Main signal 2
      { id: generateId(), type: 'signal', name: 'Main Signal 2', start: { x: 300, y: 100 }, end: { x: 300, y: 120 } },
    ];
  };

  /**
   * Create elements for 4-aspect signaling
   */
  const createFourAspectSignalingElements = (): DrawElement[] => {
    return [
      // Track
      { id: generateId(), type: 'track', name: 'Track', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Distant signal
      { id: generateId(), type: 'signal', name: 'Distant Signal', start: { x: 80, y: 100 }, end: { x: 80, y: 120 } },
      // Main signal 1
      { id: generateId(), type: 'signal', name: 'Main Signal 1', start: { x: 150, y: 100 }, end: { x: 150, y: 120 } },
      // Repeater signal
      { id: generateId(), type: 'signal', name: 'Repeater Signal', start: { x: 220, y: 100 }, end: { x: 220, y: 120 } },
      // Main signal 2
      { id: generateId(), type: 'signal', name: 'Main Signal 2', start: { x: 290, y: 100 }, end: { x: 290, y: 120 } },
    ];
  };

  /**
   * Create elements for ERTMS Level 2
   */
  const createERTMSLevel2Elements = (): DrawElement[] => {
    return [
      // Track
      { id: generateId(), type: 'track', name: 'Track', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Balise beacon 1
      { id: generateId(), type: 'beacon', name: 'Balise 1', start: { x: 100, y: 140 }, end: { x: 100, y: 160 } },
      // Balise beacon 2
      { id: generateId(), type: 'beacon', name: 'Balise 2', start: { x: 200, y: 140 }, end: { x: 200, y: 160 } },
      // Balise beacon 3
      { id: generateId(), type: 'beacon', name: 'Balise 3', start: { x: 300, y: 140 }, end: { x: 300, y: 160 } },
      // RBC (Radio Block Center) indicator
      { id: generateId(), type: 'rbc', name: 'RBC Coverage', start: { x: 50, y: 50 }, end: { x: 350, y: 50 } },
    ];
  };

  /**
   * Create elements for ERTMS Level 3
   */
  const createERTMSLevel3Elements = (): DrawElement[] => {
    return [
      // Track
      { id: generateId(), type: 'track', name: 'Track', start: { x: 50, y: 150 }, end: { x: 350, y: 150 } },
      // Balise beacon (fewer than Level 2)
      { id: generateId(), type: 'beacon', name: 'Balise 1', start: { x: 100, y: 140 }, end: { x: 100, y: 160 } },
      // RBC coverage (larger area)
      { id: generateId(), type: 'rbc', name: 'RBC Full Coverage', start: { x: 50, y: 50 }, end: { x: 350, y: 50 } },
      // GSM-R coverage
      { id: generateId(), type: 'gsm', name: 'GSM-R Coverage', start: { x: 50, y: 250 }, end: { x: 350, y: 250 } },
    ];
  };

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
        // Filter by category if specified
        if (category && template.category !== category) return false;

        // Filter by difficulty if specified
        if (difficulty && template.difficulty !== difficulty) return false;

        // Search in name, description, and tags
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
   * Get templates by category
   */
  const getTemplatesByCategory = useCallback(
    (category: string): RailwayTemplate[] => {
      return templates.filter(t => t.category === category);
    },
    [templates]
  );

  /**
   * Get templates by difficulty
   */
  const getTemplatesByDifficulty = useCallback(
    (difficulty: string): RailwayTemplate[] => {
      return templates.filter(t => t.difficulty === difficulty);
    },
    [templates]
  );

  /**
   * Get template by ID
   */
  const getTemplate = useCallback(
    (id: string): RailwayTemplate | null => {
      return templates.find(t => t.id === id) || null;
    },
    [templates]
  );

  /**
   * Get most popular templates
   */
  const getPopularTemplates = useCallback(
    (limit: number = 5): RailwayTemplate[] => {
      return [...templates]
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
    },
    [templates]
  );

  /**
   * Record template usage
   */
  const recordTemplateUsage = useCallback(
    (id: string) => {
      logger.debug('TemplateProvider', 'Recording template usage', { id });
      updateTemplate(id, {
        usageCount: (getTemplate(id)?.usageCount || 0) + 1,
      });
    },
    [updateTemplate, getTemplate]
  );

  /**
   * Save templates to localStorage
   */
  const saveTemplates = useCallback(async () => {
    try {
      logger.info('TemplateProvider', 'Saving templates to localStorage');
      const customTemplates = templates.filter(t => !t.isDefault);
      localStorage.setItem('railway-drawer-custom-templates', JSON.stringify(customTemplates));
    } catch (error) {
      logger.error('TemplateProvider', 'Failed to save templates', { error });
    }
  }, [templates]);

  /**
   * Load templates from localStorage
   */
  const loadTemplates = useCallback(async () => {
    try {
      logger.info('TemplateProvider', 'Loading templates from localStorage');
      const saved = localStorage.getItem('railway-drawer-custom-templates');
      if (saved) {
        const customTemplates = JSON.parse(saved) as RailwayTemplate[];
        setTemplates(prev => [...prev, ...customTemplates]);
      }
    } catch (error) {
      logger.error('TemplateProvider', 'Failed to load templates', { error });
    }
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
    getTemplatesByCategory,
    getTemplatesByDifficulty,
    getTemplate,
    getPopularTemplates,
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
 * @brief Hook to use template context
 * @throws Error if used outside TemplateProvider
 */
export const useTemplate = (): TemplateContextType => {
  const context = React.useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplate must be used within TemplateProvider');
  }
  return context;
};
