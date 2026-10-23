import type { Cell, Graph } from '@maxgraph/core';
import { prepareClonedCells } from '../railway/clone';

export class ClipboardService {
  private static instance: ClipboardService;
  private clipboard: Cell[] = [];
  private listeners: Array<(hasContent: boolean) => void> = [];

  private constructor() {}

  static getInstance(): ClipboardService {
    if (!ClipboardService.instance) {
      ClipboardService.instance = new ClipboardService();
    }
    return ClipboardService.instance;
  }

  copy(cells: Cell[], graph: Graph): boolean {
    if (cells.length === 0) return false;
    this.clipboard = graph.cloneCells(cells);
    this.notifyListeners();
    return true;
  }

  cut(cells: Cell[], graph: Graph): boolean {
    if (cells.length === 0) return false;
    this.clipboard = graph.cloneCells(cells);
    graph.batchUpdate(() => {
      graph.removeCells(graph.getDeletableCells(cells));
    });
    this.notifyListeners();
    return true;
  }

  paste(graph: Graph, offsetX: number = 20, offsetY: number = 20): Cell[] {
    if (this.clipboard.length === 0) return [];

    const imported: Cell[] = [];
    graph.batchUpdate(() => {
      const cloned = graph.cloneCells(this.clipboard);
      // railway IDs unique in this graph (paste twice: S2, S3), copies lose route / railML ids
      prepareClonedCells(graph.getDataModel(), cloned);
      const result = graph.importCells(cloned, offsetX, offsetY);
      graph.setSelectionCells(result);
      imported.push(...result);
    });

    return imported;
  }

  hasContent(): boolean {
    return this.clipboard.length > 0;
  }

  getContent(): Cell[] {
    return this.clipboard;
  }

  clear(): void {
    this.clipboard = [];
    this.notifyListeners();
  }

  subscribe(listener: (hasContent: boolean) => void): () => void {
    this.listeners.push(listener);
    listener(this.hasContent());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.hasContent()));
  }
}
