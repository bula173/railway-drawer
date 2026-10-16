import { afterEach, describe, expect, it, vi } from 'vitest';
import { openShareDialog } from '../share-dialog';
import type { ShareDialogHost } from '../share-dialog';
import { createSharePointDescriptor } from '../providers/sharepoint';
import { createStorageProviders } from '../providers/registry';
import { decodeShareHash, SHARE_LINK_WARN_LENGTH } from '../share-link';
import type { StorageProviderDescriptor } from '../providers/types';

const XML = '<mxfile><diagram id="a" name="P"><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>';

function host(overrides: Partial<ShareDialogHost> = {}): ShareDialogHost {
  return {
    getShareXml: () => XML,
    getTabCount: () => 2,
    getFileBaseName: () => 'Stacja',
    downloadDrawio: vi.fn(),
    exportPng: vi.fn(async () => undefined),
    exportSvg: vi.fn(async () => undefined),
    providers: [createSharePointDescriptor({ env: {} })],
    hasRemoteFile: () => false,
    onProviderAction: vi.fn(),
    notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    baseUrl: 'https://rd.example/',
    share: null,
    copy: vi.fn(async () => true),
    ...overrides,
  };
}

const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

afterEach(() => {
  document.querySelectorAll('.rd-share-overlay').forEach((n) => n.remove());
});

describe('Share dialog', () => {
  it('is an accessible modal and builds a link that decodes to the diagram', async () => {
    const h = host();
    const { ready } = openShareDialog(h);
    const dialog = q('share-dialog')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Share');
    await ready;
    const link = (q('share-link') as HTMLInputElement).value;
    expect(link.startsWith('https://rd.example/#R')).toBe(true);
    expect(await decodeShareHash(link.slice(link.indexOf('#')))).toBe(XML);
    expect(q('share-link-length')!.textContent).toMatch(/Link length: [\d,]+ characters/);
    expect(q('share-link-warning')!.hidden).toBe(true);
    expect((q('share-open-drawio') as HTMLAnchorElement).href.startsWith('https://app.diagrams.net/#R')).toBe(true);
    (q('share-copy-link') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(h.copy).toHaveBeenCalledWith(link));
  });

  it('warns about long links', async () => {
    // Random text barely compresses
    let noise = '';
    for (let i = 0; i < 40_000; i++) noise += String.fromCharCode(65 + Math.floor(Math.random() * 58));
    const { ready } = openShareDialog(host({ getShareXml: () => `<mxfile><diagram name="${noise}"/></mxfile>` }));
    await ready;
    expect((q('share-link') as HTMLInputElement).value.length).toBeGreaterThan(SHARE_LINK_WARN_LENGTH);
    expect(q('share-link-warning')!.hidden).toBe(false);
    expect(q('share-link-warning')!.textContent).toMatch(/\.drawio file/);
  });

  it('shows SharePoint as "Not configured" with a how-to link when no client id is set', () => {
    const h = host();
    openShareDialog(h);
    const section = q('share-provider-sharepoint')!;
    expect(q('share-provider-sharepoint-status')!.textContent).toBe('Not configured');
    const link = section.querySelector('a')!;
    expect(link.textContent).toBe('How to enable');
    expect(link.href).toMatch(/docs\/SHAREPOINT\.md$/);
    expect(section.querySelectorAll('button')).toHaveLength(0);
  });

  it('the default registry (no VITE_MSAL_CLIENT_ID in tests) has SharePoint not configured', () => {
    const [sharepoint] = createStorageProviders();
    expect(sharepoint.id).toBe('sharepoint');
    expect(sharepoint.availability().state).toBe('not-configured');
    return expect(sharepoint.load()).rejects.toThrow(/not available/);
  });

  it('shows "requires HTTPS" on plain-http deployments', () => {
    openShareDialog(
      host({
        providers: [
          createSharePointDescriptor({ env: { VITE_MSAL_CLIENT_ID: 'abc' }, location: { protocol: 'http:', hostname: '192.168.10.22' } }),
        ],
      })
    );
    expect(q('share-provider-sharepoint-status')!.textContent).toBe('Not available here');
    expect(q('share-provider-sharepoint')!.textContent).toContain(
      'SharePoint requires HTTPS — use https://railwaydrawer.mksystemdesign.org'
    );
  });

  it('renders ready providers generically and forwards their actions', () => {
    const fake: StorageProviderDescriptor = {
      id: 'gitlab',
      label: 'GitLab',
      description: 'Files in a repository',
      availability: () => ({ state: 'ready' }),
      load: () => Promise.reject(new Error('unused')),
    };
    const h = host({ providers: [createSharePointDescriptor({ env: {} }), fake], hasRemoteFile: (id) => id === 'gitlab' });
    const { modal } = openShareDialog(h);
    const sections = Array.from(document.querySelectorAll('[data-provider]')).map((s) => (s as HTMLElement).dataset.provider);
    expect(sections).toEqual(['sharepoint', 'gitlab']);
    expect((q('share-provider-gitlab-link') as HTMLButtonElement).disabled).toBe(false);
    q('share-provider-gitlab-save')!.click();
    expect(h.onProviderAction).toHaveBeenCalledWith('gitlab', 'save');
    expect(modal.closed).toBe(true);
  });

  it('runs the file actions and hides Web Share when unsupported', async () => {
    const h = host();
    openShareDialog(h);
    q('share-download-drawio')!.click();
    q('share-export-png')!.click();
    q('share-export-svg')!.click();
    expect(h.downloadDrawio).toHaveBeenCalled();
    await vi.waitFor(() => expect(h.exportSvg).toHaveBeenCalled());
    expect(h.exportPng).toHaveBeenCalled();
    expect(q('share-web-share-file')).toBeNull();
  });

  it('offers "Share file…" when the browser can share the file', async () => {
    const shareFn = vi.fn(async () => undefined);
    const h = host({ share: { canShare: () => true, share: shareFn } });
    openShareDialog(h);
    q('share-web-share-file')!.click();
    await vi.waitFor(() => expect(shareFn).toHaveBeenCalled());
    const data = (shareFn.mock.calls[0] as unknown as [ShareData])[0];
    expect(data.files?.[0].name).toBe('Stacja.drawio');
  });

  it('Escape closes it and focus returns', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { modal } = openShareDialog(host());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.closed).toBe(true);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
