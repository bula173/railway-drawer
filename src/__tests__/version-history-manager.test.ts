import { VersionHistoryManager } from '../version-history-manager';

describe('VersionHistoryManager', () => {
  let versionHistoryManager: VersionHistoryManager;
  let mockGraph: any;

  beforeEach(() => {
    mockGraph = {
      getDefaultParent: jest.fn().mockReturnValue({
        children: [
          { id: 'v1', isVertex: () => true },
          { id: 'e1', isEdge: () => true },
        ],
      }),
    };
    versionHistoryManager = new VersionHistoryManager(mockGraph);
  });

  it('should create snapshot', () => {
    const id = versionHistoryManager.createSnapshot('Initial');
    expect(id).toBeDefined();
  });

  it('should get versions', () => {
    versionHistoryManager.createSnapshot('V1');
    versionHistoryManager.createSnapshot('V2');
    const versions = versionHistoryManager.getVersions();
    expect(versions.length).toBe(2);
  });

  it('should delete version', () => {
    const id = versionHistoryManager.createSnapshot('Test');
    const deleted = versionHistoryManager.deleteVersion(id);
    expect(deleted).toBe(true);
  });

  it('should get version by id', () => {
    const id = versionHistoryManager.createSnapshot('Test');
    const version = versionHistoryManager.getVersion(id);
    expect(version?.label).toBe('Test');
  });
});
