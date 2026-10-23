/**
 * @file canvas.ts
 * @brief Boot steps of the page lifecycle and the canvas (main-editor.ts): cache flush / teardown when
 *        the page goes, file and shape drops on #graph-container.
 */
import type { CellStyle } from '@maxgraph/core';
import type { TabManager } from '../ui/tabs';
import { globalNotificationManager } from '../ui/notification';
import { globalSaveStatusIndicator } from '../ui/save-status';
import { assignKindForInsertedShape } from '../railway/install-railway-data';
import { isRailmlFile, requestRailmlOpen } from '../railml/install-railml';

/** beforeunload flushes the tab cache; pagehide (not cancellable) tears the tabs down. */
export function bootLifecycle(tabManager: TabManager): void {
  /**
   * @brief Application cleanup handler
   * @details Ensures all resources are properly released when the page is unloaded,
   * including disposing of graphs, removing event listeners, and clearing cached data.
   */
  window.addEventListener('beforeunload', () => {
    try {
      // The 5 s autosave interval may not have run since the last edit
      tabManager.flushCache();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });
  // Teardown only once the page really goes: beforeunload can be cancelled (install-sharing.ts asks
  // when remote-bound tabs have unsaved changes), and the page must stay usable then
  window.addEventListener('pagehide', (evt) => {
    if (evt.persisted) return;
    try {
      tabManager.destroy();
      globalSaveStatusIndicator.destroy();
      globalNotificationManager.destroy();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });
}

/** Drops on the canvas: railML files open in a new tab, palette / custom shapes are inserted. */
export function bootCanvasDrop(tabManager: TabManager, graphContainer: HTMLElement): void {
  /**
   * @brief Handle drag-and-drop of shapes onto the canvas
   * @details Enables users to drag shapes from the toolbox or stencils panel
   * and drop them onto the graph canvas. The shape is inserted at the drop location.
   */
  /**
   * @brief Process drop event for shape insertion
   * @details Converts the drag coordinates to graph coordinates and creates
   * a new cell (vertex or shape) at the drop location.
   * @param {DragEvent} evt - The drop event with shape data in dataTransfer
   */
  graphContainer.addEventListener('drop', (evt) => {
    graphContainer.classList.remove('drag-over');

    // A railML file dropped on the canvas opens in a new tab (src/railml)
    const droppedFile = evt.dataTransfer?.files?.[0];
    if (droppedFile && /\.(railml|xml)$/i.test(droppedFile.name)) {
      evt.preventDefault();
      void isRailmlFile(droppedFile).then((text) => {
        if (text !== null) requestRailmlOpen(text, droppedFile.name);
        else globalNotificationManager.warning(`${droppedFile.name} is not a railML file: use File > Open for draw.io files`);
      });
      return;
    }

    const shapeJson = evt.dataTransfer?.getData('application/x-shape-json');
    const customShapeJson = evt.dataTransfer?.getData('application/x-custom-shape');

    if (shapeJson || customShapeJson) {
      evt.preventDefault();

      const activeTab = tabManager.getActiveTab();
      if (!activeTab) return;

      // Convert to graph coordinates
      const pt = activeTab.graph.getPointForEvent(evt);

      activeTab.graph.batchUpdate(() => {
        if (shapeJson) {
          const shape = JSON.parse(shapeJson);
          if (shape.type === 'vertex') {
            const cell = activeTab.graph.insertVertex(
              activeTab.graph.getDefaultParent(),
              null,
              '',
              pt.x - shape.width / 2,
              pt.y - shape.height / 2,
              shape.width,
              shape.height,
              shape.style as CellStyle
            );
            // Railway shapes (signal, rail, points, ...) become railway objects with their kind
            assignKindForInsertedShape(activeTab.graph, cell);
            activeTab.graph.setSelectionCells([cell]);
          }
        } else if (customShapeJson) {
          // Handle custom shape drop
          const customShape = JSON.parse(customShapeJson);
          const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(
            `<svg viewBox="0 0 ${customShape.width} ${customShape.height}" xmlns="http://www.w3.org/2000/svg">
              <path d="${customShape.svgPath}" fill="${customShape.fillColor}" stroke="${customShape.strokeColor}" stroke-width="${customShape.strokeWidth}"/>
            </svg>`
          )}`;

          const cell = activeTab.graph.insertVertex(
            activeTab.graph.getDefaultParent(),
            null,
            '',
            pt.x - customShape.width / 2,
            pt.y - customShape.height / 2,
            customShape.width,
            customShape.height,
            {
              shape: 'image',
              image: svgDataUrl,
              html: false,
            } as CellStyle
          );
          activeTab.graph.setSelectionCells([cell]);
        }
      });
    }
  }, false);

  /**
   * @brief Handle drag-over to enable drop zone highlighting
   * @details Prevents default drag behavior and adds visual feedback
   * to indicate the canvas is a valid drop target.
   * @param {DragEvent} evt - The dragover event
   */
  graphContainer.addEventListener('dragover', (evt) => {
    evt.preventDefault();
    graphContainer.classList.add('drag-over');
  }, false);

  /**
   * @brief Handle drag-leave to remove drop zone highlighting
   * @details Removes visual feedback when the user drags away from the canvas.
   * @param {DragEvent} evt - The dragleave event
   */
  graphContainer.addEventListener('dragleave', (evt) => {
    if (evt.target === graphContainer) {
      graphContainer.classList.remove('drag-over');
    }
  }, false);
}
