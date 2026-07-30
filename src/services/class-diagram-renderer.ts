/**
 * @file class-diagram-renderer.ts
 * @brief Renderer for PlantUML class diagrams
 */

import { Graph } from '@maxgraph/core';
import { DiagramData } from './plantuml-parser';

export class ClassDiagramRenderer {
  private graph: Graph;
  private classWidth = 200;
  private classHeight = 150;
  private classSpacingX = 300;
  private classSpacingY = 250;
  private startX = 50;
  private startY = 50;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  renderIntoGroup(diagramData: DiagramData, groupCell: any): void {
    console.log('[ClassDiagram] Rendering into group');
    const parent = groupCell;

    const classes = diagramData.elements.filter((el) => el.type === 'class');
    console.log('[ClassDiagram] Found classes:', classes.length);

    if (classes.length === 0) return;

    this.graph.batchUpdate(() => {
      const classMap = new Map<string, any>();
      let col = 0;
      let row = 0;
      const colsPerRow = Math.ceil(Math.sqrt(classes.length));

      classes.forEach((cls) => {
        const x = this.startX + col * this.classSpacingX;
        const y = this.startY + row * this.classSpacingY;

        const classLabel = this.formatClassLabel(cls);

        const classCell = this.graph.insertVertex(
          parent,
          `class_${cls.id}`,
          classLabel,
          x,
          y,
          this.classWidth,
          this.classHeight,
          'shape=rectangle;fillColor=#e8f4f8;strokeColor=#0c5aa0;align=left;verticalAlign=top;' as any
        );

        classMap.set(cls.id, classCell);

        col++;
        if (col >= colsPerRow) {
          col = 0;
          row++;
        }
      });

      // Draw relationships
      diagramData.connections.forEach((conn) => {
        const fromClass = classMap.get(conn.from);
        const toClass = classMap.get(conn.to);

        if (fromClass && toClass) {
          const relationshipStyle = this.getRelationshipStyle(conn.type);
          this.graph.insertEdge(parent, null, conn.label || '', fromClass, toClass, relationshipStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }

  render(diagramData: DiagramData): void {
    console.log('[ClassDiagram] Rendering');
    const parent = this.graph.getDefaultParent();

    const classes = diagramData.elements.filter((el) => el.type === 'class');
    console.log('[ClassDiagram] Found classes:', classes.length);

    if (classes.length === 0) return;

    this.graph.batchUpdate(() => {
      const classMap = new Map<string, any>();
      let col = 0;
      let row = 0;
      const colsPerRow = Math.ceil(Math.sqrt(classes.length));

      classes.forEach((cls) => {
        const x = this.startX + col * this.classSpacingX;
        const y = this.startY + row * this.classSpacingY;

        const classLabel = this.formatClassLabel(cls);

        const classCell = this.graph.insertVertex(
          parent,
          `class_${cls.id}`,
          classLabel,
          x,
          y,
          this.classWidth,
          this.classHeight,
          'shape=rectangle;fillColor=#e8f4f8;strokeColor=#0c5aa0;align=left;verticalAlign=top;fontSize=11;' as any
        );

        classMap.set(cls.id, classCell);

        col++;
        if (col >= colsPerRow) {
          col = 0;
          row++;
        }
      });

      // Draw relationships
      diagramData.connections.forEach((conn) => {
        const fromClass = classMap.get(conn.from);
        const toClass = classMap.get(conn.to);

        if (fromClass && toClass) {
          const relationshipStyle = this.getRelationshipStyle(conn.type);
          this.graph.insertEdge(parent, null, conn.label || '', fromClass, toClass, relationshipStyle as any);
        }
      });
    });

    setTimeout(() => this.graph.fit(50), 100);
  }

  private formatClassLabel(cls: any): string {
    let label = cls.label;
    if (cls.attributes && cls.attributes.length > 0) {
      label += '\n---\n' + cls.attributes.join('\n');
    }
    if (cls.methods && cls.methods.length > 0) {
      label += '\n---\n' + cls.methods.join('\n');
    }
    return label;
  }

  private getRelationshipStyle(type?: string): string {
    switch (type) {
      case 'inheritance':
        return 'endArrow=block;strokeColor=#0c5aa0;dashed=0;';
      case 'aggregation':
        return 'endArrow=diamond;strokeColor=#0c5aa0;dashed=0;';
      case 'composition':
        return 'endArrow=diamondThin;strokeColor=#0c5aa0;dashed=0;';
      case 'dependency':
        return 'endArrow=block;strokeColor=#666666;dashed=1;';
      default:
        return 'endArrow=none;strokeColor=#0c5aa0;';
    }
  }
}
