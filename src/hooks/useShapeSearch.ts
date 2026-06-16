/**
 * @file useShapeSearch.ts
 * @brief Hook for searching and filtering shapes across libraries
 *
 * Provides advanced shape search with:
 * - Full-text search
 * - Category filtering
 * - Tag filtering
 * - Recent shapes tracking
 * - Keyboard shortcuts for quick access
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrawElement } from '../components/Elements';
import { useShapeLibrary } from '../contexts/ShapeLibraryContext';
import { logger } from '../utils/logger';

/**
 * @interface ShapeSearchResult
 * @brief Result of a shape search
 */
export interface ShapeSearchResult {
  shape: DrawElement;
  libraryId: string;
  libraryName: string;
  matchScore: number; // 0-100, higher = better match
  matchedFields: string[]; // Which fields matched (id, type, tags)
}

/**
 * @interface UseShapeSearchOptions
 * @brief Options for shape search hook
 */
export interface UseShapeSearchOptions {
  debounceMs?: number; // Default: 300
  maxResults?: number; // Default: 50
  trackRecent?: boolean; // Default: true
  maxRecent?: number; // Default: 10
}

/**
 * @hook useShapeSearch
 * @brief Hook for searching and filtering shapes
 *
 * Features:
 * - Full-text search across all shapes
 * - Category and tag filtering
 * - Recent shapes tracking
 * - Debounced search for performance
 * - Relevance scoring
 */
export const useShapeSearch = (options: UseShapeSearchOptions = {}) => {
  const {
    debounceMs = 300,
    maxResults = 50,
    trackRecent = true,
    maxRecent = 10,
  } = options;

  const { libraries } = useShapeLibrary();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [results, setResults] = useState<ShapeSearchResult[]>([]);
  const [recentShapes, setRecentShapes] = useState<ShapeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load recent shapes from localStorage
   */
  useEffect(() => {
    if (!trackRecent) return;

    try {
      const saved = localStorage.getItem('railway-drawer-recent-shapes');
      if (saved) {
        setRecentShapes(JSON.parse(saved));
      }
    } catch (error) {
      logger.warn('useShapeSearch', 'Failed to load recent shapes', { error });
    }
  }, [trackRecent]);

  /**
   * Calculate match score for a shape
   */
  const calculateMatchScore = useCallback(
    (shape: DrawElement, searchQuery: string, library: any): number => {
      if (!searchQuery.trim()) return 0;

      const query = searchQuery.toLowerCase();
      let score = 0;
      const matchedFields: string[] = [];

      // Exact match on ID (highest priority)
      if (shape.id.toLowerCase() === query) {
        score += 100;
        matchedFields.push('id-exact');
        return score;
      }

      // ID contains query
      if (shape.id.toLowerCase().includes(query)) {
        score += 80;
        matchedFields.push('id');
      }

      // Type matches
      if (shape.type?.toLowerCase().includes(query)) {
        score += 60;
        matchedFields.push('type');
      }

      // Library tags match
      if (library.tags) {
        const tagMatches = library.tags.filter((tag: string) =>
          tag.toLowerCase().includes(query)
        );
        if (tagMatches.length > 0) {
          score += 40 + tagMatches.length * 5;
          matchedFields.push('tags');
        }
      }

      // Library name contains query
      if (library.name.toLowerCase().includes(query)) {
        score += 30;
        matchedFields.push('library');
      }

      return score;
    },
    []
  );

  /**
   * Perform shape search
   */
  const performSearch = useCallback(() => {
    setIsSearching(true);

    try {
      const trimmedQuery = query.trim();

      // Search across all libraries
      const searchResults: ShapeSearchResult[] = [];

      libraries.forEach(library => {
        // Filter by category if specified
        if (category && library.category !== category) return;

        library.shapes.forEach(shape => {
          // Filter by tags if specified
          if (selectedTags.length > 0) {
            const hasMatchingTag = selectedTags.some(tag =>
              library.tags.some((libTag: string) =>
                libTag.toLowerCase().includes(tag.toLowerCase())
              )
            );
            if (!hasMatchingTag) return;
          }

          // Calculate match score
          const matchScore = calculateMatchScore(shape, trimmedQuery, library);

          // Include if there's a match, or if no query filter (show all by default)
          if (trimmedQuery === '' || matchScore > 0) {
            searchResults.push({
              shape,
              libraryId: library.id,
              libraryName: library.name,
              matchScore: trimmedQuery === '' ? 0 : matchScore,
              matchedFields: [],
            });
          }
        });
      });

      // Sort by relevance (higher score first)
      searchResults.sort((a, b) => b.matchScore - a.matchScore);

      // Limit results
      setResults(searchResults.slice(0, maxResults));
    } catch (error) {
      logger.error('useShapeSearch', 'Search error', { error });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, category, selectedTags, libraries, calculateMatchScore, maxResults]);

  /**
   * Debounced search
   */
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, category, selectedTags, performSearch, debounceMs]);

  /**
   * Record shape usage (for recent shapes)
   */
  const recordShapeUsage = useCallback(
    (result: ShapeSearchResult) => {
      if (!trackRecent) return;

      logger.debug('useShapeSearch', 'Recording shape usage', {
        shapeId: result.shape.id,
      });

      setRecentShapes(prev => {
        // Remove if already exists
        const filtered = prev.filter(r => r.shape.id !== result.shape.id);
        // Add to front
        const updated = [result, ...filtered].slice(0, maxRecent);
        // Save to localStorage
        try {
          localStorage.setItem('railway-drawer-recent-shapes', JSON.stringify(updated));
        } catch (error) {
          logger.warn('useShapeSearch', 'Failed to save recent shapes', { error });
        }
        return updated;
      });
    },
    [trackRecent, maxRecent]
  );

  /**
   * Clear search
   */
  const clearSearch = useCallback(() => {
    setQuery('');
    setCategory(null);
    setSelectedTags([]);
    setResults([]);
  }, []);

  /**
   * Clear recent shapes
   */
  const clearRecentShapes = useCallback(() => {
    setRecentShapes([]);
    try {
      localStorage.removeItem('railway-drawer-recent-shapes');
    } catch (error) {
      logger.warn('useShapeSearch', 'Failed to clear recent shapes', { error });
    }
  }, []);

  /**
   * Get unique categories from libraries
   */
  const getCategories = useCallback((): string[] => {
    return Array.from(new Set(libraries.map(lib => lib.category)));
  }, [libraries]);

  /**
   * Get unique tags from libraries
   */
  const getTags = useCallback((): string[] => {
    const allTags = new Set<string>();
    libraries.forEach(lib => {
      lib.tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }, [libraries]);

  return {
    // Search state
    query,
    category,
    selectedTags,
    results,
    isSearching,
    recentShapes,

    // Search actions
    setQuery,
    setCategory,
    setSelectedTags: (tags: string[]) => setSelectedTags(tags),
    addTag: (tag: string) => setSelectedTags(prev => [...new Set([...prev, tag])]),
    removeTag: (tag: string) => setSelectedTags(prev => prev.filter(t => t !== tag)),
    toggleTag: (tag: string) =>
      setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      ),

    // Utilities
    recordShapeUsage,
    clearSearch,
    clearRecentShapes,
    getCategories,
    getTags,

    // Quick access
    getRecentShapes: () => recentShapes,
    getFirstResult: () => results[0] || null,
    getResultCount: () => results.length,
  };
};
