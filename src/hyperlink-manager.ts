/**
 * Hyperlink Manager
 * Manage clickable hyperlinks and external URLs on shapes
 */

export interface HyperlinkData {
  url: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  tooltip?: string;
}

export class HyperlinkManager {
  constructor(private graph: any) {
    this.setupLinkHandling();
  }

  /**
   * Add hyperlink to cell
   */
  addHyperlink(cell: any, url: string, target: '_blank' | '_self' = '_blank', tooltip?: string): void {
    if (!cell || !url) return;

    cell.link = { url, target, tooltip };

    // Store as custom data
    if (!cell.data) {
      cell.data = {};
    }
    cell.data.hyperlink = { url, target, tooltip };

    // Update style to show link appearance
    cell.style = cell.style || {};
    cell.style.textDecoration = 'underline';

    this.graph.view.refresh();
  }

  /**
   * Get hyperlink from cell
   */
  getHyperlink(cell: any): HyperlinkData | null {
    return cell?.link || cell?.data?.hyperlink || null;
  }

  /**
   * Remove hyperlink from cell
   */
  removeHyperlink(cell: any): void {
    if (!cell) return;

    cell.link = null;
    if (cell.data) {
      cell.data.hyperlink = null;
    }

    cell.style = cell.style || {};
    cell.style.textDecoration = 'none';

    this.graph.view.refresh();
  }

  /**
   * Check if cell has hyperlink
   */
  hasHyperlink(cell: any): boolean {
    return !!(cell?.link || cell?.data?.hyperlink);
  }

  /**
   * Open hyperlink in browser
   */
  openLink(url: string, target: '_blank' | '_self' = '_blank'): void {
    if (!url) return;

    // Validate URL format
    let finalUrl = url;
    if (!url.match(/^https?:\/\//)) {
      finalUrl = `https://${url}`;
    }

    window.open(finalUrl, target);
  }

  /**
   * Setup click handling for links
   */
  private setupLinkHandling(): void {
    // Listen for cell selection/click
    this.graph.addListener('cellClicked', (_sender: any, event: any) => {
      const cell = event.getProperty('cell');
      if (cell && this.hasHyperlink(cell)) {
        const hyperlink = this.getHyperlink(cell);
        if (hyperlink) {
          this.openLink(hyperlink.url, (hyperlink.target as '_blank' | '_self') || '_blank');
        }
      }
    });
  }

  /**
   * Apply hyperlinks to multiple cells
   */
  applyHyperlinksToSelection(url: string, target: '_blank' | '_self' = '_blank'): void {
    const cells = this.graph.getSelectionModel().cells;

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        this.addHyperlink(cell, url, target);
      }
    });
  }

  /**
   * Remove hyperlinks from selection
   */
  removeHyperlinksFromSelection(): void {
    const cells = this.graph.getSelectionModel().cells;

    cells.forEach((cell: any) => {
      this.removeHyperlink(cell);
    });
  }

  /**
   * Export hyperlinks as JSON
   */
  exportHyperlinks(): Map<string, HyperlinkData> {
    const hyperlinks = new Map<string, HyperlinkData>();
    const parent = this.graph.getDefaultParent();

    if (parent && parent.children) {
      parent.children.forEach((cell: any) => {
        const link = this.getHyperlink(cell);
        if (link) {
          hyperlinks.set(cell.id, link);
        }
      });
    }

    return hyperlinks;
  }

  /**
   * Import hyperlinks from map
   */
  importHyperlinks(hyperlinks: Map<string, HyperlinkData>): void {
    const parent = this.graph.getDefaultParent();

    if (parent && parent.children) {
      parent.children.forEach((cell: any) => {
        const link = hyperlinks.get(cell.id);
        if (link) {
          this.addHyperlink(cell, link.url, (link.target as '_blank' | '_self') || '_blank', link.tooltip);
        }
      });
    }
  }
}
