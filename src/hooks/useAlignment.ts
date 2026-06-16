/**
 * @file useAlignment.ts
 * @brief Hook for element alignment and distribution
 *
 * Provides alignment operations:
 * - Align left, right, center
 * - Align top, bottom, middle
 * - Distribute evenly
 * - Smart guide detection and snapping
 */

import { useCallback, useState } from 'react';
import type { DrawElement } from '../components/Elements';
import {
  alignLeft,
  alignRight,
  alignCenterH,
  alignTop,
  alignBottom,
  alignMiddleV,
  distributeHorizontal,
  distributeVertical,
  detectSmartGuides,
  snapToGuide,
  getGroupBounds,
  type SmartGuide,
  type AlignmentResult,
} from '../utils/alignmentUtils';
import { logger } from '../utils/logger';

/**
 * @interface UseAlignmentOptions
 * @brief Options for alignment hook
 */
export interface UseAlignmentOptions {
  showSmartGuides?: boolean;
  snapDistance?: number;
  guideThreshold?: number;
}

/**
 * @hook useAlignment
 * @brief Hook for aligning and distributing elements
 */
export const useAlignment = (options: UseAlignmentOptions = {}) => {
  const {
    showSmartGuides = true,
    snapDistance = 10,
    guideThreshold = 5,
  } = options;

  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);
  const [alignmentMode, setAlignmentMode] = useState<string | null>(null);

  /**
   * Perform alignment operation
   */
  const performAlignment = useCallback(
    (
      elements: DrawElement[],
      operation: 'left' | 'right' | 'centerH' | 'top' | 'bottom' | 'middleV' | 'distributeH' | 'distributeV'
    ): AlignmentResult => {
      if (elements.length < 2) {
        return {
          alignedElements: elements,
          alignmentType: operation,
          boundsChanged: false,
        };
      }

      logger.info('useAlignment', 'Performing alignment', { operation, count: elements.length });

      const operationMap = {
        left: alignLeft,
        right: alignRight,
        centerH: alignCenterH,
        top: alignTop,
        bottom: alignBottom,
        middleV: alignMiddleV,
        distributeH: distributeHorizontal,
        distributeV: distributeVertical,
      };

      return operationMap[operation](elements);
    },
    []
  );

  /**
   * Align selected elements left
   */
  const doAlignLeft = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'left'),
    [performAlignment]
  );

  /**
   * Align selected elements right
   */
  const doAlignRight = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'right'),
    [performAlignment]
  );

  /**
   * Align selected elements center horizontally
   */
  const doAlignCenterH = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'centerH'),
    [performAlignment]
  );

  /**
   * Align selected elements top
   */
  const doAlignTop = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'top'),
    [performAlignment]
  );

  /**
   * Align selected elements bottom
   */
  const doAlignBottom = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'bottom'),
    [performAlignment]
  );

  /**
   * Align selected elements middle vertically
   */
  const doAlignMiddleV = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'middleV'),
    [performAlignment]
  );

  /**
   * Distribute selected elements horizontally
   */
  const doDistributeH = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'distributeH'),
    [performAlignment]
  );

  /**
   * Distribute selected elements vertically
   */
  const doDistributeV = useCallback(
    (elements: DrawElement[]) => performAlignment(elements, 'distributeV'),
    [performAlignment]
  );

  /**
   * Detect smart guides for selected elements
   */
  const detectGuides = useCallback(
    (elements: DrawElement[]) => {
      if (!showSmartGuides) return [];

      const guides = detectSmartGuides(elements, guideThreshold);
      setSmartGuides(guides);
      logger.debug('useAlignment', 'Guides detected', { count: guides.length });

      return guides;
    },
    [showSmartGuides, guideThreshold]
  );

  /**
   * Snap element to nearest guide
   */
  const snapElement = useCallback(
    (element: DrawElement): DrawElement => {
      return snapToGuide(element, smartGuides, snapDistance);
    },
    [smartGuides, snapDistance]
  );

  /**
   * Get alignment information for elements
   */
  const getAlignmentInfo = useCallback((elements: DrawElement[]) => {
    if (elements.length === 0) return null;

    const bounds = getGroupBounds(elements);

    return {
      bounds,
      elementCount: elements.length,
      totalWidth: bounds.width,
      totalHeight: bounds.height,
      canAlignH: elements.length > 1,
      canAlignV: elements.length > 1,
      canDistribute: elements.length > 2,
    };
  }, []);

  /**
   * Get available alignment operations
   */
  const getAvailableOperations = useCallback((elementCount: number) => {
    return {
      alignments: elementCount > 1 ? [
        'left', 'right', 'centerH', 'top', 'bottom', 'middleV'
      ] : [],
      distributions: elementCount > 2 ? [
        'distributeH', 'distributeV'
      ] : [],
    };
  }, []);

  /**
   * Clear smart guides
   */
  const clearGuides = useCallback(() => {
    setSmartGuides([]);
  }, []);

  /**
   * Set alignment mode (for UI feedback)
   */
  const setMode = useCallback((mode: string | null) => {
    setAlignmentMode(mode);
  }, []);

  return {
    // State
    smartGuides,
    alignmentMode,

    // Alignment operations
    doAlignLeft,
    doAlignRight,
    doAlignCenterH,
    doAlignTop,
    doAlignBottom,
    doAlignMiddleV,

    // Distribution operations
    doDistributeH,
    doDistributeV,

    // Smart guides
    detectGuides,
    snapElement,
    clearGuides,

    // Queries
    getAlignmentInfo,
    getAvailableOperations,

    // State management
    setMode,
  };
};
