import { Graph, type Cell, type Geometry } from '@maxgraph/core';

/** A selected vertex; alignment assumes vertices carry a geometry */
type VertexCell = Cell & { geometry: Geometry };

type Axis = 'x' | 'y';

/**
 * Align / distribute (Arrange menu, toolbar Align dropdown `#btn-align-*` / `#btn-distribute-*`: the
 * align / distribute commands of ui/commands/arrange.ts run these on the active tab).
 * Like draw.io's alignCells/distributeCells: every command is ONE model update (one undo step) that
 * writes cloned geometries through `model.setGeometry`; locked cells (`locked=1` on the cell, its group or
 * its layer, i.e. not movable) are skipped and do not count as a reference either.
 */
export class AlignmentController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  /** Selected, unlocked (movable) vertices with an absolute geometry */
  private getSelectedVertices(): VertexCell[] {
    return this.graph
      .getSelectionCells()
      .filter(
        (cell: Cell): cell is VertexCell =>
          !!cell.isVertex?.() &&
          !!cell.geometry &&
          !cell.geometry.relative &&
          this.graph.isCellMovable(cell)
      );
  }

  /** Writes new x (or y) values as cloned geometries in one undoable model update */
  private applyPositions(axis: Axis, moves: Array<[VertexCell, number]>): void {
    const changed = moves.filter(([cell, value]) => cell.geometry[axis] !== value);
    if (changed.length === 0) return;
    const model = this.graph.getDataModel();
    this.graph.batchUpdate(() => {
      for (const [cell, value] of changed) {
        const geo = cell.geometry.clone();
        geo[axis] = value;
        model.setGeometry(cell, geo);
      }
    });
  }

  private align(axis: Axis, where: 'start' | 'center' | 'end'): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 2) return;
    const size = (v: VertexCell) => (axis === 'x' ? v.geometry.width : v.geometry.height);
    const min = Math.min(...vertices.map((v) => v.geometry[axis]));
    const max = Math.max(...vertices.map((v) => v.geometry[axis] + size(v)));
    this.applyPositions(
      axis,
      vertices.map((v) => {
        if (where === 'start') return [v, min];
        if (where === 'end') return [v, max - size(v)];
        return [v, (min + max) / 2 - size(v) / 2];
      })
    );
  }

  private distribute(axis: Axis): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 3) return;
    const size = (v: VertexCell) => (axis === 'x' ? v.geometry.width : v.geometry.height);
    const sorted = [...vertices].sort((a, b) => a.geometry[axis] - b.geometry[axis]);
    const min = sorted[0].geometry[axis];
    const max = Math.max(...sorted.map((v) => v.geometry[axis] + size(v)));
    const total = sorted.reduce((sum, v) => sum + size(v), 0);
    const spacing = (max - min - total) / (sorted.length - 1);
    let current = min;
    const moves: Array<[VertexCell, number]> = sorted.map((v) => {
      const pos = current;
      current += size(v) + spacing;
      return [v, pos];
    });
    this.applyPositions(axis, moves);
  }

  alignLeft(): void {
    this.align('x', 'start');
  }

  alignCenter(): void {
    this.align('x', 'center');
  }

  alignRight(): void {
    this.align('x', 'end');
  }

  alignTop(): void {
    this.align('y', 'start');
  }

  alignMiddle(): void {
    this.align('y', 'center');
  }

  alignBottom(): void {
    this.align('y', 'end');
  }

  distributeHorizontally(): void {
    this.distribute('x');
  }

  distributeVertically(): void {
    this.distribute('y');
  }

  destroy(): void {
    // Listeners are on shared DOM and recorded by the tab's listener capture
  }
}
