import { Graph } from '@maxgraph/core';

export class DrawingController {
  private graph: Graph;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private currentTool: 'pencil' | 'brush' | 'eraser' | 'line' | 'select' = 'select';
  private startX = 0;
  private startY = 0;
  private points: Array<{ x: number; y: number }> = [];

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupDrawingCanvas();
    this.setupToolButtons();
  }

  private setupDrawingCanvas(): void {
    const container = this.graph.container as HTMLElement;
    if (!container) return;

    // Create canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'drawing-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.zIndex = '100';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.style.display = 'none';

    container.style.position = 'relative';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    // Listen for container resize
    const resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    resizeObserver.observe(container);

    this.setupMouseEvents();
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const container = this.graph.container as HTMLElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
  }

  private setupMouseEvents(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseout', () => this.handleMouseOut());
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.currentTool === 'select') return;

    this.isDrawing = true;
    const rect = this.canvas!.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;
    this.points = [{ x: this.startX, y: this.startY }];

    if (this.currentTool === 'eraser') {
      this.erase(this.startX, this.startY);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDrawing || this.currentTool === 'select') return;

    const rect = this.canvas!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.currentTool === 'line') {
      // Redraw for line preview
      this.redrawCanvas();
      this.drawLine(this.startX, this.startY, x, y, '#000', 2);
    } else if (this.currentTool === 'pencil') {
      this.drawLine(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y, x, y, '#000', 1);
      this.points.push({ x, y });
    } else if (this.currentTool === 'brush') {
      this.drawLine(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y, x, y, '#000', 4);
      this.points.push({ x, y });
    } else if (this.currentTool === 'eraser') {
      this.erase(x, y);
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentTool === 'line' && this.points.length > 1) {
      const rect = this.canvas!.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      this.convertLineToShape(this.startX, this.startY, endX, endY);
    } else if ((this.currentTool === 'pencil' || this.currentTool === 'brush') && this.points.length > 2) {
      this.convertDrawingToShape();
    }

    this.points = [];
    this.redrawCanvas();
  }

  private handleMouseOut(): void {
    if (this.isDrawing && this.currentTool === 'line') {
      this.redrawCanvas();
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    if (!this.ctx) return;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  private erase(x: number, y: number): void {
    if (!this.ctx) return;
    const eraserSize = 20;
    this.ctx.clearRect(x - eraserSize / 2, y - eraserSize / 2, eraserSize, eraserSize);
  }

  private redrawCanvas(): void {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private convertDrawingToShape(): void {
    if (this.points.length < 2) return;

    // Get bounding box
    let minX = this.points[0].x;
    let minY = this.points[0].y;
    let maxX = this.points[0].x;
    let maxY = this.points[0].y;

    this.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    const width = Math.max(maxX - minX, 20);
    const height = Math.max(maxY - minY, 20);

    // Create shape at bounding box position
    const style = `fillColor=${this.currentTool === 'pencil' ? '#E8E8E8' : '#D0D0D0'};strokeColor=#333`;
    this.graph.batchUpdate(() => {
      const cell = this.graph.insertVertex(
        this.graph.getDefaultParent(),
        null,
        this.currentTool.charAt(0).toUpperCase() + this.currentTool.slice(1),
        minX,
        minY,
        width,
        height,
        style as any
      );
      this.graph.setSelectionCells([cell]);
    });
  }

  private convertLineToShape(x1: number, y1: number, x2: number, y2: number): void {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const width = Math.abs(x2 - x1) + 20;
    const height = Math.abs(y2 - y1) + 20;

    // Create line vertex
    const style = 'strokeColor=#333;strokeWidth=2';
    this.graph.batchUpdate(() => {
      const cell = this.graph.insertVertex(
        this.graph.getDefaultParent(),
        null,
        'Line',
        minX,
        minY,
        width,
        height,
        style as any
      );
      this.graph.setSelectionCells([cell]);
    });
  }

  private setupToolButtons(): void {
    const tools = ['select', 'pencil', 'brush', 'eraser', 'line-tool'];

    tools.forEach((toolName) => {
      const btn = document.getElementById(`btn-${toolName}`);
      if (!btn) return;

      const actualToolName = toolName === 'line-tool' ? 'line' : toolName;

      btn.addEventListener('click', () => {
        this.setTool(actualToolName as typeof this.currentTool);
      });
    });

    // Keyboard shortcut: Escape to exit drawing mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.setTool('select');
      }
    });
  }

  private setTool(tool: typeof this.currentTool): void {
    this.currentTool = tool;

    // Update button states and cursor
    const tools = ['select', 'pencil', 'brush', 'eraser', 'line-tool'];
    tools.forEach((toolName) => {
      const btn = document.getElementById(`btn-${toolName}`);
      if (!btn) return;
      const actualToolName = toolName === 'line-tool' ? 'line' : toolName;
      if (actualToolName === tool) {
        btn.style.background = '#2196F3';
        btn.style.color = 'white';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#333';
      }
    });

    // Show/hide canvas and set cursor
    if (this.canvas) {
      if (tool === 'select') {
        this.canvas.style.display = 'none';
        this.canvas.style.pointerEvents = 'none';
        (this.graph.container as HTMLElement).style.cursor = 'default';
      } else {
        this.canvas.style.display = 'block';
        this.canvas.style.pointerEvents = 'auto';
        this.redrawCanvas();

        // Set appropriate cursor for each tool
        switch (tool) {
          case 'pencil':
            this.canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%221%22 fill=%22%23000%22/%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%223%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%220.5%22/%3E%3C/svg%3E") 12 12, auto';
            break;
          case 'brush':
            this.canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%224%22 fill=%22%23666%22/%3E%3C/svg%3E") 12 12, auto';
            break;
          case 'eraser':
            this.canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22%3E%3Crect x=%228%22 y=%228%22 width=%228%22 height=%228%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221%22/%3E%3C/svg%3E") 12 12, auto';
            break;
          case 'line':
            this.canvas.style.cursor = 'crosshair';
            break;
          default:
            this.canvas.style.cursor = 'default';
        }
      }
    }

    console.log(`[Drawing] Tool switched to: ${tool}`);
  }
}
