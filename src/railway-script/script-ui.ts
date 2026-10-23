/**
 * @file script-ui.ts
 * @brief Railway Script UI (lazy chunk with the YAML parser, loaded by install-railway-script.ts):
 *        the per-tab sessions, the left-panel tab "Railway Script" (editor with line numbers and
 *        inline error marks, problem list, Apply / Auto-apply, Examples, Generate from drawing,
 *        conflict banner) and File > Import/Export Railway Script.
 */
import { off, on } from '../core/event-bus';
import './railway-script.css';
import type { TabData, TabManager } from '../ui/tabs';
import { downloadBlob } from '../railway/install-railway-data';
import { fileBaseName } from '../railway/report';
import { generateScript } from './generate';
import type { Diagnostic } from './parse';
import { parseScript } from './parse';
import type { SessionStatus } from './session';
import { ScriptSession } from './session';
import { SCRIPT_TEMPLATES } from './templates';
import { confirmDialog } from '../ui/app-dialogs';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

/** Themed confirmation before the editor's text is replaced (not the native confirm()). */
function confirmReplace(message: string): Promise<boolean> {
  return confirmDialog({ title: 'Replace the script', message, confirmLabel: 'Replace', testId: 'rs-replace-confirm' });
}

export interface ScriptNotifier {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export const AUTO_APPLY_KEY = STORAGE_KEYS.railwayScriptAutoApply;

// ---------------------------------------------------------------------------------------------
// Sessions (one per tab with a script)
// ---------------------------------------------------------------------------------------------

const sessions = new Map<string, ScriptSession>();

export function ensureSession(tab: TabData): ScriptSession {
  let s = sessions.get(tab.id);
  if (!s || s.graph !== tab.graph) {
    s?.destroy();
    s = new ScriptSession(tab.graph, tab.saveLoadController.getRailwayScript());
    sessions.set(tab.id, s);
  }
  return s;
}

export function destroySession(tabId: string): void {
  sessions.get(tabId)?.destroy();
  sessions.delete(tabId);
}

export function getSession(tabId: string): ScriptSession | null {
  return sessions.get(tabId) ?? null;
}

function readAutoApply(): boolean {
  try {
    return readItem(AUTO_APPLY_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeAutoApply(on: boolean): void {
  try {
    writeItem(AUTO_APPLY_KEY, on ? '1' : '0');
  } catch {
    // session only
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, className: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------

export interface ScriptPanel {
  /** Shows the active tab's script (after a tab switch). */
  bind(): void;
  /** Focuses the editor. */
  focus(): void;
  destroy(): void;
}

let panel: ScriptPanel | null = null;

export function mountPanel(container: HTMLElement, tabManager: TabManager, notify: ScriptNotifier): ScriptPanel {
  if (panel) return panel;
  container.replaceChildren();
  const root = el('div', 'rd-rs-panel');
  root.dataset.testid = 'railway-script-panel';

  // toolbar
  const bar = el('div', 'rd-rs-toolbar');
  const applyBtn = button('Apply', 'rd-btn-solid rd-btn-primary rd-rs-apply', 'Draw the script into the diagram (Ctrl+Enter)', () => void runApply(true));
  const autoLabel = el('label', 'rd-rs-auto');
  const auto = el('input');
  auto.type = 'checkbox';
  auto.checked = readAutoApply();
  auto.className = 'rd-rs-auto-check';
  auto.addEventListener('change', () => {
    writeAutoApply(auto.checked);
    if (auto.checked) scheduleApply();
  });
  autoLabel.append(auto, document.createTextNode(' Auto-apply'));
  autoLabel.title = 'Apply valid scripts while typing';
  const examples = el('select', 'rd-input rd-rs-examples');
  examples.title = 'Insert an example script';
  examples.append(new Option('Examples…', ''));
  for (const t of SCRIPT_TEMPLATES) examples.append(new Option(t.title, t.id));
  examples.addEventListener('change', async () => {
    const t = SCRIPT_TEMPLATES.find((x) => x.id === examples.value);
    examples.value = '';
    if (!t) return;
    if (textarea.value.trim() !== '' && !(await confirmReplace(`Replace the script with the example "${t.title}"?`))) return;
    setText(t.text, true);
    void runApply(true);
  });
  const genBtn = button('From drawing', 'rd-btn rd-rs-generate', 'Generate a script from the railway objects of the drawing', async () => {
    const tab = tabManager.getActiveTab();
    if (!tab) return;
    if (textarea.value.trim() !== '' && !(await confirmReplace('Replace the script with one generated from the drawing?'))) return;
    const r = generateScript(tab.graph.getDataModel(), tab.saveLoadController.getProjectName());
    setText(r.text, false);
    const total = Object.values(r.counts).reduce((s, n) => s + (n ?? 0), 0);
    if (r.skipped.length > 0) notify.warning(`Script generated (${total} objects). Not written: ${r.skipped.slice(0, 5).join('; ')}${r.skipped.length > 5 ? '; …' : ''}`);
    else notify.success(`Script generated from the drawing (${total} objects). Apply draws them in the schematic layout.`);
  });
  bar.append(applyBtn, autoLabel, examples, genBtn);

  // conflict banner
  const banner = el('div', 'rd-rs-banner');
  banner.dataset.testid = 'railway-script-conflict';
  banner.setAttribute('role', 'status');
  banner.hidden = true;
  const bannerText = el('span', 'rd-rs-banner-text', 'The drawing changed while the script has edits that are not applied (or errors).');
  const useText = button('Apply script', 'rd-btn rd-rs-banner-apply', 'The drawing follows the script', () => void runApply(true));
  const useDrawing = button('Use drawing', 'rd-btn rd-rs-banner-drawing', 'Discard the script edits; the script follows the drawing', () => current()?.useDrawing());
  banner.append(bannerText, useText, useDrawing);

  // editor
  const editor = el('div', 'rd-rs-editor');
  const gutter = el('div', 'rd-rs-gutter');
  gutter.setAttribute('aria-hidden', 'true');
  const code = el('div', 'rd-rs-code');
  const highlight = el('pre', 'rd-rs-highlight');
  highlight.setAttribute('aria-hidden', 'true');
  // A text-transparent mirror of the textarea (only the marks' underline/background show):
  // theme-contrast.spec.ts skips its transparent text and checks the marks separately
  highlight.dataset.contrastSkip = 'mirror';
  const textarea = el('textarea', 'rd-rs-text');
  textarea.dataset.testid = 'railway-script-text';
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.setAttribute('autocapitalize', 'off');
  textarea.setAttribute('autocomplete', 'off');
  textarea.setAttribute('aria-label', 'Railway Script (YAML or JSON)');
  textarea.placeholder = 'railwayScript: 1\ntracks:\n  - id: T1\n    startKm: 0\n    endKm: 1.0\n\n(Examples… or From drawing)';
  code.append(highlight, textarea);
  editor.append(gutter, code);

  const statusLine = el('div', 'rd-rs-status');
  statusLine.dataset.testid = 'railway-script-status';
  statusLine.setAttribute('aria-live', 'polite');
  const problems = el('ul', 'rd-rs-problems');
  problems.dataset.testid = 'railway-script-problems';
  const help = el('div', 'rd-rs-help');
  const link = el('a', undefined, 'Language reference');
  link.href = 'https://github.com/bula173/railway-drawer/blob/main/docs/RAILWAY-SCRIPT.md';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const schema = el('a', undefined, 'JSON Schema');
  schema.href = `${import.meta.env.BASE_URL}schemas/railway-script-1.schema.json`;
  schema.target = '_blank';
  schema.rel = 'noopener noreferrer';
  help.append(link, document.createTextNode(' · '), schema);

  root.append(bar, banner, editor, statusLine, problems, help);
  container.append(root);

  // ---- state
  let boundTab: TabData | null = null;
  let stopStatus: (() => void) | null = null;
  let stopStore: (() => void) | null = null;
  let applyTimer: ReturnType<typeof setTimeout> | null = null;
  let diagnostics: Diagnostic[] = [];

  const current = (): ScriptSession | null => (boundTab ? ensureSession(boundTab) : null);

  function renderGutter(): void {
    const lines = textarea.value.split('\n').length;
    const errorLines = new Map<number, 'error' | 'warning'>();
    for (const d of diagnostics) if (errorLines.get(d.line) !== 'error') errorLines.set(d.line, d.severity);
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= lines; i++) {
      const n = el('div', 'rd-rs-line-no', String(i));
      const sev = errorLines.get(i);
      if (sev) n.classList.add(sev === 'error' ? 'rd-rs-line-error' : 'rd-rs-line-warning');
      frag.append(n);
    }
    gutter.replaceChildren(frag);
    gutter.scrollTop = textarea.scrollTop;
  }

  function renderHighlight(): void {
    const text = textarea.value;
    const marks = diagnostics
      .map((d) => ({ from: Math.min(d.from, text.length), to: Math.min(Math.max(d.to, d.from + 1), text.length), severity: d.severity }))
      .sort((a, b) => a.from - b.from);
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const m of marks) {
      if (m.from < pos) continue;
      frag.append(text.slice(pos, m.from));
      const mark = el('mark', m.severity === 'error' ? 'rd-rs-mark-error' : 'rd-rs-mark-warning', text.slice(m.from, m.to) || ' ');
      frag.append(mark);
      pos = m.to;
    }
    frag.append(`${text.slice(pos)}\n`);
    highlight.replaceChildren(frag);
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }

  function renderProblems(): void {
    problems.replaceChildren();
    for (const d of diagnostics) {
      const li = el('li', `rd-rs-problem rd-rs-${d.severity}`);
      li.tabIndex = 0;
      li.dataset.line = String(d.line);
      li.dataset.severity = d.severity;
      li.append(el('span', 'rd-rs-problem-pos', `${d.line}:${d.col}`), el('span', 'rd-rs-problem-msg', d.message));
      const jump = (): void => {
        textarea.focus();
        textarea.setSelectionRange(d.from, Math.max(d.to, d.from));
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 16;
        textarea.scrollTop = Math.max(0, (d.line - 3) * lineHeight);
        syncScroll();
      };
      li.addEventListener('click', jump);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          jump();
        }
      });
      problems.append(li);
    }
  }

  function renderStatus(s: SessionStatus | null): void {
    const errors = diagnostics.filter((d) => d.severity === 'error').length;
    const warnings = diagnostics.length - errors;
    banner.hidden = !s?.conflict;
    root.dataset.state = errors > 0 ? 'error' : s?.dirty ? 'dirty' : 'synced';
    if (textarea.value.trim() === '') {
      statusLine.textContent = 'No script for this diagram. Type one, pick an example or generate it from the drawing.';
      return;
    }
    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}: the drawing is unchanged`);
    else if (s?.dirty) parts.push('Not applied yet');
    else if (s?.lastApply) {
      const n = Object.values(s.lastApply.objects).reduce((t, v) => t + (v ?? 0), 0);
      parts.push(`Applied: ${n} objects`);
    } else parts.push('In sync with the drawing');
    if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
    statusLine.textContent = parts.join(' · ');
  }

  function render(s: SessionStatus | null): void {
    diagnostics = s ? s.diagnostics : parseScript(textarea.value).diagnostics;
    renderGutter();
    renderHighlight();
    renderProblems();
    renderStatus(s);
  }

  function syncScroll(): void {
    gutter.scrollTop = textarea.scrollTop;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }

  /** Puts text into the editor and the tab's store. */
  function setText(text: string, fromEditor: boolean): void {
    if (!boundTab) return;
    textarea.value = text;
    boundTab.saveLoadController.getRailwayScript().set(text, fromEditor ? 'editor' : 'api');
    ensureSession(boundTab);
    render(current()?.status() ?? null);
    if (!fromEditor) return;
  }

  async function runApply(user: boolean): Promise<void> {
    if (applyTimer) {
      clearTimeout(applyTimer);
      applyTimer = null;
    }
    const s = current();
    if (!s || textarea.value.trim() === '') return;
    const result = await s.apply();
    if (user && !result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      if (errors.length > 0) notify.error(`Railway Script: ${errors.length} error${errors.length === 1 ? '' : 's'} (line ${errors[0].line}): the drawing is unchanged`);
    }
  }

  function scheduleApply(): void {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      applyTimer = null;
      const s = current();
      if (!s) return;
      const parsed = s.revalidate();
      if (auto.checked && !parsed.hasErrors && textarea.value.trim() !== '') void runApply(false);
      else render(s.status());
    }, 500);
  }

  textarea.addEventListener('input', () => {
    if (!boundTab) return;
    boundTab.saveLoadController.getRailwayScript().set(textarea.value, 'editor');
    ensureSession(boundTab);
    renderGutter();
    renderHighlight();
    scheduleApply();
  });
  textarea.addEventListener('scroll', syncScroll);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b, value } = textarea;
      textarea.value = `${value.slice(0, a)}  ${value.slice(b)}`;
      textarea.setSelectionRange(a + 2, a + 2);
      textarea.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void runApply(true);
    }
  });

  function bind(): void {
    const tab = tabManager.getActiveTab();
    if (tab === boundTab && tab) return;
    stopStatus?.();
    stopStore?.();
    stopStatus = stopStore = null;
    boundTab = tab;
    if (!tab) {
      textarea.value = '';
      render(null);
      return;
    }
    const store = tab.saveLoadController.getRailwayScript();
    textarea.value = store.get();
    const s = ensureSession(tab);
    stopStatus = s.onStatus((st) => render(st));
    stopStore = store.subscribe((text, source) => {
      if (source === 'editor' || textarea.value === text) return;
      const pos = textarea.selectionStart;
      const top = textarea.scrollTop;
      textarea.value = text;
      textarea.setSelectionRange(Math.min(pos, text.length), Math.min(pos, text.length));
      textarea.scrollTop = top;
      render(s.status());
    });
    s.revalidate();
    render(s.status());
  }

  const onTabChanged = (): void => bind();
  on('tab-changed', onTabChanged);
  bind();
  panel = {
    bind,
    focus: () => textarea.focus(),
    destroy: () => {
      off('tab-changed', onTabChanged);
      stopStatus?.();
      stopStore?.();
      root.remove();
      panel = null;
    },
  };
  return panel;
}

// ---------------------------------------------------------------------------------------------
// File > Import / Export Railway Script
// ---------------------------------------------------------------------------------------------

/** Opens a script file in a new tab and applies it. Resolves with the tab id (null: failed). */
export async function importScriptText(tabManager: TabManager, notify: ScriptNotifier, text: string, fileName: string): Promise<string | null> {
  const parsed = parseScript(text);
  const name = parsed.model?.name || fileName.replace(/(\.rdl)?\.(ya?ml|json)$/i, '') || 'Railway Script';
  const tab = tabManager.createTab(name);
  tab.saveLoadController.setProjectName(name);
  tabManager.switchTab(tab.id);
  tab.saveLoadController.getRailwayScript().set(text, 'load');
  const session = ensureSession(tab);
  const result = await session.apply();
  panel?.bind();
  tabManager.flushCache();
  if (result.ok) notify.success(`Opened ${fileName}: ${Object.values(session.status().lastApply?.objects ?? {}).reduce((s, n) => s + (n ?? 0), 0)} objects`);
  else {
    const first = result.diagnostics.find((d) => d.severity === 'error');
    notify.error(`${fileName}: ${result.diagnostics.filter((d) => d.severity === 'error').length} error(s) in the script${first ? ` (line ${first.line}: ${first.message})` : ''}; see the Railway Script tab`);
  }
  return tab.id;
}

export function chooseAndImport(tabManager: TabManager, notify: ScriptNotifier): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.yaml,.yml,.json,application/json,application/yaml,text/yaml';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => importScriptText(tabManager, notify, text, file.name))
      .catch((error: unknown) => notify.error(`Could not read ${file.name}: ${error instanceof Error ? error.message : String(error)}`));
  });
  input.click();
}

/** The active tab's script as YAML or JSON text (generated from the drawing when it has none). */
export function exportText(tab: TabData, format: 'yaml' | 'json'): { text: string; generated: boolean } {
  let text = tab.saveLoadController.getRailwayScript().get();
  let generated = false;
  if (text.trim() === '') {
    text = generateScript(tab.graph.getDataModel(), tab.saveLoadController.getProjectName()).text;
    generated = true;
  }
  if (format === 'yaml') return { text, generated };
  const parsed = parseScript(text);
  if (parsed.doc.errors.length > 0) throw new Error(`the script has YAML errors (line ${parsed.diagnostics[0]?.line ?? 1})`);
  return { text: `${JSON.stringify(parsed.doc.toJS(), null, 2)}\n`, generated };
}

export function exportActiveTab(tabManager: TabManager, notify: ScriptNotifier): void {
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  document.querySelector('.rd-rs-export-overlay')?.remove();
  const overlay = el('div', 'rd-route-dialog-overlay rd-rs-export-overlay');
  const dialog = el('div', 'rd-route-dialog rd-rs-export-dialog');
  dialog.dataset.testid = 'railway-script-export-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Export Railway Script');
  const content = el('div', 'rd-route-dialog-content');
  const actions = el('div', 'rd-route-dialog-actions');
  const hasScript = tab.saveLoadController.getRailwayScript().has();
  content.append(
    el('p', undefined, hasScript ? 'Download the Railway Script of this diagram.' : 'This diagram has no Railway Script: one is generated from its railway objects.'),
    el('p', 'rd-rs-hint', 'YAML keeps comments; JSON is the same data without them. Both validate against the JSON Schema railway-script-1.')
  );
  const close = (): void => {
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    e.stopPropagation();
  };
  const run = (format: 'yaml' | 'json'): void => {
    try {
      const { text, generated } = exportText(tab, format);
      const name = `${fileBaseName(tab.saveLoadController.getProjectName() || tab.name)}.rdl.${format}`;
      downloadBlob(new Blob([text], { type: format === 'json' ? 'application/json' : 'application/yaml' }), name);
      notify.success(`Exported ${name}${generated ? ' (generated from the drawing)' : ''}`);
      close();
    } catch (error) {
      notify.error(`Export Railway Script: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  actions.append(
    button('YAML (.rdl.yaml)', 'rd-route-btn rd-rs-export-yaml', 'YAML with comments', () => run('yaml')),
    button('JSON (.rdl.json)', 'rd-route-btn rd-rs-export-json', 'JSON', () => run('json')),
    button('Cancel', 'rd-route-btn rd-rs-export-cancel', 'Close', close)
  );
  dialog.append(el('h3', 'rd-route-dialog-title', 'Export Railway Script'), content, actions);
  overlay.append(dialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  (actions.firstElementChild as HTMLButtonElement | null)?.focus();
}
