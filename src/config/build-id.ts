/**
 * @file build-id.ts
 * @brief Build identifier and timestamp for the current version
 * @details
 * Provides build ID (git commit hash) and build timestamp.
 * Defaults to 'dev' if git unavailable.
 */

export const BUILD_ID = (import.meta.env.VITE_BUILD_ID as string | undefined) || 'dev';

const buildTimeRaw = (import.meta.env.VITE_BUILD_TIME as string | undefined) || new Date().toISOString();

/**
 * @brief Format build timestamp as local date and time
 * @details Converts ISO timestamp to readable local format: "2026-07-22 14:30:45"
 */
export const BUILD_TIME = (() => {
  try {
    const date = new Date(buildTimeRaw);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return '-';
  }
})();
