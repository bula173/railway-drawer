/**
 * @file etcs-checks.ts
 * @brief The ETCS balise data rules of the Checks panel (rule-checks.ts runs them with the
 *        diagram's rule settings; table in docs/architecture/rules.md): linked group without a
 *        linking packet, linking distance vs the drawing, group without packets, duplicate NID_BG
 *        within NID_C, packet direction vs the group, TSR without revocation, invalid packet data.
 *        Groups without ETCS data are only checked for duplicate NID_BG (and, once some group of the
 *        drawing has data, for missing packets). Model only.
 */
import type { RuleNote } from '../rule-checks';
import type { RuleSetId, RuleSettings } from '../rule-settings';
import { getRuleDef } from '../rule-settings';
import type { Topology } from '../topology';
import type { Issue, RailObject } from '../validation';
import type { EtcsBlock, EtcsValue } from './etcs-data';
import { numericValue, validateEtcsData } from './etcs-data';
import type { EtcsEnv, GroupInfo } from './etcs-compute';
import { buildEtcsEnv, groupLinked, lookAhead, lookAheadAll, travelForward } from './etcs-compute';

export const ETCS_RULES: readonly RuleSetId[] = [
  'etcs-linking-missing',
  'etcs-linking-distance',
  'etcs-no-packets',
  'etcs-duplicate-nid-bg',
  'etcs-packet-direction',
  'etcs-tsr-revocation',
  'etcs-packet-invalid',
];

const DIR_TEXT = ['reverse', 'nominal', 'both'];
const fmt = (m: number): string => `${Math.round(m * 10) / 10} m`;

export function checkEtcsRules(objects: RailObject[], settings: RuleSettings, topo: () => Topology): { issues: Issue[]; notes: RuleNote[] } {
  const issues: Issue[] = [];
  const notes: RuleNote[] = [];
  const enabled = (id: RuleSetId): boolean => !!settings[id]?.enabled;
  if (!ETCS_RULES.some(enabled)) return { issues, notes };
  const groups = objects.filter((o) => o.kind.id === 'baliseGroup');
  if (groups.length === 0) return { issues, notes };
  const push = (id: RuleSetId, o: RailObject, message: string, field?: string, related: RailObject[] = []): void => {
    issues.push({
      severity: settings[id].severity,
      rule: id,
      message,
      cellId: o.cellId,
      kind: o.kind.id,
      objectId: o.id || undefined,
      field,
      ...(related.length > 0 ? { related: related.map((r) => ({ cellId: r.cellId, label: r.id || r.kind.label })) } : {}),
    });
  };
  const name = (o: RailObject): string => o.id || `(cell ${o.cellId})`;
  const label = (id: RuleSetId): string => getRuleDef(id)!.label.en;

  // ---- duplicate NID_BG within NID_C (every group, with or without ETCS data)
  if (enabled('etcs-duplicate-nid-bg')) {
    const byKey = new Map<string, RailObject[]>();
    for (const g of groups) {
      const nidBg = (g.values.nidBg ?? '').trim();
      if (!nidBg) continue;
      const key = `${(g.values.nidC ?? '').trim()}/${nidBg}`;
      byKey.set(key, [...(byKey.get(key) ?? []), g]);
    }
    for (const [key, list] of byKey) {
      if (list.length < 2) continue;
      const [nidC, nidBg] = key.split('/');
      for (const g of list) {
        push('etcs-duplicate-nid-bg', g, `Balise group ${name(g)}: NID_BG ${nidBg} is used ${list.length} times within NID_C ${nidC || '(none)'} (${list.map(name).join(', ')})`, 'nidBg', list.filter((x) => x !== g));
      }
    }
  }

  const withData = groups.filter((g) => (g.cell.getValue() as Element | null)?.getAttribute?.('rdEtcs'));
  // a drawing without ETCS data is not checked further (and gets no note: most drawings have none)
  if (withData.length === 0) return { issues, notes };
  const settingsTolerance = Number(settings['etcs-linking-distance']?.params.tolerance ?? 5);
  const env: EtcsEnv = buildEtcsEnv(objects, { topology: topo(), tolerance: settingsTolerance, bgSignalMax: Number(settings['bg-signal-distance']?.params.max ?? 50) });
  const infos = env.groups;
  const dataGroups = infos.filter((g) => g.data || g.parseProblems.length > 0);

  // ---- invalid data
  if (enabled('etcs-packet-invalid')) {
    for (const g of dataGroups) {
      const problems = [...g.parseProblems, ...(g.data ? validateEtcsData(g.data, g.ctx) : [])].filter((p) => p.severity === 'error');
      if (problems.length === 0) continue;
      push(
        'etcs-packet-invalid',
        g.o,
        `Balise group ${name(g.o)}: ${problems.length} error${problems.length === 1 ? '' : 's'} in the ETCS data: ${problems.slice(0, 2).map((p) => p.message).join('; ')}${problems.length > 2 ? '; …' : ''}`,
        'nidBg'
      );
    }
  }

  // ---- group without packets
  if (enabled('etcs-no-packets')) {
    for (const g of infos) {
      const packets = (g.data?.packets ?? []).filter((p) => p.nid !== 255);
      if (packets.length > 0 || g.parseProblems.length > 0) continue;
      push('etcs-no-packets', g.o, g.data ? `Balise group ${name(g.o)} has ETCS data but no packets` : `Balise group ${name(g.o)} has no ETCS data (other groups of the drawing have)`, 'nidBg');
    }
  }

  // ---- linked group without a linking packet
  if (enabled('etcs-linking-missing')) {
    for (const g of dataGroups) {
      if (!g.data || !groupLinked(g)) continue;
      if (!g.data.packets.some((p) => p.nid === 5)) push('etcs-linking-missing', g.o, `Balise group ${name(g.o)} is marked as linked (Q_LINK = 1) but has no linking packet (5)`, 'nidBg');
    }
  }

  // ---- linking distance vs the drawing
  if (enabled('etcs-linking-distance')) {
    const skipped: string[] = [];
    for (const g of dataGroups) {
      for (const p of g.data?.packets ?? []) {
        if (p.nid !== 5) continue;
        const qDir = numericValue(p.vars.Q_DIR as EtcsValue) ?? 1;
        if (qDir === 2) continue;
        const entries: EtcsBlock[] = [p.vars, ...(Array.isArray(p.vars.links) ? (p.vars.links as EtcsBlock[]) : [])];
        if (travelForward(env, g, qDir) === null) {
          skipped.push(name(g.o));
          continue;
        }
        const ahead = lookAheadAll(env, g, qDir);
        let storedM = 0;
        let fromIndex = 0;
        for (const e of entries) {
          const nidBg = numericValue(e.NID_BG as EtcsValue);
          const d = numericValue(e.D_LINK as EtcsValue);
          if (nidBg === null || d === null) break;
          storedM += d;
          const at = ahead.slice(fromIndex).findIndex((x) => x.g.ctx.nidBg === nidBg);
          if (at < 0) {
            push('etcs-linking-distance', g.o, `Balise group ${name(g.o)}, packet 5 (${DIR_TEXT[qDir]}): linked group NID_BG ${nidBg} is not ahead in the drawing in that direction`, 'nidBg');
            break;
          }
          const target = ahead[fromIndex + at];
          fromIndex += at + 1;
          if (target.metres === null) {
            skipped.push(name(g.o));
            break;
          }
          if (Math.abs(target.metres - storedM) > settingsTolerance + 1e-6) {
            push(
              'etcs-linking-distance',
              g.o,
              `Balise group ${name(g.o)}, packet 5 (${DIR_TEXT[qDir]}): linking to ${name(target.g.o)} (NID_BG ${nidBg}) totals ${fmt(storedM)}, the drawing gives ${fmt(target.metres)}; tolerance ${fmt(settingsTolerance)}`,
              'nidBg',
              [target.g.o]
            );
            break;
          }
        }
      }
    }
    if (skipped.length > 0) {
      notes.push({ rule: 'etcs-linking-distance', message: `${label('etcs-linking-distance')}: skipped for ${[...new Set(skipped)].join(', ')} (no metres along the drawing or the group has no direction / track)` });
    }
  }

  // ---- packet direction vs the group
  if (enabled('etcs-packet-direction')) {
    for (const g of dataGroups) {
      for (const p of g.data?.packets ?? []) {
        if (p.nid === 255) continue;
        const qDir = numericValue(p.vars.Q_DIR as EtcsValue) ?? 1;
        if (qDir === 2) continue;
        const unlinkedSingle = g.ctx.nTotal === 0 && !groupLinked(g);
        if (unlinkedSingle) {
          push('etcs-packet-direction', g.o, `Balise group ${name(g.o)}: packet ${p.nid} is for the ${DIR_TEXT[qDir]} direction, but a single unlinked balise has no orientation (use Q_DIR both or link the group)`, 'direction');
          continue;
        }
        if (g.orientation === null) {
          push('etcs-packet-direction', g.o, `Balise group ${name(g.o)}: packet ${p.nid} is for the ${DIR_TEXT[qDir]} direction, but the group has no direction in the drawing (set the group direction or the balise positions)`, 'direction');
          continue;
        }
        if (p.nid === 5 || p.nid === 12) {
          // the packet must look into the drawing: a track and, for an MA, a main signal ahead
          if (travelForward(env, g, qDir) === null) continue;
          const other = qDir === 1 ? 0 : 1;
          if (p.nid === 5 && lookAheadAll(env, g, qDir).length === 0 && lookAheadAll(env, g, other).length > 0) {
            push('etcs-packet-direction', g.o, `Balise group ${name(g.o)}: linking packet for the ${DIR_TEXT[qDir]} direction, but the other balise groups lie in the ${DIR_TEXT[other]} direction`, 'direction');
          }
          if (p.nid === 12 && (lookAhead(env, g, qDir)?.signals.length ?? 0) === 0 && (lookAhead(env, g, other)?.signals.length ?? 0) > 0) {
            push('etcs-packet-direction', g.o, `Balise group ${name(g.o)}: movement authority (12) for the ${DIR_TEXT[qDir]} direction, but the main signals reading for a train at the group face the ${DIR_TEXT[other]} direction`, 'direction');
          }
        }
      }
    }
  }

  // ---- TSR without revocation
  if (enabled('etcs-tsr-revocation')) {
    const revoked = new Set<number>();
    for (const g of dataGroups) for (const p of g.data?.packets ?? []) if (p.nid === 66) {
      const id = numericValue(p.vars.NID_TSR as EtcsValue);
      if (id !== null) revoked.add(id);
    }
    for (const g of dataGroups) {
      for (const p of g.data?.packets ?? []) {
        if (p.nid !== 65) continue;
        const raw = p.vars.NID_TSR;
        if (raw === 'nonrevocable') continue;
        const id = numericValue(raw as EtcsValue);
        if (id === null || id === 255) continue;
        if (!revoked.has(id)) push('etcs-tsr-revocation', g.o, `Balise group ${name(g.o)}: TSR NID_TSR ${id} (packet 65) is not revoked by any packet 66 of the drawing`, 'nidBg');
      }
    }
  }
  return { issues, notes };
}

export type { GroupInfo };
