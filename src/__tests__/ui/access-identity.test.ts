/**
 * Top-bar Cloudflare Access user (ui/access-identity.ts): identity parsing, origin gating,
 * nothing shown on failure, Log out confirm with unsaved remote changes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_IDENTITY_URL,
  ACCESS_LOGOUT_URL,
  createAccessUser,
  fetchAccessIdentity,
  installAccessIdentity,
  isLocalHost,
  parseAccessIdentity,
  shouldQueryAccess,
} from '../../ui/access-identity';

const JSON_TYPE = 'application/json; charset=utf-8';

function response(status: number, body: string, type: string | null = JSON_TYPE): { status: number; headers: Headers; text: () => Promise<string> } {
  const headers = new Headers();
  if (type) headers.set('content-type', type);
  return { status, headers, text: () => Promise.resolve(body) };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('parseAccessIdentity', () => {
  it('reads email (and name) from the identity JSON', () => {
    expect(parseAccessIdentity(200, JSON_TYPE, JSON.stringify({ email: ' ann@example.com ', name: 'Ann', idp: { type: 'onetimepin' } }))).toEqual({ email: 'ann@example.com', name: 'Ann' });
    expect(parseAccessIdentity(200, 'application/json', '{"email":"bob@example.org"}')).toEqual({ email: 'bob@example.org' });
  });

  it('null for error statuses, HTML (SPA fallback), broken JSON and missing / invalid email', () => {
    expect(parseAccessIdentity(404, JSON_TYPE, '{"email":"a@b.c"}')).toBeNull();
    expect(parseAccessIdentity(401, JSON_TYPE, '{"err":"no session"}')).toBeNull();
    expect(parseAccessIdentity(200, 'text/html', '<!doctype html><html></html>')).toBeNull();
    expect(parseAccessIdentity(200, null, '{"email":"a@b.c"}')).toBeNull();
    expect(parseAccessIdentity(200, JSON_TYPE, '{"email":')).toBeNull();
    expect(parseAccessIdentity(200, JSON_TYPE, '{"err":"x"}')).toBeNull();
    expect(parseAccessIdentity(200, JSON_TYPE, '{"email":42}')).toBeNull();
    expect(parseAccessIdentity(200, JSON_TYPE, '{"email":"not an email"}')).toBeNull();
    expect(parseAccessIdentity(200, JSON_TYPE, 'null')).toBeNull();
  });
});

describe('origin gating', () => {
  it('only https origins that are not localhost / LAN', () => {
    expect(shouldQueryAccess({ protocol: 'https:', hostname: 'railway.example.com' })).toBe(true);
    expect(shouldQueryAccess({ protocol: 'http:', hostname: 'railway.example.com' })).toBe(false);
    for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.1.20', '172.16.0.1', '172.31.255.1', '169.254.1.1', '[::1]', 'nas.local', 'fd12::1']) {
      expect(isLocalHost(h), h).toBe(true);
      expect(shouldQueryAccess({ protocol: 'https:', hostname: h }), h).toBe(false);
    }
    for (const h of ['8.8.8.8', '172.32.0.1', 'example.com']) expect(isLocalHost(h), h).toBe(false);
    expect(shouldQueryAccess({ protocol: 'http:', hostname: 'localhost' }, true)).toBe(true);
  });
});

describe('fetchAccessIdentity', () => {
  it('asks the same-origin get-identity endpoint with the cookies', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(200, '{"email":"ann@example.com"}'));
    expect(await fetchAccessIdentity(fetchFn)).toEqual({ email: 'ann@example.com' });
    expect(fetchFn).toHaveBeenCalledWith(ACCESS_IDENTITY_URL, expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('null on network errors and 404, without logging', async () => {
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    expect(await fetchAccessIdentity(() => Promise.reject(new TypeError('Failed to fetch')))).toBeNull();
    expect(await fetchAccessIdentity(() => Promise.resolve(response(404, 'Not found', 'text/plain')))).toBeNull();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('installAccessIdentity', () => {
  const HTTPS = { protocol: 'https:', hostname: 'railway.example.com' };
  const base = { unsavedRemoteTabs: () => 0, confirm: () => Promise.resolve(true) };
  const topBar = (): HTMLElement => {
    document.body.innerHTML = '<div class="top-bar-right"><div class="save-status"></div><button id="share-btn">Share</button></div>';
    return document.querySelector<HTMLElement>('.top-bar-right')!;
  };

  it('shows the email (tooltip) and an accessible Log out button first in the top bar', async () => {
    const container = topBar();
    const el = await installAccessIdentity({ ...base, container, location: HTTPS, fetchFn: () => Promise.resolve(response(200, '{"email":"ann@example.com","name":"Ann"}')) });
    expect(el).not.toBeNull();
    expect(container.firstElementChild).toBe(el);
    expect(el!.querySelector('.rd-access-email-text')!.textContent).toBe('ann@example.com');
    expect(el!.querySelector<HTMLElement>('.rd-access-email')!.title).toBe('Signed in as Ann <ann@example.com>');
    const button = el!.querySelector<HTMLButtonElement>('button.rd-access-logout')!;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Log out (ann@example.com)');
    expect(button.textContent).toBe('Log out');
    expect(button.querySelector('svg.rd-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows nothing on failure, on localhost / http, and does not even ask there', async () => {
    const container = topBar();
    const before = container.innerHTML;
    expect(await installAccessIdentity({ ...base, container, location: HTTPS, fetchFn: () => Promise.resolve(response(404, '', 'text/html')) })).toBeNull();
    expect(await installAccessIdentity({ ...base, container, location: HTTPS, fetchFn: () => Promise.reject(new Error('offline')) })).toBeNull();
    const fetchFn = vi.fn();
    expect(await installAccessIdentity({ ...base, container, location: { protocol: 'http:', hostname: 'localhost' }, fetchFn })).toBeNull();
    expect(await installAccessIdentity({ ...base, container, location: { protocol: 'https:', hostname: '192.168.0.5' }, fetchFn })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe(before);
  });

  it('does not wait for the request before returning control (async after boot)', async () => {
    const container = topBar();
    let resolve!: (r: ReturnType<typeof response>) => void;
    const pending = installAccessIdentity({ ...base, container, location: HTTPS, fetchFn: () => new Promise((r) => (resolve = r)) });
    expect(container.querySelector('.rd-access-user')).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    resolve(response(200, '{"email":"ann@example.com"}'));
    await pending;
    expect(container.querySelectorAll('.rd-access-user')).toHaveLength(1);
  });
});

describe('Log out', () => {
  const click = async (el: HTMLElement): Promise<void> => {
    el.querySelector<HTMLButtonElement>('.rd-access-logout')!.click();
    await new Promise((r) => setTimeout(r, 0));
  };

  it('leaves for the Access logout URL right away without unsaved remote changes', async () => {
    const navigate = vi.fn();
    const confirm = vi.fn();
    await click(createAccessUser({ email: 'ann@example.com' }, { unsavedRemoteTabs: () => 0, confirm, navigate }));
    expect(confirm).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(ACCESS_LOGOUT_URL);
  });

  it('asks first with unsaved remote changes: cancel stays, confirm skips the leave prompt and leaves', async () => {
    const navigate = vi.fn();
    const allowLeave = vi.fn();
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const el = createAccessUser({ email: 'ann@example.com' }, { unsavedRemoteTabs: () => 2, confirm, navigate, allowLeave });
    await click(el);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Log out?', danger: true, confirmLabel: 'Log out' }));
    expect(confirm.mock.calls[0][0].message).toContain('2 diagrams have changes not saved');
    expect(navigate).not.toHaveBeenCalled();
    expect(allowLeave).not.toHaveBeenCalled();
    await click(el);
    expect(allowLeave).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(ACCESS_LOGOUT_URL);
  });
});
