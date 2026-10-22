/**
 * @file ai-panel.ts
 * @brief The right panel "AI" (lazy chunk with the Anthropic SDK): chat with the user's own key,
 *        streaming answer, visible tool log, confirm-changes mode (each drawing change is shown and
 *        waits for Keep / Discard), Stop, Undo AI turn, New conversation, settings (key stored only
 *        in this browser, model, effort) and "Connect to AI assistant" (remote MCP pairing through
 *        the Worker, or the local MCP server on 127.0.0.1). Tool calls from the chat and from MCP
 *        clients run through the same runner on the ACTIVE tab.
 */
import './ai-panel.css';
import type Anthropic from '@anthropic-ai/sdk';
import { renderMarkdown, sanitizeHtml } from '../scenarios/markdown';
import { diffCountsText, diffSnapshots } from '../scenarios/scenario-diff';
import type { TabManager } from '../ui/tabs';
import { activeTabTarget } from './app-target';
import { BridgeClient } from './bridge/client';
import type { BridgeStatus } from './bridge/client';
import {
  claudeCodeCommand,
  clearRemotePairing,
  createRemotePairing,
  localBridgeUrl,
  localServerConfig,
  readLocalBridge,
  readRemotePairing,
  remoteBridgeUrl,
  remoteMcpUrl,
  writeLocalBridge,
} from './bridge/pairing';
import type { RemotePairing } from './bridge/pairing';
import { formatPairingToken, hashSecret, newPairingToken } from './bridge/protocol';
import { ChatSession, createBrowserClient, describeApiError } from './chat/chat-loop';
import type { ToolCall } from './chat/chat-loop';
import { AI_MODELS, EFFORTS, isModelId, maskKey, readSettings, writeSettings } from './chat/settings';
import type { AiSettings, Effort } from './chat/settings';
import { buildSystemPrompt } from './system-prompt';
import type { AiTarget } from './target';
import { getToolDef } from './tool-defs';
import { executeAiTool } from './tools';
import type { ToolOutcome } from './tools';

export interface AiNotifier {
  success(message: string): void;
  error(message: string): void;
}

export interface AiPanelOptions {
  tabManager: TabManager;
  notify?: AiNotifier;
  /** Tests: fetch for the Anthropic client. */
  fetchImpl?: typeof fetch;
  /** Site origin for the remote MCP URLs (default location.origin). */
  origin?: string;
}

export interface AiPanel {
  focus(): void;
  destroy(): void;
}

type Source = 'chat' | 'mcp';

interface TurnEdits {
  target: AiTarget;
  edits: object[];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function btn(label: string, className: string, testId: string, onClick: () => void, title?: string): HTMLButtonElement {
  const b = el('button', `rd-btn rd-ai-btn ${className}`.trim(), label);
  b.type = 'button';
  b.dataset.testid = testId;
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

let idCounter = 0;
const uid = (p: string): string => `${p}-${++idCounter}`;

/** Undoes `edits` (newest first) while each is the next one on the tab's undo history. */
export function undoOwnEdits(target: AiTarget, edits: object[]): number {
  let n = 0;
  for (let i = edits.length - 1; i >= 0; i--) {
    if (!target.nextUndoEdit || target.nextUndoEdit() !== edits[i]) break;
    target.undo();
    n++;
  }
  return n;
}

/** Markdown of an assistant message as a safe fragment: no images (they would load URLs the model chose). */
function markdownFragment(text: string): DocumentFragment {
  const frag = sanitizeHtml(renderMarkdown(text));
  frag.querySelectorAll('img').forEach((img) => img.replaceWith(document.createTextNode(img.getAttribute('alt') ?? '')));
  return frag;
}

export function mountAiPanel(container: HTMLElement, options: AiPanelOptions): AiPanel {
  const { tabManager } = options;
  const origin = options.origin ?? window.location.origin;
  let settings: AiSettings = readSettings();
  let client: Anthropic | null = null;
  let clientKey = '';
  const clientFor = (): Anthropic => {
    if (!client || clientKey !== settings.apiKey) {
      client = createBrowserClient(settings.apiKey, options.fetchImpl);
      clientKey = settings.apiKey;
    }
    return client;
  };
  const chat = new ChatSession(clientFor, buildSystemPrompt(), () => settings);
  let turnEdits: TurnEdits[] = [];
  const pendingDecisions = new Set<(keep: boolean) => void>();

  container.replaceChildren();
  const root = el('div', 'rd-ai-panel');
  root.dataset.testid = 'ai-panel';

  // ------------------------------------------------------------------ settings
  const settingsBox = el('details', 'rd-ai-section rd-ai-settings');
  settingsBox.dataset.testid = 'ai-settings';
  const settingsSummary = el('summary', 'rd-ai-summary', 'Settings');
  const keyId = uid('rd-ai-key');
  const keyLabel = el('label', 'rd-field-label', 'Anthropic API key');
  keyLabel.htmlFor = keyId;
  const keyInput = el('input', 'rd-input rd-ai-key');
  keyInput.id = keyId;
  keyInput.type = 'password';
  keyInput.autocomplete = 'off';
  keyInput.spellcheck = false;
  keyInput.placeholder = 'sk-ant-…';
  keyInput.dataset.testid = 'ai-key';
  keyInput.setAttribute('aria-describedby', `${keyId}-note`);
  const keyStatus = el('div', 'rd-ai-key-status');
  keyStatus.dataset.testid = 'ai-key-status';
  keyStatus.setAttribute('aria-live', 'polite');
  const keyToggle = btn('Show', '', 'ai-key-toggle', () => {
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    keyToggle.textContent = keyInput.type === 'password' ? 'Show' : 'Hide';
    keyToggle.setAttribute('aria-pressed', String(keyInput.type === 'text'));
  });
  keyToggle.setAttribute('aria-pressed', 'false');
  const saveSettings = (): void => {
    if (!writeSettings(settings)) options.notify?.error('The browser did not allow saving the AI settings (they last until the page is closed).');
  };
  const keySave = btn('Save key', 'rd-btn-solid rd-btn-primary', 'ai-key-save', () => {
    const k = keyInput.value.trim();
    if (!k) return;
    settings = { ...settings, apiKey: k };
    saveSettings();
    keyInput.value = '';
    keyInput.type = 'password';
    keyToggle.textContent = 'Show';
    renderKeyStatus();
    updateComposer();
  });
  const keyRemove = btn('Remove', '', 'ai-key-remove', () => {
    settings = { ...settings, apiKey: '' };
    saveSettings();
    renderKeyStatus();
    updateComposer();
  });
  keyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      keySave.click();
    }
  });
  const keyNote = el('p', 'rd-ai-note');
  keyNote.id = `${keyId}-note`;
  keyNote.textContent =
    'Your key is stored only in this browser (localStorage) and sent only to api.anthropic.com with your requests — never to a Railway Drawer server, file or share link. The browser calls the API directly (header anthropic-dangerous-direct-browser-access): any script running on this page or anyone using this browser profile could read the key, so use a key with a spending limit, avoid shared computers and remove it when done. Your prompts and the diagram data the assistant reads go to Anthropic.';
  const renderKeyStatus = (): void => {
    keyStatus.textContent = settings.apiKey ? `Key saved in this browser: ${maskKey(settings.apiKey)}` : 'No key saved.';
    keyRemove.disabled = !settings.apiKey;
  };

  const modelId = uid('rd-ai-model');
  const modelLabel = el('label', 'rd-field-label', 'Model');
  modelLabel.htmlFor = modelId;
  const modelSelect = el('select', 'rd-input rd-ai-model');
  modelSelect.id = modelId;
  modelSelect.dataset.testid = 'ai-model';
  for (const m of AI_MODELS) modelSelect.append(new Option(m.label, m.id));
  modelSelect.append(new Option('Other model id…', '__other'));
  const modelCustom = el('input', 'rd-input rd-ai-model-custom');
  modelCustom.dataset.testid = 'ai-model-custom';
  modelCustom.setAttribute('aria-label', 'Model id');
  modelCustom.placeholder = 'claude-…';
  const syncModelUi = (): void => {
    const known = AI_MODELS.some((m) => m.id === settings.model);
    modelSelect.value = known ? settings.model : '__other';
    modelCustom.hidden = known;
    if (!known) modelCustom.value = settings.model;
  };
  modelSelect.addEventListener('change', () => {
    if (modelSelect.value === '__other') {
      modelCustom.hidden = false;
      modelCustom.focus();
      return;
    }
    settings = { ...settings, model: modelSelect.value };
    modelCustom.hidden = true;
    saveSettings();
  });
  modelCustom.addEventListener('change', () => {
    const v = modelCustom.value.trim();
    if (isModelId(v)) {
      settings = { ...settings, model: v };
      saveSettings();
    }
  });
  const effortId = uid('rd-ai-effort');
  const effortLabel = el('label', 'rd-field-label', 'Effort');
  effortLabel.htmlFor = effortId;
  const effortSelect = el('select', 'rd-input rd-ai-effort');
  effortSelect.id = effortId;
  effortSelect.dataset.testid = 'ai-effort';
  for (const e of EFFORTS) effortSelect.append(new Option(e, e));
  effortSelect.value = settings.effort;
  effortSelect.addEventListener('change', () => {
    settings = { ...settings, effort: effortSelect.value as Effort };
    saveSettings();
  });
  const confirmLabel = el('label', 'rd-ai-check');
  const confirmBox = el('input');
  confirmBox.type = 'checkbox';
  confirmBox.dataset.testid = 'ai-confirm';
  confirmBox.checked = settings.confirmChanges;
  confirmBox.addEventListener('change', () => {
    settings = { ...settings, confirmChanges: confirmBox.checked };
    saveSettings();
  });
  confirmLabel.append(confirmBox, document.createTextNode(' Confirm each change (Keep / Discard)'));

  const keyRow = el('div', 'rd-ai-row');
  keyRow.append(keyInput, keyToggle);
  const keyButtons = el('div', 'rd-ai-row');
  keyButtons.append(keySave, keyRemove);
  settingsBox.append(settingsSummary, keyLabel, keyRow, keyButtons, keyStatus, keyNote, modelLabel, modelSelect, modelCustom, effortLabel, effortSelect, confirmLabel);

  // ------------------------------------------------------------------ log
  const log = el('div', 'rd-ai-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-label', 'AI conversation');
  log.tabIndex = 0;
  log.dataset.testid = 'ai-log';
  const empty = el('p', 'rd-ai-empty', 'Describe what to draw, e.g. "A double-track line from km 0 to 5 with a station of two points in the middle, main signals at both ends and ETCS L2 marker boards every kilometre."');
  log.append(empty);
  const scroll = (): void => {
    log.scrollTop = log.scrollHeight;
  };
  const addEntry = (node: HTMLElement): HTMLElement => {
    empty.remove();
    log.append(node);
    scroll();
    return node;
  };

  // ------------------------------------------------------------------ composer
  const composer = el('div', 'rd-ai-composer');
  const inputId = uid('rd-ai-input');
  const inputLabel = el('label', 'rd-visually-hidden rd-ai-sr', 'Message to the AI assistant');
  inputLabel.htmlFor = inputId;
  const input = el('textarea', 'rd-input rd-ai-input');
  input.id = inputId;
  input.rows = 3;
  input.placeholder = 'What should the drawing show? (Enter sends, Shift+Enter: new line)';
  input.dataset.testid = 'ai-input';
  const sendBtn = btn('Send', 'rd-btn-solid rd-btn-primary', 'ai-send', () => void send());
  const stopBtn = btn('Stop', 'rd-btn-solid rd-btn-danger', 'ai-stop', () => stop());
  stopBtn.hidden = true;
  const undoBtn = btn('Undo AI turn', '', 'ai-undo-turn', () => undoTurn(), 'Undo every change of the last AI turn');
  const resetBtn = btn('New conversation', '', 'ai-reset', () => resetConversation(), 'Forget the conversation (the drawing stays)');
  const composerButtons = el('div', 'rd-ai-row rd-ai-composer-buttons');
  composerButtons.append(sendBtn, stopBtn, undoBtn, resetBtn);
  const keyHint = el('p', 'rd-ai-note rd-ai-key-hint');
  keyHint.dataset.testid = 'ai-key-hint';
  composer.append(inputLabel, input, composerButtons, keyHint);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void send();
    } else if (e.key === 'Escape' && chat.running) {
      e.preventDefault();
      stop();
    }
  });

  const updateComposer = (): void => {
    const running = chat.running;
    sendBtn.hidden = running;
    stopBtn.hidden = !running;
    sendBtn.disabled = !settings.apiKey;
    undoBtn.disabled = running || turnEdits.every((t) => t.edits.length === 0);
    resetBtn.disabled = running;
    keyHint.textContent = settings.apiKey ? '' : 'Add your Anthropic API key in Settings to chat. (MCP clients can use "Connect to AI assistant" without a key here.)';
    keyHint.hidden = !!settings.apiKey;
  };

  // ------------------------------------------------------------------ tool runner (chat + MCP)
  const decide = (card: HTMLElement, signal?: AbortSignal): Promise<boolean> =>
    new Promise((resolve) => {
      const done = (keep: boolean): void => {
        pendingDecisions.delete(done);
        card.dataset.decision = keep ? 'kept' : 'discarded';
        card.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
        resolve(keep);
      };
      pendingDecisions.add(done);
      const keep = btn('Keep', 'rd-btn-solid rd-btn-primary', 'ai-keep', () => done(true));
      const discard = btn('Discard', '', 'ai-discard', () => done(false));
      const row = el('div', 'rd-ai-row');
      row.append(keep, discard);
      card.append(row);
      signal?.addEventListener('abort', () => done(false), { once: true });
      keep.focus();
    });

  const runTool = async (source: Source, name: string, toolInput: unknown, signal?: AbortSignal): Promise<ToolOutcome> => {
    const def = getToolDef(name);
    const line = addEntry(el('div', 'rd-ai-tool'));
    line.dataset.tool = name;
    line.dataset.status = 'pending';
    line.dataset.source = source;
    line.textContent = `${source === 'mcp' ? 'MCP · ' : ''}${def?.title ?? name}…`;
    const target = activeTabTarget(tabManager);
    if (!target) {
      line.dataset.status = 'error';
      line.textContent = 'No diagram tab is open.';
      return { ok: false, summary: 'No tab', result: { error: 'No diagram tab is open in Railway Drawer.' }, edits: [] };
    }
    const preview = settings.confirmChanges && def?.mutating === true && name !== 'undo';
    const before = preview ? target.modelXml() : null;
    let outcome = await executeAiTool(target, name, toolInput);
    if (before !== null && outcome.ok && outcome.edits.length > 0) {
      const diff = diffSnapshots(before, target.modelXml());
      const card = addEntry(el('div', 'rd-ai-confirm'));
      card.dataset.testid = 'ai-confirm-card';
      card.append(el('div', 'rd-ai-confirm-title', outcome.summary), el('div', 'rd-ai-confirm-diff', `Changes on the canvas: ${diffCountsText(diff.counts) || 'none visible'}`));
      const keep = await decide(card, signal);
      if (!keep) {
        undoOwnEdits(target, outcome.edits);
        outcome = { ok: false, summary: `Discarded: ${outcome.summary}`, result: { error: 'The user discarded this change; it was undone. Ask what to do differently, or adjust and try again.' }, edits: [] };
      }
    }
    if (source === 'chat' && outcome.edits.length > 0) turnEdits.push({ target, edits: outcome.edits });
    line.dataset.status = outcome.ok ? 'ok' : 'error';
    line.textContent = `${source === 'mcp' ? 'MCP · ' : ''}${outcome.ok ? '✓' : '✗'} ${outcome.summary}`;
    if (!outcome.ok && typeof outcome.result.error === 'string' && !outcome.summary.includes(outcome.result.error)) {
      line.append(el('span', 'rd-ai-tool-detail', ` — ${outcome.result.error.slice(0, 300)}`));
    }
    const errors = outcome.result.errors as Array<{ line: number; col: number; message: string }> | undefined;
    if (errors?.length) line.append(el('span', 'rd-ai-tool-detail', ` — ${errors.slice(0, 3).map((e) => `${e.line}:${e.col} ${e.message}`).join('; ')}`));
    scroll();
    updateComposer();
    return outcome;
  };

  // ------------------------------------------------------------------ chat turn
  const send = async (): Promise<void> => {
    const text = input.value.trim();
    if (!text || chat.running) return;
    if (!settings.apiKey) {
      settingsBox.open = true;
      keyInput.focus();
      return;
    }
    input.value = '';
    turnEdits = [];
    addEntry(el('div', 'rd-ai-msg rd-ai-user', text));
    let current: { box: HTMLElement; text: string } | null = null;
    let thinking: { box: HTMLDetailsElement; body: HTMLElement } | null = null;
    const finishMessage = (): void => {
      if (current && current.text.trim()) current.box.replaceChildren(markdownFragment(current.text));
      else current?.box.remove();
      current = null;
      thinking = null;
    };
    const turn = chat.send(text, (call: ToolCall, signal) => runTool('chat', call.name, call.input, signal), {
      onMessageStart: () => finishMessage(),
      onText: (delta) => {
        if (!current) current = { box: addEntry(el('div', 'rd-ai-msg rd-ai-assistant')), text: '' };
        current.text += delta;
        current.box.textContent = current.text;
        scroll();
      },
      onThinking: (delta) => {
        if (!thinking) {
          const box = addEntry(el('details', 'rd-ai-thinking')) as HTMLDetailsElement;
          box.append(el('summary', undefined, 'Thinking'));
          thinking = { box, body: box.appendChild(el('div', 'rd-ai-thinking-body')) };
        }
        thinking.body.textContent += delta;
      },
      onToolStart: () => finishMessage(),
    });
    updateComposer();
    try {
      const result = await turn;
      finishMessage();
      if (result.message) addEntry(el('div', 'rd-ai-status', result.end === 'stopped' ? 'Stopped.' : result.message));
      else if (result.end === 'stopped') addEntry(el('div', 'rd-ai-status', 'Stopped.'));
    } catch (error) {
      finishMessage();
      const box = addEntry(el('div', 'rd-ai-status rd-ai-error', describeApiError(error)));
      box.setAttribute('role', 'alert');
    } finally {
      updateComposer();
      input.focus();
    }
  };

  const stop = (): void => {
    chat.stop();
    for (const d of [...pendingDecisions]) d(false);
  };

  const undoTurn = (): void => {
    let undone = 0;
    let total = 0;
    for (let i = turnEdits.length - 1; i >= 0; i--) {
      total += turnEdits[i].edits.length;
      const n = undoOwnEdits(turnEdits[i].target, turnEdits[i].edits);
      undone += n;
      if (n < turnEdits[i].edits.length) break;
    }
    turnEdits = [];
    addEntry(el('div', 'rd-ai-status', undone === total ? `Undid the AI turn (${undone} step${undone === 1 ? '' : 's'}).` : `Undid ${undone} of ${total} steps; later edits were kept (use Edit > Undo for the rest).`));
    updateComposer();
  };

  const resetConversation = (): void => {
    chat.reset();
    turnEdits = [];
    log.replaceChildren(empty);
    updateComposer();
  };

  // ------------------------------------------------------------------ connect (MCP)
  const connectBox = el('details', 'rd-ai-section rd-ai-connect');
  connectBox.dataset.testid = 'ai-connect';
  connectBox.append(el('summary', 'rd-ai-summary', 'Connect to AI assistant (MCP)'));
  const connectIntro = el('p', 'rd-ai-note', 'Let Claude Desktop, Claude Code or a claude.ai connector draw in this tab. No API key is needed here; the pairing code below is the only credential — keep it private. It works while this tab stays open, for up to 12 hours.');

  const remoteStatus = el('div', 'rd-ai-conn-status');
  remoteStatus.dataset.testid = 'ai-pair-status';
  remoteStatus.setAttribute('aria-live', 'polite');
  const remoteDetails = el('div', 'rd-ai-pair');
  const readonlyField = (label: string, value: string, testId: string): HTMLElement => {
    const wrap = el('div', 'rd-ai-field');
    const id = uid('rd-ai-f');
    const l = el('label', 'rd-field-label', label);
    l.htmlFor = id;
    const field = value.length > 120 || value.includes('\n') ? el('textarea', 'rd-input rd-ai-readonly') : el('input', 'rd-input rd-ai-readonly');
    field.id = id;
    field.readOnly = true;
    field.value = value;
    field.dataset.testid = testId;
    if (field instanceof HTMLTextAreaElement) field.rows = Math.min(8, value.split('\n').length + 1);
    field.addEventListener('focus', () => field.select());
    const copy = btn('Copy', '', `${testId}-copy`, () => {
      void navigator.clipboard?.writeText(value).then(
        () => options.notify?.success(`${label} copied`),
        () => field.select()
      );
    });
    const row = el('div', 'rd-ai-row');
    row.append(field, copy);
    wrap.append(l, row);
    return wrap;
  };

  let remote: { pairing: RemotePairing; client: BridgeClient } | null = null;
  const statusText = (s: BridgeStatus, detail?: string, expiresAt?: number): string => {
    switch (s) {
      case 'connected':
        return `Connected${expiresAt ? ` — valid until ${new Date(expiresAt).toLocaleTimeString()}` : ''}. MCP tool calls run on the active tab.`;
      case 'connecting':
        return detail ? `Connecting… (${detail})` : 'Connecting…';
      case 'refused':
        return `Not connected: ${detail ?? 'refused'}`;
      default:
        return detail ? `Disconnected (${detail})` : 'Disconnected.';
    }
  };
  const bridgeRun = async (tool: string, toolInput: unknown) => {
    const out = await runTool('mcp', tool, toolInput);
    return { ok: out.ok, summary: out.summary, result: out.result, image: out.image };
  };
  const startRemote = (pairing: RemotePairing): void => {
    remote?.client.close();
    let everConnected = false;
    const client = new BridgeClient({
      url: remoteBridgeUrl(origin, pairing.token),
      auth: hashSecret(pairing.token.secret),
      ttlSeconds: Math.max(60, Math.round((pairing.expiresAt - Date.now()) / 1000)),
      run: bridgeRun,
      onStatus: (s, detail, expiresAt) => {
        if (s === 'connected') everConnected = true;
        remoteStatus.dataset.status = s;
        remoteStatus.textContent =
          s === 'connecting' && !everConnected && detail
            ? `Waiting for the AI bridge (${detail.toLowerCase()}). It needs the Railway Drawer Worker: the production site has it, a plain static or dev server does not.`
            : statusText(s, detail, expiresAt);
      },
    });
    remote = { pairing, client };
    remoteDetails.replaceChildren(
      readonlyField('MCP server URL (claude.ai / Claude Desktop custom connector)', remoteMcpUrl(origin, pairing.token), 'ai-pair-url'),
      readonlyField('Claude Code', claudeCodeCommand(origin, pairing.token), 'ai-pair-cmd'),
      readonlyField('Pairing code (Bearer token)', formatPairingToken(pairing.token), 'ai-pair-token')
    );
    client.connect();
    updateConnect();
  };
  const pairCreate = btn('Create pairing code', 'rd-btn-solid rd-btn-primary', 'ai-pair-create', () => startRemote(createRemotePairing()));
  const pairNew = btn('New code', '', 'ai-pair-new', () => {
    remote?.client.close();
    startRemote(createRemotePairing());
  });
  const pairStop = btn('Disconnect', '', 'ai-pair-disconnect', () => {
    remote?.client.close();
    remote = null;
    clearRemotePairing();
    remoteDetails.replaceChildren();
    remoteStatus.textContent = 'Not paired.';
    remoteStatus.dataset.status = 'closed';
    updateConnect();
  });
  const updateConnect = (): void => {
    pairCreate.hidden = !!remote;
    pairNew.hidden = !remote;
    pairStop.hidden = !remote;
  };
  const remoteButtons = el('div', 'rd-ai-row');
  remoteButtons.append(pairCreate, pairNew, pairStop);
  remoteStatus.textContent = 'Not paired.';

  // local MCP server (tools/mcp-local)
  const local = readLocalBridge();
  let localClient: BridgeClient | null = null;
  const localStatus = el('div', 'rd-ai-conn-status');
  localStatus.dataset.testid = 'ai-local-status';
  localStatus.setAttribute('aria-live', 'polite');
  localStatus.textContent = 'Not connected.';
  const portId = uid('rd-ai-port');
  const portLabel = el('label', 'rd-field-label', 'Local MCP server port');
  portLabel.htmlFor = portId;
  const portInput = el('input', 'rd-input rd-ai-port');
  portInput.id = portId;
  portInput.type = 'number';
  portInput.min = '1024';
  portInput.max = '65535';
  portInput.value = String(local.port);
  portInput.dataset.testid = 'ai-local-port';
  const localConfig = el('div', 'rd-ai-local-config');
  const renderLocalConfig = (): void => {
    localConfig.replaceChildren(readonlyField('Claude Desktop / Claude Code config (stdio server)', localServerConfig(local), 'ai-local-config'));
  };
  renderLocalConfig();
  portInput.addEventListener('change', () => {
    const p = Number(portInput.value);
    if (Number.isInteger(p) && p > 1023 && p < 65536) {
      local.port = p;
      writeLocalBridge(local);
      renderLocalConfig();
    }
  });
  const localConnect = btn('Connect local server', '', 'ai-local-connect', () => {
    localClient?.close();
    let localEver = false;
    localClient = new BridgeClient({
      url: localBridgeUrl(local.port),
      auth: hashSecret(local.token.secret),
      run: bridgeRun,
      onStatus: (s, detail, expiresAt) => {
        if (s === 'connected') localEver = true;
        localStatus.dataset.status = s;
        localStatus.textContent =
          s === 'connecting' && !localEver && detail
            ? `Waiting for the local MCP server on port ${local.port} (${detail.toLowerCase()}). Is it running (started by your MCP client)?`
            : statusText(s, detail, expiresAt);
      },
    });
    localClient.connect();
  });
  const localDisconnect = btn('Disconnect', '', 'ai-local-disconnect', () => {
    localClient?.close();
    localClient = null;
  });
  const localNewToken = btn('New local token', '', 'ai-local-new-token', () => {
    localClient?.close();
    local.token = newPairingToken();
    writeLocalBridge(local);
    renderLocalConfig();
  });
  const localButtons = el('div', 'rd-ai-row');
  localButtons.append(localConnect, localDisconnect, localNewToken);
  const localBox = el('div', 'rd-ai-local');
  localBox.append(el('h4', 'rd-ai-subtitle', 'Local MCP server (offline / LAN)'), portLabel, portInput, localConfig, localButtons, localStatus);
  const remoteBox = el('div', 'rd-ai-remote');
  remoteBox.append(el('h4', 'rd-ai-subtitle', 'Remote (this site)'), remoteButtons, remoteStatus, remoteDetails);
  connectBox.append(connectIntro, remoteBox, localBox);
  const stored = readRemotePairing();
  if (stored) startRemote(stored);
  updateConnect();

  root.append(log, composer, settingsBox, connectBox);
  container.append(root);
  renderKeyStatus();
  syncModelUi();
  if (!settings.apiKey) settingsBox.open = true;
  updateComposer();

  return {
    focus: () => (settings.apiKey ? input : keyInput).focus(),
    destroy: () => {
      stop();
      remote?.client.close();
      localClient?.close();
      root.remove();
    },
  };
}
