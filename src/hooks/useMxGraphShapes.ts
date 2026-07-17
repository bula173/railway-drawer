/**
 * @file useMxGraphShapes.ts
 * @brief Hook for managing mxGraph shape library
 *
 * Handles loading and managing shapes for mxGraph editor
 */

import { useEffect, useState, useCallback } from 'react';
import { logger } from '../utils/logger';
import {
  loadDrawioShapes,
  shapesToToolboxItems,
  initializeShapeLibrary,
} from '../utils/shapeLibraryMxGraph';
import type { ToolboxItem } from '../components/Toolbox';

export interface UseMxGraphShapesResult {
  shapes: ToolboxItem[];
  isLoading: boolean;
  error: string | null;
  loadShapes: (category: string) => Promise<void>;
  addCustomShape: (shape: ToolboxItem) => void;
  clearShapes: () => void;
}

/**
 * Hook for managing mxGraph shapes
 */
export function useMxGraphShapes(): UseMxGraphShapesResult {
  const [shapes, setShapes] = useState<ToolboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with basic shapes
  useEffect(() => {
    const loadInitialShapes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load general shapes from draw.io
        const generalShapes = await loadDrawioShapes('general');
        const toolboxItems = shapesToToolboxItems(generalShapes, 'General');

        setShapes(toolboxItems);
        logger.debug('useMxGraphShapes', 'Initial shapes loaded', {
          count: toolboxItems.length,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load shapes';
        setError(errorMsg);
        logger.error('useMxGraphShapes', 'Failed to load initial shapes', { error: err });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialShapes();
  }, []);

  const loadShapes = useCallback(
    async (category: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const drawioShapes = await loadDrawioShapes(
          category as keyof typeof import('../utils/shapeLibraryMxGraph').DRAIO_SHAPE_SOURCES
        );
        const toolboxItems = shapesToToolboxItems(drawioShapes, category);

        setShapes(prev => [...prev, ...toolboxItems]);
        logger.debug('useMxGraphShapes', 'Additional shapes loaded', {
          category,
          count: toolboxItems.length,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : `Failed to load ${category} shapes`;
        setError(errorMsg);
        logger.error('useMxGraphShapes', 'Failed to load shapes', { category, error: err });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const addCustomShape = useCallback((shape: ToolboxItem) => {
    setShapes(prev => [...prev, shape]);
    logger.debug('useMxGraphShapes', 'Custom shape added', {
      shapeId: shape.id,
      shapeName: shape.name,
    });
  }, []);

  const clearShapes = useCallback(() => {
    setShapes([]);
    setError(null);
  }, []);

  return {
    shapes,
    isLoading,
    error,
    loadShapes,
    addCustomShape,
    clearShapes,
  };
}
