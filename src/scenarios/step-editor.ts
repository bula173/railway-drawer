/**
 * @file step-editor.ts
 * @brief Modal editor of a scenario step: name, description, drawing snapshot (capture / keep),
 *        PlantUML source with a live (debounced) preview and Markdown text with a live preview.
 *
 * Uses the template dialogs' look (`.rd-tpl-modal`, inputs `template-name` / `template-description`,
 * primary button) so the simple name/description flow behaves like the other dialogs. Enter in a
 * single-line field or Ctrl/Cmd+Enter anywhere saves; Escape cancels; Enter in a text area is a new
 * line. While open, a window capture listener keeps keys away from the app's shortcut dispatcher.
 */
import { openModal } from '../core/modal';
import './scenarios.css';
import { MAX_SCENARIO_DESCRIPTION, MAX_SCENARIO_NAME, MAX_STEP_TEXT, MAX_STEP_UML } from './scenario-model';
import { renderStepUml, showUmlResult, clearUmlCache } from './step-uml';
import type { UmlRenderResult } from './step-uml';
import { showMarkdown } from './markdown';
import { getPlantUmlServer, setPlantUmlServer } from '../services/plantuml-server';

export interface StepEditorOptions {
  heading: string;
  hint?: string;
  name: string;
  description?: string;
  uml?: string;
  text?: string;
  /** add: the current drawing becomes the snapshot; edit: keep it (default) or capture the current drawing. */
  mode: 'add' | 'edit';
  confirmLabel?: string;
  /** Debounce of the previews in ms (default 300). */
  previewDelay?: number;
  /** UML renderer (default: renderStepUml). */
  renderUml?: (source: string) => Promise<UmlRenderResult>;
}

export interface StepEditorResult {
  name: string;
  description: string;
  uml: string;
  text: string;
  /** True: capture the current drawing as the step's snapshot. */
  captureDrawing: boolean;
}

export const UML_PLACEHOLDER = `@startuml
participant Train
participant RBC
Train -> RBC : MA Request
RBC --> Train : Movement Authority
@enduml`;

export const TEXT_PLACEHOLDER = `## What happens
- The train requests a **movement authority**
- The RBC answers with the MA`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Opens the step editor; resolves null when cancelled. */
export function openStepEditor(opts: StepEditorOptions): Promise<StepEditorResult | null> {
  return new Promise((resolve) => {
    const delay = opts.previewDelay ?? 300;
    const renderUml = opts.renderUml ?? ((source: string) => renderStepUml(source));
    let done = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const overlay = el('div', 'rd-tpl-modal-overlay');
    const dialog = el('div', 'rd-tpl-modal rd-scn-editor');
    overlay.appendChild(dialog);
    dialog.appendChild(el('h2', 'rd-tpl-modal-title', opts.heading));
    if (opts.hint) dialog.appendChild(el('p', 'rd-tpl-modal-hint', opts.hint));

    // name + description
    const head = el('div', 'rd-scn-editor-head');
    const nameLabel = el('label', 'rd-tpl-modal-label', 'Name');
    const nameInput = el('input', 'rd-tpl-modal-input');
    nameInput.type = 'text';
    nameInput.name = 'template-name';
    nameInput.maxLength = MAX_SCENARIO_NAME;
    nameInput.placeholder = 'e.g. Route set';
    nameInput.value = opts.name;
    nameInput.required = true;
    nameLabel.appendChild(nameInput);
    const descLabel = el('label', 'rd-tpl-modal-label', 'Description (optional)');
    const descInput = el('input', 'rd-tpl-modal-input');
    descInput.type = 'text';
    descInput.name = 'template-description';
    descInput.maxLength = MAX_SCENARIO_DESCRIPTION;
    descInput.value = opts.description ?? '';
    descLabel.appendChild(descInput);
    head.append(nameLabel, descLabel);
    dialog.appendChild(head);

    // drawing snapshot
    const drawing = el('fieldset', 'rd-scn-editor-drawing');
    drawing.appendChild(el('legend', undefined, 'Drawing'));
    let captureRadio: HTMLInputElement | null = null;
    if (opts.mode === 'add') {
      drawing.appendChild(el('p', 'rd-scn-editor-note', 'The current drawing is captured as the snapshot of this step.'));
    } else {
      const radio = (value: string, label: string, checked: boolean): HTMLLabelElement => {
        const l = el('label', 'rd-scn-editor-radio');
        const r = el('input');
        r.type = 'radio';
        r.name = 'step-drawing';
        r.value = value;
        r.checked = checked;
        l.append(r, document.createTextNode(` ${label}`));
        if (value === 'capture') captureRadio = r;
        return l;
      };
      drawing.append(radio('keep', 'Keep the step’s drawing', true), radio('capture', 'Replace it with the current drawing', false));
    }
    dialog.appendChild(drawing);

    // PlantUML + Markdown editors with previews
    const panes = el('div', 'rd-scn-editor-panes');
    const umlPane = el('section', 'rd-scn-editor-pane rd-scn-editor-uml');
    const umlHead = el('div', 'rd-scn-editor-pane-head');
    const umlTitle = el('label', 'rd-scn-editor-pane-title', 'UML diagram (PlantUML, optional)');
    umlTitle.htmlFor = 'rd-scn-editor-uml-input';
    const serverBtn = el('button', 'rd-tpl-btn rd-tpl-btn-small rd-scn-editor-server-btn', 'Server…');
    serverBtn.type = 'button';
    serverBtn.title = 'PlantUML server for diagram types other than sequence diagrams (optional)';
    umlHead.append(umlTitle, serverBtn);
    const serverRow = el('div', 'rd-scn-editor-server');
    serverRow.hidden = true;
    const serverInput = el('input', 'rd-tpl-modal-input');
    serverInput.type = 'url';
    serverInput.name = 'plantuml-server';
    serverInput.placeholder = 'https://www.plantuml.com/plantuml';
    serverInput.value = getPlantUmlServer();
    const serverSave = el('button', 'rd-tpl-btn rd-tpl-btn-small', 'Use server');
    serverSave.type = 'button';
    const serverNote = el(
      'p',
      'rd-scn-editor-note',
      'Sequence diagrams are drawn locally (offline). Other PlantUML diagram types are sent to this server for rendering — leave empty to never send anything.'
    );
    serverRow.append(serverInput, serverSave, serverNote);
    const umlInput = el('textarea', 'rd-scn-editor-text rd-scn-editor-code');
    umlInput.id = 'rd-scn-editor-uml-input';
    umlInput.name = 'step-uml';
    umlInput.spellcheck = false;
    umlInput.maxLength = MAX_STEP_UML;
    umlInput.placeholder = UML_PLACEHOLDER;
    umlInput.value = opts.uml ?? '';
    const umlPreview = el('div', 'rd-scn-editor-preview rd-scn-uml-preview');
    umlPreview.setAttribute('aria-live', 'polite');
    umlPreview.setAttribute('aria-label', 'UML preview');
    umlPane.append(umlHead, serverRow, umlInput, umlPreview);

    const textPane = el('section', 'rd-scn-editor-pane rd-scn-editor-md');
    const textHead = el('div', 'rd-scn-editor-pane-head');
    const textTitle = el('label', 'rd-scn-editor-pane-title', 'Text (Markdown, optional)');
    textTitle.htmlFor = 'rd-scn-editor-text-input';
    textHead.appendChild(textTitle);
    const textInput = el('textarea', 'rd-scn-editor-text');
    textInput.id = 'rd-scn-editor-text-input';
    textInput.name = 'step-text';
    textInput.maxLength = MAX_STEP_TEXT;
    textInput.placeholder = TEXT_PLACEHOLDER;
    textInput.value = opts.text ?? '';
    const textPreview = el('div', 'rd-scn-editor-preview rd-scn-md-preview rd-scn-markdown');
    textPreview.setAttribute('aria-label', 'Text preview');
    textPane.append(textHead, textInput, textPreview);
    panes.append(umlPane, textPane);
    dialog.appendChild(panes);

    const error = el('div', 'rd-tpl-modal-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const actions = el('div', 'rd-tpl-modal-actions');
    const cancel = el('button', 'rd-tpl-btn', 'Cancel');
    cancel.type = 'button';
    const ok = el('button', 'rd-tpl-btn rd-tpl-btn-primary', opts.confirmLabel ?? 'Save');
    ok.type = 'button';
    actions.append(cancel, ok);
    dialog.append(error, actions);

    // ---- previews
    let umlSeq = 0;
    const updateUml = (): void => {
      const seq = ++umlSeq;
      umlPreview.classList.add('rd-scn-busy');
      void renderUml(umlInput.value).then((result) => {
        if (seq !== umlSeq || done) return;
        umlPreview.classList.remove('rd-scn-busy');
        showUmlResult(umlPreview, result, 'No UML diagram — the preview appears here.');
      });
    };
    const updateText = (): void => showMarkdown(textPreview, textInput.value, 'No text — the preview appears here.');
    const debounce = (fn: () => void): (() => void) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          fn();
        }, delay);
        timers.push(timer);
      };
    };
    umlInput.addEventListener('input', debounce(updateUml));
    textInput.addEventListener('input', debounce(updateText));
    updateUml();
    updateText();

    serverBtn.addEventListener('click', () => {
      serverRow.hidden = !serverRow.hidden;
      if (!serverRow.hidden) serverInput.focus();
    });
    serverSave.addEventListener('click', () => {
      try {
        serverInput.value = setPlantUmlServer(serverInput.value);
        serverInput.removeAttribute('aria-invalid');
        clearUmlCache();
        updateUml();
      } catch (e) {
        serverInput.setAttribute('aria-invalid', 'true');
        error.textContent = e instanceof Error ? e.message : String(e);
        error.hidden = false;
      }
    });

    // ---- finish
    const finish = (value: StepEditorResult | null): void => {
      if (done) return;
      done = true;
      for (const t of timers) clearTimeout(t);
      modal.close();
      resolve(value);
    };
    const submit = (): void => {
      const name = nameInput.value.trim();
      if (!name) {
        error.textContent = 'Please enter a name.';
        error.hidden = false;
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
        return;
      }
      finish({
        name,
        description: descInput.value.trim(),
        uml: umlInput.value,
        text: textInput.value,
        captureDrawing: opts.mode === 'add' || !!(captureRadio as HTMLInputElement | null)?.checked,
      });
    };
    /** Enter: Ctrl/Cmd+Enter or Enter in a text field saves; Enter in the server field saves that. */
    const onKey = (evt: KeyboardEvent): boolean => {
      if (evt.key !== 'Enter') return false;
      if (evt.isComposing) return true;
      const target = evt.target as HTMLElement | null;
      if (evt.ctrlKey || evt.metaKey) {
        evt.preventDefault();
        submit();
      } else if (target === serverInput) {
        evt.preventDefault();
        serverSave.click();
      } else if (target instanceof HTMLInputElement && target.type === 'text') {
        evt.preventDefault();
        submit();
      }
      return true;
    };
    nameInput.addEventListener('input', () => {
      error.hidden = true;
      nameInput.removeAttribute('aria-invalid');
    });
    cancel.addEventListener('click', () => finish(null));
    ok.addEventListener('click', submit);
    // Esc cancels; focus trap / return, keys kept from the diagram shortcuts: core/modal.ts.
    // No "click outside cancels" here: a stray click must not discard typed UML/Markdown.
    const modal = openModal({
      overlay,
      dialog,
      label: opts.heading,
      testId: 'scenario-step-editor',
      closeOnBackdrop: false,
      onCancel: () => finish(null),
      onKey,
    });
    nameInput.focus();
    nameInput.select();
  });
}
