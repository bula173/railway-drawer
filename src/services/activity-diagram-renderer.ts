/**
 * @file activity-diagram-renderer.ts
 * @brief Renderer for PlantUML activity diagrams
 */

import { Cell, CellStyle, Graph } from '@maxgraph/core';
import { DiagramData } from './plantuml-parser';
import { logger } from '../drawio/logger';

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

  renderIntoGroup(diagramData: DiagramData, groupCell: Cell): void {
    logger.debug('ActivityDiagram', 'Rendering into group');
    const parent = groupCell;

    const activities = diagramData.elements.filter((el) => el.type === 'activity');
    logger.debug('ActivityDiagram', 'Found activities:', activities.length);

    if (activities.length === 0) return;

    this.graph.batchUpdate(() => {
      const activityMap = new Map<string, { cell: Cell; y: number }>();
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
          'rounded=1;fillColor=#b3e5fc;strokeColor=#0288d1;fontSize=11;' as unknown as CellStyle
        );

        activityMap.set(activity.id, { cell: activityCell, y });
      });

      // Draw flows
      diagramData.connections.forEach((conn) => {
        const fromInfo = activityMap.get(conn.from);
        const toInfo = activityMap.get(conn.to);

        if (fromInfo && toInfo) {
          const flowStyle = 'endArrow=block;strokeColor=#0288d1;';
          this.graph.insertEdge(parent, null, conn.label || '', fromInfo.cell, toInfo.cell, flowStyle as unknown as CellStyle);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }
}
