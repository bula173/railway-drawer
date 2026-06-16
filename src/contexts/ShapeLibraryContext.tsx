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
   * Get default track shapes
   */
  const getDefaultTrackShapes = (): DrawElement[] => {
    return [
      {
        id: 'track-straight',
        type: 'track',
        start: { x: 0, y: 50 },
        end: { x: 100, y: 50 },
        fillColor: '#000000',
        strokeColor: '#000000',
        strokeWidth: 2,
      } as DrawElement,
      {
        id: 'track-curve-left',
        type: 'track-curve',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        fillColor: '#000000',
        strokeColor: '#000000',
        strokeWidth: 2,
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
        start: { x: 50, y: 0 },
        end: { x: 50, y: 100 },
        fillColor: '#FF0000',
        strokeColor: '#000000',
        strokeWidth: 2,
      } as DrawElement,
    ];
  };

  /**
   * Get default switch shapes
   */
  const getDefaultSwitchShapes = (): DrawElement[] => {
    return [];
  };

  /**
   * Get default structure shapes
   */
  const getDefaultStructureShapes = (): DrawElement[] => {
    return [];
  };

  /**
   * Get default ERTMS shapes
   */
  const getDefaultERTMSShapes = (): DrawElement[] => {
    return [];
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
