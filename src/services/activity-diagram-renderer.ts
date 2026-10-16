/**
 * @file activity-diagram-renderer.ts
 * @brief Renderer for PlantUML activity diagrams
 */

import { Graph } from '@maxgraph/core';
import { DiagramData } from './plantuml-parser';

export class ActivityDiagramRenderer {
  private graph: Graph;
  private activityWidth = 140;
  private activityHeight = 50;
  private activitySpacingY = 120;
  private startX = 50;
  private startY = 50;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  renderIntoGroup(diagramData: DiagramData, groupCell: any): void {
    console.log('[ActivityDiagram] Rendering into group');
    const parent = groupCell;

    const activities = diagramData.elements.filter((el) => el.type === 'activity');
    console.log('[ActivityDiagram] Found activities:', activities.length);

    if (activities.length === 0) return;

    this.graph.batchUpdate(() => {
      const activityMap = new Map<string, any>();
      const centerX = this.startX + 150;

      activities.forEach((activity, index) => {
        const y = this.startY + index * this.activitySpacingY;

        const activityCell = this.graph.insertVertex(
          parent,
          `activity_${activity.id}`,
          activity.label,
          centerX - this.activityWidth / 2,
          y,
          this.activityWidth,
          this.activityHeight,
          'rounded=1;fillColor=#b3e5fc;strokeColor=#0288d1;fontSize=11;' as any
        );

        activityMap.set(activity.id, { cell: activityCell, y });
      });

      // Draw flows
      diagramData.connections.forEach((conn) => {
        const fromInfo = activityMap.get(conn.from);
        const toInfo = activityMap.get(conn.to);

        if (fromInfo && toInfo) {
          const flowStyle = 'endArrow=block;strokeColor=#0288d1;';
          this.graph.insertEdge(parent, null, conn.label || '', fromInfo.cell, toInfo.cell, flowStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }

  render(diagramData: DiagramData): void {
    console.log('[ActivityDiagram] Rendering');
    const parent = this.graph.getDefaultParent();

    const activities = diagramData.elements.filter((el) => el.type === 'activity');
    console.log('[ActivityDiagram] Found activities:', activities.length);

    if (activities.length === 0) return;

    this.graph.batchUpdate(() => {
      const activityMap = new Map<string, any>();
      const centerX = this.startX + 150;

      activities.forEach((activity, index) => {
        const y = this.startY + index * this.activitySpacingY;

        const activityCell = this.graph.insertVertex(
          parent,
          `activity_${activity.id}`,
          activity.label,
          centerX - this.activityWidth / 2,
          y,
          this.activityWidth,
          this.activityHeight,
          'rounded=1;fillColor=#b3e5fc;strokeColor=#0288d1;fontSize=11;' as any
        );

        activityMap.set(activity.id, { cell: activityCell, y });
      });

      // Draw flows
      diagramData.connections.forEach((conn) => {
        const fromInfo = activityMap.get(conn.from);
        const toInfo = activityMap.get(conn.to);

        if (fromInfo && toInfo) {
          const flowStyle = 'endArrow=block;strokeColor=#0288d1;';
          this.graph.insertEdge(parent, null, conn.label || '', fromInfo.cell, toInfo.cell, flowStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }
}
