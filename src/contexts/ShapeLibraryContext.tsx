/**
 * @file ShapeLibraryContext.tsx
 * @brief Context for managing shape libraries and custom components
 *
 * Provides organized, searchable shape libraries with:
 * - Pre-built railway component libraries
 * - Custom user libraries
 * - Library search and filtering
 * - Library persistence
 *
 * Inspired by draw.io's library system
 */

import React, { createContext, useCallback, useState, useEffect } from 'react';
import type { DrawElement } from '../components/Elements';
import { logger } from '../utils/logger';

/**
 * @interface ShapeLibrary
 * @brief A collection of related shapes/components
 */
export interface ShapeLibrary {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what shapes this library contains */
  description: string;
  /** Category for organization */
  category: 'railway' | 'signaling' | 'ertms' | 'structures' | 'custom' | 'other';
  /** Shape elements in this library */
  shapes: DrawElement[];
  /** Tags for searching */
  tags: string[];
  /** Icon/thumbnail for library */
  thumbnail?: string;
  /** Whether this is a built-in library */
  isDefault: boolean;
  /** Creator of the library */
  createdBy?: string;
  /** Creation date */
  createdAt: Date;
  /** Last modified date */
  modifiedAt: Date;
  /** Whether library is visible */
  visible: boolean;
}

/**
 * @interface ShapeLibraryContextType
 * @brief Shape library context value
 */
export interface ShapeLibraryContextType {
  /** All available libraries */
  libraries: ShapeLibrary[];
  /** Selected/active library ID */
  selectedLibraryId: string | null;
  /** Search query */
  searchQuery: string;
  /** Selected category filter */
  selectedCategory: string | null;

  // Library Operations
  addLibrary: (library: ShapeLibrary) => void;
  updateLibrary: (id: string, updates: Partial<ShapeLibrary>) => void;
  deleteLibrary: (id: string) => void;
  selectLibrary: (id: string | null) => void;

  // Search Operations
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  searchShapes: (query: string, category?: string) => DrawElement[];

  // Shape Operations
  addShapeToLibrary: (libraryId: string, shape: DrawElement) => void;
  removeShapeFromLibrary: (libraryId: string, shapeId: string) => void;

  // Query Operations
  getLibrariesByCategory: (category: string) => ShapeLibrary[];
  getSelectedLibrary: () => ShapeLibrary | null;
  getVisibleLibraries: () => ShapeLibrary[];

  // Persistence
  saveLibraries: () => Promise<void>;
  loadLibraries: () => Promise<void>;
}

/**
 * Create the context
 */
export const ShapeLibraryContext = createContext<ShapeLibraryContextType | undefined>(undefined);

/**
 * @interface ShapeLibraryProviderProps
 * @brief Props for ShapeLibraryProvider
 */
export interface ShapeLibraryProviderProps {
  children: React.ReactNode;
}

/**
 * @component ShapeLibraryProvider
 * @brief Provider component for shape library context
 *
 * Manages shape libraries and provides operations for searching,
 * filtering, and managing custom libraries.
 */
export const ShapeLibraryProvider: React.FC<ShapeLibraryProviderProps> = ({ children }) => {
  const [libraries, setLibraries] = useState<ShapeLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  /**
   * Initialize with default libraries
   */
  useEffect(() => {
    logger.info('ShapeLibraryProvider', 'Initializing with default libraries');
    initializeDefaultLibraries();
  }, []);

  /**
   * Create default railway component libraries
   */
  const initializeDefaultLibraries = useCallback(() => {
    const defaultLibraries: ShapeLibrary[] = [
      {
        id: 'railway-tracks',
        name: 'Railway Tracks',
        description: 'Track elements - straight, curves, junctions, crossovers',
        category: 'railway',
        shapes: getDefaultTrackShapes(),
        tags: ['track', 'railway', 'line', 'curve', 'junction', 'crossover'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        visible: true,
      },
      {
        id: 'railway-signals',
        name: 'Railway Signals',
        description: 'Signal types - main, distant, repeater, shunting',
        category: 'signaling',
        shapes: getDefaultSignalShapes(),
        tags: ['signal', 'main', 'distant', 'repeater', 'shunting', 'aspect'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        visible: true,
      },
      {
        id: 'railway-switches',
        name: 'Railway Switches',
        description: 'Switch elements - points, crossovers, turnouts',
        category: 'railway',
        shapes: getDefaultSwitchShapes(),
        tags: ['switch', 'points', 'turnout', 'crossover', 'junction'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        visible: true,
      },
      {
        id: 'railway-structures',
        name: 'Railway Structures',
        description: 'Structural elements - platforms, stations, buildings',
        category: 'structures',
        shapes: getDefaultStructureShapes(),
        tags: ['platform', 'station', 'building', 'structure', 'infrastructure'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        visible: true,
      },
      {
        id: 'ertms-components',
        name: 'ERTMS Components',
        description: 'ERTMS equipment - balises, transponders, trackside units',
        category: 'ertms',
        shapes: getDefaultERTMSShapes(),
        tags: ['ERTMS', 'balise', 'transponder', 'RBC', 'DMI'],
        isDefault: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
        visible: true,
      },
    ];

    setLibraries(defaultLibraries);
    if (defaultLibraries.length > 0) {
      setSelectedLibraryId(defaultLibraries[0].id);
    }
  }, []);

  /**
   * Generate unique ID for shapes
   */
  const generateShapeId = (): string => `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Get default track shapes
   */
  const getDefaultTrackShapes = (): DrawElement[] => {
    return [
      {
        id: 'track-straight-h',
        type: 'track',
        name: 'Straight Track (Horizontal)',
        start: { x: 0, y: 50 },
        end: { x: 150, y: 50 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'track-straight-v',
        type: 'track',
        name: 'Straight Track (Vertical)',
        start: { x: 50, y: 0 },
        end: { x: 50, y: 150 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'track-curve-br',
        type: 'track-curve',
        name: 'Curve (Bottom-Right)',
        start: { x: 0, y: 50 },
        end: { x: 100, y: 150 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'track-curve-bl',
        type: 'track-curve',
        name: 'Curve (Bottom-Left)',
        start: { x: 150, y: 50 },
        end: { x: 50, y: 150 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'track-curve-tr',
        type: 'track-curve',
        name: 'Curve (Top-Right)',
        start: { x: 0, y: 150 },
        end: { x: 100, y: 50 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'track-curve-tl',
        type: 'track-curve',
        name: 'Curve (Top-Left)',
        start: { x: 150, y: 150 },
        end: { x: 50, y: 50 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'track-double-h',
        type: 'track-double',
        name: 'Double Track (Horizontal)',
        start: { x: 0, y: 40 },
        end: { x: 150, y: 60 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'track-double-v',
        type: 'track-double',
        name: 'Double Track (Vertical)',
        start: { x: 40, y: 0 },
        end: { x: 60, y: 150 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
    ];
  };

  /**
   * Get default signal shapes
   */
  const getDefaultSignalShapes = (): DrawElement[] => {
    return [
      {
        id: 'signal-3aspect',
        type: 'signal',
        name: '3-Aspect Signal (Red)',
        start: { x: 40, y: 0 },
        end: { x: 60, y: 100 },
        styles: { fill: '#FF0000', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-3aspect-yellow',
        type: 'signal',
        name: '3-Aspect Signal (Yellow)',
        start: { x: 40, y: 0 },
        end: { x: 60, y: 100 },
        styles: { fill: '#FFFF00', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-3aspect-green',
        type: 'signal',
        name: '3-Aspect Signal (Green)',
        start: { x: 40, y: 0 },
        end: { x: 60, y: 100 },
        styles: { fill: '#00AA00', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-4aspect-red',
        type: 'signal-4aspect',
        name: '4-Aspect Signal (Red)',
        start: { x: 35, y: 0 },
        end: { x: 65, y: 120 },
        styles: { fill: '#FF0000', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-4aspect-yellow1',
        type: 'signal-4aspect',
        name: '4-Aspect Signal (Double Yellow)',
        start: { x: 35, y: 0 },
        end: { x: 65, y: 120 },
        styles: { fill: '#FFFF00', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-4aspect-yellow2',
        type: 'signal-4aspect',
        name: '4-Aspect Signal (Single Yellow)',
        start: { x: 35, y: 0 },
        end: { x: 65, y: 120 },
        styles: { fill: '#FFAA00', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-4aspect-green',
        type: 'signal-4aspect',
        name: '4-Aspect Signal (Green)',
        start: { x: 35, y: 0 },
        end: { x: 65, y: 120 },
        styles: { fill: '#00AA00', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-distant',
        type: 'signal-distant',
        name: 'Distant Signal',
        start: { x: 35, y: 0 },
        end: { x: 65, y: 80 },
        styles: { fill: '#FFAA00', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
      {
        id: 'signal-shunting',
        type: 'signal-shunting',
        name: 'Shunting Signal',
        start: { x: 45, y: 0 },
        end: { x: 55, y: 80 },
        styles: { fill: '#FF00FF', stroke: '#000000', strokeWidth: 1 },
      } as DrawElement,
    ];
  };

  /**
   * Get default switch shapes
   */
  const getDefaultSwitchShapes = (): DrawElement[] => {
    return [
      {
        id: 'switch-points-left',
        type: 'switch',
        name: 'Points (Left)',
        start: { x: 0, y: 50 },
        end: { x: 100, y: 30 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'switch-points-right',
        type: 'switch',
        name: 'Points (Right)',
        start: { x: 0, y: 50 },
        end: { x: 100, y: 70 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'switch-crossover-left',
        type: 'switch-crossover',
        name: 'Crossover (Left)',
        start: { x: 0, y: 40 },
        end: { x: 100, y: 60 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'switch-crossover-right',
        type: 'switch-crossover',
        name: 'Crossover (Right)',
        start: { x: 0, y: 60 },
        end: { x: 100, y: 40 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'switch-diamond',
        type: 'switch-diamond',
        name: 'Diamond Crossing',
        start: { x: 0, y: 50 },
        end: { x: 100, y: 50 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'switch-3way',
        type: 'switch-3way',
        name: '3-Way Junction',
        start: { x: 0, y: 50 },
        end: { x: 100, y: 50 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'switch-turnout',
        type: 'switch-turnout',
        name: 'Turnout',
        start: { x: 0, y: 50 },
        end: { x: 80, y: 80 },
        styles: { stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
    ];
  };

  /**
   * Get default structure shapes
   */
  const getDefaultStructureShapes = (): DrawElement[] => {
    return [
      {
        id: 'platform-short',
        type: 'platform',
        name: 'Short Platform (60m)',
        start: { x: 0, y: 30 },
        end: { x: 60, y: 70 },
        styles: { fill: '#FFFFCC', stroke: '#FF9900', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'platform-medium',
        type: 'platform',
        name: 'Medium Platform (100m)',
        start: { x: 0, y: 30 },
        end: { x: 100, y: 70 },
        styles: { fill: '#FFFFCC', stroke: '#FF9900', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'platform-long',
        type: 'platform',
        name: 'Long Platform (150m)',
        start: { x: 0, y: 30 },
        end: { x: 150, y: 70 },
        styles: { fill: '#FFFFCC', stroke: '#FF9900', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'platform-island',
        type: 'platform-island',
        name: 'Island Platform',
        start: { x: 0, y: 20 },
        end: { x: 100, y: 80 },
        styles: { fill: '#FFFFCC', stroke: '#FF9900', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'station-building',
        type: 'station',
        name: 'Station Building',
        start: { x: 10, y: 10 },
        end: { x: 90, y: 90 },
        styles: { fill: '#FF6666', stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'depot',
        type: 'depot',
        name: 'Depot/Maintenance Facility',
        start: { x: 0, y: 0 },
        end: { x: 120, y: 60 },
        styles: { fill: '#9999FF', stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'warehouse',
        type: 'warehouse',
        name: 'Warehouse',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
        styles: { fill: '#CCCCCC', stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'level-crossing',
        type: 'level-crossing',
        name: 'Level Crossing',
        start: { x: 0, y: 40 },
        end: { x: 100, y: 60 },
        styles: { fill: '#CC0000', stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
    ];
  };

  /**
   * Get default ERTMS shapes
   */
  const getDefaultERTMSShapes = (): DrawElement[] => {
    return [
      {
        id: 'ertms-balise',
        type: 'ertms-balise',
        name: 'Balise (Fixed)',
        start: { x: 40, y: 0 },
        end: { x: 60, y: 60 },
        styles: { fill: '#0099FF', stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'ertms-balise-l2',
        type: 'ertms-balise',
        name: 'Balise (Level 2)',
        start: { x: 40, y: 0 },
        end: { x: 60, y: 70 },
        styles: { fill: '#0099FF', stroke: '#0000AA', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'ertms-balise-l3',
        type: 'ertms-balise',
        name: 'Balise (Level 3)',
        start: { x: 40, y: 0 },
        end: { x: 60, y: 50 },
        styles: { fill: '#00FF99', stroke: '#0000AA', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'ertms-rbc-link',
        type: 'ertms-rbc',
        name: 'RBC (Radio Block Center)',
        start: { x: 0, y: 30 },
        end: { x: 150, y: 70 },
        styles: { fill: '#FFCCCC', stroke: '#FF0000', strokeWidth: 2, strokeDasharray: '5,5' },
      } as DrawElement,
      {
        id: 'ertms-gsm-r',
        type: 'ertms-gsm',
        name: 'GSM-R Coverage Area',
        start: { x: 0, y: 30 },
        end: { x: 150, y: 70 },
        styles: { fill: '#CCFFCC', stroke: '#00AA00', strokeWidth: 2, strokeDasharray: '5,5' },
      } as DrawElement,
      {
        id: 'ertms-antenna',
        type: 'ertms-antenna',
        name: 'GSM-R Antenna',
        start: { x: 45, y: 0 },
        end: { x: 55, y: 80 },
        styles: { stroke: '#FF6600', strokeWidth: 2 },
      } as DrawElement,
      {
        id: 'ertms-hotspot',
        type: 'ertms-hotspot',
        name: 'Dead Zone / Hotspot',
        start: { x: 25, y: 25 },
        end: { x: 75, y: 75 },
        styles: { fill: '#FFFF00', stroke: '#FF0000', strokeWidth: 2, opacity: 0.5 },
      } as DrawElement,
      {
        id: 'ertms-link-box',
        type: 'ertms-link',
        name: 'Link Box (Trackside)',
        start: { x: 35, y: 35 },
        end: { x: 65, y: 65 },
        styles: { fill: '#FF9999', stroke: '#000000', strokeWidth: 2 },
      } as DrawElement,
    ];
  };

  /**
   * Add a new library
   */
  const addLibrary = useCallback((library: ShapeLibrary) => {
    logger.info('ShapeLibraryProvider', 'Adding library', { id: library.id, name: library.name });
    setLibraries(prev => [...prev, library]);
  }, []);

  /**
   * Update a library
   */
  const updateLibrary = useCallback((id: string, updates: Partial<ShapeLibrary>) => {
    logger.info('ShapeLibraryProvider', 'Updating library', { id });
    setLibraries(prev =>
      prev.map(lib =>
        lib.id === id ? { ...lib, ...updates, modifiedAt: new Date() } : lib
      )
    );
  }, []);

  /**
   * Delete a library
   */
  const deleteLibrary = useCallback((id: string) => {
    logger.info('ShapeLibraryProvider', 'Deleting library', { id });
    setLibraries(prev => prev.filter(lib => lib.id !== id));
    if (selectedLibraryId === id) {
      setSelectedLibraryId(null);
    }
  }, [selectedLibraryId]);

  /**
   * Select a library
   */
  const selectLibrary = useCallback((id: string | null) => {
    logger.debug('ShapeLibraryProvider', 'Selecting library', { id });
    setSelectedLibraryId(id);
  }, []);

  /**
   * Search shapes across all libraries
   */
  const searchShapes = useCallback(
    (query: string, category?: string): DrawElement[] => {
      const lowerQuery = query.toLowerCase();

      return libraries
        .filter(lib => !category || lib.category === category)
        .flatMap(lib =>
          lib.shapes.filter(shape => {
            // Search in shape ID, type, and library tags
            const shapeTags = lib.tags.join(' ').toLowerCase();
            const shapeInfo = `${shape.id} ${shape.type} ${shapeTags}`.toLowerCase();
            return shapeInfo.includes(lowerQuery);
          })
        );
    },
    [libraries]
  );

  /**
   * Add a shape to a library
   */
  const addShapeToLibrary = useCallback((libraryId: string, shape: DrawElement) => {
    logger.debug('ShapeLibraryProvider', 'Adding shape to library', {
      libraryId,
      shapeId: shape.id,
    });
    updateLibrary(libraryId, {
      shapes: [
        ...(libraries.find(lib => lib.id === libraryId)?.shapes || []),
        shape,
      ],
    });
  }, [libraries, updateLibrary]);

  /**
   * Remove a shape from a library
   */
  const removeShapeFromLibrary = useCallback(
    (libraryId: string, shapeId: string) => {
      logger.debug('ShapeLibraryProvider', 'Removing shape from library', {
        libraryId,
        shapeId,
      });
      const library = libraries.find(lib => lib.id === libraryId);
      if (library) {
        updateLibrary(libraryId, {
          shapes: library.shapes.filter(s => s.id !== shapeId),
        });
      }
    },
    [libraries, updateLibrary]
  );

  /**
   * Get libraries by category
   */
  const getLibrariesByCategory = useCallback(
    (category: string): ShapeLibrary[] => {
      return libraries.filter(lib => lib.category === category);
    },
    [libraries]
  );

  /**
   * Get selected library
   */
  const getSelectedLibrary = useCallback((): ShapeLibrary | null => {
    return libraries.find(lib => lib.id === selectedLibraryId) || null;
  }, [libraries, selectedLibraryId]);

  /**
   * Get visible libraries
   */
  const getVisibleLibraries = useCallback((): ShapeLibrary[] => {
    return libraries.filter(lib => lib.visible);
  }, [libraries]);

  /**
   * Save libraries to localStorage
   */
  const saveLibraries = useCallback(async () => {
    try {
      logger.info('ShapeLibraryProvider', 'Saving libraries to localStorage');
      const customLibraries = libraries.filter(lib => !lib.isDefault);
      localStorage.setItem('railway-drawer-custom-libraries', JSON.stringify(customLibraries));
    } catch (error) {
      logger.error('ShapeLibraryProvider', 'Failed to save libraries', { error });
    }
  }, [libraries]);

  /**
   * Load libraries from localStorage
   */
  const loadLibraries = useCallback(async () => {
    try {
      logger.info('ShapeLibraryProvider', 'Loading libraries from localStorage');
      const saved = localStorage.getItem('railway-drawer-custom-libraries');
      if (saved) {
        const customLibraries = JSON.parse(saved) as ShapeLibrary[];
        setLibraries(prev => [...prev, ...customLibraries]);
      }
    } catch (error) {
      logger.error('ShapeLibraryProvider', 'Failed to load libraries', { error });
    }
  }, []);

  const value: ShapeLibraryContextType = {
    libraries,
    selectedLibraryId,
    searchQuery,
    selectedCategory,
    addLibrary,
    updateLibrary,
    deleteLibrary,
    selectLibrary,
    setSearchQuery,
    setSelectedCategory,
    searchShapes,
    addShapeToLibrary,
    removeShapeFromLibrary,
    getLibrariesByCategory,
    getSelectedLibrary,
    getVisibleLibraries,
    saveLibraries,
    loadLibraries,
  };

  return (
    <ShapeLibraryContext.Provider value={value}>
      {children}
    </ShapeLibraryContext.Provider>
  );
};

/**
 * @hook useShapeLibrary
 * @brief Hook to use shape library context
 * @throws Error if used outside ShapeLibraryProvider
 */
export const useShapeLibrary = (): ShapeLibraryContextType => {
  const context = React.useContext(ShapeLibraryContext);
  if (!context) {
    throw new Error('useShapeLibrary must be used within ShapeLibraryProvider');
  }
  return context;
};
