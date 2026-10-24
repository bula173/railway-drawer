/**
 * AI tools of the ETCS balise data: get_balise_data, set_balise_packets (schema + packet
 * validation, one undo step), recompute_balise_data (preview, apply).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readAttr } from '../../railway/object-data';
import { collectObjects } from '../../railway/validation';
import { executeAiTool } from '../tools';
import type { TestTarget } from './helpers';
import { createTestTarget } from './helpers';

const LINE = `railwayScript: 1
name: Line
tracks:
  - { id: T1, startKm: 0.000, endKm: 2.000 }
signals:
  - { id: S1, track: T1, at: 0.500, direction: nominal, type: main }
  - { id: S2, track: T1, at: 1.800, direction: nominal, type: main }
baliseGroups:
  - { id: BG1, track: T1, at: 0.200, direction: nominal, nidBg: 1, balises: 2 }
  - id: BG2
    track: T1
    at: 1.000
    direction: nominal
    nidBg: 2
    balises: 2
    etcs: { header: { Q_LINK: 0 }, packets: [{ nid: 132, vars: { Q_DIR: 2, Q_ASPECT: 0 } }] }
`;

let t: TestTarget;
afterEach(() => t?.destroy());

const etcsOf = (id: string): string => readAttr(collectObjects(t.graph.getDataModel()).find((o) => o.id === id)!.cell, 'rdEtcs');

describe('ETCS AI tools', () => {
  it('set_balise_packets validates, stores in one undo step; get / recompute', async () => {
    t = createTestTarget();
    expect((await executeAiTool(t, 'apply_railway_script', { script: LINE })).ok).toBe(true);

    const list = await executeAiTool(t, 'get_balise_data', {});
    expect(list.result).toMatchObject({ groups: [{ id: 'BG1', nidC: 510, nidBg: 1, balises: 2, hasData: false }, { id: 'BG2', hasData: true, packets: [{ nid: 132 }] }] });
    // Railway Script: the etcs key is the group's rdEtcs, and comes back in the generated script
    expect(JSON.parse(etcsOf('BG2'))).toMatchObject({ header: { Q_LINK: 0 }, packets: [{ nid: 132, vars: { Q_DIR: 2, Q_ASPECT: 0 } }] });
    const script = await executeAiTool(t, 'export_drawing', { format: 'railway-script-json' });
    const text = String((script.result as { text?: string }).text ?? JSON.stringify(script.result));
    expect(text).toContain('Q_ASPECT');

    // schema: unknown packet number refused by the input schema
    const bad = await executeAiTool(t, 'set_balise_packets', { group: 'BG1', packets: [{ nid: 99, vars: {} }] });
    expect(bad.ok).toBe(false);
    // packet validation: NID_BG out of range
    const invalid = await executeAiTool(t, 'set_balise_packets', { group: 'BG1', packets: [{ nid: 5, vars: { Q_DIR: 1, Q_SCALE: 1, D_LINK: 800, Q_NEWCOUNTRY: 0, NID_BG: 99999, Q_LINKORIENTATION: 1, Q_LINKREACTION: 1, Q_LOCACC: 5 } }] });
    expect(invalid.ok).toBe(false);
    expect(String((invalid.result as { error: string }).error)).toContain('NID_BG 99999 is outside');
    expect(etcsOf('BG1')).toBe('');

    const set = await executeAiTool(t, 'set_balise_packets', { group: 'bg1', packets: [{ nid: 5, vars: { Q_DIR: 1, Q_SCALE: 1, Q_LINKREACTION: 1, Q_LOCACC: 5 } }, { nid: 137, vars: { Q_DIR: 2, Q_SRSTOP: 0 } }] });
    // D_LINK / NID_BG missing: refused
    expect(set.ok).toBe(false);
    const ok = await executeAiTool(t, 'set_balise_packets', { group: 'BG1', packets: [{ nid: 137, vars: { Q_DIR: 2, Q_SRSTOP: 0 } }] });
    expect(ok.ok).toBe(true);
    expect(ok.edits).toHaveLength(1);
    expect(JSON.parse(etcsOf('BG1')).packets[0].nid).toBe(137);

    // append a linking packet without distances, then compute them from the drawing
    expect((await executeAiTool(t, 'set_balise_packets', { group: 'BG1', mode: 'append', packets: [{ nid: 5, vars: { Q_DIR: 1, Q_SCALE: 1, D_LINK: 1, NID_BG: 2, Q_LINKREACTION: 1, Q_LOCACC: 5 }, auto: ['D_LINK'] }] })).ok).toBe(true);
    const preview = await executeAiTool(t, 'recompute_balise_data', { group: 'BG1' });
    expect(preview.ok).toBe(true);
    expect(JSON.parse(etcsOf('BG1')).packets[1].vars.D_LINK).toBe(1);
    const applied = await executeAiTool(t, 'recompute_balise_data', { apply: true });
    expect(applied.edits).toHaveLength(1);
    const stored = JSON.parse(etcsOf('BG1'));
    expect(stored.packets[1].vars.NID_BG).toBe(2);
    expect(Math.abs(stored.packets[1].vars.D_LINK - 800)).toBeLessThanOrEqual(20);

    const one = await executeAiTool(t, 'get_balise_data', { group: 'BG1' });
    expect(one.result).toMatchObject({ id: 'BG1', hasData: true });
    expect((one.result as { telegramBits: number[] }).telegramBits).toHaveLength(2);
    expect((await executeAiTool(t, 'get_balise_data', { group: 'BG9' })).ok).toBe(false);
  });
});
