/**
 * @file title-block.ts
 * @brief The title block (tabliczka rysunkowa) and revision table (tabela zmian) values of a
 *        document, their PL / EN labels, and the values printed on one sheet (the document's
 *        values with the page's overrides, sheet x of n, the scale).
 *
 * The store is a project section (project-section.ts): `rdTitleBlock` (JSON of the fields) and
 * `rdRevisions` (JSON rows) on the main page's `<diagram>`, which draw.io keeps.
 */
import { sanitizeXmlText } from '../format/drawio-xml';
import type { SheetSetup } from './sheet-setup';

export type SheetLang = 'pl' | 'en';

export const TITLE_FIELDS = ['project', 'title', 'drawingNumber', 'scale', 'designed', 'checked', 'approved', 'date', 'revision', 'company', 'status'] as const;
export type TitleField = (typeof TITLE_FIELDS)[number];

export interface TitleBlockValues extends Record<TitleField, string> {
  /** Company logo: a PNG / JPEG data URL, or ''. */
  logo: string;
  lang: SheetLang;
}

export interface RevisionRow {
  rev: string;
  date: string;
  description: string;
  author: string;
  checked: string;
}

export const REVISION_FIELDS = ['rev', 'date', 'description', 'author', 'checked'] as const satisfies ReadonlyArray<keyof RevisionRow>;

/** Largest stored logo (data URL characters). */
export const MAX_LOGO_LENGTH = 700_000;
const MAX_FIELD_LENGTH = 300;
const MAX_REVISIONS = 50;

export const LABELS: Readonly<Record<SheetLang, Record<TitleField | 'sheet' | 'of' | 'role' | 'name' | 'legend' | 'nts' | RevisionColumn, string>>> = {
  pl: {
    project: 'Projekt',
    title: 'Tytuł rysunku',
    drawingNumber: 'Nr rysunku',
    scale: 'Skala',
    designed: 'Projektował',
    checked: 'Sprawdził',
    approved: 'Zatwierdził',
    date: 'Data',
    revision: 'Rewizja',
    company: 'Firma',
    status: 'Status',
    sheet: 'Arkusz',
    of: 'z',
    role: 'Funkcja',
    name: 'Imię i nazwisko',
    legend: 'Legenda',
    nts: 'bez skali',
    revRev: 'Rew.',
    revDate: 'Data',
    revDescription: 'Opis zmiany',
    revAuthor: 'Autor',
    revChecked: 'Sprawdził',
  },
  en: {
    project: 'Project',
    title: 'Drawing title',
    drawingNumber: 'Drawing no.',
    scale: 'Scale',
    designed: 'Designed',
    checked: 'Checked',
    approved: 'Approved',
    date: 'Date',
    revision: 'Revision',
    company: 'Company',
    status: 'Status',
    sheet: 'Sheet',
    of: 'of',
    role: 'Role',
    name: 'Name',
    legend: 'Legend',
    nts: 'NTS',
    revRev: 'Rev.',
    revDate: 'Date',
    revDescription: 'Description',
    revAuthor: 'Author',
    revChecked: 'Checked',
  },
};

export type RevisionColumn = 'revRev' | 'revDate' | 'revDescription' | 'revAuthor' | 'revChecked';

export function emptyTitleBlock(): TitleBlockValues {
  const values = Object.fromEntries(TITLE_FIELDS.map((f) => [f, ''])) as Record<TitleField, string>;
  return { ...values, logo: '', lang: 'pl' };
}

function text(value: unknown): string {
  return typeof value === 'string' ? sanitizeXmlText(value).slice(0, MAX_FIELD_LENGTH) : '';
}

/** A logo value: only PNG / JPEG data URLs (jsPDF / svg2pdf embed those), bounded. */
export function sanitizeLogo(value: unknown): string {
  return typeof value === 'string' && value.length <= MAX_LOGO_LENGTH && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
}

/** Title block values from untrusted JSON (file attribute, tab cache, AI tool). */
export function sanitizeTitleBlock(raw: unknown): TitleBlockValues {
  const out = emptyTitleBlock();
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const f of TITLE_FIELDS) out[f] = text(obj[f]);
  out.logo = sanitizeLogo(obj.logo);
  out.lang = obj.lang === 'en' ? 'en' : 'pl';
  return out;
}

/** Revision rows from untrusted JSON. */
export function sanitizeRevisions(raw: unknown): RevisionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .slice(0, MAX_REVISIONS)
    .map((r) => ({ rev: text(r.rev), date: text(r.date), description: text(r.description), author: text(r.author), checked: text(r.checked) }))
    .filter((r) => REVISION_FIELDS.some((f) => r[f].trim() !== ''));
}

export function isEmptyTitleBlock(values: TitleBlockValues): boolean {
  return TITLE_FIELDS.every((f) => values[f].trim() === '') && !values.logo && values.lang === 'pl';
}

/** Title block + revisions of one document, with change listeners. */
export class TitleBlockStore {
  private values: TitleBlockValues = emptyTitleBlock();
  private rows: RevisionRow[] = [];
  private readonly listeners = new Set<() => void>();

  get(): TitleBlockValues {
    return { ...this.values };
  }

  revisions(): RevisionRow[] {
    return this.rows.map((r) => ({ ...r }));
  }

  /** Replaces (or merges, with a partial) the title block values. */
  set(values: Partial<TitleBlockValues>): void {
    this.values = sanitizeTitleBlock({ ...this.values, ...values });
    this.changed();
  }

  setRevisions(rows: readonly RevisionRow[]): void {
    this.rows = sanitizeRevisions(rows);
    this.changed();
  }

  /** Replaces both (a load). */
  replace(values: TitleBlockValues, rows: readonly RevisionRow[]): void {
    this.values = sanitizeTitleBlock(values);
    this.rows = sanitizeRevisions(rows);
    this.changed();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private changed(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** What one sheet prints in its title block. */
export interface SheetTitleValues extends TitleBlockValues {
  sheetNumber: string;
  sheetCount: number;
}

/**
 * The values of sheet `index` (0-based) of `count`: the page's title / drawing number / sheet
 * number override the document's; an empty scale is the setup's (1:n, or "bez skali" / "NTS" when
 * fitted); an empty revision is the last revision row's.
 */
export function sheetTitleValues(doc: TitleBlockValues, revisions: readonly RevisionRow[], setup: SheetSetup, index: number, count: number): SheetTitleValues {
  const labels = LABELS[doc.lang];
  const ratio = Number.isInteger(setup.scale) ? String(setup.scale) : setup.scale.toFixed(2).replace(/\.?0+$/, '');
  return {
    ...doc,
    title: setup.sheetTitle.trim() || doc.title,
    drawingNumber: setup.drawingNumber.trim() || doc.drawingNumber,
    scale: doc.scale.trim() || (setup.scaleMode === 'fixed' ? `1:${ratio}` : labels.nts),
    revision: doc.revision.trim() || revisions[revisions.length - 1]?.rev || '',
    sheetNumber: setup.sheetNumber.trim() || String(index + 1),
    sheetCount: count,
  };
}

/** "Arkusz 3 z 5" / "Sheet 3 of 5". */
export function sheetOfText(values: SheetTitleValues): string {
  const l = LABELS[values.lang];
  return `${values.sheetNumber} ${l.of} ${values.sheetCount}`;
}
