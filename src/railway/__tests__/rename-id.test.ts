/** rename-id.ts: railway ID rename (unique per kind, references follow, literal label, one undo step). */
import { describe, expect, it } from 'vitest';
import { Cell, Geometry, GraphDataModel, InternalEvent, UndoManager } from '@maxgraph/core';
import type { EventObject, EventSource } from '@maxgraph/core';
import { idProblem, railwayObjectOf, renameObjectId } from '../rename-id';
import { readAttr, readObjectId, setRailwayData } from '../object-data';

function setup() {
  const model = new GraphDataModel();
  const layer = model.getRoot()!.getChildAt(0);
  const add = (kind: string, values: Record<string, string>, label = ''): Cell => {
    const cell = new Cell(label, new Geometry(0, 0, 10, 10));
    cell.setVertex(true);
    model.add(layer, cell);
    setRailwayData(model, [cell], { kind: kind as never, values });
    return cell;
  };
  const s1 = add('signal', { id: 'S1', routes: 'R1' }, 'S1');
  const s2 = add('signal', { id: 'S2' });
  const w1 = add('points', { id: 'W1' });
  const r1 = add('route', { id: 'R1', entrySignal: 'S1', exitSignal: 'S2', points: 'W1:normal, W2:reverse' });
  const bg = add('baliseGroup', { id: 'BG1' });
  const b1 = add('balise', { id: 'B1', groupId: 'bg1' });
  const undo = new UndoManager();
  (model as unknown as EventSource).addListener(InternalEvent.UNDO, (_s: EventSource, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit')));
  return { model, s1, s2, w1, r1, bg, b1, undo };
}

describe('renameObjectId', () => {
  it('renames, follows references and the literal label, one undo step', () => {
    const { model, s1, r1, undo } = setup();
    const result = renameObjectId(model, s1, ' S7 ');
    expect(result.ok).toBe(true);
    expect(readObjectId(s1)).toBe('S7');
    expect(readAttr(s1, 'label')).toBe('S7');
    expect(readAttr(r1, 'rdEntrySignal')).toBe('S7');
    expect(undo.history.length).toBe(1);
    undo.undo();
    expect(readObjectId(s1)).toBe('S1');
    expect(readAttr(r1, 'rdEntrySignal')).toBe('S1');
  });

  it('points in a route points text, groups case-insensitively, routes of a signal', () => {
    const { model, w1, r1, bg, b1, s1 } = setup();
    expect(renameObjectId(model, w1, 'W5').ok).toBe(true);
    expect(readAttr(r1, 'rdPoints')).toBe('W5:normal, W2:reverse');
    expect(renameObjectId(model, bg, 'BG4').ok).toBe(true);
    expect(readAttr(b1, 'rdGroupId')).toBe('BG4');
    expect(renameObjectId(model, r1, 'R9').ok).toBe(true);
    expect(readAttr(s1, 'rdRoutes')).toBe('R9');
  });

  it('refuses duplicates (per kind, case-insensitive), empty IDs and spaces; a case change is fine', () => {
    const { model, s1, s2 } = setup();
    expect(idProblem(model, s2, 's1')).toMatch(/already used by another signal/);
    expect(renameObjectId(model, s2, '').ok).toBe(false);
    expect(renameObjectId(model, s2, 'S 3').ok).toBe(false);
    expect(renameObjectId(model, s1, 's1').ok).toBe(true);
    // another kind may use the same ID
    expect(idProblem(model, s2, 'W1')).toBeNull();
  });

  it('railwayObjectOf: the cell or its nearest railway ancestor', () => {
    const { model, s1 } = setup();
    const lamp = new Cell('', new Geometry(0, 0, 2, 2));
    lamp.setVertex(true);
    model.add(s1, lamp);
    expect(railwayObjectOf(lamp)).toBe(s1);
    expect(railwayObjectOf(model.getRoot())).toBeNull();
  });
});
