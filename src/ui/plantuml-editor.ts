/**
 * @file plantuml-editor.ts
 * @brief PlantUML editor UI component for the left panel
 * @details Provides text input and rendering controls for PlantUML diagrams
 */

import { onSelectionChange } from '../core/graph-events';
import { Graph, Cell, CellStyle } from '@maxgraph/core';
import { UIController } from './base/ui-controller';
import { PlantUmlParser, DiagramData, DiagramElement } from '../services/plantuml-parser';
import { SequenceDiagramRenderer } from '../services/sequence-diagram-renderer';
import { ClassDiagramRenderer } from '../services/class-diagram-renderer';
import { StateDiagramRenderer } from '../services/state-diagram-renderer';
import { ActivityDiagramRenderer } from '../services/activity-diagram-renderer';
import { ComponentDiagramRenderer } from '../services/component-diagram-renderer';
import { PlantUmlGroupManager } from '../services/plantuml-group-manager';
import { logger } from '../drawio/logger';

export class PlantUmlEditorController extends UIController {
  private graph: Graph;
  private offSelection: (() => void) | null = null;
  private groupManager: PlantUmlGroupManager;
  private editorPanel: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private renderButton: HTMLButtonElement | null = null;
  private clearButton: HTMLButtonElement | null = null;
  private exampleButton: HTMLButtonElement | null = null;
  private errorDisplay: HTMLElement | null = null;
  private diagramPreview: HTMLElement | null = null;
  private currentEditingGroup: Cell | null = null;

  constructor(graph: Graph) {
    super();
    this.graph = graph;
    this.groupManager = new PlantUmlGroupManager(graph);
    logger.debug('PlantUmlEditor', 'Constructor called');
    this.createEditorPanel();
    logger.debug('PlantUmlEditor', 'Panel created:', this.editorPanel?.id);
    this.setupEventListeners();
    this.setupSelectionListener();
    logger.debug('PlantUmlEditor', 'Event listeners setup');
  }

  /**
   * Create the PlantUML editor panel
   */
  private createEditorPanel(): void {
    // Get container from HTML (registered as tab)
    this.editorPanel = document.getElementById('plantuml-panel');
    if (!this.editorPanel) {
      console.error('[PlantUML] plantuml-panel container not found');
      return;
    }

    const html = `
      <div class="editor-toolbar" style="flex-shrink: 0;">
        <button id="render-plantuml-btn" class="btn btn-primary" title="Render diagram to canvas" style="flex: 1;">Render</button>
        <button id="plantuml-example-btn" class="btn" title="Insert example" style="flex: 1;">Example</button>
        <button id="clear-plantuml-btn" class="btn" title="Clear" style="flex: 1;">Clear</button>
      </div>
      <div id="plantuml-error" class="error-display" style="display: none;"></div>
      <textarea id="plantuml-input" class="editor-textarea" placeholder="@startuml
participant Alice
participant Bob
Alice -> Bob: Hello
Bob --> Alice: Hi
@enduml" spellcheck="false"></textarea>
      <div id="plantuml-preview" class="diagram-preview" style="flex-shrink: 0;">
        <small>Ready to render</small>
      </div>
    `;

    // The panel is shared by all tabs. Build it only once: rebuilding it for every new tab
    // would discard the buttons the other tabs' listeners are bound to (the TabManager
    // attaches the active tab's listeners to these same nodes when tabs are switched).
    if (!this.editorPanel.querySelector('#plantuml-input')) {
      this.editorPanel.innerHTML = html;
    }
    this.editorPanel.style.display = 'flex';

    // Get references to elements
    this.textarea = this.editorPanel.querySelector('#plantuml-input');
    this.renderButton = this.editorPanel.querySelector('#render-plantuml-btn');
    this.clearButton = this.editorPanel.querySelector('#clear-plantuml-btn');
    this.exampleButton = this.editorPanel.querySelector('#plantuml-example-btn');
    this.errorDisplay = this.editorPanel.querySelector('#plantuml-error');
    this.diagramPreview = this.editorPanel.querySelector('#plantuml-preview');
  }

  /**
   * Setup selection listener to detect PlantUML group selection
   */
  private setupSelectionListener(): void {
    this.offSelection = onSelectionChange(this.graph, () => {
      const selected = this.graph.getSelectionCells();

      if (selected.length === 1) {
        const cell = selected[0];
        const metadata = this.groupManager.getPlantUmlMetadata(cell as Cell);
        if (metadata) {
          logger.debug('PlantUmlEditor', 'PlantUML group selected:', cell.getValue());
          this.currentEditingGroup = cell as Cell;
          this.groupManager.setCurrentPlantUmlGroup(cell as Cell);
          if (this.textarea) {
            this.textarea.value = metadata.plantumlSource;
            this.updatePreview();
          }
          return;
        }
      }

      // If selection is NOT a PlantUML group, clear the editing group
      // This way render will create a new diagram
      logger.debug('PlantUmlEditor', 'Non-PlantUML selection or no selection');
      this.currentEditingGroup = null;
      this.groupManager.setCurrentPlantUmlGroup(null);
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (this.renderButton) {
      this.trackListener(this.renderButton, 'click', () => this.renderDiagram());
    }

    if (this.clearButton) {
      this.trackListener(this.clearButton, 'click', () => this.clearEditor());
    }

    if (this.exampleButton) {
      this.trackListener(this.exampleButton, 'click', () => this.insertExample());
    }

    // Real-time validation
    if (this.textarea) {
      this.trackListener(this.textarea, 'input', () => this.updatePreview());
    }
  }

  /**
   * Show the editor panel
   */
  show(): void {
    logger.debug('PlantUmlEditor', 'show() called');
    logger.debug('PlantUmlEditor', 'editorPanel exists:', !!this.editorPanel);
    if (this.editorPanel) {
      logger.debug('PlantUmlEditor', 'Adding visible class');
      this.editorPanel.classList.add('visible');
      logger.debug('PlantUmlEditor', 'visible class added, classList:', this.editorPanel.className);
      if (this.textarea) {
        setTimeout(() => this.textarea?.focus(), 100);
      }
    } else {
      console.error('[PlantUmlEditor] editorPanel is null!');
    }
  }

  /**
   * Toggle the editor panel visibility
   */
  toggle(): void {
    if (this.editorPanel?.classList.contains('visible')) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Hide the editor panel
   */
  hide(): void {
    if (this.editorPanel) {
      this.editorPanel.classList.remove('visible');
    }
  }

  /**
   * Render PlantUML diagram to canvas
   */
  private renderDiagram(): void {
    if (!this.textarea) return;

    try {
      this.clearError();
      const text = this.textarea.value.trim();

      if (!text) {
        this.showError('Please enter PlantUML syntax');
        return;
      }

      const diagramData = PlantUmlParser.parse(text);
      logger.debug('PlantUML', 'Parsed diagram type:', [diagramData.type, diagramData]);

      const parent = this.graph.getDefaultParent();
      let groupToRender: Cell;

      // Create or get group
      if (this.currentEditingGroup) {
        // Update existing group
        groupToRender = this.currentEditingGroup;
        // Clear existing children (but keep the group)
        this.graph.batchUpdate(() => {
          const childCount = groupToRender.getChildCount();
          const cellsToRemove: Cell[] = [];
          for (let i = 0; i < childCount; i++) {
            const child = groupToRender.getChildAt(i);
            if (child) {
              cellsToRemove.push(child);
            }
          }
          this.graph.removeCells(cellsToRemove);
        });
        this.groupManager.updatePlantUmlSource(groupToRender, text);
        logger.debug('PlantUML', 'Updated existing group source');
      } else {
        // Create new group for this diagram
        const groupName = `${diagramData.type.toUpperCase()} Diagram`;
        groupToRender = this.groupManager.createPlantUmlGroup(parent!, groupName, text, diagramData.type);
        this.currentEditingGroup = groupToRender;
        this.groupManager.setCurrentPlantUmlGroup(groupToRender);
        logger.debug('PlantUML', 'Created new group:', groupName);
      }

      // Render diagram inside the group using the appropriate renderer
      this.renderDiagramWithAppropriateRenderer(diagramData, groupToRender);

      this.showSuccess(`${diagramData.type} diagram rendered! (${diagramData.elements.length} elements, ${diagramData.connections.length} connections)`);
    } catch (error) {
      this.showError(`Error parsing PlantUML: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[PlantUML]', error);
    }
  }

  /**
   * Render diagram using the appropriate renderer based on type
   */
  private renderDiagramWithAppropriateRenderer(diagramData: DiagramData, groupToRender: Cell): void {
    switch (diagramData.type) {
      case 'sequence':
        logger.debug('PlantUML', 'Using sequence diagram renderer');
        new SequenceDiagramRenderer(this.graph).renderIntoGroup(diagramData, groupToRender);
        break;
      case 'class':
        logger.debug('PlantUML', 'Using class diagram renderer');
        new ClassDiagramRenderer(this.graph).renderIntoGroup(diagramData, groupToRender);
        break;
      case 'state':
        logger.debug('PlantUML', 'Using state diagram renderer');
        new StateDiagramRenderer(this.graph).renderIntoGroup(diagramData, groupToRender);
        break;
      case 'activity':
        logger.debug('PlantUML', 'Using activity diagram renderer');
        new ActivityDiagramRenderer(this.graph).renderIntoGroup(diagramData, groupToRender);
        break;
      case 'component':
        logger.debug('PlantUML', 'Using component diagram renderer');
        new ComponentDiagramRenderer(this.graph).renderIntoGroup(diagramData, groupToRender);
        break;
      default:
        logger.debug('PlantUML', 'Using generic diagram renderer');
        this.convertAndAddToGraph(diagramData, groupToRender);
    }
  }

  /**
   * Convert diagram data to maxGraph cells
   */
  private convertAndAddToGraph(diagramData: DiagramData, parentGroup?: Cell): void {
    // If no parent group provided, use default parent
    const parent = parentGroup || this.graph.getDefaultParent();
    const yPos = 30;
    const elementMap = new Map<string, Cell>();

    this.graph.batchUpdate(() => {
      // Add all elements first
      diagramData.elements.forEach((element, index) => {
        const dims = PlantUmlParser.getDefaultDimensions(element.type);
        const xPos = 20 + (index % 3) * 220;
        const yActual = yPos + Math.floor(index / 3) * 150;

        const styleStr = this.getShapeStyle(element);
        const cellValue = this.getCellValue(element);

        const vertex = this.graph.insertVertex(
          parent,
          `plantuml_${element.id}`,
          cellValue,
          xPos,
          yActual,
          dims.width,
          dims.height,
          styleStr as unknown as CellStyle
        );

        elementMap.set(element.id, vertex);
      });

      // Add connections
      diagramData.connections.forEach((conn) => {
        const fromCell = elementMap.get(conn.from);
        const toCell = elementMap.get(conn.to);

        if (fromCell && toCell) {
          const edgeStyleStr = this.getEdgeStyle(conn.type || 'default');
          this.graph.insertEdge(parent, null, conn.label || '', fromCell, toCell, edgeStyleStr as unknown as CellStyle);
        }
      });
    });

    // Fit diagram to view
    setTimeout(() => this.graph.fit(50), 100);
  }

  /**
   * Get shape style based on element type
   */
  private getShapeStyle(element: DiagramElement): string {
    const baseStyle = `rounded=1;shadow=0;html=1;fontSize=11;`;

    switch (element.type) {
      case 'actor':
        return `${baseStyle}shape=actor;fillColor=#E1D5FE;strokeColor=#6D28D9;`;
      case 'participant':
        return `${baseStyle}shape=rect;fillColor=#DBEAFE;strokeColor=#0284C7;`;
      case 'class':
        return `${baseStyle}shape=rectangle;fillColor=#F3E8FF;strokeColor=#7E22CE;`;
      case 'state':
        return `${baseStyle}ellipse;fillColor=#D1FAE5;strokeColor=#059669;`;
      case 'activity':
        return `${baseStyle}shape=rectangle;fillColor=#FEF3C7;strokeColor=#F59E0B;`;
      case 'component':
        return `${baseStyle}shape=component;fillColor=#EDE9FE;strokeColor=#7C3AED;`;
      case 'note':
        return `${baseStyle}shape=note;fillColor=#FEF08A;strokeColor=#CA8A04;`;
      default:
        return `${baseStyle}fillColor=#F0F0F0;strokeColor=#666666;`;
    }
  }

  /**
   * Get edge style based on connection type
   */
  private getEdgeStyle(type?: string): string {
    switch (type) {
      case 'async':
        return 'dashed=1;dashPattern=5,5;';
      case 'composition':
        return 'endArrow=diamond;endFill=1;';
      case 'aggregation':
        return 'endArrow=diamondThin;endFill=0;';
      case 'transition':
        return 'endArrow=block;';
      case 'initial':
        return 'startArrow=circle;endArrow=block;';
      case 'final':
        return 'endArrow=circle;';
      default:
        return 'endArrow=block;';
    }
  }

  /**
   * Get cell value (label) from element
   */
  private getCellValue(element: DiagramElement): string {
    if (element.type === 'class' && element.attributes?.length) {
      return `${element.label}\n---\n${element.attributes.join('\n')}\n---\n${element.methods?.join('\n') || ''}`;
    }
    return element.label;
  }

  /**
   * Update diagram preview
   */
  private updatePreview(): void {
    if (!this.textarea || !this.diagramPreview) return;

    try {
      const text = this.textarea.value.trim();
      if (!text) {
        this.diagramPreview.innerHTML = '<small>Enter PlantUML syntax to preview</small>';
        return;
      }

      const diagramData = PlantUmlParser.parse(text);
      const preview = `
        <small>
          <strong>${diagramData.type}</strong><br/>
          Elements: ${diagramData.elements.length}<br/>
          Connections: ${diagramData.connections.length}
        </small>
      `;
      this.diagramPreview.innerHTML = preview;
      this.clearError();
    } catch (error) {
      // Silent error for preview
    }
  }

  /**
   * Insert example diagram
   */
  private insertExample(): void {
    if (!this.textarea) return;

    const examples: Record<string, string> = {
      'sequence': `@startuml
participant Alice as A
participant Bob as B
A -> B: Authentication Request
B --> A: Authentication Response
A -> B: Another request
B --> A: Response
@enduml`,
      'class': `@startuml
class Car {
  -brand: String
  -color: String
  +start()
  +stop()
}

class Engine {
  -power: int
  +start()
  +stop()
}

Car *-- Engine
@enduml`,
      'state': `@startuml
[*] --> Active
Active --> Paused: pause()
Paused --> Active: resume()
Active --> Stopped: stop()
Stopped --> [*]
@enduml`,
      'component': `@startuml
component "Web UI" as web
component "Database" as db
component "API" as api

web --> api
api --> db
@enduml`,
    };

    const example = examples['sequence'];
    this.textarea.value = example;
    this.updatePreview();
  }

  /**
   * Clear editor
   */
  private clearEditor(): void {
    if (this.textarea) {
      this.textarea.value = '';
      this.updatePreview();
      this.clearError();
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    if (this.errorDisplay) {
      this.errorDisplay.textContent = message;
      this.errorDisplay.style.display = 'block';
    }
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    if (this.errorDisplay) {
      this.errorDisplay.textContent = message;
      this.errorDisplay.style.display = 'block';
      setTimeout(() => {
        if (this.errorDisplay) this.errorDisplay.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Clear error message
   */
  private clearError(): void {
    if (this.errorDisplay) {
      this.errorDisplay.style.display = 'none';
    }
  }

  destroy(): void {
    // Only this tab's listeners go; #plantuml-panel is shared and stays for the other tabs
    this.removeTrackedListeners();
    this.offSelection?.();
  }
}
