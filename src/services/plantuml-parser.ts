/**
 * @file plantuml-parser.ts
 * @brief PlantUML text syntax parser for converting to maxGraph shapes
 * @details Client-side PlantUML parser without external dependencies
 */

export interface DiagramElement {
  type: 'actor' | 'participant' | 'class' | 'state' | 'activity' | 'component' | 'note' | 'message';
  id: string;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  stereotype?: string;
  attributes?: string[];
  methods?: string[];
  targetId?: string; // For connections
  relationshipType?: string; // For connections
}

export interface DiagramData {
  type: 'sequence' | 'class' | 'state' | 'activity' | 'component' | 'unknown';
  title?: string;
  elements: DiagramElement[];
  connections: Array<{
    from: string;
    to: string;
    label?: string;
    type?: string;
  }>;
}

/**
 * PlantUML text parser
 * Parses simplified PlantUML syntax to diagram elements
 */
export class PlantUmlParser {
  /**
   * Parse PlantUML text and return diagram data
   */
  static parse(text: string): DiagramData {
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith("'"));

    const diagramType = this.detectDiagramType(lines);
    const data: DiagramData = {
      type: diagramType,
      elements: [],
      connections: [],
    };

    // Extract title
    const titleMatch = lines.find((line) => line.startsWith('@startuml') || line.startsWith('title'));
    if (titleMatch && titleMatch.includes('title')) {
      data.title = titleMatch.replace(/^title\s+/i, '').trim();
    }

    switch (diagramType) {
      case 'sequence':
        this.parseSequenceDiagram(lines, data);
        break;
      case 'class':
        this.parseClassDiagram(lines, data);
        break;
      case 'state':
        this.parseStateDiagram(lines, data);
        break;
      case 'activity':
        this.parseActivityDiagram(lines, data);
        break;
      case 'component':
        this.parseComponentDiagram(lines, data);
        break;
      default:
        this.parseSequenceDiagram(lines, data);
    }

    return data;
  }

  /**
   * Detect diagram type from PlantUML syntax
   */
  private static detectDiagramType(lines: string[]): DiagramData['type'] {
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('sequence')) return 'sequence';
      if (lower.includes('class')) return 'class';
      if (lower.includes('state')) return 'state';
      if (lower.includes('activity')) return 'activity';
      if (lower.includes('component')) return 'component';
    }
    return 'sequence';
  }

  /**
   * Parse sequence diagram (participants and messages)
   */
  private static parseSequenceDiagram(lines: string[], data: DiagramData): void {
    const participantRegex = /^(actor|participant|queue|database|entity)\s+(\w+)(?:\s+as\s+(\w+))?(?:\s*:\s*(.+))?$/i;
    const messageRegex = /^(\w+)\s*(?:-+>|<-+|-->|<--)\s*(\w+)\s*:\s*(.+)$/;
    const noteRegex = /^note\s+(left|right|over)\s+(\w+)\s*:\s*(.+)$/i;

    for (const line of lines) {
      // Parse participants
      const participantMatch = line.match(participantRegex);
      if (participantMatch) {
        const [, type, id, alias, label] = participantMatch;
        data.elements.push({
          type: 'participant',
          id: alias || id,
          label: label || id,
          stereotype: type.toLowerCase() as any,
        });
        continue;
      }

      // Parse messages
      const messageMatch = line.match(messageRegex);
      if (messageMatch) {
        const [, from, to, label] = messageMatch;
        const hasDoubleDash = line.includes('--');
        data.connections.push({
          from,
          to,
          label,
          type: hasDoubleDash ? 'async' : 'sync',
        });
        continue;
      }

      // Parse notes
      const noteMatch = line.match(noteRegex);
      if (noteMatch) {
        const [, position, , noteLabel] = noteMatch;
        data.elements.push({
          type: 'note',
          id: `note_${data.elements.length}`,
          label: noteLabel,
          stereotype: position,
        });
      }
    }
  }

  /**
   * Parse class diagram (classes with attributes/methods)
   */
  private static parseClassDiagram(lines: string[], data: DiagramData): void {
    const classRegex = /^class\s+(\w+)(?:\s*<<\s*(\w+)\s*>>)?(?:\s*{)?$/i;
    const relationRegex = /^(\w+)\s*(--|#|\\*--)\s*(\w+)\s*:\s*(.+)?$/;
    const attributeRegex = /^\s*([\+\-#~])\s*(\w+)\s*:\s*(.+)$/;
    const methodRegex = /^\s*([\+\-#~])\s*(\w+)\s*\(\s*\)(?:\s*:\s*(.+))?$/;

    let currentClass: DiagramElement | null = null;

    for (const line of lines) {
      // Parse class
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const [, className, stereotype] = classMatch;
        currentClass = {
          type: 'class',
          id: className,
          label: className,
          stereotype: stereotype || undefined,
          attributes: [],
          methods: [],
        };
        data.elements.push(currentClass);
        continue;
      }

      // Parse relationships
      const relationMatch = line.match(relationRegex);
      if (relationMatch) {
        const [, from, relType, to, label] = relationMatch;
        data.connections.push({
          from,
          to,
          label,
          type: relType === '--' ? 'association' : relType === '#' ? 'aggregation' : 'composition',
        });
        continue;
      }

      // Parse attributes and methods
      if (currentClass) {
        const attrMatch = line.match(attributeRegex);
        if (attrMatch) {
          const [, visibility, name, type] = attrMatch;
          currentClass.attributes?.push(`${visibility} ${name}: ${type}`);
          continue;
        }

        const methodMatch = line.match(methodRegex);
        if (methodMatch) {
          const [, visibility, name, returnType] = methodMatch;
          currentClass.methods?.push(`${visibility} ${name}(): ${returnType || 'void'}`);
          continue;
        }
      }
    }
  }

  /**
   * Parse state diagram (states and transitions)
   */
  private static parseStateDiagram(lines: string[], data: DiagramData): void {
    const stateRegex = /^state\s+(\w+)(?:\s*:\s*(.+))?$/i;
    const transitionRegex = /^(\w+)\s*(-+>)\s*(\w+)(?:\s*:\s*(.+))?$/;
    const initialRegex = /^\[?\*\]?\s*(-+>)\s*(\w+)/i;
    const finalRegex = /^(\w+)\s*(-+>)\s*\[?\*\]?/i;

    for (const line of lines) {
      // Parse states
      const stateMatch = line.match(stateRegex);
      if (stateMatch) {
        const [, stateId, stateLabel] = stateMatch;
        data.elements.push({
          type: 'state',
          id: stateId,
          label: stateLabel || stateId,
        });
        continue;
      }

      // Parse transitions
      const transMatch = line.match(transitionRegex);
      if (transMatch) {
        const [, from, , to, label] = transMatch;
        data.connections.push({
          from,
          to,
          label,
          type: 'transition',
        });
        continue;
      }

      // Parse initial state
      const initialMatch = line.match(initialRegex);
      if (initialMatch) {
        const [, , to] = initialMatch;
        data.connections.push({
          from: 'initial',
          to,
          type: 'initial',
        });
        continue;
      }

      // Parse final state
      const finalMatch = line.match(finalRegex);
      if (finalMatch) {
        const [, from] = finalMatch;
        data.connections.push({
          from,
          to: 'final',
          type: 'final',
        });
      }
    }
  }

  /**
   * Parse activity diagram (activities and flows)
   */
  private static parseActivityDiagram(lines: string[], data: DiagramData): void {
    const activityRegex = /^:\s*(.+?)\s*;$/;
    const flowRegex = /^(.+?)\s*(?:-+>)\s*(.+?)(?:\s*:\s*(.+))?$/;

    for (const line of lines) {
      // Parse activities
      const activityMatch = line.match(activityRegex);
      if (activityMatch) {
        const [, activityLabel] = activityMatch;
        data.elements.push({
          type: 'activity',
          id: `activity_${data.elements.length}`,
          label: activityLabel,
        });
        continue;
      }

      // Parse flows
      const flowMatch = line.match(flowRegex);
      if (flowMatch) {
        const [, from, to, label] = flowMatch;
        data.connections.push({
          from: from.trim(),
          to: to.trim(),
          label,
          type: 'flow',
        });
      }
    }
  }

  /**
   * Parse component diagram (components and interfaces)
   */
  private static parseComponentDiagram(lines: string[], data: DiagramData): void {
    const componentRegex = /^component\s+(\w+)(?:\s*<<\s*(\w+)\s*>>)?(?:\s+as\s+(\w+))?(?:\s*:\s*(.+))?$/i;
    const relationRegex = /^(\w+)\s*(-+)\s*(\w+)(?:\s*:\s*(.+))?$/;

    for (const line of lines) {
      // Parse components
      const componentMatch = line.match(componentRegex);
      if (componentMatch) {
        const [, compId, stereotype, alias, label] = componentMatch;
        data.elements.push({
          type: 'component',
          id: alias || compId,
          label: label || compId,
          stereotype: stereotype || undefined,
        });
        continue;
      }

      // Parse relationships
      const relationMatch = line.match(relationRegex);
      if (relationMatch) {
        const [, from, , to, label] = relationMatch;
        data.connections.push({
          from,
          to,
          label,
          type: 'dependency',
        });
      }
    }
  }

  /**
   * Get default width/height for different element types
   */
  static getDefaultDimensions(type: DiagramElement['type']): { width: number; height: number } {
    switch (type) {
      case 'actor':
        return { width: 80, height: 100 };
      case 'participant':
        return { width: 100, height: 40 };
      case 'class':
        return { width: 180, height: 120 };
      case 'state':
        return { width: 120, height: 60 };
      case 'activity':
        return { width: 140, height: 50 };
      case 'component':
        return { width: 160, height: 80 };
      case 'note':
        return { width: 150, height: 60 };
      default:
        return { width: 100, height: 60 };
    }
  }
}
