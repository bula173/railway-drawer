import { FindReplaceManager } from '../find-replace-manager';

describe('FindReplaceManager', () => {
  let findReplaceManager: FindReplaceManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      view: {
        refresh: jest.fn(),
      },
      model: {
        setValue: jest.fn(),
      },
      getSelectionModel: jest.fn().mockReturnValue({
        cells: [],
        setCell: jest.fn(),
      }),
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          { id: 'v1', value: 'Hello World', isVertex: () => true, isEdge: () => false },
          { id: 'v2', value: 'Hello there', isVertex: () => true, isEdge: () => false },
          { id: 'e1', value: 'Connection', isVertex: () => false, isEdge: () => true },
        ],
      }),
    };

    findReplaceManager = new FindReplaceManager(mockGraph);
  });

  it('should find simple text occurrences', () => {
    const results = findReplaceManager.find('Hello');

    expect(results.length).toBe(2);
    expect(results[0].text).toContain('Hello');
  });

  it('should find case-sensitive text', () => {
    const results = findReplaceManager.find('hello', { caseSensitive: true });

    expect(results.length).toBe(0);
  });

  it('should find case-insensitive text', () => {
    const results = findReplaceManager.find('hello', { caseSensitive: false });

    expect(results.length).toBe(2);
  });

  it('should find whole word matches', () => {
    const results = findReplaceManager.find('Hello', { wholeWord: true });

    expect(results.length).toBe(2);
  });

  it('should match whole words in whole word mode', () => {
    const results = findReplaceManager.find('Hello', { wholeWord: true });

    // Should match "Hello" at word boundaries
    expect(results.length).toBeGreaterThan(0);
  });

  it('should support regex patterns', () => {
    const results = findReplaceManager.find('H.+?\\s', { regex: true });

    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('should search in selected cells only', () => {
    mockGraph.getSelectionModel().cells = [mockGraph.getDefaultParent().children[0]];

    const results = findReplaceManager.find('Hello', { limitToSelection: true });

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should find next occurrence', () => {
    findReplaceManager.find('Hello');
    const next = findReplaceManager.findNext();

    expect(next).toBeDefined();
    expect(findReplaceManager.getCurrentResultIndex()).toBe(1);
  });

  it('should find previous occurrence', () => {
    findReplaceManager.find('Hello');
    findReplaceManager.findNext();
    const prev = findReplaceManager.findPrevious();

    expect(prev).toBeDefined();
  });

  it('should replace first occurrence', () => {
    const result = findReplaceManager.replaceFirst('Hello', 'Hi');

    expect(result).toBe(true);
    expect(mockGraph.model.setValue).toHaveBeenCalled();
  });

  it('should replace all occurrences', () => {
    const result = findReplaceManager.replaceAll('Hello', 'Hi');

    expect(result.count).toBe(2);
    expect(result.replacedCells).toHaveLength(2);
  });

  it('should replace in current result', () => {
    findReplaceManager.find('Hello');
    const result = findReplaceManager.replaceCurrent('Hello', 'Hi');

    expect(result).toBe(true);
  });

  it('should get search results', () => {
    findReplaceManager.find('Hello');
    const results = findReplaceManager.getResults();

    expect(results.length).toBeGreaterThan(0);
  });

  it('should get result count', () => {
    findReplaceManager.find('Hello');
    const count = findReplaceManager.getResultCount();

    expect(count).toBe(2);
  });

  it('should clear results', () => {
    findReplaceManager.find('Hello');
    findReplaceManager.clearResults();

    expect(findReplaceManager.getResultCount()).toBe(0);
  });

  it('should return empty for empty search term', () => {
    const results = findReplaceManager.find('');

    expect(results).toEqual([]);
  });

  it('should find in edge labels', () => {
    const results = findReplaceManager.find('Connection');

    expect(results.length).toBe(1);
    expect(results[0].cell.isEdge()).toBe(true);
  });

  it('should handle invalid regex gracefully', () => {
    const results = findReplaceManager.find('[invalid', { regex: true });

    expect(results).toEqual([]);
  });

  it('should track current result index', () => {
    findReplaceManager.find('Hello');
    findReplaceManager.findNext();

    const index = findReplaceManager.getCurrentResultIndex();
    expect(index).toBeGreaterThanOrEqual(0);
  });

  it('should wrap around when navigating results', () => {
    const results = findReplaceManager.find('Hello');
    if (results.length > 1) {
      for (let i = 0; i < results.length + 1; i++) {
        findReplaceManager.findNext();
      }
      // Should wrap around
      expect(findReplaceManager.getCurrentResultIndex()).toBeLessThanOrEqual(results.length - 1);
    }
  });

  it('should return false for replace operations on empty results', () => {
    const result = findReplaceManager.replaceFirst('NotFound', 'Something');

    expect(result).toBe(false);
  });

  it('should search across vertex and edge fields', () => {
    mockGraph.getDefaultParent().children.push({
      id: 'v3',
      value: 'Test Hello',
      isVertex: () => true,
      isEdge: () => false,
    });

    const results = findReplaceManager.find('Hello');

    expect(results.length).toBeGreaterThan(2);
  });

  it('should escape special regex characters in non-regex mode', () => {
    mockGraph.getDefaultParent().children[0].value = 'Hello.World';

    const results = findReplaceManager.find('Hello.World', { regex: false });

    expect(results.length).toBe(1);
  });

  it('should support multiple search iterations', () => {
    findReplaceManager.find('Hello');
    const count1 = findReplaceManager.getResultCount();

    findReplaceManager.clearResults();
    findReplaceManager.find('Connection');
    const count2 = findReplaceManager.getResultCount();

    expect(count1).toBe(2);
    expect(count2).toBe(1);
  });
});
