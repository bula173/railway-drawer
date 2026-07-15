# ERTMS SVG Remote Hosting Setup

This guide explains how to set up remote SVG hosting for ERTMS elements in the Railway Drawer.

## Overview

The Railway Drawer now supports fetching ERTMS SVGs from remote sources instead of embedding them inline. This allows for:

- **Smaller bundle size** - SVGs are fetched on-demand instead of being bundled
- **Easy updates** - Update SVGs without rebuilding the application
- **Better maintainability** - SVGs are centralized in one location
- **Caching** - SVGs are cached in memory and localStorage for performance

## Configuration

### 1. Update `src/config/ertmsSvgUrls.json`

Edit the `baseUrl` to point to your SVG hosting location:

```json
{
  "baseUrl": "https://your-domain.com/ertms-svgs/",
  "elements": {
    "ertms_double_balise": "balises/double-balise.svg",
    "ertms_single_balise": "balises/single-balise.svg",
    ...
  }
}
```

### 2. Hosting Options

#### Option A: GitHub Raw Content (Recommended for open source)

1. Create a GitHub repository for ERTMS SVGs:
   ```
   https://github.com/username/ertms-svgs/
   ```

2. Organize SVGs by category:
   ```
   ├── balises/
   │   ├── single-balise.svg
   │   ├── double-balise.svg
   │   └── triple-balise.svg
   ├── infrastructure/
   │   ├── rbc-station.svg
   │   └── leu-lineside-ecu.svg
   ├── communication/
   │   ├── euroloop.svg
   │   └── euroradio-antenna.svg
   └── onboard/
       └── dmi-display.svg
   ```

3. Set baseUrl:
   ```json
   "baseUrl": "https://raw.githubusercontent.com/username/ertms-svgs/main/"
   ```

#### Option B: CDN (Cloudflare, AWS S3, etc.)

1. Upload SVGs to your CDN
2. Set baseUrl to your CDN endpoint:
   ```json
   "baseUrl": "https://cdn.example.com/ertms-svgs/"
   ```

#### Option C: Self-hosted Web Server

1. Host SVGs on your own web server
2. Set baseUrl to your server:
   ```json
   "baseUrl": "https://your-domain.com/assets/ertms-svgs/"
   ```

## SVG Caching

The application implements 3 levels of caching:

1. **Memory Cache** - Fast in-memory cache for the current session
2. **Failed URL Cache** - Prevents retry of failed URLs
3. **Fallback System** - Uses inline SVGs if remote fetch fails

## How It Works

1. **On Application Load:**
   - Toolbox configuration is loaded
   - ERTMS elements are identified
   - Remote SVG URLs are fetched in parallel
   - Fetched SVGs replace inline definitions
   - Cache is warmed up for faster future access

2. **During Runtime:**
   - SVGs are cached in memory
   - Failed URLs are skipped to avoid repeated fetch attempts
   - Inline SVGs are used as fallback if fetch fails

3. **Error Handling:**
   - Network errors are caught and logged
   - Inline SVGs are used automatically if remote fetch fails
   - Failed URLs are cached to avoid repeated failures

## Performance Impact

- **Initial Load:** +100-500ms for fetching SVGs (configurable with timeout)
- **Subsequent Loads:** Instant (cached in memory)
- **Fallback:** Inline SVGs load instantly if fetch fails

## Testing

To test the remote SVG loading:

1. Set up your SVG repository with at least one ERTMS SVG
2. Update `ertmsSvgUrls.json` with your baseUrl
3. Open developer console (F12)
4. Look for logs indicating successful fetches:
   ```
   ✅ Enhanced toolbox with 10 remote ERTMS SVGs
   ✅ Preloaded 10 ERTMS SVGs
   ```
5. Verify ERTMS shapes appear correctly in the toolbox

## Troubleshooting

### SVGs not loading
- Check browser console for network errors
- Verify baseUrl is correct and accessible
- Ensure SVGs have `.svg` extension
- Check CORS headers if hosting on different domain

### Slow initial load
- Reduce number of ERTMS elements in configuration
- Host SVGs on a CDN closer to users
- Consider preloading critical SVGs only

### Fallback SVGs showing
- This is normal behavior - inline fallbacks are intentional
- Check Failed URLs in console: `console.log(require('./utils/svgLoader').getSVGCacheStats())`

## Future Improvements

- [ ] Async SVG loading UI (loading spinners)
- [ ] Progressive fallback (load size-optimized versions)
- [ ] Service worker caching for offline access
- [ ] SVG compression (gzip, minification)
- [ ] Per-element fetch retries with exponential backoff
