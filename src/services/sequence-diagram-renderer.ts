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
   * Get style for participant type
   */
  private getStyleForParticipantType(stereotype?: string): string {
    switch (stereotype?.toLowerCase()) {
      case 'actor':
        return 'shape=customPlantUmlActor;fillColor=#fff2cc;strokeColor=#d6b656;shadow=0;';
      case 'boundary':
        return 'shape=customPlantUmlBoundary;fillColor=#e8f4f8;strokeColor=#0c5aa0;shadow=0;';
      case 'control':
        return 'shape=customPlantUmlControl;fillColor=#f8e8f4;strokeColor=#8b0c5a;shadow=0;';
      case 'entity':
        return 'shape=customPlantUmlEntity;fillColor=#f4f8e8;strokeColor=#5aa00c;shadow=0;';
      case 'database':
        return 'shape=customPlantUmlDatabase;fillColor=#ffe8e8;strokeColor=#a00c0c;shadow=0;';
      case 'collections':
        return 'shape=customPlantUmlCollections;fillColor=#e8e8f4;strokeColor=#0c0ca0;shadow=0;';
      case 'queue':
        return 'shape=customPlantUmlQueue;fillColor=#f4e8e8;strokeColor=#8b5a0c;shadow=0;';
      default:
        return 'shape=customPlantUmlParticipant;fillColor=#e8f4f8;strokeColor=#0284C7;rounded=1;shadow=0;';
    }
  }

  /**
   * Render sequence diagram into a group
   */
  renderIntoGroup(diagramData: DiagramData, groupCell: any): void {
    console.log('[SequenceDiagram] Rendering into group');
    const parent = groupCell;

    // Separate participants from other elements
    const participants = diagramData.elements.filter((el) => el.type === 'participant');

    console.log('[SequenceDiagram] Found participants:', participants.length);
    if (participants.length === 0) {
      console.warn('[SequenceDiagram] No participants found!');
      return;
    }

    this.graph.batchUpdate(() => {
      // 1. Draw participant boxes and lifelines
      const participantMap = new Map<string, { x: number; y: number; cell: any }>();
      participants.forEach((participant, index) => {
        const x = this.startX + index * this.lifelineSpacing;
        const y = this.startY;

        const style = this.getStyleForParticipantType(participant.stereotype);

        // Participant box with proper shape
        const participantCell = this.graph.insertVertex(
          parent,
          `seq_participant_${participant.id}`,
          participant.label,
          x - this.participantWidth / 2,
          y,
          this.participantWidth,
          this.participantHeight,
          `${style}fontSize=12;fontStyle=bold;` as any
        );

        participantMap.set(participant.id, { x, y: y + this.participantHeight, cell: participantCell });
      });

      // 2. Draw messages with anchor points
      const lifelineY = this.startY + this.participantHeight;
      const maxY = this.startY + this.participantHeight + diagramData.connections.length * this.messageSpacing;

      // Create invisible anchor points for messages
      const messageAnchors = new Map<number, { from: any; to: any }>();

      diagramData.connections.forEach((connection, index) => {
        const fromInfo = participantMap.get(connection.from);
        const toInfo = participantMap.get(connection.to);

        if (!fromInfo || !toInfo) {
          console.warn(`[SequenceDiagram] Missing participant: ${connection.from} or ${connection.to}`);
          return;
        }

        const x1 = fromInfo.x;
        const x2 = toInfo.x;
        const y = this.startY + this.participantHeight + (index + 1) * this.messageSpacing;

        // Create invisible anchor cells for edge endpoints
        const fromAnchor = this.graph.insertVertex(parent, null, '', x1 - 5, y - 5, 10, 10, 'opacity=0;' as any);
        const toAnchor = this.graph.insertVertex(parent, null, '', x2 - 5, y - 5, 10, 10, 'opacity=0;' as any);

        // Draw message arrow between anchors
        const isAsync = connection.type === 'async';
        const isDashed = isAsync ? '1' : '0';
        const msgStyle = `dashed=${isDashed};endArrow=block;fontSize=11;labelBackgroundColor=white;`;

        this.graph.insertEdge(parent, null, connection.label || '', fromAnchor, toAnchor, msgStyle as any);

        messageAnchors.set(index, { from: fromAnchor, to: toAnchor });
      });

      // 3. Draw lifelines (vertical dashed lines)
      participantMap.forEach((info) => {
        const lifelineStyle = 'dashed=1;strokeColor=#999999;endArrow=none;startArrow=none;';
        const lifelineStart = this.graph.insertVertex(parent, null, '', info.x - 5, lifelineY - 5, 10, 10, 'opacity=0;' as any);
        const lifelineEnd = this.graph.insertVertex(parent, null, '', info.x - 5, maxY + this.messageSpacing - 5, 10, 10, 'opacity=0;' as any);
        this.graph.insertEdge(parent, null, '', lifelineStart, lifelineEnd, lifelineStyle as any);
      });
    });

    // Fit diagram to view
    setTimeout(() => this.graph.fit(50), 100);
  }

  /**
   * Render sequence diagram with proper layout
   */
  render(diagramData: DiagramData): void {
    console.log('[SequenceDiagram] Rendering', diagramData);
    const parent = this.graph.getDefaultParent();

    // Separate participants from other elements
    const participants = diagramData.elements.filter((el) => el.type === 'participant');

    console.log('[SequenceDiagram] Found participants:', participants.length);
    if (participants.length === 0) {
      console.warn('[SequenceDiagram] No participants found!');
      return;
    }

    this.graph.batchUpdate(() => {
      // 1. Draw participant boxes and lifelines
      const participantMap = new Map<string, { x: number; y: number; cell: any }>();
      participants.forEach((participant, index) => {
        const x = this.startX + index * this.lifelineSpacing;
        const y = this.startY;

        const style = this.getStyleForParticipantType(participant.stereotype);

        // Participant box with proper shape
        const participantCell = this.graph.insertVertex(
          parent,
          `seq_participant_${participant.id}`,
          participant.label,
          x - this.participantWidth / 2,
          y,
          this.participantWidth,
          this.participantHeight,
          `${style}fontSize=12;fontStyle=bold;` as any
        );

        participantMap.set(participant.id, { x, y: y + this.participantHeight, cell: participantCell });
      });

      // 2. Draw messages with anchor points
      const lifelineY = this.startY + this.participantHeight;
      const maxY = this.startY + this.participantHeight + diagramData.connections.length * this.messageSpacing;

      // Create invisible anchor points for messages
      const messageAnchors = new Map<number, { from: any; to: any }>();

      diagramData.connections.forEach((connection, index) => {
        const fromInfo = participantMap.get(connection.from);
        const toInfo = participantMap.get(connection.to);

        if (!fromInfo || !toInfo) {
          console.warn(`[SequenceDiagram] Missing participant: ${connection.from} or ${connection.to}`);
          return;
        }

        const x1 = fromInfo.x;
        const x2 = toInfo.x;
        const y = this.startY + this.participantHeight + (index + 1) * this.messageSpacing;

        // Create invisible anchor cells for edge endpoints
        const fromAnchor = this.graph.insertVertex(parent, null, '', x1 - 5, y - 5, 10, 10, 'opacity=0;' as any);
        const toAnchor = this.graph.insertVertex(parent, null, '', x2 - 5, y - 5, 10, 10, 'opacity=0;' as any);

        // Draw message arrow between anchors
        const isAsync = connection.type === 'async';
        const isDashed = isAsync ? '1' : '0';
        const msgStyle = `dashed=${isDashed};endArrow=block;fontSize=11;labelBackgroundColor=white;`;

        this.graph.insertEdge(parent, null, connection.label || '', fromAnchor, toAnchor, msgStyle as any);

        messageAnchors.set(index, { from: fromAnchor, to: toAnchor });
      });

      // 3. Draw lifelines (vertical dashed lines)
      participantMap.forEach((info) => {
        const lifelineStyle = 'dashed=1;strokeColor=#999999;endArrow=none;startArrow=none;';
        const lifelineStart = this.graph.insertVertex(parent, null, '', info.x - 5, lifelineY - 5, 10, 10, 'opacity=0;' as any);
        const lifelineEnd = this.graph.insertVertex(parent, null, '', info.x - 5, maxY + this.messageSpacing - 5, 10, 10, 'opacity=0;' as any);
        this.graph.insertEdge(parent, null, '', lifelineStart, lifelineEnd, lifelineStyle as any);
      });
    });

    // Fit to view
    setTimeout(() => this.graph.fit(50), 100);
  }
}
