/**
 * @file plantuml-group-manager.ts
 * @brief Manage PlantUML diagrams as editable groups on the canvas
 * @details Associates PlantUML source code with diagram groups
 */

import { Graph, Cell } from '@maxgraph/core';

export interface PlantUmlGroupMetadata {
  plantumlSource: string;
  diagramType: string;
  createdAt: number;
  lastModified: number;
}

/**
 * Manages PlantUML diagrams as groups with source code metadata
 */
export class PlantUmlGroupManager {
  private graph: Graph;
  private currentPlantUmlGroup: Cell | null = null;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  /**
   * Create a group for PlantUML diagram
   */
  createPlantUmlGroup(
    parent: Cell,
    diagramName: string,
    plantumlSource: string,
    diagramType: string
  ): Cell {
    console.log('[PlantUmlGroup] Creating group:', diagramName);

    // Create group with no background, just border, label in top-left
    const groupStyle = 'group=1;fillColor=none;strokeColor=#999;strokeWidth=2;html=1;verticalAlign=top;align=left;spacing=2;';

    const group = this.graph.insertVertex(
      parent,
      null,
      diagramName,
      50,
      50,
      500,
      400,
      groupStyle as any
    );

    // Store PlantUML metadata
    const metadata: PlantUmlGroupMetadata = {
      plantumlSource,
      diagramType,
      createdAt: Date.now(),
      lastModified: Date.now(),
    };

    this.setPlantUmlMetadata(group, metadata);
    return group;
  }

  /**
   * Set PlantUML metadata on a cell
   */
  setPlantUmlMetadata(cell: Cell, metadata: PlantUmlGroupMetadata): void {
    (cell as any).__plantuml = metadata;
  }

  /**
   * Get PlantUML metadata from a cell
   */
  getPlantUmlMetadata(cell: Cell | null): PlantUmlGroupMetadata | null {
    if (!cell) return null;
    return (cell as any).__plantuml || null;
  }

  /**
   * Check if a cell has PlantUML metadata
   */
  hasPlantUmlMetadata(cell: Cell | null): boolean {
    return this.getPlantUmlMetadata(cell) !== null;
  }

  /**
   * Get the currently selected PlantUML group
   */
  getCurrentPlantUmlGroup(): Cell | null {
    return this.currentPlantUmlGroup;
  }

  /**
   * Set the currently selected PlantUML group
   */
  setCurrentPlantUmlGroup(cell: Cell | null): void {
    this.currentPlantUmlGroup = cell;
  }

  /**
   * Update PlantUML source in a group
   */
  updatePlantUmlSource(cell: Cell, newSource: string): void {
    const metadata = this.getPlantUmlMetadata(cell);
    if (metadata) {
      metadata.plantumlSource = newSource;
      metadata.lastModified = Date.now();
      this.setPlantUmlMetadata(cell, metadata);
      console.log('[PlantUmlGroup] Updated source for:', cell.getValue());
    }
  }

  /**
   * Export group metadata as JSON
   */
  exportGroupMetadata(cell: Cell): string {
    const metadata = this.getPlantUmlMetadata(cell);
    if (!metadata) return '';

    return JSON.stringify({
      name: cell.getValue(),
      ...metadata,
    });
  }

  /**
   * Get all PlantUML groups in the diagram
   */
  getAllPlantUmlGroups(): Cell[] {
    const groups: Cell[] = [];
    const parent = this.graph.getDefaultParent();

    const visit = (cell: Cell) => {
      if (this.hasPlantUmlMetadata(cell)) {
        groups.push(cell);
      }

      const childCount = cell.getChildCount();
      for (let i = 0; i < childCount; i++) {
        const child = cell.getChildAt(i);
        if (child) visit(child);
      }
    };

    if (parent) visit(parent);
    return groups;
  }
}
