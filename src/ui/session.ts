/**
 * @file session.ts
 * @brief The active diagram session and the singleton views bound to it.
 *
 * A DiagramSession is what a panel needs of a tab: its graph, its command service (undo history)
 * and its document. The TabManager makes a tab's session the active one when the tab is shown
 * (bus event `active-session-changed`). The shell's panels (Properties, Layers, status bar, ...)
 * are views created once over the shared DOM: they bind their graph listeners to the active
 * session only (ActiveSessionBinding: released and re-added on every change), so an edit on a
 * background tab never touches the visible panels.
 */
import type { Graph } from '@maxgraph/core';
import { emit, on } from '../core/event-bus';
import { Disposers } from '../core/graph-events';
import type { DiagramDocument } from '../document/diagram-document';
import type { GraphCommandService } from '../services/graph-command-service';

export interface DiagramSession {
  /** The tab id. */
  readonly id: string;
  readonly graph: Graph;
  readonly graphCommandService: GraphCommandService;
  readonly document: DiagramDocument;
}

declare module '../core/event-bus' {
  interface AppEventMap {
    /** The shown tab's session changed (tab switch, first tab, close of the shown tab); null: none. */
    'active-session-changed': { session: DiagramSession | null };
  }
}

let active: DiagramSession | null = null;

/** The active session (the shown tab's), or null before the first tab. */
export function activeSession(): DiagramSession | null {
  return active;
}

/** Makes `session` the active one and tells the views (TabManager). */
export function setActiveSession(session: DiagramSession | null): void {
  if (session === active) return;
  active = session;
  emit('active-session-changed', { session });
}

/** The part of a session a view binds to (a graph is enough for most panels and their tests). */
export type GraphSession = Pick<DiagramSession, 'graph'> & Partial<DiagramSession>;

/**
 * Binds a view to a session: `bind(session, disposers)` runs for each new session after the
 * previous one's disposers ran. Follows the active session, or stays on `fixed` (a panel built
 * for one graph, e.g. in unit tests).
 */
export class ActiveSessionBinding<S extends GraphSession = DiagramSession> {
  private readonly disposers = new Disposers();
  private readonly stop: (() => void) | null;
  private current: S | null = null;

  constructor(
    private readonly bind: (session: S, disposers: Disposers) => void,
    private readonly unbind: ((session: S) => void) | null = null,
    fixed: S | null = null
  ) {
    if (fixed) {
      this.stop = null;
      this.set(fixed);
    } else {
      this.stop = on('active-session-changed', ({ session }) => this.set(session as S | null));
      this.set(active as S | null);
    }
  }

  /** The bound session, or null. */
  get session(): S | null {
    return this.current;
  }

  private set(session: S | null): void {
    if (session === this.current) return;
    const previous = this.current;
    if (previous) {
      this.disposers.dispose();
      this.unbind?.(previous);
    }
    this.current = session;
    if (session) this.bind(session, this.disposers);
  }

  /** Stops following and releases the bound session's listeners. */
  dispose(): void {
    this.stop?.();
    this.set(null);
  }
}
