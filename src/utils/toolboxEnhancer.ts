/**
 * @file toolboxEnhancer.ts
 * @brief Enhances toolbox with remotely-fetched SVGs for ERTMS elements
 */

import { loadSVG } from './svgLoader';
import ertmsSvgUrls from '../config/ertmsSvgUrls.json';
import type { ToolboxItem } from '../components/Toolbox';

/**
 * Get the full URL for an ERTMS element SVG
 */
function getErtmsSvgUrl(elementId: string): string | null {
  const config = ertmsSvgUrls as any;
  const path = config.elements?.[elementId];

  if (!path) return null;

  return `${config.baseUrl}${path}`;
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
