/**
 * @file ShapeLibraryContext.tsx
 * @brief Context for managing shape libraries from toolboxConfig.json
 *
 * Loads shapes from toolboxConfig.json and organizes them into libraries
 */

import React, { createContext, useCallback, useState, useEffect } from 'react';
import type { DrawElement } from '../components/Elements';
import { logger } from '../utils/logger';
import toolboxConfig from '../assets/toolboxConfig.json';

/**
 * @interface ShapeLibrary
 * @brief A collection of related shapes/components
 */
export interface ShapeLibrary {
  id: string;
  name: string;
  description: string;
  category: 'railway' | 'signaling' | 'ertms' | 'structures' | 'custom' | 'other';
  shapes: DrawElement[];
  tags: string[];
  thumbnail?: string;
  isDefault: boolean;
  createdBy?: string;
  createdAt: Date;
  modifiedAt: Date;
  visible: boolean;
}

/**
 * @interface ShapeLibraryContextType
 * @brief Shape library context value
 */
export interface ShapeLibraryContextType {
  libraries: ShapeLibrary[];
  selectedLibraryId: string | null;
  searchQuery: string;
  selectedCategory: string | null;

  addLibrary: (library: ShapeLibrary) => void;
  updateLibrary: (id: string, updates: Partial<ShapeLibrary>) => void;
  deleteLibrary: (id: string) => void;
  selectLibrary: (id: string | null) => void;

  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  searchShapes: (query: string, category?: string) => DrawElement[];

  addShapeToLibrary: (libraryId: string, shape: DrawElement) => void;
  removeShapeFromLibrary: (libraryId: string, shapeId: string) => void;

  getLibrariesByCategory: (category: string) => ShapeLibrary[];
  getSelectedLibrary: () => ShapeLibrary | null;
  getVisibleLibraries: () => ShapeLibrary[];

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
 * Loads shapes from toolboxConfig.json and organizes them by group
 */
export const ShapeLibraryProvider: React.FC<ShapeLibraryProviderProps> = ({ children }) => {
  const [libraries, setLibraries] = useState<ShapeLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  /**
   * Initialize with libraries from toolboxConfig.json
   */
  useEffect(() => {
    logger.info('ShapeLibraryProvider', 'Initializing with toolboxConfig.json');
    initializeLibrariesFromToolboxConfig();
  }, []);

  /**
   * Create libraries from toolboxConfig.json
   */
  const initializeLibrariesFromToolboxConfig = useCallback(() => {
    // Group shapes by their group name
    const groupedShapes = (toolboxConfig as any[]).reduce((acc, shape) => {
      const groupName = shape.group || 'Other';
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(shape as DrawElement);
      return acc;
    }, {} as Record<string, DrawElement[]>);

    // Map groups to library categories
    const groupToCategoryMap: Record<string, 'railway' | 'signaling' | 'ertms' | 'structures' | 'custom' | 'other'> = {
      'Tracks': 'railway',
      'Signals': 'signaling',
      'Trains': 'railway',
      'ERTMS': 'ertms',
      'Utils': 'structures',
      'General': 'custom',
      'Arrows': 'custom',
      'Sequence Diagram': 'custom',
      'UML': 'custom',
    };

    // Create libraries from grouped shapes
    const defaultLibraries: ShapeLibrary[] = Object.entries(groupedShapes)
      .map(([groupName, shapes]) => {
        const shapeList = shapes as DrawElement[];
        return {
          id: `library-${groupName.toLowerCase().replace(/\s+/g, '-')}`,
          name: groupName,
          description: `${groupName} shapes and elements`,
          category: groupToCategoryMap[groupName] || 'other',
          shapes: shapeList,
          tags: [groupName.toLowerCase(), ...shapeList.map((s: DrawElement) => (s.type || '').toLowerCase()).filter(Boolean)],
          isDefault: true,
          createdAt: new Date(),
          modifiedAt: new Date(),
          visible: true,
        };
      });

    logger.info('ShapeLibraryProvider', 'Loaded libraries from toolboxConfig.json', {
      libraryCount: defaultLibraries.length,
      totalShapes: defaultLibraries.reduce((sum, lib) => sum + lib.shapes.length, 0),
    });

    setLibraries(defaultLibraries);
    if (defaultLibraries.length > 0) {
      // Prioritize railway-related libraries
      const railwayLibs = defaultLibraries.filter(lib => lib.category === 'railway' || lib.category === 'signaling');
      setSelectedLibraryId(railwayLibs[0]?.id || defaultLibraries[0].id);
    }
  }, []);

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
            const shapeTags = lib.tags.join(' ').toLowerCase();
            const shapeInfo = `${shape.id} ${shape.type} ${shape.name || ''} ${shapeTags}`.toLowerCase();
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
          shapes: library.shapes.filter(shape => shape.id !== shapeId),
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
   * Save libraries (placeholder - can implement with localStorage or API)
   */
  const saveLibraries = useCallback(async () => {
    logger.info('ShapeLibraryProvider', 'Saving libraries');
  }, []);

  /**
   * Load libraries (placeholder - can implement with localStorage or API)
   */
  const loadLibraries = useCallback(async () => {
    logger.info('ShapeLibraryProvider', 'Loading libraries');
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
 * @brief Hook to use the shape library context
 */
export const useShapeLibrary = (): ShapeLibraryContextType => {
  const context = React.useContext(ShapeLibraryContext);
  if (!context) {
    throw new Error('useShapeLibrary must be used within ShapeLibraryProvider');
  }
  return context;
};
