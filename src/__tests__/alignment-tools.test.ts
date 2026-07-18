import { AlignmentTools } from '../alignment-tools';

describe('AlignmentTools', () => {
  let alignmentTools: AlignmentTools;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      batchUpdate: jest.fn((callback) => callback()),
      model: { setGeometry: jest.fn() },
    };
    alignmentTools = new AlignmentTools(mockGraph);
  });

  describe('alignLeft', () => {
    it('should align cells to leftmost position', () => {
      const cells = [
        { geometry: { x: 50, y: 10, width: 20, height: 20 } },
        { geometry: { x: 100, y: 10, width: 20, height: 20 } },
        { geometry: { x: 30, y: 10, width: 20, height: 20 } },
      ];

      alignmentTools.alignLeft(cells);

      expect(mockGraph.model.setGeometry).toHaveBeenCalledTimes(3);
      // Leftmost is 30
      const calls = mockGraph.model.setGeometry.mock.calls;
      calls.forEach(([, geo]: [any, any]) => {
        expect(geo.x).toBe(30);
      });
    });

    it('should do nothing with fewer than 2 cells', () => {
      alignmentTools.alignLeft([]);
      alignmentTools.alignLeft([{ geometry: { x: 0, y: 0, width: 10, height: 10 } }]);

      expect(mockGraph.model.setGeometry).not.toHaveBeenCalled();
    });
  });

  describe('alignRight', () => {
    it('should align cells to rightmost position', () => {
      const cells = [
        { geometry: { x: 0, y: 10, width: 20, height: 20 } },
        { geometry: { x: 50, y: 10, width: 20, height: 20 } },
      ];

      alignmentTools.alignRight(cells);

      // Rightmost is 50 + 20 = 70
      const calls = mockGraph.model.setGeometry.mock.calls;
      calls.forEach(([, geo]: [any, any]) => {
        expect(geo.x + geo.width).toBe(70);
      });
    });
  });

  describe('alignHCenter', () => {
    it('should center cells horizontally', () => {
      const cells = [
        { geometry: { x: 0, y: 10, width: 20, height: 20 } },
        { geometry: { x: 100, y: 10, width: 20, height: 20 } },
      ];

      alignmentTools.alignHCenter(cells);

      // Center between 0 and 120 is 60
      const calls = mockGraph.model.setGeometry.mock.calls;
      calls.forEach(([, geo]: [any, any]) => {
        expect(geo.x + geo.width / 2).toBe(60);
      });
    });
  });

  describe('distributeHorizontally', () => {
    it('should distribute cells equally', () => {
      const cells = [
        { geometry: { x: 0, y: 0, width: 10, height: 10 } },
        { geometry: { x: 50, y: 0, width: 10, height: 10 } },
        { geometry: { x: 100, y: 0, width: 10, height: 10 } },
      ];

      alignmentTools.distributeHorizontally(cells);

      expect(mockGraph.model.setGeometry).toHaveBeenCalledTimes(3);
      expect(mockGraph.batchUpdate).toHaveBeenCalled();
    });

    it('should do nothing with fewer than 3 cells', () => {
      alignmentTools.distributeHorizontally([
        { geometry: { x: 0, y: 0, width: 10, height: 10 } },
      ]);

      expect(mockGraph.model.setGeometry).not.toHaveBeenCalled();
    });
  });
});
