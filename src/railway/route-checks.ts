/**
 * @file route-checks.ts
 * @brief Route rules of the railway checks (validation.ts):
 * - `route-endpoint` error    a route has no entry/exit signal, both are the same, or one names
 *                             an object that is not a signal
 * - `route-path`     error    no path from the entry to the exit signal in the signal direction,
 *                             or the route's sections are not a continuous path between them
 * - `route-points`   error/warning  the points list is unreadable, names unknown points, misses
 *                             points the path runs over, needs the wrong position, or lists one
 *                             points twice with different positions (warning: points not on the path)
 * Conflicting routes are not issues: they are listed in the interlocking table.
 */
import type { RailObject } from './validation';
import type { RoutePath } from './routes';
import { findRoutePaths, parsePointsList } from './routes';
import { buildTopology } from './topology';
import type { Topology } from './topology';

export interface RouteIssue {
  o: RailObject;
  severity: 'error' | 'warning';
  rule: 'route-endpoint' | 'route-path' | 'route-points';
  message: string;
  field: string;
}

const upper = (s: string): string => s.trim().toUpperCase();

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => upper(x) === upper(b[i]));
}

export function checkRoutes(objects: RailObject[], topology?: Topology): RouteIssue[] {
  const routes = objects.filter((o) => o.kind.id === 'route');
  if (routes.length === 0) return [];
  const issues: RouteIssue[] = [];
  const name = (o: RailObject): string => (o.id ? `Route ${o.id}` : `Route (cell ${o.cellId})`);
  const byId = (id: string): RailObject[] => objects.filter((o) => o.id && upper(o.id) === upper(id));
  let topo = topology ?? null;

  for (const r of routes) {
    const push = (severity: RouteIssue['severity'], rule: RouteIssue['rule'], message: string, field: string): void => {
      issues.push({ o: r, severity, rule, message, field });
    };
    // Points list syntax and duplicates (independent of the endpoints)
    const { entries, invalid } = parsePointsList(r.values.points);
    for (const bad of invalid) push('error', 'route-points', `${name(r)}: points entry "${bad}" is not "<ID>:normal" or "<ID>:reverse"`, 'points');
    const listed = new Map<string, string>();
    const contradictory = new Set<string>();
    for (const e of entries) {
      const prev = listed.get(upper(e.id));
      if (prev && prev !== e.position) {
        push('error', 'route-points', `${name(r)}: points ${e.id} is listed as both normal and reverse`, 'points');
        contradictory.add(upper(e.id));
      }
      listed.set(upper(e.id), e.position);
      if (!byId(e.id).some((o) => o.kind.id === 'points')) push('error', 'route-points', `${name(r)}: points "${e.id}" does not exist`, 'points');
    }

    // Endpoints
    const ends: Array<RailObject | null> = [];
    for (const field of ['entrySignal', 'exitSignal'] as const) {
      const label = field === 'entrySignal' ? 'entry signal' : 'exit signal';
      const id = (r.values[field] ?? '').trim();
      if (!id) {
        push('error', 'route-endpoint', `${name(r)} has no ${label}`, field);
        ends.push(null);
        continue;
      }
      const found = byId(id);
      const signal = found.find((o) => o.kind.id === 'signal') ?? null;
      if (!signal && found.length > 0) {
        push('error', 'route-endpoint', `${name(r)}: ${label} "${id}" is a ${found[0].kind.label.toLowerCase()}, not a signal`, field);
      }
      ends.push(signal);
    }
    const [entry, exit] = ends;
    if (entry && exit && entry === exit) {
      push('error', 'route-endpoint', `${name(r)}: entry and exit signal are the same (${entry.id})`, 'exitSignal');
      continue;
    }
    if (!entry || !exit) continue;

    // Path over the drawing
    topo ??= buildTopology(objects);
    const result = findRoutePaths(topo, entry, exit, { maxPaths: 16 });
    if (result.paths.length === 0) {
      push('error', 'route-path', `${name(r)}: ${result.problem ?? 'no path'}`, 'sections');
      continue;
    }
    const sections = (r.values.sections ?? '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    let candidates: RoutePath[] = result.paths;
    if (sections.length > 0) {
      candidates = result.paths.filter((p) => sameList(p.sections, sections));
      if (candidates.length === 0) {
        push('error', 'route-path', `${name(r)}: sections ${sections.join(', ')} are not a continuous path from ${entry.id} to ${exit.id} (the drawing gives ${result.paths.map((p) => p.sections.join(', ')).join(' or ')})`, 'sections');
        continue;
      }
    }
    // The path whose points agree best with the list
    const score = (p: RoutePath): number => p.points.filter((x) => listed.get(upper(x.id)) === x.position).length - p.points.filter((x) => listed.get(upper(x.id)) !== x.position).length;
    const path = [...candidates].sort((a, b) => score(b) - score(a))[0];
    for (const need of path.points) {
      if (contradictory.has(upper(need.id))) continue;
      const has = listed.get(upper(need.id));
      if (!has) push('error', 'route-points', `${name(r)} runs over points ${need.id} but does not require a position (needs ${need.position})`, 'points');
      else if (has !== need.position) push('error', 'route-points', `${name(r)} requires points ${need.id} ${has}, but its path needs ${need.position}`, 'points');
    }
    for (const e of entries) {
      if (!path.points.some((p) => upper(p.id) === upper(e.id)) && byId(e.id).some((o) => o.kind.id === 'points')) {
        push('warning', 'route-points', `${name(r)}: points ${e.id} is not on the route's path`, 'points');
      }
    }
  }
  return issues;
}
