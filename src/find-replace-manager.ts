/**
 * Find & Replace Manager
 * Search and replace text across diagram shapes
 */

export interface FindReplaceOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  limitToSelection?: boolean;
  searchInLabels?: boolean;
  searchInValues?: boolean;
}

export interface FindResult {
  cell: any;
  text: string;
  matchPosition: number;
  matchLength: number;
  fieldType: 'value' | 'label';
}

export class FindReplaceManager {
  private lastResults: FindResult[] = [];
  private currentResultIndex = 0;

  constructor(private graph: any) {}

  /**
   * Find all occurrences of search term
   */
  find(searchTerm: string, options: FindReplaceOptions = {}): FindResult[] {
    if (!searchTerm) return [];

    const {
      caseSensitive = false,
      wholeWord = false,
      regex = false,
      limitToSelection = false,
      searchInLabels = true,
      searchInValues = true,
    } = options;

    const results: FindResult[] = [];

    const cells = limitToSelection
      ? this.graph.getSelectionModel().cells || []
      : this.graph.getDefaultParent().children || [];

    cells.forEach((cell: any) => {
      if (cell.isVertex?.()) {
        // Search in value (cell text)
        if (searchInValues && cell.value) {
          const valueMatches = this.findMatches(cell.value, searchTerm, {
            caseSensitive,
            wholeWord,
            regex,
          });

          valueMatches.forEach((match) => {
            results.push({
              cell,
              text: cell.value,
              matchPosition: match.position,
              matchLength: match.length,
              fieldType: 'value',
            });
          });
        }

        // Search in label (might be separate property)
        if (searchInLabels && cell.label && cell.label !== cell.value) {
          const labelMatches = this.findMatches(cell.label, searchTerm, {
            caseSensitive,
            wholeWord,
            regex,
          });

          labelMatches.forEach((match) => {
            results.push({
              cell,
              text: cell.label,
              matchPosition: match.position,
              matchLength: match.length,
              fieldType: 'label',
            });
          });
        }
      }

      // Search in edge labels
      if (cell.isEdge?.() && searchInValues && cell.value) {
        const edgeMatches = this.findMatches(cell.value, searchTerm, {
          caseSensitive,
          wholeWord,
          regex,
        });

        edgeMatches.forEach((match) => {
          results.push({
            cell,
            text: cell.value,
            matchPosition: match.position,
            matchLength: match.length,
            fieldType: 'value',
          });
        });
      }
    });

    this.lastResults = results;
    this.currentResultIndex = 0;

    return results;
  }

  /**
   * Find next occurrence
   */
  findNext(): FindResult | null {
    if (this.lastResults.length === 0) return null;

    this.currentResultIndex = (this.currentResultIndex + 1) % this.lastResults.length;
    const result = this.lastResults[this.currentResultIndex];

    // Select the cell
    if (result.cell) {
      this.graph.getSelectionModel().setCell(result.cell);
    }

    return result;
  }

  /**
   * Find previous occurrence
   */
  findPrevious(): FindResult | null {
    if (this.lastResults.length === 0) return null;

    this.currentResultIndex =
      (this.currentResultIndex - 1 + this.lastResults.length) % this.lastResults.length;
    const result = this.lastResults[this.currentResultIndex];

    // Select the cell
    if (result.cell) {
      this.graph.getSelectionModel().setCell(result.cell);
    }

    return result;
  }

  /**
   * Replace first occurrence
   */
  replaceFirst(searchTerm: string, replaceTerm: string, options: FindReplaceOptions = {}): boolean {
    const results = this.find(searchTerm, options);
    if (results.length === 0) return false;

    const firstResult = results[0];
    this.replaceInCell(firstResult.cell, firstResult.fieldType, searchTerm, replaceTerm, options);
    return true;
  }

  /**
   * Replace all occurrences
   */
  replaceAll(
    searchTerm: string,
    replaceTerm: string,
    options: FindReplaceOptions = {}
  ): { count: number; replacedCells: any[] } {
    const results = this.find(searchTerm, options);
    const replacedCells = new Set<string>();

    results.forEach((result) => {
      this.replaceInCell(result.cell, result.fieldType, searchTerm, replaceTerm, options);
      replacedCells.add(result.cell.id);
    });

    return {
      count: results.length,
      replacedCells: Array.from(replacedCells),
    };
  }

  /**
   * Replace in current cell
   */
  replaceCurrent(searchTerm: string, replaceTerm: string, options: FindReplaceOptions = {}): boolean {
    if (this.lastResults.length === 0) return false;

    const result = this.lastResults[this.currentResultIndex];
    this.replaceInCell(result.cell, result.fieldType, searchTerm, replaceTerm, options);

    return true;
  }

  /**
   * Replace text in a specific cell field
   */
  private replaceInCell(
    cell: any,
    fieldType: 'value' | 'label',
    searchTerm: string,
    replaceTerm: string,
    options: FindReplaceOptions
  ): void {
    const { caseSensitive = false, wholeWord = false, regex = false } = options;

    const field = fieldType === 'value' ? cell.value : cell.label;
    if (!field) return;

    let newText = field;

    if (regex) {
      const flags = caseSensitive ? 'g' : 'gi';
      try {
        const regexPattern = new RegExp(searchTerm, flags);
        newText = field.replace(regexPattern, replaceTerm);
      } catch {
        return;
      }
    } else {
      const pattern = wholeWord
        ? new RegExp(`\\b${this.escapeRegex(searchTerm)}\\b`, caseSensitive ? 'g' : 'gi')
        : new RegExp(this.escapeRegex(searchTerm), caseSensitive ? 'g' : 'gi');

      newText = field.replace(pattern, replaceTerm);
    }

    // Update cell
    if (fieldType === 'value') {
      this.graph.model.setValue(cell, newText);
    } else if (fieldType === 'label') {
      cell.label = newText;
    }

    this.graph.view.refresh();
  }

  /**
   * Find matches with different options
   */
  private findMatches(
    text: string,
    searchTerm: string,
    options: { caseSensitive: boolean; wholeWord: boolean; regex: boolean }
  ): Array<{ position: number; length: number }> {
    const matches: Array<{ position: number; length: number }> = [];

    if (!text || !searchTerm) return matches;

    const { caseSensitive, wholeWord, regex } = options;

    try {
      let regexPattern: RegExp;

      if (regex) {
        const flags = caseSensitive ? 'g' : 'gi';
        regexPattern = new RegExp(searchTerm, flags);
      } else {
        const escapedTerm = this.escapeRegex(searchTerm);
        const pattern = wholeWord ? `\\b${escapedTerm}\\b` : escapedTerm;
        const flags = caseSensitive ? 'g' : 'gi';
        regexPattern = new RegExp(pattern, flags);
      }

      let match;
      while ((match = regexPattern.exec(text)) !== null) {
        matches.push({
          position: match.index,
          length: match[0].length,
        });
      }
    } catch {
      // Invalid regex, return empty matches
    }

    return matches;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get current search results
   */
  getResults(): FindResult[] {
    return this.lastResults;
  }

  /**
   * Get result count
   */
  getResultCount(): number {
    return this.lastResults.length;
  }

  /**
   * Get current result index
   */
  getCurrentResultIndex(): number {
    return this.currentResultIndex;
  }

  /**
   * Clear search results
   */
  clearResults(): void {
    this.lastResults = [];
    this.currentResultIndex = 0;
  }
}
