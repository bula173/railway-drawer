/**
 * @file step-uml.ts
 * @brief Renders the PlantUML part of a scenario step to SVG markup.
 *
 * Sequence diagrams (the usual case: `Train -> RBC : MA Request`) are rendered locally by
 * plantuml-sequence-svg.ts — offline, nothing leaves the browser. Other diagram types go to the
 * PlantUML server only when the user configured one (plantuml-server.ts); otherwise the result is an
 * error telling how to enable it. The local renderer is a separate chunk, loaded on the first
 * rendering (scenario steps with UML are rare; it is not needed for the first paint).
 */
import { getPlantUmlServer, PlantUmlServerError, renderOnPlantUmlServer } from '../services/plantuml-server';
import type { ServerRenderOptions } from '../services/plantuml-server';

export type UmlRenderResult =
  | { status: 'empty' }
  | { status: 'ok'; svg: string; renderer: 'local' | 'server'; warnings: string[] }
  | { status: 'error'; message: string; offline: boolean };

export interface UmlRenderOptions extends ServerRenderOptions {
  /** PlantUML server URL; default: the configured one ('' = none). */
  server?: string;
}

const cache = new Map<string, Promise<UmlRenderResult>>();
const CACHE_SIZE = 40;

/** Renders PlantUML text; never throws. Server results are cached per server + text. */
export async function renderStepUml(source: string, opts: UmlRenderOptions = {}): Promise<UmlRenderResult> {
  const text = source.trim();
  if (!text) return { status: 'empty' };
  const server = opts.server ?? getPlantUmlServer();
  let localError: string | null = null;
  const sequence = await import('../services/plantuml-sequence-svg');
  if (sequence.isSequenceDiagram(text)) {
    try {
      const result = sequence.renderSequenceSvg(text);
      return { status: 'ok', svg: result.svg, renderer: 'local', warnings: result.warnings };
    } catch (error) {
      if (!(error instanceof sequence.PlantUmlSyntaxError)) {
        console.error('[Scenarios] Local PlantUML rendering failed:', error);
      }
      localError = error instanceof Error ? error.message : String(error);
    }
  }
  if (!server) {
    return {
      status: 'error',
      offline: false,
      message: localError
        ? `Cannot render this diagram: ${localError}.`
        : 'Only sequence diagrams are rendered locally. To render other PlantUML diagrams, set a PlantUML server in the step editor.',
    };
  }
  const key = `${server}\n${text}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = renderOnPlantUmlServer(text, server, opts).then(
    (svg): UmlRenderResult => ({ status: 'ok', svg, renderer: 'server', warnings: [] }),
    (error: unknown): UmlRenderResult => {
      cache.delete(key);
      const offline = error instanceof PlantUmlServerError && error.kind === 'offline';
      return { status: 'error', offline, message: error instanceof Error ? error.message : String(error) };
    }
  );
  cache.set(key, pending);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return pending;
}

/** Forgets cached server renderings (tests, server change). */
export function clearUmlCache(): void {
  cache.clear();
}

/** Fills `host` with the rendering result (SVG, error or empty hint). */
export function showUmlResult(host: HTMLElement, result: UmlRenderResult, emptyHint = 'No UML diagram.'): void {
  host.replaceChildren();
  host.classList.toggle('rd-scn-uml-error', result.status === 'error');
  if (result.status === 'empty') {
    const p = document.createElement('p');
    p.className = 'rd-scn-muted';
    p.textContent = emptyHint;
    host.appendChild(p);
    return;
  }
  if (result.status === 'error') {
    const p = document.createElement('p');
    p.className = 'rd-scn-uml-message';
    p.setAttribute('role', 'status');
    p.textContent = (result.offline ? 'PlantUML server offline — ' : '') + result.message;
    host.appendChild(p);
    return;
  }
  // local SVG: built from escaped text; server SVG: sanitized in plantuml-server.ts
  const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg && svg.localName === 'svg' && doc.getElementsByTagName('parsererror').length === 0) {
    svg.setAttribute('data-renderer', result.renderer);
    host.appendChild(document.importNode(svg, true));
  }
  if (result.warnings.length) {
    const w = document.createElement('p');
    w.className = 'rd-scn-uml-warnings';
    w.textContent = `Skipped: ${result.warnings.slice(0, 3).join('; ')}${result.warnings.length > 3 ? ` (+${result.warnings.length - 3})` : ''}`;
    host.appendChild(w);
  }
}
