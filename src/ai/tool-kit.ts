/**
 * @file tool-kit.ts
 * @brief Shared pieces of the AI tool executors (tools.ts, scenario-tools.ts, template-tools.ts):
 *        the outcome type, the error a tool throws for the model, and small helpers for object ids.
 */
import type { KindId } from '../railway/catalogue';
import type { RailObject } from '../railway/validation';
import type { AiTarget } from './target';

export interface ToolImage {
  mediaType: 'image/png';
  /** base64 without the data: prefix */
  data: string;
}

export interface ToolOutcome {
  ok: boolean;
  /** JSON-able result for the model. */
  result: Record<string, unknown>;
  /** One line for the visible log ("Applied Railway Script: 3 tracks, 5 signals"). */
  summary: string;
  image?: ToolImage;
  /** Undoable edits the call made, in order (0 or 1 for every tool except undo). */
  edits: object[];
}

/** A failure the model can act on (its message is returned as the tool's `error`). */
export class ToolError extends Error {}

export const fail = (message: string): never => {
  throw new ToolError(message);
};

export type Input = Record<string, unknown>;
export type Executor = (target: AiTarget, input: Input) => Promise<Omit<ToolOutcome, 'edits'>>;

export const ok = (summary: string, result: Record<string, unknown>, image?: ToolImage): Omit<ToolOutcome, 'edits'> => ({ ok: true, summary, result, image });

/** Objects with id `id` (case-insensitive), optionally of one kind. */
export function findObject(objects: RailObject[], id: string, kind?: string): RailObject[] {
  const key = id.trim().toUpperCase();
  return objects.filter((o) => o.id.toUpperCase() === key && (!kind || o.kind.id === kind));
}

/** Ids by kind, e.g. `{ signal: ['S1', 'S2'], trackSection: ['TC1'] }` (sorted naturally, deduplicated). */
export function idsByKind(objects: RailObject[], kinds?: readonly KindId[]): Partial<Record<KindId, string[]>> {
  const out: Partial<Record<KindId, string[]>> = {};
  for (const o of objects) {
    if (!o.id || (kinds && !kinds.includes(o.kind.id))) continue;
    const list = (out[o.kind.id] ??= []);
    if (!list.includes(o.id)) list.push(o.id);
  }
  for (const list of Object.values(out)) list!.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return out;
}

/** "signal: S1, S2; trackSection: TC1, TC2" (for error messages naming the valid ids). */
export function validIdsText(objects: RailObject[], kinds?: readonly KindId[], maxPerKind = 40): string {
  const parts = Object.entries(idsByKind(objects, kinds)).map(
    ([kind, ids]) => `${kind}: ${ids!.slice(0, maxPerKind).join(', ')}${ids!.length > maxPerKind ? ', …' : ''}`
  );
  return parts.join('; ') || 'none';
}
