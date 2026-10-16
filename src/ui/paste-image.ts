import { Graph } from '@maxgraph/core';

export class PasteImageController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupPasteHandler();
  }

  private setupPasteHandler(): void {
    const graphContainer = this.graph.getContainer();

    graphContainer.addEventListener('paste', (e: ClipboardEvent) => {
      this.handlePaste(e);
    });
  }

  private handlePaste(event: ClipboardEvent): void {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if the item is an image
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          this.createImageFromBlob(blob);
        }
      }
    }
  }

  private createImageFromBlob(blob: Blob): void {
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        this.insertImageIntoGraph(dataUrl, blob);
      }
    };

    reader.readAsDataURL(blob);
  }

  private insertImageIntoGraph(dataUrl: string, blob: Blob): void {
    // Get image dimensions from the data URL
    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;

      // Use default size if image is too large
      const maxSize = 300;
      let finalWidth = Math.min(width, maxSize);
      let finalHeight = Math.min(height, maxSize);

      // Maintain aspect ratio
      if (width > height) {
        finalHeight = (height / width) * finalWidth;
      } else {
        finalWidth = (width / height) * finalHeight;
      }

      // Get the center of the current view
      const container = this.graph.getContainer();
      const centerX = container.scrollLeft + container.clientWidth / 2;
      const centerY = container.scrollTop + container.clientHeight / 2;

      // Create the image cell
      this.graph.batchUpdate(() => {
        const cell = this.graph.insertVertex(
          this.graph.getDefaultParent(),
          null,
          '',
          centerX - finalWidth / 2,
          centerY - finalHeight / 2,
          finalWidth,
          finalHeight,
          {
            shape: 'image',
            image: dataUrl,
            verticalLabelPosition: 'bottom',
            verticalAlign: 'top',
          }
        );

        this.graph.setSelectionCells([cell]);
      });

      console.log(
        `[PasteImage] Image pasted successfully: ${blob.type} (${(blob.size / 1024).toFixed(1)} KB)`
      );
    };

    img.src = dataUrl;
  }

  destroy(): void {
    // Cleanup if needed
  }
}
