import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { originAllowed, startBridgeServer } from '../../../tools/mcp-local/src/bridge-server';
import type { BridgeServer } from '../../../tools/mcp-local/src/bridge-server';
import { openDrawioFile, readDrawioText } from '../../../tools/mcp-local/src/headless-core';
import { hashSecret, newPairingToken } from '../bridge/protocol';

const PUBLIC = resolve(__dirname, '../../../public');
const SCRIPT = `railwayScript: 1
name: Headless
tracks:
  - { id: T1, startKm: 0, endKm: 2 }
signals:
  - { id: S1, track: T1, at: 0.5, direction: nominal, type: main }
`;

let dir = '';
let server: BridgeServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('local bridge server', () => {
  it('allows only the configured page origins', () => {
    const list = ['https://railwaydrawer.mksystemdesign.org', 'http://localhost:*'];
    expect(originAllowed('https://railwaydrawer.mksystemdesign.org', list)).toBe(true);
    expect(originAllowed('http://localhost:3000', list)).toBe(true);
    expect(originAllowed('http://localhost', list)).toBe(true);
    expect(originAllowed('http://localhost.evil.com', list)).toBe(false);
    expect(originAllowed('http://localhost:3000.evil.com', list)).toBe(false);
    expect(originAllowed('https://evil.example', list)).toBe(false);
    expect(originAllowed(undefined, list)).toBe(false);
  });

  it('relays a call to an authenticated browser socket and refuses other origins and secrets', async () => {
    const token = newPairingToken();
    server = await startBridgeServer({ token, port: 0, origins: ['http://localhost:*'] });
    const url = `ws://127.0.0.1:${server.port}/bridge`;

    const foreign = new WebSocket(url, { origin: 'https://evil.example' });
    await expect(new Promise((_, reject) => foreign.on('error', reject))).rejects.toThrow(/401|Unexpected server response/);

    const intruder = new WebSocket(url, { origin: 'http://localhost:3000' });
    await new Promise((r) => intruder.on('open', r));
    intruder.send(JSON.stringify({ t: 'hello', v: 1, auth: hashSecret('y'.repeat(43)) }));
    const closed = await new Promise<number>((r) => intruder.on('close', (code) => r(code)));
    expect(closed).toBe(4401);

    const browser = new WebSocket(url, { origin: 'http://localhost:3000' });
    await new Promise((r) => browser.on('open', r));
    const welcome = new Promise<Record<string, unknown>>((r) => browser.once('message', (d) => r(JSON.parse(d.toString()) as Record<string, unknown>)));
    browser.send(JSON.stringify({ t: 'hello', v: 1, auth: hashSecret(token.secret) }));
    expect(await welcome).toMatchObject({ t: 'welcome', via: 'local', session: token.session });
    browser.on('message', (d) => {
      const msg = JSON.parse(d.toString()) as { t: string; id: string; tool: string };
      if (msg.t === 'call') browser.send(JSON.stringify({ t: 'result', id: msg.id, ok: true, summary: `ran ${msg.tool}`, result: { fine: true } }));
    });
    await expect(server.relay.call(server.auth, 'check_drawing', {})).resolves.toMatchObject({ ok: true, summary: 'ran check_drawing' });
    browser.close();
  });
});

describe('headless .drawio mode', () => {
  it('reads plain and compressed pages', () => {
    const model = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
    const packed = deflateRawSync(Buffer.from(encodeURIComponent(model), 'latin1')).toString('base64');
    const f = readDrawioText(`<mxfile><diagram id="a" name="P1" rdRailwayScript="railwayScript: 1&#xa;">${packed}</diagram><diagram id="b" name="Notes">${model}</diagram></mxfile>`, 'x');
    expect(f.modelXml).toBe(model);
    expect(f).toMatchObject({ pageId: 'a', pageName: 'P1', script: 'railwayScript: 1\n' });
    expect(f.extraPages).toHaveLength(1);
    expect(f.extraPages[0]).toContain('name="Notes"');
  });

  it('applies a script to a file, saves it with the script and keeps other pages', async () => {
    dir = mkdtempSync(join(tmpdir(), 'rd-mcp-'));
    const path = join(dir, 'plan.drawio');
    writeFileSync(path, '<mxfile><diagram id="p1" name="Plan"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram><diagram id="p2" name="Notes"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>');
    const s = openDrawioFile(path, PUBLIC);
    const out = await s.execute('apply_railway_script', { script: SCRIPT });
    expect(out).toMatchObject({ ok: true, summary: 'Applied Railway Script: 1 track, 1 signal' });
    s.destroy();
    const saved = readFileSync(path, 'utf8');
    expect(saved).toContain('name="Plan"');
    expect(saved).toContain('rdRailwayScript="railwayScript: 1');
    expect(saved).toContain('rdKind="signal"');
    expect(saved).toContain('name="Notes"');
    // reopen: the script is the stored one and in sync
    const again = openDrawioFile(path, PUBLIC);
    const drawing = await again.execute('get_drawing', {});
    expect(drawing.result).toMatchObject({ railwayObjects: { track: 1, signal: 1 }, railwayScript: { source: 'stored', inSyncWithDrawing: true } });
    const undo = await again.execute('delete_cells', { ids: ['S1'] });
    expect(undo.ok).toBe(true);
    expect(readFileSync(path, 'utf8')).not.toContain('rdKind="signal"');
    const png = await again.execute('export_drawing', { format: 'png' });
    expect(png.ok).toBe(false);
    again.destroy();
  });

  it('builds scenarios on a file: step pages written, read back on reopen', async () => {
    dir = mkdtempSync(join(tmpdir(), 'rd-mcp-'));
    const path = join(dir, 'scn.drawio');
    const s = openDrawioFile(path, PUBLIC);
    expect((await s.execute('insert_template', { id: 'ertms-tpl-22', mode: 'newTab' })).result).toMatchObject({ error: expect.stringMatching(/new tabs are not available here/) });
    expect((await s.execute('insert_template', { id: 'ertms-tpl-22', mode: 'intoTab' })).ok).toBe(true);
    const built = await s.execute('build_scenario', { name: 'Entry', steps: [{ name: 'Initial' }, { name: 'Occupied', states: [{ id: 'TC2', state: 'occupied' }], text: 'TC2 **occupied**' }] });
    expect(built).toMatchObject({ ok: true, summary: 'Built scenario "Entry" with 2 steps' });
    expect((await s.execute('view_scenario', { scenario: 'Entry' })).result).toMatchObject({ error: 'the scenario view is not available here' });
    s.destroy();
    const saved = readFileSync(path, 'utf8');
    expect(saved).toContain('rdScenarios=');
    expect(saved.match(/rdStepId=/g)).toHaveLength(2);
    const again = openDrawioFile(path, PUBLIC);
    const list = await again.execute('list_scenarios', {});
    expect((list.result as { scenarios: unknown }).scenarios).toEqual([expect.objectContaining({ name: 'Entry', steps: [expect.objectContaining({ name: 'Initial' }), expect.objectContaining({ name: 'Occupied', text: true })] })]);
    await again.execute('delete_scenario_step', { scenario: 'Entry', step: 1 });
    expect(readFileSync(path, 'utf8').match(/rdStepId=/g)).toHaveLength(1);
    again.destroy();
  });
});
