/**
 * @file share-dialog.ts
 * @brief The Share dialog (top-bar "Share" button, File > Share…).
 *
 * - Link with the diagram: all tabs as one `<mxfile>`, compressed into the URL hash (`#R…`), plus
 *   the same diagram as an app.diagrams.net link. Nothing is uploaded.
 * - File: Download .drawio, Export PNG/SVG (current tab), Share file… (Web Share API, only shown
 *   when the browser can share that file type).
 * - One section per cloud storage provider (SharePoint, GitLab): "Not configured" with a how-to
 *   link, "requires HTTPS", or Open from / Save to / Sharing link; providers with runtime settings
 *   (GitLab URL + application id) get a Settings form, and the section is redrawn after saving.
 */
import {
  SHARE_LINK_WARN_LENGTH,
  buildAppShareLink,
  buildDrawioShareLink,
} from './share-link';
import type { SaveFieldValues, StorageProviderDescriptor } from './providers/types';
import { button, copyText, el, openModal } from './ui/modal';
import type { Modal } from './ui/modal';

export type ProviderAction = 'open' | 'save' | 'link';

export interface ShareNotifier {
  success(message: string): unknown;
  error(message: string): unknown;
  info(message: string): unknown;
}

export interface ShareDialogHost {
  /** All tabs as one `<mxfile>`. */
  getShareXml(): string;
  getTabCount(): number;
  /** File name without extension. */
  getFileBaseName(): string;
  downloadDrawio(): void;
  exportPng(): Promise<void>;
  exportSvg(): Promise<void>;
  /** PNG of the current tab, for "Share image…". */
  renderPngFile?(): Promise<File>;
  providers: StorageProviderDescriptor[];
  /** The active tab is bound to a file of this provider (enables "Sharing link…"). */
  hasRemoteFile(providerId: string): boolean;
  /** Name of that file, for the button tooltip. */
  remoteFileName?(providerId: string): string | null;
  onProviderAction(providerId: string, action: ProviderAction): void;
  /** A provider's runtime settings were saved or reset (rebuild menus, open pending links). */
  onProviderSettingsChanged?(providerId: string): void;
  notify: ShareNotifier;
  /** Base URL of share links (default: this page without query/hash). */
  baseUrl?: string;
  /** Web Share API (injectable for tests). */
  share?: { canShare(data: ShareData): boolean; share(data: ShareData): Promise<void> } | null;
  copy?: (text: string) => Promise<boolean>;
}

export interface ShareDialogHandle {
  modal: Modal;
  /** Resolves when the links are generated (or failed). */
  ready: Promise<void>;
}

function webShare(): ShareDialogHost['share'] {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return null;
  }
  return {
    canShare: (data) => {
      try {
        return navigator.canShare(data);
      } catch {
        return false;
      }
    },
    share: (data) => navigator.share(data),
  };
}

const DRAWIO_MIME = 'application/vnd.jgraph.mxfile';

export function openShareDialog(host: ShareDialogHost): ShareDialogHandle {
  const modal = openModal({ title: 'Share', testId: 'share-dialog' });
  const copy = host.copy ?? copyText;
  const share = host.share === undefined ? webShare() : host.share;
  const tabs = host.getTabCount();
  const baseName = host.getFileBaseName();

  // ---- Link with the diagram ---------------------------------------------------------------
  const linkSection = el('section', 'rd-share-section');
  linkSection.setAttribute('aria-labelledby', 'rd-share-link-heading');
  const linkHeading = el('h3', undefined, 'Link with the diagram');
  linkHeading.id = 'rd-share-link-heading';
  const linkHint = el(
    'p',
    'rd-share-hint',
    `The diagram (${tabs === 1 ? '1 tab' : `${tabs} tabs as pages`}) is stored inside the link, after the #. ` +
      'It is not uploaded anywhere; whoever opens the link gets a copy.'
  );
  const linkInput = el('input', 'rd-share-input rd-share-link-input');
  linkInput.type = 'text';
  linkInput.readOnly = true;
  linkInput.value = 'Generating…';
  linkInput.setAttribute('aria-label', 'Link with the diagram');
  linkInput.dataset.testid = 'share-link';
  linkInput.addEventListener('focus', () => linkInput.select());
  const meta = el('div', 'rd-share-meta');
  meta.dataset.testid = 'share-link-length';
  meta.setAttribute('aria-live', 'polite');
  const warning = el('div', 'rd-share-warning');
  warning.hidden = true;
  warning.dataset.testid = 'share-link-warning';
  warning.setAttribute('role', 'note');
  const linkError = el('div', 'rd-share-error');
  linkError.hidden = true;
  linkError.setAttribute('role', 'alert');

  let appLink = '';
  let drawioLink = '';
  const copyLinkBtn = button('Copy link', 'rd-share-btn rd-share-btn-primary', async () => {
    if (!appLink) return;
    if (await copy(appLink)) host.notify.success('Link copied. It opens a copy of the diagram in Railway Drawer.');
    else {
      linkInput.focus();
      linkInput.select();
      host.notify.info('Copy the selected link with Ctrl+C / Cmd+C.');
    }
  });
  copyLinkBtn.dataset.testid = 'share-copy-link';
  copyLinkBtn.disabled = true;
  const copyDrawioBtn = button('Copy draw.io link', 'rd-share-btn', async () => {
    if (!drawioLink) return;
    if (await copy(drawioLink)) host.notify.success('draw.io link copied. It opens the diagram in app.diagrams.net.');
    else host.notify.error('Could not copy to the clipboard');
  });
  copyDrawioBtn.dataset.testid = 'share-copy-drawio-link';
  copyDrawioBtn.disabled = true;
  const openDrawio = el('a', 'rd-share-btn', 'Open in draw.io');
  openDrawio.target = '_blank';
  openDrawio.rel = 'noopener noreferrer';
  openDrawio.setAttribute('aria-disabled', 'true');
  openDrawio.dataset.testid = 'share-open-drawio';
  const linkRow = el('div', 'rd-share-row');
  linkRow.append(copyLinkBtn, copyDrawioBtn, openDrawio);
  linkSection.append(linkHeading, linkHint, linkInput, meta, warning, linkError, linkRow);

  const ready = (async () => {
    try {
      const xml = host.getShareXml();
      [appLink, drawioLink] = await Promise.all([buildAppShareLink(xml, host.baseUrl), buildDrawioShareLink(xml)]);
      if (modal.closed) return;
      linkInput.value = appLink;
      copyLinkBtn.disabled = false;
      copyDrawioBtn.disabled = false;
      openDrawio.href = drawioLink;
      openDrawio.removeAttribute('aria-disabled');
      meta.textContent = `Link length: ${appLink.length.toLocaleString('en-US')} characters (draw.io link: ${drawioLink.length.toLocaleString('en-US')})`;
      if (appLink.length > SHARE_LINK_WARN_LENGTH) {
        warning.hidden = false;
        warning.textContent =
          `This link is long (over ${SHARE_LINK_WARN_LENGTH.toLocaleString('en-US')} characters). Some apps (chat, ` +
          'e-mail, Office) cut long links, and the diagram would not open. Send the .drawio file instead.';
      }
    } catch (err) {
      if (modal.closed) return;
      linkInput.value = '';
      linkError.hidden = false;
      linkError.textContent = `The link could not be created: ${err instanceof Error ? err.message : String(err)}`;
    }
  })();

  // ---- File ---------------------------------------------------------------------------------
  const fileSection = el('section', 'rd-share-section');
  fileSection.appendChild(el('h3', undefined, 'File'));
  fileSection.appendChild(
    el('p', 'rd-share-hint', 'The .drawio file has every tab as a page and opens in Railway Drawer and draw.io. Images show the current tab.')
  );
  const fileRow = el('div', 'rd-share-row');
  const downloadBtn = button('Download .drawio', 'rd-share-btn', () => host.downloadDrawio());
  downloadBtn.dataset.testid = 'share-download-drawio';
  const run = (label: string, task: () => Promise<void>) => async () => {
    try {
      await task();
    } catch (err) {
      host.notify.error(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const pngBtn = button('Export PNG', 'rd-share-btn', run('PNG export', () => host.exportPng()));
  pngBtn.dataset.testid = 'share-export-png';
  const svgBtn = button('Export SVG', 'rd-share-btn', run('SVG export', () => host.exportSvg()));
  svgBtn.dataset.testid = 'share-export-svg';
  fileRow.append(downloadBtn, pngBtn, svgBtn);

  if (share) {
    const fileName = `${baseName}.drawio`;
    const probe = new File([''], fileName, { type: DRAWIO_MIME });
    if (share.canShare({ files: [probe] })) {
      const shareFileBtn = button('Share file…', 'rd-share-btn', async () => {
        const file = new File([host.getShareXml()], fileName, { type: DRAWIO_MIME });
        try {
          await share.share({ files: [file], title: baseName });
        } catch (err) {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            host.notify.error(`Sharing failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });
      shareFileBtn.dataset.testid = 'share-web-share-file';
      fileRow.appendChild(shareFileBtn);
    }
    const pngProbe = new File([''], `${baseName}.png`, { type: 'image/png' });
    if (host.renderPngFile && share.canShare({ files: [pngProbe] })) {
      const renderPng = host.renderPngFile;
      const shareImageBtn = button('Share image…', 'rd-share-btn', async () => {
        try {
          await share.share({ files: [await renderPng()], title: baseName });
        } catch (err) {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            host.notify.error(`Sharing failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });
      shareImageBtn.dataset.testid = 'share-web-share-image';
      fileRow.appendChild(shareImageBtn);
    }
  }
  fileSection.appendChild(fileRow);

  modal.body.append(linkSection, fileSection);

  // ---- Cloud providers ----------------------------------------------------------------------
  for (const provider of host.providers) {
    modal.body.appendChild(renderProviderSection(provider, host, modal));
  }

  const done = button('Done', 'rd-share-btn', () => modal.close());
  modal.footer.appendChild(done);
  copyLinkBtn.focus();
  if (copyLinkBtn.disabled) done.focus();
  void ready.then(() => {
    if (!modal.closed && document.activeElement === done) copyLinkBtn.focus();
  });
  return { modal, ready };
}

function renderProviderSection(provider: StorageProviderDescriptor, host: ShareDialogHost, modal: Modal): HTMLElement {
  const section = el('section', 'rd-share-section');
  section.dataset.provider = provider.id;
  section.dataset.testid = `share-provider-${provider.id}`;
  const heading = el('h3', undefined, provider.label);
  heading.id = `rd-share-provider-${provider.id}`;
  section.setAttribute('aria-labelledby', heading.id);
  section.appendChild(heading);
  const availability = provider.availability();
  const settings = provider.settings ? renderSettings(provider, host, () => section.replaceWith(renderProviderSection(provider, host, modal)), availability.state !== 'ready') : null;

  if (availability.state !== 'ready') {
    const status = el('p', 'rd-share-hint');
    const strong = el(
      'span',
      'rd-share-status',
      availability.state === 'not-configured' ? 'Not configured' : 'Not available here'
    );
    strong.dataset.testid = `share-provider-${provider.id}-status`;
    status.append(strong, document.createTextNode(` — ${availability.reason} `));
    if (availability.helpUrl) {
      const link = el('a', undefined, availability.state === 'not-configured' ? 'How to enable' : 'Open');
      link.href = availability.helpUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      status.appendChild(link);
    }
    section.appendChild(status);
    if (settings) section.appendChild(settings);
    return section;
  }

  section.appendChild(el('p', 'rd-share-hint', provider.description));
  const row = el('div', 'rd-share-row');
  const act = (action: ProviderAction) => () => {
    modal.close();
    host.onProviderAction(provider.id, action);
  };
  const openBtn = button(`Open from ${provider.label}…`, 'rd-share-btn', act('open'));
  const saveBtn = button(`Save to ${provider.label}…`, 'rd-share-btn', act('save'));
  const linkBtn = button('Sharing link…', 'rd-share-btn', act('link'));
  const bound = host.hasRemoteFile(provider.id);
  linkBtn.disabled = !bound;
  linkBtn.title = bound
    ? `Share "${host.remoteFileName?.(provider.id) ?? 'the file'}" from ${provider.label}`
    : `Save the diagram to ${provider.label} (or open it from there) first`;
  openBtn.dataset.testid = `share-provider-${provider.id}-open`;
  saveBtn.dataset.testid = `share-provider-${provider.id}-save`;
  linkBtn.dataset.testid = `share-provider-${provider.id}-link`;
  row.append(openBtn, saveBtn, linkBtn);
  section.appendChild(row);
  if (settings) section.appendChild(settings);
  return section;
}

/** The provider's runtime settings (collapsed unless the provider still needs them). */
function renderSettings(provider: StorageProviderDescriptor, host: ShareDialogHost, redraw: () => void, open: boolean): HTMLElement {
  const settings = provider.settings!;
  const details = el('details', 'rd-share-settings');
  details.dataset.testid = `share-provider-${provider.id}-settings`;
  details.open = open;
  details.appendChild(el('summary', undefined, `${provider.label} settings`));
  const values = settings.values();
  const inputs: Array<{ id: string; kind: 'text' | 'checkbox'; input: HTMLInputElement }> = [];
  for (const field of settings.fields) {
    const row = el('div', field.kind === 'checkbox' ? 'rd-share-field rd-share-field-check' : 'rd-share-field');
    const input = el('input', field.kind === 'checkbox' ? undefined : 'rd-share-input');
    input.id = `rd-share-setting-${provider.id}-${field.id}`;
    input.dataset.setting = field.id;
    const label = el('label', 'rd-share-field-label', field.label);
    label.htmlFor = input.id;
    if (field.kind === 'checkbox') {
      input.type = 'checkbox';
      input.checked = values[field.id] === true;
      row.append(input, label);
    } else {
      input.type = 'text';
      input.spellcheck = false;
      input.value = typeof values[field.id] === 'string' ? (values[field.id] as string) : '';
      if (field.placeholder) input.placeholder = field.placeholder;
      row.append(label, input);
    }
    if (field.hint) row.appendChild(el('div', 'rd-share-hint', field.hint));
    details.appendChild(row);
    inputs.push({ id: field.id, kind: field.kind, input });
  }
  const hint = settings.hint?.();
  if (hint) details.appendChild(el('p', 'rd-share-hint', hint));
  const error = el('div', 'rd-share-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const row = el('div', 'rd-share-row');
  const saveBtn = button('Save settings', 'rd-share-btn rd-share-btn-primary', () => {
    const next: SaveFieldValues = Object.fromEntries(inputs.map(({ id, kind, input }) => [id, kind === 'checkbox' ? input.checked : input.value.trim()]));
    try {
      settings.save(next);
    } catch (err) {
      error.hidden = false;
      error.textContent = err instanceof Error ? err.message : String(err);
      return;
    }
    host.notify.success(`${provider.label} settings saved in this browser.`);
    redraw();
    host.onProviderSettingsChanged?.(provider.id);
  });
  saveBtn.dataset.testid = `share-provider-${provider.id}-settings-save`;
  const resetBtn = button('Reset to defaults', 'rd-share-btn', () => {
    settings.reset();
    host.notify.info(`${provider.label} settings reset to the defaults of this deployment.`);
    redraw();
    host.onProviderSettingsChanged?.(provider.id);
  });
  row.append(saveBtn, resetBtn);
  details.append(error, row);
  return details;
}
