/**
 * @file plantuml-editor.ts
 * @brief PlantUML editor UI component for the left panel
 * @details Provides text input and rendering controls for PlantUML diagrams. One editor for the
 * app (TabManager's session views): its panel and buttons are built and bound once, it renders into
 * and follows the selection of the active session's graph (session.ts).
 */

import { onSelectionChange } from '../core/graph-events';
import { Graph, Cell } from '@maxgraph/core';
import { UIController } from './base/ui-controller';
import { PlantUmlParser, DiagramData } from '../services/plantuml-parser';
import { SequenceDiagramRenderer } from '../services/sequence-diagram-renderer';
import { ClassDiagramRenderer } from '../services/class-diagram-renderer';
import { StateDiagramRenderer } from '../services/state-diagram-renderer';
import { ActivityDiagramRenderer } from '../services/activity-diagram-renderer';
import { ComponentDiagramRenderer } from '../services/component-diagram-renderer';
import { PlantUmlGroupManager } from '../services/plantuml-group-manager';
import { logger } from '../drawio/logger';
import { ActiveSessionBinding, type GraphSession } from './session';

export class PlantUmlEditorController extends UIController {
  /** The bound session's graph (the active tab's) and its PlantUML groups. */
  private graph!: Graph;
  private groupManager!: PlantUmlGroupManager;
  private bound = false;
  private readonly binding: ActiveSessionBinding<GraphSession>;
  /** Per tab graph: its PlantUML group manager and the group being edited (kept across tab switches). */
  private readonly perGraph = new WeakMap<Graph, { groupManager: PlantUmlGroupManager; editing: Cell | null }>();
  private editorPanel: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private renderButton: HTMLButtonElement | null = null;
  private clearButton: HTMLButtonElement | null = null;
  private exampleButton: HTMLButtonElement | null = null;
  private errorDisplay: HTMLElement | null = null;
  private diagramPreview: HTMLElement | null = null;
  private currentEditingGroup: Cell | null = null;

  /** Follows the active session; with `graph`, stays on that graph (tests). */
  constructor(graph?: Graph) {
    super();
    logger.debug('PlantUmlEditor', 'Constructor called');
    this.createEditorPanel();
    logger.debug('PlantUmlEditor', 'Panel created:', this.editorPanel?.id);
    this.setupEventListeners();
    this.binding = new ActiveSessionBinding<GraphSession>(
      (session, disposers) => {
        this.graph = session.graph;
        let state = this.perGraph.get(session.graph);
        if (!state) this.perGraph.set(session.graph, (state = { groupManager: new PlantUmlGroupManager(session.graph), editing: null }));
        this.groupManager = state.groupManager;
        this.currentEditingGroup = state.editing;
        this.bound = true;
        disposers.add(this.selectionListener(session.graph));
      },
      (session) => {
        const state = this.perGraph.get(session.graph);
        if (state) state.editing = this.currentEditingGroup;
        this.bound = false;
        this.currentEditingGroup = null;
      },
      graph ? { graph } : null
    );
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
   * Selection listener of the bound graph: detects the selection of a PlantUML group
   */
  private selectionListener(graph: Graph): () => void {
    return onSelectionChange(graph, () => {
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
      this.trackListener(this.renderButton, 'click', () => this.bound && this.renderDiagram());
    }

    if (this.clearButton) {
      this.trackListener(this.clearButton, 'click', () => this.bound && this.clearEditor());
    }

    if (this.exampleButton) {
      this.trackListener(this.exampleButton, 'click', () => this.bound && this.insertExample());
    }

    // Real-time validation
    if (this.textarea) {
      this.trackListener(this.textarea, 'input', () => this.updatePreview());
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
    }
  }

  /** Live summary of the parsed diagram under the editor. */
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
    // #plantuml-panel stays (built once); its listeners and the graph binding go
    this.removeTrackedListeners();
    this.binding.dispose();
  }
}
