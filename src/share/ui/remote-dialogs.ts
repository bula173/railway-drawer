/**
 * @file remote-dialogs.ts
 * @brief Generic dialogs for any StorageProvider: browse for a file to open, choose a folder +
 *        name to save, resolve a save conflict, create a sharing link.
 */
import type {
  BrowseEntry,
  BrowseListing,
  ConflictAction,
  ConflictBehavior,
  RemoteFileInfo,
  ResultLink,
  SaveField,
  SaveFieldValues,
  StorageProvider,
} from '../providers/types';
import { button, copyText, el, openModal } from './modal';

export type BrowseResult =
  | { mode: 'open'; path: BrowseEntry[]; file: BrowseEntry }
  /** `values`: answers to the provider's `saveFields` (only when it has any). */
  | { mode: 'save'; path: BrowseEntry[]; name: string; conflict: ConflictBehavior; values?: SaveFieldValues };

let fieldCounter = 0;

export interface RenderedFields {
  element: HTMLElement;
  values(): SaveFieldValues;
  /** First input (for focus). */
  first: HTMLElement | null;
}

/**
 * Inputs for provider save fields (commit message, branch, checkboxes). `previous` keeps what
 * the user already typed when the fields are rendered again (the location changed).
 */
export function renderSaveFields(fields: SaveField[], previous: SaveFieldValues = {}, onEnter?: () => void): RenderedFields {
  const element = el('div', 'rd-share-fields');
  const inputs: Array<{ field: SaveField; input: HTMLInputElement }> = [];
  for (const field of fields) {
    const id = `rd-share-field-${++fieldCounter}`;
    const row = el('div', field.kind === 'checkbox' ? 'rd-share-field rd-share-field-check' : 'rd-share-field');
    row.dataset.field = field.id;
    const input = el('input', field.kind === 'checkbox' ? undefined : 'rd-share-input');
    input.id = id;
    input.dataset.field = field.id;
    const label = el('label', 'rd-share-field-label', field.label);
    label.htmlFor = id;
    const kept = previous[field.id];
    if (field.kind === 'checkbox') {
      input.type = 'checkbox';
      input.checked = typeof kept === 'boolean' ? kept : field.value === true;
      row.append(input, label);
    } else {
      input.type = 'text';
      input.value = typeof kept === 'string' ? kept : typeof field.value === 'string' ? field.value : '';
      if (field.placeholder) input.placeholder = field.placeholder;
      if (onEnter) {
        input.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            onEnter();
          }
        });
      }
      row.append(label, input);
    }
    if (field.hint) {
      const hint = el('div', 'rd-share-hint', field.hint);
      hint.id = `${id}-hint`;
      input.setAttribute('aria-describedby', hint.id);
      row.appendChild(hint);
    }
    element.appendChild(row);
    inputs.push({ field, input });
  }
  return {
    element,
    first: inputs[0]?.input ?? null,
    values: () => Object.fromEntries(inputs.map(({ field, input }) => [field.id, field.kind === 'checkbox' ? input.checked : input.value.trim()])),
  };
}

export interface BrowseOptions {
  mode: 'open' | 'save';
  /** Save: suggested file name. */
  defaultName?: string;
  /** Save: folder to start in. */
  initialPath?: BrowseEntry[];
  /** Save: shown above the list (e.g. "A file with that name exists"). */
  message?: string;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Opens the browser dialog; resolves null when cancelled. */
export function browseRemote(provider: StorageProvider, opts: BrowseOptions): Promise<BrowseResult | null> {
  return new Promise((resolve) => {
    const isSave = opts.mode === 'save';
    const modal = openModal({
      title: isSave ? `Save to ${provider.label}` : `Open from ${provider.label}`,
      testId: `remote-${opts.mode}-dialog`,
    });
    let result: BrowseResult | null = null;
    modal.onClose(() => resolve(result));

    let path: BrowseEntry[] = opts.initialPath ? [...opts.initialPath] : [];
    let selected: BrowseEntry | null = null;
    let listing: BrowseListing | null = null;
    let search = '';
    let requestId = 0;

    // Account line
    const accountRow = el('div', 'rd-share-row');
    const accountText = el('span', 'rd-share-hint');
    const signInBtn = button('Sign in', 'rd-share-btn rd-share-btn-primary');
    const signOutBtn = button('Sign out', 'rd-share-btn');
    accountRow.append(accountText, signInBtn, signOutBtn);

    const message = el('div', 'rd-share-warning');
    message.hidden = !opts.message;
    message.textContent = opts.message ?? '';

    const crumbs = el('nav', 'rd-share-crumbs');
    crumbs.setAttribute('aria-label', 'Location');
    const searchForm = el('form', 'rd-share-row');
    const searchInput = el('input', 'rd-share-input');
    searchInput.type = 'search';
    const searchBtn = button('Search', 'rd-share-btn');
    searchBtn.type = 'submit';
    searchForm.append(searchInput, searchBtn);
    searchForm.hidden = true;
    const heading = el('div', 'rd-share-meta');
    const list = el('ul', 'rd-share-list');
    list.setAttribute('aria-label', 'Files and folders');
    list.setAttribute('aria-busy', 'false');
    const error = el('div', 'rd-share-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;

    // Save fields
    const nameInput = el('input', 'rd-share-input');
    nameInput.type = 'text';
    nameInput.value = opts.defaultName ?? 'diagram.drawio';
    nameInput.setAttribute('aria-label', 'File name');
    const conflictSelect = el('select', 'rd-share-select');
    conflictSelect.setAttribute('aria-label', 'If a file with this name exists');
    for (const [value, label] of [
      ['fail', 'If it exists: ask me'],
      ['replace', 'If it exists: replace it'],
      ['rename', 'If it exists: keep both'],
    ] as const) {
      const option = el('option', undefined, label);
      option.value = value;
      conflictSelect.appendChild(option);
    }
    const saveRow = el('div', 'rd-share-row');
    const nameLabel = el('label', 'rd-share-hint', 'File name');
    saveRow.append(nameLabel, nameInput, conflictSelect);
    // Provider save fields (GitLab: commit message, new branch, merge request), per location
    const fieldsHost = el('div');
    let fields: RenderedFields | null = null;
    let fieldsKey = '';
    const renderFields = (): void => {
      if (!isSave) return;
      const defs = provider.saveFields?.({ kind: 'saveAs', path }) ?? [];
      const key = JSON.stringify(defs);
      if (key === fieldsKey) return;
      const kept = fields?.values() ?? {};
      fieldsKey = key;
      fields = defs.length > 0 ? renderSaveFields(defs, kept, () => confirm()) : null;
      fieldsHost.replaceChildren(...(fields ? [fields.element] : []));
    };

    modal.body.append(accountRow, message, crumbs, searchForm, heading, list, error);
    if (isSave) modal.body.append(saveRow, fieldsHost);

    const cancelBtn = button('Cancel', 'rd-share-btn', () => modal.close());
    const confirmBtn = button(isSave ? 'Save' : 'Open', 'rd-share-btn rd-share-btn-primary');
    confirmBtn.dataset.testid = `remote-${opts.mode}-confirm`;
    modal.footer.append(cancelBtn, confirmBtn);

    const updateConfirm = (): void => {
      confirmBtn.disabled = isSave
        ? !provider.canSaveAt(path) || !nameInput.value.trim()
        : !selected || selected.kind !== 'file';
    };

    const updateAccount = (): void => {
      const account = provider.getAccount();
      accountText.textContent = account
        ? `Signed in as ${account.name}${account.username && account.username !== account.name ? ` (${account.username})` : ''}`
        : `Sign in with your ${provider.label} account to browse.`;
      signInBtn.hidden = !!account;
      signOutBtn.hidden = !account;
    };

    const renderCrumbs = (): void => {
      crumbs.textContent = '';
      const items: Array<{ label: string; depth: number }> = [
        { label: provider.label, depth: 0 },
        ...path.map((entry, i) => ({ label: entry.name, depth: i + 1 })),
      ];
      items.forEach((item, i) => {
        if (i > 0) crumbs.appendChild(el('span', undefined, '›'));
        const crumb = button(item.label, 'rd-share-crumb');
        if (i === items.length - 1) crumb.setAttribute('aria-current', 'location');
        else crumb.addEventListener('click', () => navigate(path.slice(0, item.depth)));
        crumbs.appendChild(crumb);
      });
    };

    const renderList = (): void => {
      list.textContent = '';
      const entries = listing?.entries ?? [];
      if (entries.length === 0) {
        const empty = el('li', 'rd-share-empty', listing ? 'Nothing here.' : '');
        list.appendChild(empty);
      }
      for (const entry of entries) {
        const li = el('li');
        const item = button('', 'rd-share-entry');
        const icon = entry.kind === 'file' ? '📄' : entry.kind === 'folder' ? '📁' : '🗂️';
        item.append(el('span', undefined, icon), el('span', 'rd-share-entry-name', entry.name));
        if (entry.detail) item.appendChild(el('span', 'rd-share-entry-detail', entry.detail));
        item.dataset.kind = entry.kind;
        if (entry.kind === 'file') {
          item.setAttribute('aria-pressed', String(selected?.id === entry.id));
          item.addEventListener('click', () => {
            selected = entry;
            if (isSave) nameInput.value = entry.name;
            list.querySelectorAll('.rd-share-entry[data-kind="file"]').forEach((node) => node.setAttribute('aria-pressed', 'false'));
            item.setAttribute('aria-pressed', 'true');
            updateConfirm();
          });
          item.addEventListener('dblclick', () => {
            selected = entry;
            confirm();
          });
        } else {
          item.addEventListener('click', () => navigate([...path, entry]));
        }
        li.appendChild(item);
        list.appendChild(li);
      }
    };

    const navigate = async (next: BrowseEntry[], query = ''): Promise<void> => {
      if (!provider.getAccount()) {
        updateAccount();
        renderCrumbs();
        listing = null;
        renderList();
        updateConfirm();
        return;
      }
      const id = ++requestId;
      path = next;
      search = query;
      selected = null;
      error.hidden = true;
      renderCrumbs();
      renderFields();
      list.setAttribute('aria-busy', 'true');
      heading.textContent = 'Loading…';
      updateConfirm();
      try {
        const result = await provider.list(path, query ? { search: query } : {});
        if (id !== requestId || modal.closed) return;
        listing = result;
        heading.textContent = result.heading ?? '';
        searchForm.hidden = !result.searchable;
        searchInput.placeholder = result.searchPlaceholder ?? 'Search';
        if (!query) searchInput.value = '';
      } catch (err) {
        if (id !== requestId || modal.closed) return;
        listing = { entries: [] };
        heading.textContent = '';
        error.hidden = false;
        error.textContent = errorText(err);
      } finally {
        if (id === requestId) list.setAttribute('aria-busy', 'false');
      }
      updateAccount();
      renderList();
      updateConfirm();
    };

    const confirm = (): void => {
      updateConfirm();
      if (confirmBtn.disabled) return;
      if (isSave) {
        let name = nameInput.value.trim();
        if (!/\.(drawio|xml)$/i.test(name)) name += '.drawio';
        const values = fields?.values();
        result = { mode: 'save', path, name, conflict: conflictSelect.value as ConflictBehavior, ...(values ? { values } : {}) };
      } else if (selected) {
        result = { mode: 'open', path, file: selected };
      }
      modal.close();
    };

    signInBtn.addEventListener('click', async () => {
      signInBtn.disabled = true;
      error.hidden = true;
      try {
        await provider.signIn();
        await navigate(path, search);
      } catch (err) {
        error.hidden = false;
        error.textContent = `Sign-in failed: ${errorText(err)}`;
      } finally {
        signInBtn.disabled = false;
        updateAccount();
      }
    });
    signOutBtn.addEventListener('click', async () => {
      await provider.signOut().catch(() => undefined);
      updateAccount();
      void navigate([]);
    });
    searchForm.addEventListener('submit', (evt) => {
      evt.preventDefault();
      void navigate([], searchInput.value.trim());
    });
    nameInput.addEventListener('input', updateConfirm);
    nameInput.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        confirm();
      }
    });
    confirmBtn.addEventListener('click', confirm);

    updateAccount();
    void navigate(path);
    (provider.getAccount() ? (isSave ? nameInput : list) : signInBtn).focus();
  });
}

/** Overwrite / Save as copy / Cancel, or a provider's `ConflictAction` (`action:<id>`). */
export type ConflictChoice = 'overwrite' | 'copy' | 'cancel' | `action:${string}`;

/** The file changed remotely since it was opened/saved. */
export function askSaveConflict(providerLabel: string, message: string, actions: ConflictAction[] = []): Promise<ConflictChoice> {
  return new Promise((resolve) => {
    const modal = openModal({ title: 'The file was changed by someone else', testId: 'remote-conflict-dialog' });
    let choice: ConflictChoice = 'cancel';
    modal.onClose(() => resolve(choice));
    modal.body.append(
      el('p', undefined, message),
      el(
        'p',
        'rd-share-hint',
        `Overwrite replaces the version in ${providerLabel} with yours (their changes are lost, but stay in the version history). ` +
          'Save as copy keeps both files.'
      )
    );
    for (const action of actions) {
      if (action.hint) modal.body.appendChild(el('p', 'rd-share-hint', `${action.label}: ${action.hint}`));
    }
    const pick = (value: ConflictChoice) => () => {
      choice = value;
      modal.close();
    };
    const cancel = button('Cancel', 'rd-share-btn', pick('cancel'));
    const copy = button('Save as copy', 'rd-share-btn', pick('copy'));
    const extra = actions.map((action) => {
      const btn = button(action.label, 'rd-share-btn', pick(`action:${action.id}`));
      btn.dataset.action = action.id;
      return btn;
    });
    const overwrite = button('Overwrite', 'rd-share-btn rd-share-btn-primary', pick('overwrite'));
    modal.footer.append(cancel, copy, ...extra, overwrite);
    copy.focus();
  });
}

/** Asks for a provider's save fields (e.g. the commit message on Ctrl+S); null = cancelled. */
export function askSaveOptions(opts: {
  title: string;
  intro?: string;
  fields: SaveField[];
  confirmLabel?: string;
}): Promise<SaveFieldValues | null> {
  return new Promise((resolve) => {
    const modal = openModal({ title: opts.title, testId: 'remote-save-options-dialog' });
    let result: SaveFieldValues | null = null;
    modal.onClose(() => resolve(result));
    const confirm = (): void => {
      result = rendered.values();
      modal.close();
    };
    const rendered = renderSaveFields(opts.fields, {}, confirm);
    if (opts.intro) modal.body.appendChild(el('p', 'rd-share-hint', opts.intro));
    modal.body.appendChild(rendered.element);
    const ok = button(opts.confirmLabel ?? 'Save', 'rd-share-btn rd-share-btn-primary', confirm);
    ok.dataset.testid = 'remote-save-options-confirm';
    modal.footer.append(button('Cancel', 'rd-share-btn', () => modal.close()), ok);
    (rendered.first ?? ok).focus();
  });
}

/** After a save that produced something to open (e.g. a merge request). */
export function showResultLink(title: string, message: string, link: ResultLink): Promise<void> {
  return new Promise((resolve) => {
    const modal = openModal({ title, testId: 'remote-result-link-dialog' });
    modal.onClose(() => resolve());
    const anchor = el('a', undefined, link.label);
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    const input = el('input', 'rd-share-input rd-share-link-input');
    input.readOnly = true;
    input.value = link.url;
    input.setAttribute('aria-label', link.label);
    const row = el('p');
    row.appendChild(anchor);
    modal.body.append(el('p', undefined, message), row, input);
    const copyBtn = button('Copy link', 'rd-share-btn', async () => {
      copyBtn.textContent = (await copyText(link.url)) ? 'Copied' : 'Copy the link above';
    });
    modal.footer.append(copyBtn, button('Close', 'rd-share-btn rd-share-btn-primary', () => modal.close()));
    anchor.focus();
  });
}

/** "Sign in to <provider>" (from a click, so the sign-in popup is allowed); true when signed in. */
export function askSignIn(provider: StorageProvider, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = openModal({ title: `Sign in to ${provider.label}`, testId: 'remote-signin-dialog' });
    let signedIn = false;
    modal.onClose(() => resolve(signedIn));
    const error = el('div', 'rd-share-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    modal.body.append(el('p', undefined, message), error);
    const signInBtn = button('Sign in', 'rd-share-btn rd-share-btn-primary', async () => {
      signInBtn.disabled = true;
      error.hidden = true;
      try {
        await provider.signIn();
        signedIn = true;
        modal.close();
      } catch (err) {
        error.hidden = false;
        error.textContent = `Sign-in failed: ${errorText(err)}`;
      } finally {
        signInBtn.disabled = false;
      }
    });
    modal.footer.append(button('Cancel', 'rd-share-btn', () => modal.close()), signInBtn);
    signInBtn.focus();
  });
}

/** Creates a sharing link for `file` and copies it. */
export function shareLinkDialog(provider: StorageProvider, file: RemoteFileInfo): Promise<void> {
  return new Promise((resolve) => {
    const capability = provider.shareLinks;
    const modal = openModal({ title: `Share "${file.name}"`, testId: 'remote-link-dialog' });
    modal.onClose(() => resolve());
    if (!capability || !provider.createShareLink) {
      modal.body.appendChild(el('p', undefined, `${provider.label} does not support sharing links.`));
      modal.footer.appendChild(button('Close', 'rd-share-btn', () => modal.close()));
      return;
    }

    const typeSet = el('fieldset', 'rd-share-fieldset');
    typeSet.appendChild(el('legend', undefined, capability.typesLegend ?? 'People with the link'));
    capability.types.forEach((type, i) => {
      const label = el('label', 'rd-share-radio');
      const input = el('input');
      input.type = 'radio';
      input.name = 'rd-link-type';
      input.value = type.id;
      input.checked = i === 0;
      label.append(input, document.createTextNode(` ${type.label}`));
      typeSet.appendChild(label);
    });

    const audienceSet = el('fieldset', 'rd-share-fieldset');
    audienceSet.appendChild(el('legend', undefined, capability.audiencesLegend ?? 'Who'));
    const recipients = el('input', 'rd-share-input');
    recipients.type = 'text';
    recipients.placeholder = 'name@company.com, other@company.com';
    recipients.setAttribute('aria-label', 'E-mail addresses');
    const recipientsRow = el('div', 'rd-share-row');
    recipientsRow.appendChild(recipients);
    capability.audiences.forEach((audience, i) => {
      const label = el('label', 'rd-share-radio');
      const input = el('input');
      input.type = 'radio';
      input.name = 'rd-link-audience';
      input.value = audience.id;
      input.checked = i === 0;
      input.addEventListener('change', () => {
        recipientsRow.hidden = !audience.needsRecipients;
      });
      label.append(input, document.createTextNode(` ${audience.label}`));
      if (audience.hint) label.appendChild(el('span', 'rd-share-hint', ` — ${audience.hint}`));
      audienceSet.appendChild(label);
    });
    recipientsRow.hidden = !capability.audiences[0]?.needsRecipients;

    const resultRow = el('div', 'rd-share-row');
    const resultInput = el('input', 'rd-share-input rd-share-link-input');
    resultInput.readOnly = true;
    resultInput.setAttribute('aria-label', 'Sharing link');
    resultRow.appendChild(resultInput);
    resultRow.hidden = true;
    const note = el('div', 'rd-share-meta');
    note.setAttribute('aria-live', 'polite');
    const error = el('div', 'rd-share-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;

    modal.body.append(typeSet, audienceSet, recipientsRow, resultRow, note, error);
    const closeBtn = button('Close', 'rd-share-btn', () => modal.close());
    const createBtn = button('Create link and copy', 'rd-share-btn rd-share-btn-primary');
    modal.footer.append(closeBtn, createBtn);

    createBtn.addEventListener('click', async () => {
      const type = (modal.dialog.querySelector('input[name="rd-link-type"]:checked') as HTMLInputElement | null)?.value;
      const audience = (modal.dialog.querySelector('input[name="rd-link-audience"]:checked') as HTMLInputElement | null)?.value;
      if (!type || !audience) return;
      createBtn.disabled = true;
      error.hidden = true;
      note.textContent = 'Creating link…';
      try {
        const res = await provider.createShareLink!(file, {
          type,
          audience,
          recipients: recipients.value.split(/[,;\s]+/).filter(Boolean),
        });
        resultRow.hidden = !res.url;
        resultInput.value = res.url;
        const copied = res.url ? await copyText(res.url) : false;
        note.textContent = [copied ? 'Link copied to the clipboard.' : res.url ? 'Copy the link above.' : '', res.note ?? '']
          .filter(Boolean)
          .join(' ');
      } catch (err) {
        note.textContent = '';
        error.hidden = false;
        error.textContent = errorText(err);
      } finally {
        createBtn.disabled = false;
      }
    });
    createBtn.focus();
  });
}
