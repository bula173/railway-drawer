/**
 * @file sequence-diagram-renderer.ts
 * @brief Specialized renderer for sequence diagrams
 * @details Converts PlantUML sequence diagrams to maxGraph with proper layout
 */

import { Graph } from '@maxgraph/core';
import { DiagramData } from './plantuml-parser';

export class SequenceDiagramRenderer {
  private graph: Graph;
  private participantWidth = 100;
  private participantHeight = 40;
  private lifelineSpacing = 150;
  private messageSpacing = 60;
  private startX = 50;
  private startY = 50;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  /**
   * Render sequence diagram with proper layout
   */
  render(diagramData: DiagramData): void {
    const parent = this.graph.getDefaultParent();

    // Separate participants from other elements
    const participants = diagramData.elements.filter((el) => el.type === 'participant');

    if (participants.length === 0) return;

    this.graph.batchUpdate(() => {
      // 1. Draw participant boxes and lifelines
      const participantMap = new Map<string, { x: number; y: number; cell: any }>();
      participants.forEach((participant, index) => {
        const x = this.startX + index * this.lifelineSpacing;
        const y = this.startY;

        // Participant box
        const participantCell = this.graph.insertVertex(
          parent,
          `seq_participant_${participant.id}`,
          participant.label,
          x - this.participantWidth / 2,
          y,
          this.participantWidth,
          this.participantHeight,
          'rounded=1;shadow=0;fillColor=#E8F4F8;strokeColor=#0284C7;fontSize=12;fontStyle=bold;' as any
        );

        participantMap.set(participant.id, { x, y: y + this.participantHeight, cell: participantCell });
      });

      // 2. Draw messages
      const lifelineY = this.startY + this.participantHeight;
      const maxY = this.startY + this.participantHeight + diagramData.connections.length * this.messageSpacing;

      diagramData.connections.forEach((connection, index) => {
        const fromInfo = participantMap.get(connection.from);
        const toInfo = participantMap.get(connection.to);

        if (!fromInfo || !toInfo) return;

        const x1 = fromInfo.x;
        const x2 = toInfo.x;
        const y = this.startY + this.participantHeight + (index + 1) * this.messageSpacing;

        // Draw message arrow
        const isAsync = connection.type === 'async';
        const isDashed = isAsync ? '1' : '0';
        const style = `dashed=${isDashed};endArrow=block;fontSize=11;labelBackgroundColor=white;`;

        this.graph.insertEdge(parent, null, connection.label || '', { x: x1, y } as any, { x: x2, y } as any, style as any);
      });

      // 3. Draw lifelines (vertical dashed lines)
      participantMap.forEach((info) => {
        const lifelineStyle = 'dashed=1;strokeColor=#999999;endArrow=none;';
        this.graph.insertEdge(
          parent,
          null,
          '',
          { x: info.x, y: lifelineY } as any,
          { x: info.x, y: maxY + this.messageSpacing } as any,
          lifelineStyle as any
        );
      });
    });

    // Fit to view
    setTimeout(() => this.graph.fit(50), 100);
  }
}
