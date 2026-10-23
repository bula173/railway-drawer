/**
 * @file sheet-dialogs.ts
 * @brief The print sheet dialogs (lazy chunk, opened by the commands in ui/commands/print.ts):
 *        Page Setup… (the shown page's sheet), Title Block…, Revisions…, Pages… (go to, add,
 *        rename, delete drawing pages) and Insert Sheet Reference… (continuation marker).
 *        Themed modals on openAppModal (core/modal.ts: focus trap, Esc / Enter).
 */
import type { CellStyle } from '@maxgraph/core';
import { openAppModal, confirmDialog, type AppModal } from '../../ui/app-dialogs';
import { globalNotificationManager } from '../../ui/notification';
import type { DiagramSession } from '../../ui/session';
import {
  DEFAULT_FILING,
  SHEET_FORMAT_IDS,
  pageSettingsFor,
  readSheetSetup,
  sheetAttributesFor,
  writeRootAttributes,
  type SheetFormatId,
  type SheetOrientation,
  type SheetSetupInput,
} from '../sheet-setup';
import { MAX_LOGO_LENGTH, REVISION_FIELDS, TITLE_FIELDS, sanitizeLogo, type RevisionRow, type TitleField } from '../title-block';
import { CONTINUATION_SIZE, CONTINUATION_STYLE, continuationLabel, createSheetRefValue } from '../sheet-refs';
import { sheetNumbers } from '../sheet-plan';
import './print-sheets.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrap = el('label', 'rd-print-field');
  wrap.append(el('span', undefined, label), control);
  return wrap;
}

function textInput(name: string, value: string, maxLength = 300): HTMLInputElement {
  const input = el('input');
  input.type = 'text';
  input.name = name;
  input.value = value;
  input.maxLength = maxLength;
  input.spellcheck = false;
  input.setAttribute('autocomplete', 'off');
  return input;
}

function numberInput(name: string, value: number, min: number, max: number, step = 1): HTMLInputElement {
  const input = el('input');
  input.type = 'number';
  input.name = name;
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  return input;
}

function checkbox(name: string, label: string, checked: boolean): { row: HTMLLabelElement; input: HTMLInputElement } {
  const row = el('label', 'rd-print-check');
  const input = el('input');
  input.type = 'checkbox';
  input.name = name;
  input.checked = checked;
  row.append(input, document.createTextNode(label));
  return { row, input };
}

function fieldset(legend: string, ...children: HTMLElement[]): HTMLFieldSetElement {
  const fs = el('fieldset');
  fs.append(el('legend', undefined, legend), ...children);
  return fs;
}

function grid(cols: 2 | 4, ...children: HTMLElement[]): HTMLDivElement {
  const g = el('div', cols === 4 ? 'rd-print-grid rd-print-grid-4' : 'rd-print-grid');
  g.append(...children);
  return g;
}

function actions(modal: AppModal, okLabel: string, onOk: () => void): HTMLButtonElement {
  const ok = button(okLabel, 'rd-tpl-btn rd-tpl-btn-primary', onOk);
  modal.actions.append(button('Cancel', 'rd-tpl-btn', () => modal.close()), ok);
  return ok;
}

const clampNumber = (input: HTMLInputElement, fallback: number): number => {
  const n = Number(input.value);
  const min = Number(input.min);
  const max = Number(input.max);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// ---- Page Setup ---------------------------------------------------------------------------------

/** File > Page Setup…: the sheet of the shown page (one undoable edit). */
export function openSheetSetupDialog(session: DiagramSession): AppModal {
  const { graph, document: doc } = session;
  const setup = readSheetSetup(doc.getPageSettings(), graph.getDataModel());
  const page = doc.listPages()[doc.shownPageIndex()];
  const modal = openAppModal({ title: 'Page Setup', testId: 'sheet-setup-dialog', className: 'rd-print-dialog', onSubmit: () => apply() });
  modal.body.appendChild(el('p', 'rd-print-hint', `Sheet of page "${page?.name ?? ''}". Stored in the .drawio file as draw.io's page size and scale.`));

  const format = el('select');
  format.name = 'format';
  for (const id of SHEET_FORMAT_IDS) {
    const option = el('option', undefined, id);
    option.value = id;
    format.appendChild(option);
  }
  format.value = setup.format === 'custom' ? 'A4' : setup.format;
  const orientation = el('select');
  orientation.name = 'orientation';
  for (const [value, label] of [
    ['portrait', 'Portrait'],
    ['landscape', 'Landscape'],
  ] as const) {
    const option = el('option', undefined, label);
    option.value = value;
    orientation.appendChild(option);
  }
  orientation.value = setup.orientation;
  const scaleMode = el('select');
  scaleMode.name = 'scaleMode';
  for (const [value, label] of [
    ['fit', 'Fit to sheet'],
    ['fixed', 'Fixed scale 1:n'],
  ] as const) {
    const option = el('option', undefined, label);
    option.value = value;
    scaleMode.appendChild(option);
  }
  scaleMode.value = setup.scaleMode;
  const scale = numberInput('scale', setup.scaleMode === 'fixed' ? setup.scale : 1, 0.1, 1000, 0.1);
  const syncScale = (): void => {
    scale.disabled = scaleMode.value !== 'fixed';
  };
  scaleMode.addEventListener('change', syncScale);
  syncScale();
  modal.body.appendChild(
    fieldset('Paper and scale', grid(4, field('Format', format), field('Orientation', orientation), field('Scale', scaleMode), field('n (1:n)', scale)))
  );

  const m = setup.margins;
  const top = numberInput('marginTop', m.top, 0, 100);
  const right = numberInput('marginRight', m.right, 0, 100);
  const bottom = numberInput('marginBottom', m.bottom, 0, 100);
  const left = numberInput('marginLeft', m.left, 0, 100);
  const filing = numberInput('filing', setup.filing, 0, 100);
  const frame = checkbox('frame', 'Frame', setup.frame);
  const titleBlock = checkbox('titleBlock', 'Title block', setup.titleBlock);
  const revisions = checkbox('revisions', 'Revision table', setup.revisions);
  const legend = checkbox('legend', 'Legend of the symbols used', setup.legend);
  modal.body.appendChild(
    fieldset(
      'Frame (mm)',
      grid(4, field('Top', top), field('Right', right), field('Bottom', bottom), field('Left', left)),
      grid(2, field('Filing margin (left)', filing), el('span')),
      grid(4, frame.row, titleBlock.row, revisions.row, legend.row)
    )
  );

  const sheetTitle = textInput('sheetTitle', setup.sheetTitle);
  const sheetNumber = textInput('sheetNumber', setup.sheetNumber, 20);
  sheetNumber.placeholder = String(doc.shownPageIndex() + 1);
  const drawingNumber = textInput('drawingNumber', setup.drawingNumber, 80);
  sheetTitle.placeholder = doc.titleBlock.get().title || 'the document title';
  drawingNumber.placeholder = doc.titleBlock.get().drawingNumber || 'the document number';
  modal.body.appendChild(
    fieldset('This page in the title block (empty: the document values)', grid(2, field('Sheet title', sheetTitle), field('Drawing number', drawingNumber)), grid(2, field('Sheet number', sheetNumber), el('span')))
  );
  const border = checkbox('showBorder', 'Show the sheet border on the canvas', true);
  modal.body.appendChild(border.row);

  const apply = (): void => {
    const input: SheetSetupInput = {
      format: format.value as SheetFormatId,
      orientation: orientation.value as SheetOrientation,
      scaleMode: scaleMode.value === 'fixed' ? 'fixed' : 'fit',
      scale: clampNumber(scale, 1),
      margins: { top: clampNumber(top, 10), right: clampNumber(right, 10), bottom: clampNumber(bottom, 10), left: clampNumber(left, 10) },
      filing: clampNumber(filing, DEFAULT_FILING),
      frame: frame.input.checked,
      titleBlock: titleBlock.input.checked,
      revisions: revisions.input.checked,
      legend: legend.input.checked,
      sheetTitle: sheetTitle.value,
      sheetNumber: sheetNumber.value,
      drawingNumber: drawingNumber.value,
    };
    const model = graph.getDataModel();
    model.beginUpdate();
    try {
      doc.setPageSettings({ ...pageSettingsFor(input), page: border.input.checked });
      writeRootAttributes(model, sheetAttributesFor(input));
    } finally {
      model.endUpdate();
    }
    modal.close();
  };
  actions(modal, 'Apply', apply);
  format.focus();
  return modal;
}

// ---- Title Block ---------------------------------------------------------------------------------

const FIELD_LABELS: Record<TitleField, string> = {
  project: 'Project name',
  title: 'Drawing title',
  drawingNumber: 'Drawing number',
  scale: 'Scale (empty: from the page setup)',
  designed: 'Designed / author',
  checked: 'Checked',
  approved: 'Approved',
  date: 'Date',
  revision: 'Revision (empty: the last revision)',
  company: 'Company',
  status: 'Status',
};

/** File > Title Block…: the document's title block values (every sheet; Page Setup overrides per page). */
export function openTitleBlockDialog(session: DiagramSession): AppModal {
  const store = session.document.titleBlock;
  const values = store.get();
  const modal = openAppModal({ title: 'Title Block', testId: 'title-block-dialog', className: 'rd-print-dialog', onSubmit: () => save() });
  modal.body.appendChild(el('p', 'rd-print-hint', 'Printed in the bottom-right corner of every sheet. Saved in the .drawio file.'));
  const inputs = new Map<TitleField, HTMLInputElement>();
  const cells: HTMLElement[] = [];
  for (const f of TITLE_FIELDS) {
    const input = textInput(f, values[f]);
    inputs.set(f, input);
    cells.push(field(FIELD_LABELS[f], input));
  }
  const lang = el('select');
  lang.name = 'lang';
  for (const [value, label] of [
    ['pl', 'Polski (PL)'],
    ['en', 'English (EN)'],
  ] as const) {
    const option = el('option', undefined, label);
    option.value = value;
    lang.appendChild(option);
  }
  lang.value = values.lang;
  cells.push(field('Labels', lang));
  modal.body.appendChild(grid(2, ...cells));

  let logo = values.logo;
  const preview = el('img');
  preview.alt = 'Company logo';
  const file = el('input');
  file.type = 'file';
  file.accept = 'image/png,image/jpeg';
  file.name = 'logo';
  file.setAttribute('aria-label', 'Company logo (PNG or JPEG)');
  const remove = button('Remove logo', 'rd-tpl-btn', () => {
    logo = '';
    sync();
  });
  const sync = (): void => {
    preview.hidden = !logo;
    if (logo) preview.src = logo;
    else preview.removeAttribute('src');
    remove.hidden = !logo;
  };
  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    if (!picked) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (url.length > MAX_LOGO_LENGTH || !sanitizeLogo(url)) {
        globalNotificationManager.error('The logo must be a PNG or JPEG image of at most 500 KB.');
        return;
      }
      logo = url;
      sync();
    };
    reader.readAsDataURL(picked);
  });
  const logoRow = el('div', 'rd-print-logo');
  logoRow.append(preview, file, remove);
  modal.body.appendChild(fieldset('Company logo (optional)', logoRow));
  sync();

  const save = (): void => {
    const next: Record<string, string> = { logo, lang: lang.value };
    for (const [f, input] of inputs) next[f] = input.value;
    store.set(next);
    modal.close();
  };
  actions(modal, 'Save', save);
  inputs.get('project')?.focus();
  return modal;
}

// ---- Revisions -----------------------------------------------------------------------------------

const REVISION_LABELS: Record<(typeof REVISION_FIELDS)[number], string> = {
  rev: 'Rev.',
  date: 'Date',
  description: 'Description',
  author: 'Author',
  checked: 'Checked',
};

function today(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The revision after `rev`: A -> B, 3 -> 4, '' -> A. */
export function nextRevision(rev: string): string {
  const t = rev.trim();
  if (/^\d+$/.test(t)) return String(Number(t) + 1);
  if (/^[A-Y]$/i.test(t)) return String.fromCharCode(t.toUpperCase().charCodeAt(0) + 1);
  return t ? `${t}+` : 'A';
}

/** File > Revisions…: the revision table printed above the title block. */
export function openRevisionsDialog(session: DiagramSession): AppModal {
  const store = session.document.titleBlock;
  const rows: RevisionRow[] = store.revisions();
  const modal = openAppModal({ title: 'Revisions', testId: 'revisions-dialog', className: 'rd-print-dialog', onSubmit: () => save() });
  modal.body.appendChild(el('p', 'rd-print-hint', 'The revision table (tabela zmian) above the title block of every sheet.'));
  const table = el('table', 'rd-print-rev-table');
  const head = el('tr');
  for (const f of REVISION_FIELDS) head.appendChild(el('th', undefined, REVISION_LABELS[f]));
  head.appendChild(el('th'));
  table.appendChild(el('thead')).appendChild(head);
  const body = el('tbody');
  table.appendChild(body);
  const render = (): void => {
    body.replaceChildren();
    rows.forEach((row, i) => {
      const tr = el('tr');
      for (const f of REVISION_FIELDS) {
        const td = el('td');
        const input = textInput(`${f}-${i}`, row[f]);
        input.setAttribute('aria-label', `${REVISION_LABELS[f]} of row ${i + 1}`);
        input.addEventListener('input', () => {
          row[f] = input.value;
        });
        td.appendChild(input);
        tr.appendChild(td);
      }
      const td = el('td');
      const del = button('✕', 'rd-tpl-btn', () => {
        rows.splice(i, 1);
        render();
      });
      del.setAttribute('aria-label', `Remove revision ${row.rev || i + 1}`);
      td.appendChild(del);
      tr.appendChild(td);
      body.appendChild(tr);
    });
  };
  render();
  modal.body.appendChild(table);
  const add = button('Add revision', 'rd-tpl-btn rd-print-add-rev', () => {
    rows.push({ rev: nextRevision(rows[rows.length - 1]?.rev ?? ''), date: today(), description: '', author: store.get().designed, checked: '' });
    render();
    body.querySelector<HTMLInputElement>(`input[name="description-${rows.length - 1}"]`)?.focus();
  });
  modal.body.appendChild(add);
  const save = (): void => {
    store.setRevisions(rows);
    modal.close();
  };
  actions(modal, 'Save', save);
  add.focus();
  return modal;
}

// ---- Pages ----------------------------------------------------------------------------------------

function promptName(title: string, value: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: string | null): void => {
      if (done) return;
      done = true;
      modal.close();
      resolve(result);
    };
    const modal = openAppModal({ title, testId: 'page-name-dialog', className: 'rd-print-dialog', onCancel: () => finish(null), onSubmit: () => finish(input.value.trim() || null) });
    const input = textInput('page-name', value, 120);
    modal.body.appendChild(field('Name', input));
    modal.actions.append(button('Cancel', 'rd-tpl-btn', () => finish(null)), button('OK', 'rd-tpl-btn rd-tpl-btn-primary', () => finish(input.value.trim() || null)));
    input.focus();
    input.select();
  });
}

/** Shows page `index`, reporting a page that cannot be read. */
export async function goToPage(session: DiagramSession, index: number): Promise<void> {
  try {
    await session.document.showPage(index);
    const page = session.document.listPages()[index];
    if (page) globalNotificationManager.info(`Page ${index + 1}: ${page.name}`);
  } catch (error) {
    globalNotificationManager.error(`Could not show the page: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** View > Pages…: the drawing pages of the file (go to, add, rename, delete). */
export function openPagesDialog(session: DiagramSession): AppModal {
  const doc = session.document;
  const modal = openAppModal({ title: 'Pages', testId: 'pages-dialog', className: 'rd-print-dialog' });
  modal.body.appendChild(el('p', 'rd-print-hint', 'The drawing pages (sheets) of this file. Scenario steps are kept as their own pages and not listed.'));
  const list = el('ul', 'rd-print-pages');
  modal.body.appendChild(list);
  const render = (): void => {
    list.replaceChildren();
    for (const page of doc.listPages()) {
      const li = el('li');
      li.dataset.index = String(page.index);
      if (page.shown) li.setAttribute('aria-current', 'page');
      li.appendChild(el('span', 'rd-print-page-name', `${page.index + 1}. ${page.name}${page.shown ? ' (shown)' : ''}`));
      const go = button('Go to', 'rd-tpl-btn rd-print-page-go', () => {
        void goToPage(session, page.index).then(() => modal.close());
      });
      go.disabled = page.shown;
      const rename = button('Rename', 'rd-tpl-btn', () => {
        void promptName('Rename page', page.name).then((name) => {
          if (name) doc.renamePage(page.index, name);
          render();
        });
      });
      li.append(go, rename);
      if (page.index > 0) {
        const del = button('Delete', 'rd-tpl-btn', () => {
          void confirmDialog({ title: 'Delete page', message: `Delete page "${page.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true }).then(async (yes) => {
            if (yes) await doc.removePage(page.index);
            render();
          });
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    }
  };
  render();
  const add = button('Add page', 'rd-tpl-btn rd-print-page-add', () => {
    void promptName('New page', `Page ${doc.listPages().length + 1}`).then(async (name) => {
      if (!name) return;
      const index = doc.addPage(name);
      await goToPage(session, index);
      modal.close();
    });
  });
  modal.actions.append(add, button('Close', 'rd-tpl-btn rd-tpl-btn-primary', () => modal.close()));
  return modal;
}

// ---- Sheet reference --------------------------------------------------------------------------------

/** Edit > Insert Sheet Reference…: a continuation marker to another page, at the view centre. */
export function openSheetRefDialog(session: DiagramSession): AppModal | null {
  const { graph, document: doc } = session;
  const pages = doc.listPages().filter((p) => !p.shown);
  if (pages.length === 0) {
    globalNotificationManager.info('Add a second page first (View > Pages…): a sheet reference points to another page.');
    return null;
  }
  const modal = openAppModal({ title: 'Insert Sheet Reference', testId: 'sheet-ref-dialog', className: 'rd-print-dialog', onSubmit: () => void insert() });
  modal.body.appendChild(el('p', 'rd-print-hint', 'A "continued on sheet n" marker. Click it on the canvas to go to that page; draw.io follows it as a page link.'));
  const target = el('select');
  target.name = 'targetPage';
  for (const page of pages) {
    const option = el('option', undefined, `${page.index + 1}. ${page.name}`);
    option.value = page.id;
    target.appendChild(option);
  }
  modal.body.appendChild(field('Target page', target));
  const insert = async (): Promise<void> => {
    const pageId = target.value;
    modal.close();
    const numberOf = await sheetNumbers(doc);
    const label = continuationLabel(numberOf(pageId), doc.titleBlock.get().lang);
    const { width, height } = CONTINUATION_SIZE;
    const container = graph.container as HTMLElement;
    const { scale, translate } = graph.view;
    const x = Math.round((container.scrollLeft + container.clientWidth / 2) / scale - translate.x - width / 2);
    const y = Math.round((container.scrollTop + container.clientHeight / 2) / scale - translate.y - height / 2);
    graph.batchUpdate(() => {
      const cell = graph.insertVertex(graph.getDefaultParent(), null, createSheetRefValue(pageId, label), x, y, width, height, CONTINUATION_STYLE as unknown as CellStyle);
      graph.setSelectionCells([cell]);
    });
  };
  actions(modal, 'Insert', () => void insert());
  target.focus();
  return modal;
}
