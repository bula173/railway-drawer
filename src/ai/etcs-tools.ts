/**
 * @file etcs-tools.ts
 * @brief AI tools for the ETCS balise data (docs/architecture/etcs-data.md): get_balise_data
 *        (groups with header context, packets, validation, telegram sizes), set_balise_packets
 *        (the input schema in tool-defs.ts plus the packet schema validation of etcs-data.ts;
 *        refused while it has errors; one undo step) and recompute_balise_data (values from the
 *        drawing, mismatches with hand-set values; `apply` stores them, one undo step).
 */
import type { EtcsGroupData, EtcsPacket } from '../railway/etcs/etcs-data';
import { buildTelegrams, cloneEtcsData, withDefaults, emptyEtcsData, normalizeEtcsData, serializeEtcsData, setEtcsData, validateEtcsData } from '../railway/etcs/etcs-data';
import type { EtcsEnv, GroupInfo } from '../railway/etcs/etcs-compute';
import { etcsEnvFromModel } from '../railway/etcs/etcs-compute';
import { recomputeGroup } from '../railway/etcs/etcs-recompute';
import { getPacketDef } from '../railway/etcs/etcs-schema';
import { sortedGroups } from '../railway/etcs/etcs-export';
import { fail, ok } from './tool-kit';
import type { Executor } from './tool-kit';

function findGroup(env: EtcsEnv, id: string): GroupInfo {
  const key = id.trim().toUpperCase();
  const g = env.groups.find((x) => x.o.id.toUpperCase() === key);
  if (!g) fail(`no balise group "${id}"; balise groups: ${env.groups.map((x) => x.o.id).filter(Boolean).join(', ') || 'none'}`);
  return g!;
}

function describeGroup(g: GroupInfo, withPackets: boolean): Record<string, unknown> {
  const problems = [...g.parseProblems, ...(g.data ? validateEtcsData(g.data, g.ctx) : [])];
  return {
    id: g.o.id,
    nidC: g.ctx.nidC,
    nidBg: g.ctx.nidBg,
    balises: g.ctx.nTotal + 1,
    orientation: g.orientation,
    km: g.o.values.km || null,
    track: g.o.values.trackId || null,
    hasData: !!g.data,
    ...(g.data
      ? {
          header: g.data.header,
          packets: withPackets ? g.data.packets : g.data.packets.map((p) => ({ nid: p.nid, name: getPacketDef(p.nid)?.name.en ?? 'unknown' })),
          ...(g.data.balises ? { baliseHeaders: g.data.balises } : {}),
          telegramBits: buildTelegrams(g.data, g.ctx).map((t) => t.bits),
        }
      : {}),
    problems: problems.slice(0, 30).map((p) => `${p.severity}: ${p.message}`),
  };
}

export const getBaliseData: Executor = async (target, input) => {
  const env = etcsEnvFromModel(target.graph.getDataModel());
  if (typeof input.group === 'string' && input.group.trim()) {
    const g = findGroup(env, input.group);
    return ok(`Balise group ${g.o.id}: ${g.data ? `${g.data.packets.length} packet(s)` : 'no ETCS data'}`, describeGroup(g, true));
  }
  const groups = sortedGroups(env).map((g) => describeGroup(g, false));
  return ok(`${env.groups.length} balise group(s), ${env.groups.filter((g) => g.data).length} with ETCS data`, { groups });
};

export const setBalisePackets: Executor = async (target, input) => {
  const model = target.graph.getDataModel();
  const env = etcsEnvFromModel(model);
  const g = findGroup(env, String(input.group));
  const mode = input.mode === 'append' ? 'append' : 'replace';
  const base = mode === 'append' && g.data ? cloneEtcsData(g.data) : g.data ? { ...cloneEtcsData(g.data), packets: [] as EtcsPacket[] } : emptyEtcsData();
  const incoming = normalizeEtcsData({ header: input.header ?? {}, packets: input.packets ?? [], balises: input.baliseHeaders });
  const data: EtcsGroupData = {
    ...base,
    header: { ...base.header, ...(input.header ? incoming.data.header : {}) },
    packets: [...base.packets, ...incoming.data.packets.map(withDefaults)],
    ...(input.baliseHeaders ? { balises: incoming.data.balises } : {}),
  };
  const errors = [...incoming.problems, ...validateEtcsData(data, g.ctx)].filter((p) => p.severity === 'error');
  if (errors.length > 0) fail(`ETCS data of ${g.o.id} not stored, ${errors.length} error(s): ${errors.slice(0, 8).map((p) => p.message).join('; ')}`);
  const before = g.data ? serializeEtcsData(g.data) : '';
  if (serializeEtcsData(data) !== before) setEtcsData(model, [g.o.cell], data);
  const warnings = validateEtcsData(data, g.ctx).filter((p) => p.severity === 'warning');
  return ok(`Stored ${data.packets.length} packet(s) on ${g.o.id}`, { group: g.o.id, packets: data.packets.map((p) => p.nid), telegramBits: buildTelegrams(data, g.ctx).map((t) => t.bits), warnings: warnings.map((w) => w.message) });
};

export const recomputeBaliseData: Executor = async (target, input) => {
  const model = target.graph.getDataModel();
  const env = etcsEnvFromModel(model);
  const groups = typeof input.group === 'string' && input.group.trim() ? [findGroup(env, input.group)] : env.groups.filter((g) => g.data);
  const results: Array<Record<string, unknown>> = [];
  const updates = new Map<string, EtcsGroupData>();
  for (const g of groups) {
    if (!g.data) {
      results.push({ group: g.o.id, note: 'no ETCS data (add packets first with set_balise_packets)' });
      continue;
    }
    const r = recomputeGroup(env, g, g.data);
    results.push({
      group: g.o.id,
      filled: r.filled.map((f) => `packet ${g.data!.packets[f.packet]?.nid}: ${f.path}`),
      mismatches: r.mismatches.map((m) => m.message),
      notes: r.notes,
      ...(input.apply === true ? {} : { computed: r.data.packets.map((p) => ({ nid: p.nid, vars: p.vars })) }),
    });
    if (serializeEtcsData(r.data) !== serializeEtcsData(g.data)) updates.set(g.o.cellId, r.data);
  }
  if (input.apply === true && updates.size > 0) {
    const cells = groups.filter((g) => updates.has(g.o.cellId)).map((g) => g.o.cell);
    setEtcsData(model, cells, (cell) => updates.get(String(cell.getId())) ?? null);
  }
  return ok(`Recomputed ${groups.length} group(s)${input.apply === true ? `, ${updates.size} updated` : ' (not stored: apply=true stores them)'}`, { groups: results });
};
