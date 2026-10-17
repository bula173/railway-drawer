/**
 * @file export-image.ts
 * @brief File > Export as PNG… / Export as SVG… of a tab (one controller per tab, called by its
 *        MenuController). Renders the tab's draw.io model with the shared draw.io-like pipeline of
 *        diagram-image-export.ts (also used by the Share dialog and the scenario exports): light
 *        colours on the diagram's background (white by default), also in the dark theme.
 */
import { downloadBlob, safeFileName } from '../share/ui/modal';
import { renderXmlToPngBlob, renderXmlToSvgDocument } from './diagram-image-export';
import { globalNotificationManager } from './notification';

export interface ExportImageSource {
  /** The tab's `<mxGraphModel>` XML (SaveLoadController.serializeToXml). */
  getModelXml(): string;
  /** Base name of the downloaded file (the tab's name). */
  getName(): string;
}

export class ExportImageController {
  constructor(private readonly source: ExportImageSource) {}

  private fileName(ext: 'png' | 'svg'): string {
    return `${safeFileName(this.source.getName())}.${ext}`;
  }

  async exportToPNG(): Promise<void> {
    try {
      downloadBlob(await renderXmlToPngBlob(this.source.getModelXml()), this.fileName('png'));
    } catch (error) {
      console.error('[ExportImage] PNG export failed:', error);
      globalNotificationManager.error(`PNG export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async exportToSVG(): Promise<void> {
    try {
      const svg = await renderXmlToSvgDocument(this.source.getModelXml());
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), this.fileName('svg'));
    } catch (error) {
      console.error('[ExportImage] SVG export failed:', error);
      globalNotificationManager.error(`SVG export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  destroy(): void {
    // Nothing bound: the menu items belong to the tab's MenuController
  }
}
