/**
 * Storage left behind by the removed embedded draw.io mode, and opening its autosaved document.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RETIRED_DRAWIO_DOC_KEY,
  RETIRED_EDITOR_MODE_KEY,
  clearRetiredEditorMode,
  discardRetiredDrawioDocument,
  readRetiredDrawioDocument,
} from '../retired-drawio-mode';
import { openDiagramFile } from '../../share/share-open';
import type { ShareOpenHost } from '../../share/share-open';
import { buildShareMxfile } from '../../share/share-mxfile';

const model = (cells: string) =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
const VERTEX = '<mxCell id="2" value="v" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell>';

describe('retired draw.io mode storage', () => {
  beforeEach(() => localStorage.clear());

  it('drops the remembered editor mode, whatever it says', () => {
    for (const mode of ['drawio', 'legacy', 'main']) {
      localStorage.setItem(RETIRED_EDITOR_MODE_KEY, mode);
      clearRetiredEditorMode();
      expect(localStorage.getItem(RETIRED_EDITOR_MODE_KEY)).toBeNull();
    }
    expect(() => clearRetiredEditorMode(null)).not.toThrow();
  });

  it('reads the draw.io view document and ignores unusable ones', () => {
    expect(readRetiredDrawioDocument()).toBeNull();
    localStorage.setItem(RETIRED_DRAWIO_DOC_KEY, JSON.stringify({ xml: '<mxfile/>', title: ' Plan ', savedAt: 'x' }));
    expect(readRetiredDrawioDocument()).toEqual({ xml: '<mxfile/>', title: 'Plan' });
    localStorage.setItem(RETIRED_DRAWIO_DOC_KEY, JSON.stringify({ xml: '<mxfile/>', title: '' }));
    expect(readRetiredDrawioDocument()?.title).toBe('draw.io diagram');
    for (const bad of ['{', 'null', '{"xml":42}', '{"xml":"not xml"}']) {
      localStorage.setItem(RETIRED_DRAWIO_DOC_KEY, bad);
      expect(readRetiredDrawioDocument(), bad).toBeNull();
    }
    discardRetiredDrawioDocument();
    expect(localStorage.getItem(RETIRED_DRAWIO_DOC_KEY)).toBeNull();
  });

  it('storage that throws is harmless', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(readRetiredDrawioDocument(broken)).toBeNull();
    expect(() => discardRetiredDrawioDocument(broken)).not.toThrow();
    expect(() => clearRetiredEditorMode(broken)).not.toThrow();
  });
});

describe('openDiagramFile', () => {
  function host() {
    const loaded = new Map<string, string>();
    const tabs: Array<{ id: string; saveLoadController: { loadProjectXml(xml: string): Promise<void> } }> = [];
    const make = (id: string) => ({
      id,
      saveLoadController: {
        loadProjectXml: async (xml: string) => {
          if (xml.includes('broken')) throw new Error('broken');
          loaded.set(id, xml);
        },
      },
    });
    tabs.push(make('start'));
    const h: ShareOpenHost & { tabs: typeof tabs; active: string } = {
      tabs,
      active: 'start',
      getAllTabs: () => tabs,
      createTab: () => {
        const tab = make(`t${tabs.length}`);
        tabs.push(tab);
        return tab;
      },
      switchTab: (id) => {
        h.active = id;
      },
      closeTab: (id) => {
        tabs.splice(tabs.findIndex((t) => t.id === id), 1);
      },
      isTabEmpty: (id) => !(loaded.get(id) ?? '').includes('vertex="1"'),
    };
    return h;
  }

  it('skips blank pages, replaces the lone empty tab and words the notification', async () => {
    const h = host();
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    const xml = buildShareMxfile([
      { name: 'Drawn', modelXml: model(VERTEX) },
      { name: 'Blank', modelXml: model('') },
    ]);
    const result = await openDiagramFile(xml, 'Old', h, notify, { what: 'the old diagram', successHint: 'Save it.' }, { skipEmpty: true });
    expect(result).toEqual({ opened: 1, failed: 0, invalid: false });
    expect(h.tabs.map((t) => t.id)).toEqual(['t1']);
    expect(h.active).toBe('t1');
    expect(notify.success).toHaveBeenCalledWith('Opened the old diagram in a new tab. Save it.');
  });

  it('reports unreadable files and pages', async () => {
    const h = host();
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    expect(await openDiagramFile('<html/>', 'x', h, notify)).toEqual({ opened: 0, failed: 0, invalid: true });
    expect(notify.error).toHaveBeenCalledWith(expect.stringMatching(/^Could not open the shared diagram: /));
    const xml = buildShareMxfile([
      { name: 'Good', modelXml: model(VERTEX) },
      { name: 'Bad', modelXml: model('<mxCell id="broken" vertex="1" parent="1"/>') },
    ]);
    expect(await openDiagramFile(xml, 'x', h, notify)).toEqual({ opened: 1, failed: 1, invalid: false });
    expect(notify.warning).toHaveBeenCalledWith('Opened the shared diagram in a new tab; 1 page(s) could not be read.');
  });
});
