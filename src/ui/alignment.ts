import { Graph } from '@maxgraph/core';

export class AlignmentController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupAlignmentButtons();
  }

  private setupAlignmentButtons(): void {
    const alignLeftBtn = document.getElementById('btn-align-left');
    const alignCenterBtn = document.getElementById('btn-align-center');
    const alignRightBtn = document.getElementById('btn-align-right');
    const alignTopBtn = document.getElementById('btn-align-top');
    const alignMiddleBtn = document.getElementById('btn-align-middle');
    const alignBottomBtn = document.getElementById('btn-align-bottom');
    const distributeHBtn = document.getElementById('btn-distribute-h');
    const distributeVBtn = document.getElementById('btn-distribute-v');

    if (alignLeftBtn) {
      alignLeftBtn.addEventListener('click', () => this.alignLeft());
    }
    if (alignCenterBtn) {
      alignCenterBtn.addEventListener('click', () => this.alignCenter());
    }
    if (alignRightBtn) {
      alignRightBtn.addEventListener('click', () => this.alignRight());
    }
    if (alignTopBtn) {
      alignTopBtn.addEventListener('click', () => this.alignTop());
    }
    if (alignMiddleBtn) {
      alignMiddleBtn.addEventListener('click', () => this.alignMiddle());
    }
    if (alignBottomBtn) {
      alignBottomBtn.addEventListener('click', () => this.alignBottom());
    }
    if (distributeHBtn) {
      distributeHBtn.addEventListener('click', () => this.distributeHorizontally());
    }
    if (distributeVBtn) {
      distributeVBtn.addEventListener('click', () => this.distributeVertically());
    }
  }

  private getSelectedVertices(): any[] {
    const selected = this.graph.getSelectionCells();
    return selected.filter((cell: any) => cell.isVertex?.());
  }

  alignLeft(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 2) return;

    const minX = Math.min(...vertices.map((v: any) => v.geometry.x));

    this.graph.batchUpdate(() => {
      vertices.forEach((vertex: any) => {
        vertex.geometry.x = minX;
        this.graph.refresh();
      });
    });
  }

  alignCenter(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 2) return;

    const minX = Math.min(...vertices.map((v: any) => v.geometry.x));
    const maxX = Math.max(
      ...vertices.map((v: any) => v.geometry.x + v.geometry.width)
    );
    const centerX = (minX + maxX) / 2;

    this.graph.batchUpdate(() => {
      vertices.forEach((vertex: any) => {
        vertex.geometry.x = centerX - vertex.geometry.width / 2;
        this.graph.refresh();
      });
    });
  }

  alignRight(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 2) return;

    const maxX = Math.max(
      ...vertices.map((v: any) => v.geometry.x + v.geometry.width)
    );

    this.graph.batchUpdate(() => {
      vertices.forEach((vertex: any) => {
        vertex.geometry.x = maxX - vertex.geometry.width;
        this.graph.refresh();
      });
    });
  }

  alignTop(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 2) return;

    const minY = Math.min(...vertices.map((v: any) => v.geometry.y));

    this.graph.batchUpdate(() => {
      vertices.forEach((vertex: any) => {
        vertex.geometry.y = minY;
        this.graph.refresh();
      });
    });
  }

  alignMiddle(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 2) return;

    const minY = Math.min(...vertices.map((v: any) => v.geometry.y));
    const maxY = Math.max(
      ...vertices.map((v: any) => v.geometry.y + v.geometry.height)
    );
    const centerY = (minY + maxY) / 2;

    this.graph.batchUpdate(() => {
      vertices.forEach((vertex: any) => {
        vertex.geometry.y = centerY - vertex.geometry.height / 2;
        this.graph.refresh();
      });
    });
  }

  alignBottom(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 2) return;

    const maxY = Math.max(
      ...vertices.map((v: any) => v.geometry.y + v.geometry.height)
    );

    this.graph.batchUpdate(() => {
      vertices.forEach((vertex: any) => {
        vertex.geometry.y = maxY - vertex.geometry.height;
        this.graph.refresh();
      });
    });
  }

  distributeHorizontally(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 3) return;

    // Sort by x position
    const sorted = [...vertices].sort(
      (a: any, b: any) => a.geometry.x - b.geometry.x
    );

    const minX = sorted[0].geometry.x;
    const maxX =
      sorted[sorted.length - 1].geometry.x +
      sorted[sorted.length - 1].geometry.width;

    const totalWidth = sorted.reduce(
      (sum: number, v: any) => sum + v.geometry.width,
      0
    );
    const gaps = sorted.length - 1;
    const spacing = (maxX - minX - totalWidth) / gaps;

    this.graph.batchUpdate(() => {
      let currentX = minX;
      sorted.forEach((vertex: any) => {
        vertex.geometry.x = currentX;
        currentX += vertex.geometry.width + spacing;
        this.graph.refresh();
      });
    });
  }

  distributeVertically(): void {
    const vertices = this.getSelectedVertices();
    if (vertices.length < 3) return;

    // Sort by y position
    const sorted = [...vertices].sort(
      (a: any, b: any) => a.geometry.y - b.geometry.y
    );

    const minY = sorted[0].geometry.y;
    const maxY =
      sorted[sorted.length - 1].geometry.y +
      sorted[sorted.length - 1].geometry.height;

    const totalHeight = sorted.reduce(
      (sum: number, v: any) => sum + v.geometry.height,
      0
    );
    const gaps = sorted.length - 1;
    const spacing = (maxY - minY - totalHeight) / gaps;

    this.graph.batchUpdate(() => {
      let currentY = minY;
      sorted.forEach((vertex: any) => {
        vertex.geometry.y = currentY;
        currentY += vertex.geometry.height + spacing;
        this.graph.refresh();
      });
    });
  }

  destroy(): void {
    // Cleanup if needed
  }
}
