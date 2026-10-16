/**
 * @file state-diagram-renderer.ts
 * @brief Renderer for PlantUML state diagrams
 */

import { Graph } from '@maxgraph/core';
import { DiagramData } from './plantuml-parser';

export class StateDiagramRenderer {
  private graph: Graph;
  private stateWidth = 120;
  private stateHeight = 60;
  private stateSpacingX = 200;
  private stateSpacingY = 200;
  private startX = 50;
  private startY = 50;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  renderIntoGroup(diagramData: DiagramData, groupCell: any): void {
    console.log('[StateDiagram] Rendering into group');
    const parent = groupCell;

    const states = diagramData.elements.filter((el) => el.type === 'state');
    console.log('[StateDiagram] Found states:', states.length);

    if (states.length === 0) return;

    this.graph.batchUpdate(() => {
      const stateMap = new Map<string, any>();
      let col = 0;
      let row = 0;
      const colsPerRow = Math.ceil(Math.sqrt(states.length));

      states.forEach((state) => {
        const x = this.startX + col * this.stateSpacingX;
        const y = this.startY + row * this.stateSpacingY;

        const stateCell = this.graph.insertVertex(
          parent,
          `state_${state.id}`,
          state.label,
          x,
          y,
          this.stateWidth,
          this.stateHeight,
          'rounded=1;fillColor=#b3e5fc;strokeColor=#0288d1;fontSize=12;' as any
        );

        stateMap.set(state.id, stateCell);

        col++;
        if (col >= colsPerRow) {
          col = 0;
          row++;
        }
      });

      // Draw transitions
      diagramData.connections.forEach((conn) => {
        let fromCell: any;
        let toCell: any;

        if (conn.from === 'initial') {
          // Create initial state (circle)
          if (!stateMap.has('initial')) {
            const initCell = this.graph.insertVertex(
              parent,
              'state_initial',
              '',
              this.startX - 100,
              this.startY,
              20,
              20,
              'ellipse;fillColor=#000000;strokeColor=#000000;' as any
            );
            stateMap.set('initial', initCell);
          }
          fromCell = stateMap.get('initial');
        } else {
          fromCell = stateMap.get(conn.from);
        }

        if (conn.to === 'final') {
          // Create final state (circle with border)
          if (!stateMap.has('final')) {
            const finalCell = this.graph.insertVertex(
              parent,
              'state_final',
              '',
              this.startX + 500,
              this.startY,
              20,
              20,
              'ellipse;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;' as any
            );
            stateMap.set('final', finalCell);
          }
          toCell = stateMap.get('final');
        } else {
          toCell = stateMap.get(conn.to);
        }

        if (fromCell && toCell) {
          const transitionStyle = 'endArrow=block;strokeColor=#0288d1;';
          this.graph.insertEdge(parent, null, conn.label || '', fromCell, toCell, transitionStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }

  render(diagramData: DiagramData): void {
    console.log('[StateDiagram] Rendering');
    const parent = this.graph.getDefaultParent();

    const states = diagramData.elements.filter((el) => el.type === 'state');
    console.log('[StateDiagram] Found states:', states.length);

    if (states.length === 0) return;

    this.graph.batchUpdate(() => {
      const stateMap = new Map<string, any>();
      let col = 0;
      let row = 0;
      const colsPerRow = Math.ceil(Math.sqrt(states.length));

      states.forEach((state) => {
        const x = this.startX + col * this.stateSpacingX;
        const y = this.startY + row * this.stateSpacingY;

        const stateCell = this.graph.insertVertex(
          parent,
          `state_${state.id}`,
          state.label,
          x,
          y,
          this.stateWidth,
          this.stateHeight,
          'rounded=1;fillColor=#b3e5fc;strokeColor=#0288d1;fontSize=12;' as any
        );

        stateMap.set(state.id, stateCell);

        col++;
        if (col >= colsPerRow) {
          col = 0;
          row++;
        }
      });

      // Draw transitions
      diagramData.connections.forEach((conn) => {
        let fromCell: any;
        let toCell: any;

        if (conn.from === 'initial') {
          if (!stateMap.has('initial')) {
            const initCell = this.graph.insertVertex(
              parent,
              'state_initial',
              '',
              this.startX - 100,
              this.startY,
              20,
              20,
              'ellipse;fillColor=#000000;strokeColor=#000000;' as any
            );
            stateMap.set('initial', initCell);
          }
          fromCell = stateMap.get('initial');
        } else {
          fromCell = stateMap.get(conn.from);
        }

        if (conn.to === 'final') {
          if (!stateMap.has('final')) {
            const finalCell = this.graph.insertVertex(
              parent,
              'state_final',
              '',
              this.startX + 500,
              this.startY,
              20,
              20,
              'ellipse;fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;' as any
            );
            stateMap.set('final', finalCell);
          }
          toCell = stateMap.get('final');
        } else {
          toCell = stateMap.get(conn.to);
        }

        if (fromCell && toCell) {
          const transitionStyle = 'endArrow=block;strokeColor=#0288d1;';
          this.graph.insertEdge(parent, null, conn.label || '', fromCell, toCell, transitionStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }
}
