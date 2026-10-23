/**
 * @file settings.ts
 * @brief AI chat settings in THIS browser only (localStorage `rd.ai.settings`): the user's own
 *        Anthropic API key, model, effort and the confirm-changes toggle. The key never goes to
 *        any Railway Drawer server, the cache, files or share links; it is sent only to
 *        api.anthropic.com with the user's requests. Never logged.
 */

export const AI_SETTINGS_KEY = 'rd.ai.settings';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AiModelOption {
  id: string;
  label: string;
  /** Server-side refusal fallback (`fallbacks: "default"`) is available for this model. */
  fallback: boolean;
}

/** Offered models (the default first). Any other model id can be typed in. */
export const AI_MODELS: readonly AiModelOption[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (recommended)', fallback: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, cheaper)', fallback: true },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)', fallback: false },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 (most capable, most expensive)', fallback: true },
];

export const DEFAULT_MODEL = AI_MODELS[0].id;
export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export interface AiSettings {
  apiKey: string;
  model: string;
  effort: Effort;
  /** Show each drawing change and wait for Keep / Discard (in-app chat and the local MCP bridge). */
  confirmChanges: boolean;
  /** The same for calls from REMOTE MCP clients (pairing code via the Worker); on by default. */
  confirmRemoteChanges: boolean;
}

export const DEFAULT_SETTINGS: AiSettings = { apiKey: '', model: DEFAULT_MODEL, effort: 'high', confirmChanges: false, confirmRemoteChanges: true };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A plausible model id (letters, digits, dots, dashes). */
export function isModelId(id: string): boolean {
  return /^[a-z0-9][a-z0-9.\-_:@]{2,80}$/i.test(id);
}

export function readSettings(): AiSettings {
  try {
    const raw = storage()?.getItem(AI_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<AiSettings>;
    return {
      apiKey: typeof v.apiKey === 'string' ? v.apiKey.trim() : '',
      model: typeof v.model === 'string' && isModelId(v.model) ? v.model : DEFAULT_MODEL,
      effort: EFFORTS.includes(v.effort as Effort) ? (v.effort as Effort) : DEFAULT_SETTINGS.effort,
      confirmChanges: v.confirmChanges === true,
      confirmRemoteChanges: v.confirmRemoteChanges !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Saves the settings; false when the browser refuses (private mode, quota). */
export function writeSettings(settings: AiSettings): boolean {
  try {
    storage()?.setItem(AI_SETTINGS_KEY, JSON.stringify({ ...settings, apiKey: settings.apiKey.trim() }));
    return true;
  } catch {
    return false;
  }
}

/** `sk-ant-…abcd` style mask for display (never the whole key). */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  if (k.length <= 12) return '•'.repeat(k.length);
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

export function modelOption(id: string): AiModelOption | undefined {
  return AI_MODELS.find((m) => m.id === id);
}
