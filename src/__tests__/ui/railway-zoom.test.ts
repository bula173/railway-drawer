/** railway-zoom.ts: the zoom a railway drawing opens at (150-200 % for small / medium drawings, fit for large). */
import { describe, expect, it } from 'vitest';
import { LARGE_FIT, RAILWAY_MAX_ZOOM, RAILWAY_MIN_ZOOM, railwayOpenZoom } from '../../ui/railway-zoom';

describe('railwayOpenZoom', () => {
  it('clamps small and medium drawings to 150-200 %', () => {
    expect(railwayOpenZoom(5)).toBe(RAILWAY_MAX_ZOOM);
    expect(railwayOpenZoom(1.8)).toBe(1.8);
    expect(railwayOpenZoom(1)).toBe(RAILWAY_MIN_ZOOM);
    expect(railwayOpenZoom(LARGE_FIT)).toBe(RAILWAY_MIN_ZOOM);
  });
  it('large drawings get the plain fit (an overview), never above 100 %', () => {
    expect(railwayOpenZoom(0.5)).toBe(0.5);
    expect(railwayOpenZoom(0)).toBe(1);
    expect(railwayOpenZoom(Number.NaN)).toBe(1);
  });
});
