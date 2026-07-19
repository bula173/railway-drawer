/**
 * Version History Manager - Track changes
 */
export interface VersionSnapshot {
  id: string;
  timestamp: number;
  label?: string;
  cellCount: number;
  edgeCount: number;
  data: any;
}

export class VersionHistoryManager {
  private versions: Map<string, VersionSnapshot> = new Map();

  constructor(private graph: any) {}

  createSnapshot(label?: string): string {
    const id = `version-${Date.now()}`;
    const parent = this.graph.getDefaultParent();
    const cells = parent?.children || [];
    const cellCount = cells.filter((c: any) => c.isVertex?.()).length;
    const edgeCount = cells.filter((c: any) => c.isEdge?.()).length;

    const snapshot: VersionSnapshot = {
      id,
      timestamp: Date.now(),
      label,
      cellCount,
      edgeCount,
      data: JSON.parse(JSON.stringify(cells)),
    };

    this.versions.set(id, snapshot);
    return id;
  }

  getVersions(): VersionSnapshot[] {
    return Array.from(this.versions.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  deleteVersion(id: string): boolean {
    return this.versions.delete(id);
  }

  getVersion(id: string): VersionSnapshot | null {
    return this.versions.get(id) || null;
  }
}
