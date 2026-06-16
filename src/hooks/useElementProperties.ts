/**
 * @file useElementProperties.ts
 * @brief Hook for managing element properties and metadata
 *
 * Features:
 * - Custom property management
 * - Railway standard properties
 * - Validation and compliance checking
 * - Property persistence
 */

import { useCallback, useState } from 'react';
import type { DrawElement } from '../components/Elements';
import { logger } from '../utils/logger';

/**
 * @interface ElementProperty
 * @brief A property descriptor for an element
 */
export interface ElementProperty {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  value: any;
  required?: boolean;
  options?: Array<{ label: string; value: any }>;
  validation?: (value: any) => { valid: boolean; error?: string };
  metadata?: string;
}

/**
 * @interface ElementMetadata
 * @brief Metadata for railway elements
 */
export interface ElementMetadata {
  // Track properties
  gauge?: number;
  trackNumber?: string;
  speedLimit?: number;
  isElectrified?: boolean;

  // Signal properties
  signalType?: 'main' | 'distant' | 'repeater' | 'shunting';
  aspects?: 2 | 3 | 4;
  hasERTMS?: boolean;

  // Station/Platform properties
  platformName?: string;
  platformLength?: number;
  platformHeight?: number;

  // General
  owner?: string;
  notes?: string;
  tags?: string[];
  lastModified?: Date;
}

/**
 * @hook useElementProperties
 * @brief Hook for element property management
 */
export const useElementProperties = () => {
  const [properties, setProperties] = useState<Map<string, ElementProperty[]>>(new Map());
  const [validationErrors, setValidationErrors] = useState<Map<string, string[]>>(new Map());

  /**
   * Get properties for an element
   */
  const getElementProperties = useCallback(
    (elementId: string, elementType: string): ElementProperty[] => {
      if (properties.has(elementId)) {
        return properties.get(elementId)!;
      }

      // Generate default properties based on type
      return getDefaultProperties(elementType);
    },
    [properties]
  );

  /**
   * Get default properties for element type
   */
  const getDefaultProperties = (elementType: string): ElementProperty[] => {
    const defaults: Record<string, ElementProperty[]> = {
      'track': [
        {
          key: 'gauge',
          label: 'Gauge (mm)',
          type: 'number',
          value: 1435,
          validation: (v) => ({ valid: v > 0 && v < 2500, error: 'Invalid gauge' }),
        },
        {
          key: 'trackNumber',
          label: 'Track Number',
          type: 'text',
          value: '',
          metadata: 'e.g., "1", "2A", "Sidings"',
        },
        {
          key: 'speedLimit',
          label: 'Speed Limit (km/h)',
          type: 'number',
          value: 160,
          validation: (v) => ({ valid: v > 0 && v <= 320, error: 'Invalid speed' }),
        },
        {
          key: 'isElectrified',
          label: 'Electrified',
          type: 'boolean',
          value: false,
        },
      ],
      'signal': [
        {
          key: 'signalType',
          label: 'Signal Type',
          type: 'select',
          value: 'main',
          options: [
            { label: 'Main', value: 'main' },
            { label: 'Distant', value: 'distant' },
            { label: 'Repeater', value: 'repeater' },
            { label: 'Shunting', value: 'shunting' },
          ],
        },
        {
          key: 'aspects',
          label: 'Aspects',
          type: 'select',
          value: 3,
          options: [
            { label: '2-Aspect', value: 2 },
            { label: '3-Aspect', value: 3 },
            { label: '4-Aspect', value: 4 },
          ],
        },
        {
          key: 'hasERTMS',
          label: 'ERTMS Equipped',
          type: 'boolean',
          value: false,
        },
      ],
      'platform': [
        {
          key: 'platformName',
          label: 'Platform Name',
          type: 'text',
          value: '',
        },
        {
          key: 'platformLength',
          label: 'Length (m)',
          type: 'number',
          value: 400,
          validation: (v) => ({ valid: v > 0 && v < 1000, error: 'Invalid length' }),
        },
        {
          key: 'platformHeight',
          label: 'Height (mm)',
          type: 'number',
          value: 550,
          validation: (v) => ({ valid: v > 0 && v < 1000, error: 'Invalid height' }),
        },
      ],
    };

    return defaults[elementType] || [];
  };

  /**
   * Set property value
   */
  const setPropertyValue = useCallback(
    (elementId: string, propertyKey: string, value: any): boolean => {
      const current = properties.get(elementId) || getDefaultProperties('generic');
      const prop = current.find(p => p.key === propertyKey);

      if (!prop) return false;

      // Validate
      if (prop.validation) {
        const validation = prop.validation(value);
        if (!validation.valid) {
          const errors = validationErrors.get(elementId) || [];
          errors.push(validation.error || 'Validation failed');
          setValidationErrors(new Map(validationErrors).set(elementId, errors));
          return false;
        }
      }

      // Update
      const updated = current.map(p =>
        p.key === propertyKey ? { ...p, value } : p
      );

      const newProperties = new Map(properties);
      newProperties.set(elementId, updated);
      setProperties(newProperties);

      // Clear errors for this property
      const errors = validationErrors.get(elementId) || [];
      const filtered = errors.filter(e => !e.includes(propertyKey));
      if (filtered.length === 0) {
        const newErrors = new Map(validationErrors);
        newErrors.delete(elementId);
        setValidationErrors(newErrors);
      }

      logger.debug('useElementProperties', 'Property updated', { elementId, propertyKey, value });
      return true;
    },
    [properties, validationErrors]
  );

  /**
   * Get validation errors
   */
  const getErrors = useCallback(
    (elementId: string): string[] => {
      return validationErrors.get(elementId) || [];
    },
    [validationErrors]
  );

  /**
   * Check if element is valid
   */
  const isElementValid = useCallback(
    (elementId: string): boolean => {
      const errors = getErrors(elementId);
      return errors.length === 0;
    },
    [getErrors]
  );

  /**
   * Export element with properties
   */
  const exportElement = useCallback(
    (element: DrawElement): DrawElement & { metadata?: ElementMetadata } => {
      const props = properties.get(element.id);
      if (!props) return element;

      const metadata: ElementMetadata = {};
      props.forEach(prop => {
        (metadata as any)[prop.key] = prop.value;
      });

      return { ...element, metadata };
    },
    [properties]
  );

  /**
   * Get property statistics
   */
  const getStatistics = useCallback(() => {
    return {
      elementsWithProperties: properties.size,
      totalProperties: Array.from(properties.values()).reduce((sum, props) => sum + props.length, 0),
      elementsWithErrors: validationErrors.size,
      totalErrors: Array.from(validationErrors.values()).reduce((sum, errors) => sum + errors.length, 0),
    };
  }, [properties, validationErrors]);

  return {
    // State
    properties,
    validationErrors,

    // Operations
    getElementProperties,
    setPropertyValue,
    exportElement,

    // Queries
    getErrors,
    isElementValid,
    getStatistics,
  };
};
