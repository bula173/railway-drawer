/**
 * @file useCustomShapeLibrary.ts
 * @brief Hook for managing custom shapes library integration
 *
 * Loads custom shapes and integrates them with toolbox
 */

import { useEffect, useState, useCallback } from 'react';
import { shapeLibraryManager } from '../utils/shapeLibraryManager';
import { generateToolboxItem } from '../utils/shapeComposerSvgGenerator';
import { logger } from '../utils/logger';
import type { ComposedShape } from '../types';
import type { ToolboxItem } from '../components/Toolbox';

/**
 * Hook for loading and managing custom shapes
 */
export function useCustomShapeLibrary() {
  const [customShapes, setCustomShapes] = useState<ComposedShape[]>([]);
  const [customToolboxItems, setCustomToolboxItems] = useState<ToolboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load shapes from library
  useEffect(() => {
    try {
      const shapes = shapeLibraryManager.getAllShapes();
      setCustomShapes(shapes);

      // Convert to toolbox items
      const items = shapes.map(shape => generateToolboxItem(shape));
      setCustomToolboxItems(items);

      logger.debug('useCustomShapeLibrary', 'Loaded custom shapes', {
        count: shapes.length,
      });
    } catch (error) {
      logger.error('useCustomShapeLibrary', 'Failed to load custom shapes', {
        error,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add new shape to library
  const addShape = useCallback((shape: ComposedShape) => {
    try {
      const saved = shapeLibraryManager.createShape(shape);
      setCustomShapes(prev => [...prev, saved]);

      const item = generateToolboxItem(saved);
      setCustomToolboxItems(prev => [...prev, item]);

      logger.debug('useCustomShapeLibrary', 'Shape added', {
        id: saved.id,
        name: saved.name,
      });

      return saved;
    } catch (error) {
      logger.error('useCustomShapeLibrary', 'Failed to add shape', {
        error,
      });
      throw error;
    }
  }, []);

  // Update shape
  const updateShape = useCallback((id: string, updates: Partial<ComposedShape>) => {
    try {
      const updated = shapeLibraryManager.updateShape(id, updates);
      setCustomShapes(prev =>
        prev.map(s => (s.id === id ? updated : s))
      );

      const item = generateToolboxItem(updated);
      setCustomToolboxItems(prev =>
        prev.map(i => (i.id === `custom_${id}` ? item : i))
      );

      logger.debug('useCustomShapeLibrary', 'Shape updated', {
        id: updated.id,
      });

      return updated;
    } catch (error) {
      logger.error('useCustomShapeLibrary', 'Failed to update shape', {
        error,
      });
      throw error;
    }
  }, []);

  // Delete shape
  const deleteShape = useCallback((id: string) => {
    try {
      shapeLibraryManager.deleteShape(id);
      setCustomShapes(prev => prev.filter(s => s.id !== id));
      setCustomToolboxItems(prev => prev.filter(i => i.id !== `custom_${id}`));

      logger.debug('useCustomShapeLibrary', 'Shape deleted', {
        id,
      });
    } catch (error) {
      logger.error('useCustomShapeLibrary', 'Failed to delete shape', {
        error,
      });
      throw error;
    }
  }, []);

  // Reload from storage
  const reload = useCallback(() => {
    setIsLoading(true);
    try {
      const shapes = shapeLibraryManager.getAllShapes();
      setCustomShapes(shapes);

      const items = shapes.map(shape => generateToolboxItem(shape));
      setCustomToolboxItems(items);

      logger.debug('useCustomShapeLibrary', 'Library reloaded', {
        count: shapes.length,
      });
    } catch (error) {
      logger.error('useCustomShapeLibrary', 'Failed to reload library', {
        error,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    customShapes,
    customToolboxItems,
    isLoading,
    addShape,
    updateShape,
    deleteShape,
    reload,
  };
}
