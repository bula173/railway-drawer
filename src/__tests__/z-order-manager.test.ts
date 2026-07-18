import { ZOrderManager } from '../z-order-manager';

describe('ZOrderManager', () => {
  let zOrderManager: ZOrderManager;
  let mockGraph: any;
  let parent: any;

  beforeEach(() => {
    // Create mock cells
    const cell1 = { id: 'cell-1', isVertex: () => true };
    const cell2 = { id: 'cell-2', isVertex: () => true };
    const cell3 = { id: 'cell-3', isVertex: () => true };

    parent = {
      children: [cell1, cell2, cell3],
    };

    mockGraph = {
      getDefaultParent: jest.fn().mockReturnValue(parent),
      view: {
        refresh: jest.fn(),
      },
    };

    zOrderManager = new ZOrderManager(mockGraph);
  });

  it('should bring cells to front', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.bringToFront([cell1]);

    expect(parent.children).toEqual([cell2, cell3, cell1]);
  });

  it('should bring multiple cells to front in order', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.bringToFront([cell1, cell2]);

    expect(parent.children).toEqual([cell3, cell1, cell2]);
  });

  it('should send cells to back', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.sendToBack([cell3]);

    expect(parent.children).toEqual([cell3, cell1, cell2]);
  });

  it('should send multiple cells to back in order', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.sendToBack([cell2, cell3]);

    expect(parent.children).toEqual([cell2, cell3, cell1]);
  });

  it('should bring forward one step', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.bringForward(cell1);

    expect(parent.children).toEqual([cell2, cell1, cell3]);
  });

  it('should not bring forward if already at front', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.bringForward(cell3);

    expect(parent.children).toEqual([cell1, cell2, cell3]);
  });

  it('should send backward one step', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.sendBackward(cell3);

    expect(parent.children).toEqual([cell1, cell3, cell2]);
  });

  it('should not send backward if already at back', () => {
    const [cell1, cell2, cell3] = parent.children;

    zOrderManager.sendBackward(cell1);

    expect(parent.children).toEqual([cell1, cell2, cell3]);
  });

  it('should refresh view after changes', () => {
    const [cell1] = parent.children;

    zOrderManager.bringToFront([cell1]);

    expect(mockGraph.view.refresh).toHaveBeenCalled();
  });
});
