/**
 * Step editor (name, drawing capture/keep, PlantUML + Markdown with live previews), the step view's
 * UML & text side panel (Prev/Next switch all three, collapse remembered) and the HTML export, with
 * real tabs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import type { TabData } from '../../ui/tabs';
import { loadAppDom, clearAppDom } from '../../__tests__/ui/app-dom';
import { installScenarios } from '../install-scenarios';
import type { ScenariosHandle } from '../install-scenarios';
import { openStepEditor } from '../step-editor';
import { SIDE_PANEL_KEY } from '../scenario-view';
import { scenarioExportFileName } from '../scenario-export';

const notify = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };

const wait = (ms = 5): Promise<void> => new Promise((r) => setTimeout(r, ms));

function field<T extends HTMLElement>(name: string): T {
  return document.querySelector(`.rd-scn-editor [name="${name}"]`) as T;
}

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function fillEditor(values: { name?: string; uml?: string; text?: string; capture?: boolean }): Promise<void> {
  await wait();
  expect(document.querySelector('.rd-scn-editor')).not.toBeNull();
  if (values.name !== undefined) type(field<HTMLInputElement>('template-name'), values.name);
  if (values.uml !== undefined) type(field<HTMLTextAreaElement>('step-uml'), values.uml);
  if (values.text !== undefined) type(field<HTMLTextAreaElement>('step-text'), values.text);
  if (values.capture) (document.querySelector('.rd-scn-editor input[value="capture"]') as HTMLInputElement).checked = true;
  await wait();
}

async function save(): Promise<void> {
  (document.querySelector('.rd-scn-editor .rd-tpl-btn-primary') as HTMLButtonElement).click();
  await wait();
}

describe('scenario steps with UML and text', () => {
  let tabManager: TabManager | null = null;
  let handle: ScenariosHandle | null = null;
  let saved: Array<{ blob: Blob; name: string }> = [];

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
    loadAppDom();
    localStorage.clear();
    saved = [];
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();
  });

  afterEach(() => {
    handle?.destroy();
    handle = null;
    tabManager?.destroy();
    tabManager = null;
    localStorage.clear();
    document.querySelectorAll('.rd-tpl-modal-overlay').forEach((n) => n.remove());
    document.body.classList.remove('rd-scenario-viewing');
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function start(): { tab: TabData; h: ScenariosHandle; panel: HTMLElement } {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const tab = tabManager.createTab('Węzeł');
    handle = installScenarios(tabManager, notify, document.getElementById('graph-container')!, {
      thumbnails: null,
      stepEditor: (opts) => openStepEditor({ ...opts, previewDelay: 0 }),
      renderDrawingSvg: async (xml) => `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><text>${xml.length}</text></svg>`,
      saveFile: (blob, name) => saved.push({ blob, name }),
    });
    (document.querySelector('[data-right-panel="scenarios"]') as HTMLButtonElement).click();
    return { tab, h: handle, panel: document.getElementById('scenarios-panel')! };
  }

  async function newScenario(panel: HTMLElement, name: string): Promise<void> {
    (panel.querySelector('.rd-scn-new') as HTMLButtonElement).click();
    await wait();
    (document.querySelector('.rd-tpl-modal input[name="template-name"]') as HTMLInputElement).value = name;
    (document.querySelector('.rd-tpl-modal .rd-tpl-btn-primary') as HTMLButtonElement).click();
    await wait();
  }

  it('add step: editor previews, stored UML/text, side panel follows Prev/Next, collapse remembered', async () => {
    const { tab, h, panel } = start();
    await newScenario(panel, 'Wjazd');

    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'A', 10, 10, 60, 30);
    (panel.querySelector('.rd-scn-add-step-details') as HTMLButtonElement).click();
    await fillEditor({
      name: 'Krok 1',
      uml: '@startuml\nTrain -> RBC : MA Request\nRBC --> Train : MA\n@enduml',
      text: '## Żądanie MA\n- pociąg pyta\n- RBC odpowiada',
    });
    // live previews (the sequence renderer is loaded on first use)
    await vi.waitFor(() => expect(document.querySelector('.rd-scn-uml-preview svg')).not.toBeNull());
    expect(document.querySelector('.rd-scn-uml-preview')?.textContent).toContain('MA Request');
    expect(document.querySelector('.rd-scn-md-preview h2')?.textContent).toBe('Żądanie MA');
    expect(document.querySelectorAll('.rd-scn-md-preview li')).toHaveLength(2);
    // Enter in a text area does not submit
    field<HTMLTextAreaElement>('step-text').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.rd-scn-editor')).not.toBeNull();
    await save();
    expect(document.querySelector('.rd-scn-editor')).toBeNull();

    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'B', 100, 10, 60, 30);
    (panel.querySelector('.rd-scn-add-step-details') as HTMLButtonElement).click();
    await fillEditor({ name: 'Krok 2', uml: 'RBC -> IXL : route?', text: '# Second\n1. one\n2. two' });
    // Ctrl+Enter saves from a text area
    field<HTMLTextAreaElement>('step-uml').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    await wait();
    expect(document.querySelector('.rd-scn-editor')).toBeNull();

    const scenario = tab.saveLoadController.getScenarios().list()[0];
    expect(scenario.steps.map((s) => [s.name, s.uml.split('\n')[1] ?? s.uml, s.text.split('\n')[0]])).toEqual([
      ['Krok 1', 'Train -> RBC : MA Request', '## Żądanie MA'],
      ['Krok 2', 'RBC -> IXL : route?', '# Second'],
    ]);
    expect(Array.from(panel.querySelectorAll('.rd-scn-step')[0].querySelectorAll('.rd-scn-badge-small')).map((b) => b.textContent)).toEqual([
      'UML',
      'Text',
    ]);

    // view step 1: drawing + side panel with UML (svg) and Markdown
    (panel.querySelectorAll('.rd-scn-step')[0] as HTMLElement).click();
    await wait();
    const side = document.querySelector('[data-testid="scenario-side-panel"]') as HTMLElement;
    expect(side).not.toBeNull();
    expect(side.querySelector('.rd-scn-side-uml svg')).not.toBeNull();
    expect(side.querySelector('.rd-scn-side-uml')?.textContent).toContain('MA Request');
    expect(side.querySelector('.rd-scn-side-text h2')?.textContent).toBe('Żądanie MA');
    // Next: all three switch
    (document.querySelector('.rd-scn-next') as HTMLButtonElement).click();
    await wait();
    expect(document.querySelector('.rd-scn-banner-title')?.textContent).toBe('Wjazd — step 2/2: Krok 2');
    expect(h.viewer.getViewGraph()!.getChildCells(h.viewer.getViewGraph()!.getDefaultParent())).toHaveLength(2);
    expect(side.querySelector('.rd-scn-side-uml')?.textContent).toContain('route?');
    expect(side.querySelector('.rd-scn-side-uml')?.textContent).not.toContain('MA Request');
    expect(side.querySelector('.rd-scn-side-text h1')?.textContent).toBe('Second');
    expect(side.querySelectorAll('.rd-scn-side-text ol li')).toHaveLength(2);
    // keyboard ← goes back
    expect(h.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))).toBe(true);
    await wait();
    expect(side.querySelector('.rd-scn-side-text h2')?.textContent).toBe('Żądanie MA');

    // collapse: remembered
    expect(side.classList.contains('rd-scn-side-collapsed')).toBe(false);
    (side.querySelector('.rd-scn-side-toggle') as HTMLButtonElement).click();
    expect(side.classList.contains('rd-scn-side-collapsed')).toBe(true);
    expect(localStorage.getItem(SIDE_PANEL_KEY)).toBe('collapsed');
    h.viewer.close();
    handle!.destroy();
    handle = installScenarios(tabManager!, notify, document.getElementById('graph-container')!, { thumbnails: null });
    handle.viewer.open(tab.id, scenario.id, 0);
    const side2 = document.querySelector('[data-testid="scenario-side-panel"]') as HTMLElement;
    expect(side2.classList.contains('rd-scn-side-collapsed')).toBe(true);
    expect(side2.querySelector('.rd-scn-side-toggle')?.getAttribute('aria-expanded')).toBe('false');
    handle.viewer.setSideCollapsed(false);
    expect(localStorage.getItem(SIDE_PANEL_KEY)).toBe('open');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('edit step: keeps the drawing unless "replace" is chosen; old steps without UML/text show hints', async () => {
    const { tab, panel } = start();
    await newScenario(panel, 'S');
    const set = tab.saveLoadController.getScenarios();
    const scenarioId = set.list()[0].id;
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'one', 10, 10, 60, 30);
    set.addStep(scenarioId, { name: 'old step', xml: tab.saveLoadController.serializeToXml() });
    const firstXml = set.list()[0].steps[0].xml;

    // the existing step: view shows empty hints
    (panel.querySelectorAll('.rd-scn-step')[0] as HTMLElement).click();
    await wait();
    expect(document.querySelector('.rd-scn-side-uml')?.textContent).toBe('No UML diagram for this step.');
    expect(document.querySelector('.rd-scn-side-text')?.textContent).toBe('No text for this step.');
    (document.querySelector('.rd-scn-exit') as HTMLButtonElement).click();

    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'two', 100, 10, 60, 30);
    (panel.querySelectorAll('.rd-scn-step-edit')[0] as HTMLButtonElement).click();
    await fillEditor({ text: 'just *text*' });
    expect((document.querySelector('.rd-scn-editor input[value="keep"]') as HTMLInputElement).checked).toBe(true);
    await save();
    expect(set.list()[0].steps[0]).toMatchObject({ name: 'old step', text: 'just *text*', uml: '', xml: firstXml });

    (panel.querySelectorAll('.rd-scn-step-edit')[0] as HTMLButtonElement).click();
    await fillEditor({ capture: true, text: '' });
    await save();
    const step = set.list()[0].steps[0];
    expect(step.text).toBe('');
    expect(step.xml).not.toBe(firstXml);
    expect(step.xml).toContain('two');

    // cancel (Escape) changes nothing
    (panel.querySelectorAll('.rd-scn-step-edit')[0] as HTMLButtonElement).click();
    await fillEditor({ name: 'changed' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait();
    expect(set.list()[0].steps[0].name).toBe('old step');
  });

  it('exports a scenario as one HTML file with drawing, UML and text of every step', async () => {
    const { tab, h, panel } = start();
    expect(await h.exportScenario()).toBeNull();
    expect(notify.warning).toHaveBeenCalledWith(expect.stringMatching(/no scenario with steps/));
    await newScenario(panel, 'Wjazd "A" <1>');
    const set = tab.saveLoadController.getScenarios();
    const id = set.list()[0].id;
    set.addStep(id, {
      name: 'Krok 1',
      xml: tab.saveLoadController.serializeToXml(),
      uml: 'Train -> RBC : MA Request',
      text: '## Opis\n- punkt <script>alert(1)</script>\n[x](javascript:alert(1))',
    });
    set.addStep(id, { name: 'Krok 2', xml: tab.saveLoadController.serializeToXml() });
    // File > Export Scenario (HTML)… (window event from MenuController); only one scenario: no chooser
    window.dispatchEvent(new CustomEvent('scenario-export-request'));
    await wait(20);
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe(scenarioExportFileName('Węzeł', 'Wjazd "A" <1>'));
    expect(saved[0].name).toBe('Węzeł - Wjazd _A_ _1_.html');
    const html = await saved[0].blob.text();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain('<h1>Wjazd &quot;A&quot; &lt;1&gt;</h1>');
    expect(html.match(/<section class="step"/g)).toHaveLength(2);
    expect(html.match(/src="data:image\/svg\+xml;base64,/g)).toHaveLength(2);
    expect(html).toContain('class="rd-uml-svg"');
    expect(html).toContain('MA Request');
    expect(html).toContain('<h2>Opis</h2>');
    expect(html).toContain('<li>punkt &lt;script&gt;alert(1)&lt;/script&gt;\nx</li>');
    expect(html).not.toMatch(/<script|javascript:/i);
    expect(html).toContain('No UML diagram.');

    // panel button exports that scenario directly
    (panel.querySelector('.rd-scn-export') as HTMLButtonElement).click();
    await wait(20);
    expect(saved).toHaveLength(2);

    // several scenarios: the chooser asks
    await newScenario(panel, 'Druga');
    set.addStep(set.list()[1].id, { name: 'x', xml: tab.saveLoadController.serializeToXml() });
    const pending = h.exportScenario();
    await wait();
    const items = Array.from(document.querySelectorAll('.rd-scn-choose-item')) as HTMLButtonElement[];
    expect(items.map((b) => b.textContent)).toEqual(['Wjazd "A" <1> (2 steps)', 'Druga (1 step)']);
    items[1].click();
    expect(await pending).toBe('Węzeł - Druga.html');
    expect(notify.error).not.toHaveBeenCalled();
  });
});
