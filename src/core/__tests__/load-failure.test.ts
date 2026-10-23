import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../drawio/logger';
import { isAbortError, isPageUnloading, reportLoadFailure, resetPageUnloadForTests } from '../load-failure';

describe('load-failure', () => {
  afterEach(() => {
    resetPageUnloadForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports a real network failure at the requested level', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const debug = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    expect(reportLoadFailure('error', 'drawio-palette', 'Palette ertms failed to load', new TypeError('Failed to fetch'))).toBe(true);
    expect(error).toHaveBeenCalledWith('drawio-palette', 'Palette ertms failed to load', { error: 'Failed to fetch' });
    expect(debug).not.toHaveBeenCalled();
  });

  it('logs at debug only after pagehide, until pageshow restores the page', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const debug = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    window.dispatchEvent(new Event('pagehide'));
    expect(isPageUnloading()).toBe(true);
    expect(reportLoadFailure('error', 'templates', 'ERTMS templates failed to load', new TypeError('Failed to fetch'))).toBe(false);
    expect(reportLoadFailure('warn', 'stencils', 'Stencil set failed to load', new TypeError('Failed to fetch'), { url: 'x' })).toBe(false);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('pageshow'));
    expect(isPageUnloading()).toBe(false);
  });

  it('treats beforeunload as unloading only for a short window (the navigation may be cancelled)', () => {
    vi.useFakeTimers();
    window.dispatchEvent(new Event('beforeunload'));
    expect(isPageUnloading()).toBe(true);
    vi.advanceTimersByTime(6000);
    expect(isPageUnloading()).toBe(false);
  });

  it('never reports an AbortError', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    expect(isAbortError(abort)).toBe(true);
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(reportLoadFailure('error', 'x', 'failed', abort)).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });
});
