/**
 * @file session.ts
 * @brief Two-way sync between a tab's Railway Script and its drawing.
 *
 * - Text -> drawing (`apply`): parse + validate; with no errors the generated drawing replaces the
 *   previous generated cells (apply.ts) as one undo step. The text is then "in sync".
 * - Drawing -> text: every model change that is not an apply is written into the text (sync.ts),
 *   debounced, but ONLY while the text is in sync (no unapplied edits). Otherwise the session is
 *   in conflict: the drawing edit stays, the text stays, and the panel offers "Apply script" (the
 *   drawing follows the text) or "Use drawing" (the text edits are discarded, then synced).
 * - Undo/redo of an apply puts back the text of before/after that apply (when in sync).
 * - Loads (file, cache, scenario snapshot: root changes) just take the drawing as in sync.
 * The `applying` flag keeps an apply's own model events out of the sync (no feedback loop).
 */
import { onModelChange, onModelEvent } from '../core/graph-events';
import { emit as emitAppEvent } from '../core/event-bus';
import { InternalEvent, RootChange } from '@maxgraph/core';
import type { EventObject, EventSource, Graph } from '@maxgraph/core';
import type { KindId } from '../railway/catalogue';
import type { LibraryEntry } from '../drawio-shapes/engine';
import type { ApplyCounts } from './apply';
import { applyGenerated } from './apply';
import { buildScriptModel } from './build';
import type { Diagnostic, ParsedScript } from './parse';
import { diagnosticsFor, parseScript } from './parse';
import type { RailwayScriptStore, ScriptChangeSource } from './script-store';
import type { Snapshot } from './sync';
import { drawingEdits, editText, takeSnapshot } from './sync';

export interface SessionStatus {
  diagnostics: Diagnostic[];
  /** The drawing changed while the text had unapplied edits (or errors). */
  conflict: boolean;
  /** The text differs from the drawing (edits not applied yet). */
  dirty: boolean;
  /** Result of the last apply. */
  lastApply: { counts: ApplyCounts; objects: Partial<Record<KindId, number>>; at: number } | null;
}

export interface ApplyOutcome {
  ok: boolean;
  diagnostics: Diagnostic[];
  counts?: ApplyCounts;
}

type SymbolsLoader = () => Promise<LibraryEntry[]>;

let symbolsLoader: SymbolsLoader = async () => {
  const { loadErtmsLibraryEntries } = await import('../drawio-shapes/ertms-library');
  return loadErtmsLibraryEntries();
};
let symbolsCache: Promise<LibraryEntry[]> | null = null;

/** Replaces where the ERTMS library entries come from (tests). */
export function setSymbolsLoader(loader: SymbolsLoader): void {
  symbolsLoader = loader;
  symbolsCache = null;
}

async function symbols(): Promise<{ entries: LibraryEntry[]; failed: boolean }> {
  symbolsCache ??= symbolsLoader();
  try {
    return { entries: await symbolsCache, failed: false };
  } catch {
    symbolsCache = null;
    return { entries: [], failed: true };
  }
}

interface ApplyRecord {
  before: string;
  after: string;
}

export class ScriptSession {
  private lastSynced = '';
  private parsed: ParsedScript | null = null;
  private snapshot: Snapshot = new Map();
  private applying = false;
  private conflict = false;
  private diagnostics: Diagnostic[] = [];
  private lastApply: SessionStatus['lastApply'] = null;
  private readonly applyRecords = new WeakMap<object, ApplyRecord>();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<(s: SessionStatus) => void>();
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    readonly graph: Graph,
    readonly store: RailwayScriptStore,
    private readonly options: { syncDelay?: number } = {}
  ) {
    this.unsubscribe.push(onModelChange(this.graph, (_s: EventSource, evt: EventObject): void => this.onModelChange(evt)));
    this.unsubscribe.push(
      this.store.subscribe((_text, source: ScriptChangeSource) => {
        if (source === 'load') this.takeDrawingAsSynced();
        else if (source === 'editor' || source === 'api') {
          this.revalidate();
          this.emit();
        }
      })
    );
    this.takeDrawingAsSynced();
  }

  destroy(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.unsubscribe.forEach((u) => u());
    this.listeners.clear();
  }

  status(): SessionStatus {
    return { diagnostics: this.diagnostics, conflict: this.conflict, dirty: this.isDirty(), lastApply: this.lastApply };
  }

  onStatus(listener: (s: SessionStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const s = this.status();
    for (const l of [...this.listeners]) l(s);
  }

  isDirty(): boolean {
    return this.store.get() !== this.lastSynced;
  }

  /** Parses the current text (diagnostics only). */
  revalidate(): ParsedScript {
    const text = this.store.get();
    if (this.parsed?.text !== text) this.parsed = parseScript(text);
    this.diagnostics = text.trim() === '' ? [] : this.parsed.diagnostics;
    return this.parsed;
  }

  /** The drawing as it is now matches the text as it is now (after loads). */
  takeDrawingAsSynced(): void {
    this.lastSynced = this.store.get();
    const parsed = this.revalidate();
    this.snapshot = parsed.model ? takeSnapshot(this.graph.getDataModel(), parsed.model) : new Map();
    this.conflict = false;
    this.emit();
  }

  /** Text -> drawing. Resolves with ok=false (drawing unchanged) when the text has errors. */
  async apply(): Promise<ApplyOutcome> {
    const text = this.store.get();
    const parsed = this.revalidate();
    if (parsed.hasErrors || !parsed.model) {
      this.emit();
      return { ok: false, diagnostics: this.diagnostics };
    }
    const lib = await symbols();
    // the text may have changed while the library loaded: apply the latest text
    if (this.store.get() !== text) return this.apply();
    const built = buildScriptModel(parsed.model, lib.entries);
    const extra = diagnosticsFor(parsed, built.issues);
    if (lib.failed) extra.unshift({ severity: 'warning', message: 'The ERTMS library could not be loaded: simple shapes are used instead of the ERTMS symbols', line: 1, col: 1, from: 0, to: 0 });
    this.diagnostics = [...parsed.diagnostics, ...extra].sort((a, b) => a.from - b.from);
    if (extra.some((d) => d.severity === 'error')) {
      this.emit();
      return { ok: false, diagnostics: this.diagnostics };
    }
    let edit: object | null = null;
    const offUndo = onModelEvent(this.graph, InternalEvent.UNDO, (_s: EventSource, evt: EventObject): void => {
      edit = evt.getProperty('edit') as object;
    });
    this.applying = true;
    let counts: ApplyCounts;
    // a script drawn into an empty tab opens zoomed in (railway symbols are small; src/ui/railway-zoom.ts)
    const wasEmpty = this.graph.getGraphBounds().width <= 0 && this.graph.getGraphBounds().height <= 0;
    try {
      counts = applyGenerated(this.graph, built.model);
    } finally {
      this.applying = false;
      offUndo();
    }
    if (edit) this.applyRecords.set(edit, { before: this.lastSynced, after: text });
    this.lastSynced = text;
    this.snapshot = takeSnapshot(this.graph.getDataModel(), parsed.model);
    this.conflict = false;
    this.lastApply = { counts, objects: built.counts, at: Date.now() };
    if (wasEmpty) emitAppEvent('railway-zoom-request', { graph: this.graph });
    this.emit();
    return { ok: true, diagnostics: this.diagnostics, counts };
  }

  private onModelChange(evt: EventObject): void {
    if (this.applying) return;
    const changes = (evt.getProperty('changes') as unknown[] | undefined) ?? [];
    if (changes.some((c) => c instanceof RootChange)) {
      this.takeDrawingAsSynced();
      return;
    }
    const edit = evt.getProperty('edit') as { undone?: boolean } | undefined;
    const record = edit ? this.applyRecords.get(edit) : undefined;
    if (record && edit) {
      // undo/redo of an apply: the text of before/after it
      const target = edit.undone ? record.before : record.after;
      const from = edit.undone ? record.after : record.before;
      if (this.store.get() === from && this.lastSynced === from) {
        this.lastSynced = target;
        this.store.set(target, 'drawing');
        this.revalidate();
        this.snapshot = this.parsed?.model ? takeSnapshot(this.graph.getDataModel(), this.parsed.model) : new Map();
        this.emit();
      } else {
        this.conflict = true;
        this.emit();
      }
      return;
    }
    if (this.store.get().trim() === '' && this.lastSynced.trim() === '') return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    const delay = this.options.syncDelay ?? 300;
    if (delay <= 0) this.syncNow();
    else this.syncTimer = setTimeout(() => this.syncNow(), delay);
  }

  /** Drawing -> text now (normally debounced after model changes). */
  syncNow(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    const text = this.store.get();
    if (text !== this.lastSynced) {
      this.conflict = true;
      this.emit();
      return;
    }
    const parsed = this.revalidate();
    if (!parsed.model) {
      this.conflict = true;
      this.emit();
      return;
    }
    const doc = parseScript(text).doc;
    const edits = drawingEdits({ doc, model: this.graph.getDataModel(), script: parsed.model, snapshot: this.snapshot });
    if (edits.length > 0) {
      const next = editText(text, edits, parsed.json);
      this.lastSynced = next;
      this.store.set(next, 'drawing');
      // The text now follows the drawing: the status reads "In sync", not the last apply
      this.lastApply = null;
    }
    const after = this.revalidate();
    this.snapshot = after.model ? takeSnapshot(this.graph.getDataModel(), after.model) : this.snapshot;
    this.conflict = false;
    this.emit();
  }

  /** Conflict resolution "Use drawing": drops the unapplied text edits, then syncs the drawing. */
  useDrawing(): void {
    this.store.set(this.lastSynced, 'api');
    this.syncNow();
  }

  /** Text the drawing currently matches. */
  syncedText(): string {
    return this.lastSynced;
  }
}
