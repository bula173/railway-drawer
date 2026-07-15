/**
 * @file svgLoader.ts
 * @brief Utility for fetching and caching SVG content from remote sources
 */

// Cache for fetched SVGs (memory cache)
const svgCache = new Map<string, string>();

// Cache for failed URLs to avoid repeated fetch attempts
const failedUrls = new Set<string>();

/**
 * Fetch SVG from remote URL or decode data URI with caching
 * @param url Remote URL or data URI to fetch/decode
 * @param fallbackSvg Fallback SVG content if fetch fails
 * @returns Promise resolving to SVG content
 */
export async function fetchSVG(url: string, fallbackSvg?: string): Promise<string> {
  // Check memory cache first
  if (svgCache.has(url)) {
    return svgCache.get(url)!;
  }

  // Don't retry failed URLs
  if (failedUrls.has(url)) {
    return fallbackSvg || '';
  }

  try {
    // Handle data URIs (embedded SVGs)
    if (url.startsWith('data:image/svg+xml;base64,')) {
      const base64Data = url.replace('data:image/svg+xml;base64,', '');
      const content = atob(base64Data);
      svgCache.set(url, content);
      return content;
    }

    // Handle HTTP URLs
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/svg+xml',
      },
      timeout: 5000, // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();

    // Validate it's actual SVG content
    if (!content.includes('<svg')) {
      throw new Error('Response is not valid SVG content');
    }

    // Cache the result
    svgCache.set(url, content);
    return content;
  } catch (error) {
    console.warn(`Failed to fetch SVG from ${url}:`, error);
    failedUrls.add(url);
    return fallbackSvg || '';
  }
}

/**
 * Load SVG from URL, data URI, or inline content
 * @param urlOrSvg URL, data URI, or inline SVG string
 * @param fallbackSvg Fallback SVG if loading fails
 * @returns Promise resolving to SVG content
 */
export async function loadSVG(urlOrSvg: string, fallbackSvg?: string): Promise<string> {
  // If it's already SVG content (starts with <), return as-is
  if (urlOrSvg.startsWith('<svg')) {
    return urlOrSvg;
  }

  // If it's a data URI, fetch/decode it
  if (urlOrSvg.startsWith('data:')) {
    return fetchSVG(urlOrSvg, fallbackSvg);
  }

  // If it's a HTTP URL, fetch it
  if (urlOrSvg.startsWith('http')) {
    return fetchSVG(urlOrSvg, fallbackSvg);
  }

  // Default to fallback
  return fallbackSvg || urlOrSvg;
}

/**
 * Preload multiple SVGs in parallel
 * @param urls Array of URLs to preload
 */
export async function preloadSVGs(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(url => fetchSVG(url).catch(() => null))
  );
}

/**
 * Clear the SVG cache
 */
export function clearSVGCache(): void {
  svgCache.clear();
  failedUrls.clear();
}

/**
 * Get cache statistics
 */
export function getSVGCacheStats(): { cached: number; failed: number } {
  return {
    cached: svgCache.size,
    failed: failedUrls.size,
  };
}
