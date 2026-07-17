/**
 * @file toolboxEnhancer.ts
 * @brief Toolbox enhancement utilities
 *
 * Provides utilities for enhancing toolbox items with SVGs
 */

import { loadSVG } from './svgLoader';
import type { ToolboxItem } from '../components/Toolbox';

/**
 * Map of ERTMS element IDs to their SVG URLs
 * Can be extended with external URLs for remote SVG hosting
 */
const ERTMS_SVG_URLS: Record<string, string> = {
  // Extended ERTMS elements would go here
  // Example: 'ertms_signal_head': 'https://example.com/svgs/signal-head.svg'
};

/**
 * Get the full URL for an ERTMS element SVG
 */
function getErtmsSvgUrl(elementId: string): string | null {
  return ERTMS_SVG_URLS[elementId] || null;
}

/**
 * Check if an element is an ERTMS element
 */
function isErtmsElement(elementId: string): boolean {
  return elementId.startsWith('ertms_');
}

/**
 * Enhance toolbox items by fetching ERTMS SVGs
 */
export async function enhanceToolboxWithRemoteSvgs(
  toolbox: ToolboxItem[]
): Promise<ToolboxItem[]> {
  const enhanced = [...toolbox];

  // Fetch ERTMS SVGs in parallel
  const fetchPromises = enhanced.map(async (item) => {
    if (!isErtmsElement(item.id)) {
      return item; // Not an ERTMS element, skip
    }

    const svgUrl = getErtmsSvgUrl(item.id);
    if (!svgUrl) {
      console.warn(`No remote SVG configured for ERTMS element: ${item.id}`);
      return item; // No URL configured, use fallback
    }

    try {
      // Get fallback SVG from existing item
      const fallbackSvg = item.shape ||
                         (item.shapeElements?.[0]?.svg) ||
                         item.iconSvg;

      // Load SVG from URL with fallback
      const svgContent = await loadSVG(svgUrl, fallbackSvg);

      // Update the item with fetched SVG
      return {
        ...item,
        shape: svgContent,
        iconSvg: svgContent.length > 1000 ? 'default' : svgContent, // Use default icon if SVG is large
      };
    } catch (error) {
      console.error(`Failed to enhance ERTMS element ${item.id}:`, error);
      return item; // Return original on error
    }
  });

  const results = await Promise.all(fetchPromises);

  console.log(`✅ Enhanced toolbox with ${results.filter(r => r !== toolbox).length} remote ERTMS SVGs`);

  return results;
}

/**
 * Preload ERTMS SVGs without modifying toolbox
 * Useful for warming up the cache
 */
export async function preloadErtmsSvgs(): Promise<void> {
  const config = ertmsSvgUrls as any;
  const urls = Object.values(config.elements || {}).map(
    (path: string) => `${config.baseUrl}${path}`
  );

  console.log(`⏳ Preloading ${urls.length} ERTMS SVGs...`);

  try {
    const { preloadSVGs } = await import('./svgLoader');
    await preloadSVGs(urls);
    console.log(`✅ Preloaded ${urls.length} ERTMS SVGs`);
  } catch (error) {
    console.warn('Failed to preload ERTMS SVGs:', error);
  }
}
