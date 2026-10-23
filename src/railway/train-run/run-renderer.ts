/**
 * @file run-renderer.ts
 * @brief Puts a train run's state at time t on a graph: the object states (state-apply.ts
 *        `applyObjectStates`, so the look is exactly the one of the Object State commands) and the
 *        train cell's position along the path. Used on the run view's own graph (render-time
 *        animation: that model has no undo history and is thrown away), on a scratch graph for the
 *        scenario snapshots, and once on the live graph for "Keep final state" (the caller wraps it
 *        in one model update = one undo step).
 *
 * Objects are matched by their railway ID (sections/tracks, points, signals, routes). The values an
 * object had before the run are remembered; going back in time (timeline scrubber) restores them.
 * "free" and "stop" are the defaults and are written as "no state" (like Reset State).
 */
import { Cell, Geometry } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import { parseDrawioStyle } from '../../format/drawio-xml';
import { absoluteBounds } from '../geometry';
import { ID_PLACEHOLDER, allCells, buildDataValue, getCellKind, nextFreeId, readObjectId, usedIds } from '../object-data';
import { applyObjectStates, readStates } from '../state-apply';
import type { StateItem } from '../state-apply';
import { pointAtM } from './run-path';
import { changeKey, headAt, statesAt } from './simulate';
import type { RunResult } from './simulate';

/** Style of a train created for a run (the ERTMS palette's train symbol). */
export const NEW_TRAIN_STYLE = 'shape=ertms-train;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#404040;';
export const NEW_TRAIN_SIZE = { width: 50, height: 20 };
/** Gap between the train symbol and the track line. */
const TRAIN_GAP = 4;

export interface TrainChoice {
  /** Cell id of an existing train (null: a new train is created). */
  cellId: string | null;
  /** ID of a new train (default: next free TR<n>). */
  newId?: string;
}

type Values = { state: string; aspect: string; position: string };

function keyOfCell(cell: Cell): string | null {
  const kind = getCellKind(cell);
  const id = readObjectId(cell);
  if (!kind || !id) return null;
  if (kind === 'trackSection' || kind === 'track') return changeKey({ kind: 'section', id });
  if (kind === 'points' || kind === 'signal' || kind === 'route') return changeKey({ kind, id });
  return null;
}

export class RunRenderer {
  private readonly cellsByKey = new Map<string, Cell[]>();
  private readonly original = new Map<Cell, Values>();
  private readonly current = new Map<Cell, Values>();
  private train: Cell | null = null;
  private trainOriginal: Geometry | null = null;
  /** IDs of the run that are not in the drawing. */
  readonly missing: string[] = [];
  /** ID of the train (existing or new). */
  readonly trainId: string;
  private readonly createTrain: boolean;

  constructor(
    readonly graph: Graph,
    readonly run: RunResult,
    train: TrainChoice
  ) {
    const model = graph.getDataModel();
    // sections before tracks: a block ID names the section when both exist
    const cells = allCells(model);
    for (const cell of cells) {
      const key = keyOfCell(cell);
      if (!key) continue;
      const list = this.cellsByKey.get(key) ?? [];
      const isSection = getCellKind(cell) === 'trackSection';
      if (key.startsWith('block:') && list.length > 0 && getCellKind(list[0]) !== getCellKind(cell)) {
        if (isSection) this.cellsByKey.set(key, [cell]); // a section wins over a track of the same ID
        continue;
      }
      list.push(cell);
      this.cellsByKey.set(key, list);
    }
    for (const e of run.events) {
      for (const c of e.changes) {
        if (!this.cellsByKey.has(changeKey(c)) && !this.missing.includes(c.id)) this.missing.push(c.id);
      }
    }
    const existing = train.cellId ? model.getCell(train.cellId) : null;
    this.createTrain = !existing;
    if (existing) {
      this.train = existing;
      this.trainOriginal = existing.getGeometry()?.clone() ?? null;
      this.trainId = readObjectId(existing) || String(existing.getId());
    } else {
      this.trainId = train.newId?.trim() || nextFreeId('train', usedIds(model, 'train'));
    }
  }

  /** The train cell (after the first `showAt` for a new train). */
  getTrainCell(): Cell | null {
    return this.train;
  }

  private ensureTrain(): Cell | null {
    if (this.train || !this.createTrain) return this.train;
    const model = this.graph.getDataModel();
    const value = buildDataValue('', { kind: 'train', values: { id: this.trainId, length: String(Math.round(this.run.options.lengthM)) } }) as Element;
    value.setAttribute('label', ID_PLACEHOLDER);
    value.setAttribute('placeholders', '1');
    const style = parseDrawioStyle(`${NEW_TRAIN_STYLE}verticalAlign=bottom;labelPosition=center;verticalLabelPosition=top;fontSize=10;`);
    const cell = new Cell(value, new Geometry(0, 0, NEW_TRAIN_SIZE.width, NEW_TRAIN_SIZE.height), style);
    cell.setVertex(true);
    model.add(this.graph.getDefaultParent(), cell);
    this.train = cell;
    return cell;
  }

  /** Geometry of the train cell with its head at `m` metres (above / beside the track). */
  private trainGeometry(cell: Cell, m: number): Geometry | null {
    const geo = cell.getGeometry();
    if (!geo) return null;
    const { p, dir } = pointAtM(this.run.path, m);
    const w = geo.width;
    const h = geo.height;
    let x: number;
    let y: number;
    if (Math.abs(dir.x) >= Math.abs(dir.y)) {
      x = dir.x >= 0 ? p.x - w : p.x;
      y = p.y - h - TRAIN_GAP;
    } else {
      x = p.x + TRAIN_GAP;
      y = dir.y >= 0 ? p.y - h : p.y;
    }
    const parent = cell.getParent();
    if (parent?.isVertex()) {
      const pb = absoluteBounds(parent);
      if (pb) {
        x -= pb.x;
        y -= pb.y;
      }
    }
    const next = geo.clone();
    next.x = Math.round(x * 100) / 100;
    next.y = Math.round(y * 100) / 100;
    return next;
  }

  private valuesOf(cell: Cell): Values {
    let v = this.current.get(cell);
    if (!v) {
      v = readStates(cell);
      this.original.set(cell, { ...v });
      this.current.set(cell, v);
    }
    return v;
  }

  /**
   * Shows the run at time `t` (seconds; clamped): object states and the train position. Runs as one
   * model update; returns the number of cells whose state changed.
   */
  showAt(t: number): number {
    const time = Math.max(0, Math.min(this.run.durationS, t));
    const desired = statesAt(this.run, time);
    const items: StateItem[] = [];
    const keys = new Set<string>(desired.keys());
    for (const [key, cells] of this.cellsByKey) if (cells.some((c) => this.current.has(c))) keys.add(key);
    for (const key of keys) {
      const change = desired.get(key);
      for (const cell of this.cellsByKey.get(key) ?? []) {
        const now = this.valuesOf(cell);
        const base = this.original.get(cell)!;
        const target: Values = { ...base };
        if (change?.state !== undefined) target.state = change.state === 'free' ? '' : change.state;
        if (change?.aspect !== undefined) target.aspect = change.aspect === 'stop' ? '' : change.aspect;
        if (change?.position !== undefined) target.position = change.position;
        if (target.state === now.state && target.aspect === now.aspect && target.position === now.position) continue;
        items.push({
          cell,
          change: {
            ...(target.state !== now.state ? { state: target.state || null } : {}),
            ...(target.aspect !== now.aspect ? { aspect: target.aspect || null } : {}),
            ...(target.position !== now.position ? { position: target.position || null } : {}),
          },
        });
        this.current.set(cell, target);
      }
    }
    const model = this.graph.getDataModel();
    model.beginUpdate();
    try {
      if (items.length > 0) applyObjectStates(this.graph, items);
      const train = this.ensureTrain();
      if (train) {
        const geo = this.trainGeometry(train, headAt(this.run, time));
        const old = train.getGeometry();
        if (geo && (!old || old.x !== geo.x || old.y !== geo.y)) model.setGeometry(train, geo);
      }
    } finally {
      model.endUpdate();
    }
    return items.length;
  }

  /** Back to the drawing before the run (states, train position; a created train removed). */
  restore(): void {
    const model = this.graph.getDataModel();
    const items: StateItem[] = [];
    for (const [cell, now] of this.current) {
      const base = this.original.get(cell)!;
      if (base.state === now.state && base.aspect === now.aspect && base.position === now.position) continue;
      items.push({ cell, change: { state: base.state || null, aspect: base.aspect || null, position: base.position || null } });
      this.current.set(cell, { ...base });
    }
    model.beginUpdate();
    try {
      if (items.length > 0) applyObjectStates(this.graph, items);
      if (this.train && this.createTrain && model.contains(this.train)) {
        model.remove(this.train);
        this.train = null;
      } else if (this.train && this.trainOriginal) {
        model.setGeometry(this.train, this.trainOriginal.clone());
      }
    } finally {
      model.endUpdate();
    }
  }
}
