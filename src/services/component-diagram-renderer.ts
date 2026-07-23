/**
 * @file component-diagram-renderer.ts
 * @brief Renderer for PlantUML component diagrams
 */

import { Graph } from '@maxgraph/core';
import { DiagramData } from './plantuml-parser';

export class ComponentDiagramRenderer {
  private graph: Graph;
  private componentWidth = 160;
  private componentHeight = 80;
  private componentSpacingX = 250;
  private componentSpacingY = 200;
  private startX = 50;
  private startY = 50;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  renderIntoGroup(diagramData: DiagramData, groupCell: any): void {
    console.log('[ComponentDiagram] Rendering into group');
    const parent = groupCell;

    const components = diagramData.elements.filter((el) => el.type === 'component');
    console.log('[ComponentDiagram] Found components:', components.length);

    if (components.length === 0) return;

    this.graph.batchUpdate(() => {
      const componentMap = new Map<string, any>();
      let col = 0;
      let row = 0;
      const colsPerRow = Math.ceil(Math.sqrt(components.length));

      components.forEach((component) => {
        const x = this.startX + col * this.componentSpacingX;
        const y = this.startY + row * this.componentSpacingY;

        const componentCell = this.graph.insertVertex(
          parent,
          `component_${component.id}`,
          component.label,
          x,
          y,
          this.componentWidth,
          this.componentHeight,
          'shape=rectangle;fillColor=#e8f4f8;strokeColor:#0c5aa0;fontSize=12;' as any
        );

        componentMap.set(component.id, componentCell);

        col++;
        if (col >= colsPerRow) {
          col = 0;
          row++;
        }
      });

      // Draw relationships
      diagramData.connections.forEach((conn) => {
        const fromComponent = componentMap.get(conn.from);
        const toComponent = componentMap.get(conn.to);

        if (fromComponent && toComponent) {
          const relationshipStyle = 'endArrow=block;strokeColor:#0c5aa0;dashed=0;';
          this.graph.insertEdge(parent, null, conn.label || '', fromComponent, toComponent, relationshipStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }

  render(diagramData: DiagramData): void {
    console.log('[ComponentDiagram] Rendering');
    const parent = this.graph.getDefaultParent();

    const components = diagramData.elements.filter((el) => el.type === 'component');
    console.log('[ComponentDiagram] Found components:', components.length);

    if (components.length === 0) return;

    this.graph.batchUpdate(() => {
      const componentMap = new Map<string, any>();
      let col = 0;
      let row = 0;
      const colsPerRow = Math.ceil(Math.sqrt(components.length));

      components.forEach((component) => {
        const x = this.startX + col * this.componentSpacingX;
        const y = this.startY + row * this.componentSpacingY;

        const componentCell = this.graph.insertVertex(
          parent,
          `component_${component.id}`,
          component.label,
          x,
          y,
          this.componentWidth,
          this.componentHeight,
          'shape=rectangle;fillColor=#e8f4f8;strokeColor:#0c5aa0;fontSize=12;' as any
        );

        componentMap.set(component.id, componentCell);

        col++;
        if (col >= colsPerRow) {
          col = 0;
          row++;
        }
      });

      // Draw relationships
      diagramData.connections.forEach((conn) => {
        const fromComponent = componentMap.get(conn.from);
        const toComponent = componentMap.get(conn.to);

        if (fromComponent && toComponent) {
          const relationshipStyle = 'endArrow=block;strokeColor:#0c5aa0;dashed=0;';
          this.graph.insertEdge(parent, null, conn.label || '', fromComponent, toComponent, relationshipStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }
}
