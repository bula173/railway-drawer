/**
 * @file plantuml-sequence-svg.ts
 * @brief Local (offline) PlantUML sequence-diagram renderer: PlantUML text -> standalone SVG string.
 *
 * The app's PlantUML tab (plantuml-parser.ts + *-diagram-renderer.ts) turns PlantUML into maxGraph
 * cells on the canvas; it knows participants, plain messages and single-line notes only. Scenario
 * steps need a read-only picture of a sequence diagram, rendered without sending the text anywhere,
 * so this module parses the sequence-diagram subset scenarios use and lays it out like PlantUML:
 *
 * - `@startuml`/`@enduml`, `'` and `/' … '/` comments, `title` (also `title … end title`),
 *   `autonumber [start] [step]` / `autonumber stop|resume`, `hide footbox`; skinparam, `!theme`,
 *   `box`, `header`, `footer`, `legend`, `scale`, `newpage` are ignored.
 * - participants: `participant|actor|boundary|control|entity|database|collections|queue`,
 *   `"Long name" as X`, `X as "Long name"`, `#color`, `<<stereotype>>`, `order n`; undeclared
 *   participants are created in order of appearance.
 * - messages: `->`, `-->` (dashed), `->>` / `-->>` (open head), `<-` / `<--` (reversed), `<->`,
 *   lost/found `->x`, `->o`, `[->`, `->]`, colours `-[#red]>`, self messages, `\n` in labels,
 *   activation suffixes `++` / `--` / `**` / `!!`, `return label`.
 * - notes: `note left|right [of X]`, `note over X[, Y]`, `hnote`/`rnote`, single line (`: text`) or
 *   multi-line until `end note`; `ref over X, Y : text` (or multi-line until `end ref`).
 * - groups: `alt|else|opt|loop|par|break|critical|group … end` (nested).
 * - `activate X [#color]`, `deactivate X`, `destroy X`, dividers `== text ==`, delays `...` /
 *   `... text ...`, spacing `|||` / `||45||`.
 *
 * Everything written into the SVG is escaped; colours are validated, so the result can be inserted
 * into the page as markup. Unknown lines are reported in `warnings` and skipped.
 */

export type ParticipantKind =
  | 'participant'
  | 'actor'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'database'
  | 'collections'
  | 'queue'
  | 'edge';

export interface SeqParticipant {
  id: string;
  label: string[];
  kind: ParticipantKind;
  color?: string;
  stereotype?: string;
}

export type ArrowHead = 'closed' | 'open' | 'lost' | 'circle' | 'none';

export type SeqEvent =
  | {
      t: 'msg';
      from: string;
      to: string;
      label: string[];
      dashed: boolean;
      head: ArrowHead;
      tail: ArrowHead;
      color?: string;
      number?: string;
      suffix?: '++' | '--' | '**' | '!!';
      /** `A -> B ++ #gold`: colour of the activation started by the message. */
      activationColor?: string;
    }
  | { t: 'note'; pos: 'left' | 'right' | 'over'; targets: string[]; text: string[]; shape: 'note' | 'hnote' | 'rnote'; color?: string }
  | { t: 'ref'; targets: string[]; text: string[] }
  | { t: 'groupStart'; kind: string; label: string }
  | { t: 'else'; label: string }
  | { t: 'groupEnd' }
  | { t: 'activate'; who: string; color?: string }
  | { t: 'deactivate'; who: string }
  | { t: 'destroy'; who: string }
  | { t: 'divider'; label: string }
  | { t: 'delay'; label: string }
  | { t: 'space'; px: number };

export interface SequenceDiagram {
  title: string[];
  participants: SeqParticipant[];
  events: SeqEvent[];
  footbox: boolean;
  /** Lines that were not understood (1-based line number + text). */
  warnings: string[];
}

export class PlantUmlSyntaxError extends Error {}

const PARTICIPANT_KINDS = ['participant', 'actor', 'boundary', 'control', 'entity', 'database', 'collections', 'queue'];
const GROUP_KINDS = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group'];
const ID = String.raw`"[^"]+"|[\p{L}\p{N}_.@$]+|\[|\]|\?`;
const ARROW = String.raw`(?:(?<=\s)[ox])?(?:<<?|\/\/?|\\\\?)?-{1,2}(?:\[[^\]]*\])?-{0,2}(?:>>?|\/\/?|\\\\?)?(?:[ox](?=[\s\]]|$))?`;
const MESSAGE_RE = new RegExp(
  String.raw`^(${ID})\s*(${ARROW})\s*(${ID})\s*(\+\+|--|\*\*|!!)?\s*(#\w+)?\s*(?::\s?(.*))?$`,
  'u'
);

/** True when the PlantUML text looks like a sequence diagram (the default diagram type of `@startuml`). */
export function isSequenceDiagram(source: string): boolean {
  const start = /@start(\w+)/i.exec(source);
  if (start && start[1].toLowerCase() !== 'uml') return false;
  const lines = stripComments(source).split('\n').map((l) => l.trim());
  for (const line of lines) {
    if (/^(class|interface|abstract|enum|annotation|state|usecase|component|node|package|object|map|json|artifact|cloud|folder|frame|rectangle|start|stop|if|while|fork|repeat|partition)\b/i.test(line)) {
      // `participant`-style declarations of these words do not exist in sequence diagrams
      return false;
    }
    if (/\[\*\]/.test(line) || /^:.*;$/.test(line) || /^\(\*\)/.test(line)) return false;
  }
  return true;
}

function stripComments(source: string): string {
  return source.replace(/\r\n?/g, '\n').replace(/\/'[\s\S]*?'\//g, '');
}

function unquote(text: string): string {
  const t = text.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/** `\n` inside PlantUML labels is a line break. */
function splitLabel(text: string): string[] {
  return text.split(/\\n/).map((s) => s.trim());
}

/** A colour from PlantUML (`#red`, `#FF0000`, `#f00`, `#red/blue` -> first part) or undefined. */
export function plantColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.replace(/^#/, '').split(/[/\\|-]/)[0];
  if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(value)) return `#${value}`;
  if (/^[a-z]{3,30}$/i.test(value)) return value.toLowerCase();
  return undefined;
}

/** Parses the sequence-diagram subset described in the file header. */
export function parseSequenceDiagram(source: string): SequenceDiagram {
  const diagram: SequenceDiagram = { title: [], participants: [], events: [], footbox: true, warnings: [] };
  const byId = new Map<string, SeqParticipant>();
  const lines = stripComments(source).split('\n');
  let autonumber: { next: number; step: number; on: boolean } | null = null;
  let groupDepth = 0;
  /** Active calls for `return`: [callee, caller]. */
  const calls: Array<{ who: string; caller: string }> = [];
  let lastMessage: Extract<SeqEvent, { t: 'msg' }> | null = null;

  const ensure = (rawId: string): string => {
    const token = rawId.trim();
    if (token === '[' || token === '?') return ensureEdge('[');
    if (token === ']') return ensureEdge(']');
    const id = unquote(token);
    if (!byId.has(id)) {
      const p: SeqParticipant = { id, label: splitLabel(id), kind: 'participant' };
      byId.set(id, p);
      diagram.participants.push(p);
    }
    return id;
  };
  const ensureEdge = (id: '[' | ']'): string => {
    if (!byId.has(id)) {
      const p: SeqParticipant = { id, label: [], kind: 'edge' };
      byId.set(id, p);
      diagram.participants.push(p);
    }
    return id;
  };
  const targetsOf = (text: string): string[] =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(ensure);

  /** Reads lines until `end <word>` (multi-line notes, refs, titles, legends). */
  const block = (start: number, endRe: RegExp): { text: string[]; next: number } => {
    const text: string[] = [];
    let i = start;
    for (; i < lines.length; i++) {
      if (endRe.test(lines[i].trim())) return { text, next: i };
      text.push(lines[i].replace(/\s+$/, ''));
    }
    return { text, next: i };
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("'")) continue;
    let m: RegExpExecArray | null;

    if (/^@(start|end)\w*/i.test(line)) continue;
    // messages first: a participant may be called like a keyword (`loop`, `group`, ...)
    if ((m = MESSAGE_RE.exec(line)) && (/[<>/\\]/.test(m[2]) || /^[ox]|[ox]$/.test(m[2]))) {
      const arrow = m[2];
      const dashes = (arrow.replace(/\[[^\]]*\]/, '').match(/-/g) ?? []).length;
      const bracket = /\[([^\]]*)\]/.exec(arrow)?.[1] ?? '';
      const dashed = dashes >= 2 || /dashed|dotted/i.test(bracket);
      const color = plantColor(bracket.split(',').find((p) => p.trim().startsWith('#'))?.trim());
      const leftPart = arrow.slice(0, arrow.indexOf('-'));
      const rightPart = arrow.slice(arrow.lastIndexOf('-') + 1).replace(/^\[[^\]]*\]-*/, '');
      const headOf = (part: string, side: 'left' | 'right'): ArrowHead => {
        const tip = part.replace(/[ox]/g, '');
        const end = side === 'right' ? part.slice(-1) : part.slice(0, 1);
        if (end === 'x') return 'lost';
        if (end === 'o') return tip ? 'circle' : 'circle';
        if (!tip) return 'none';
        if (tip.length === 2 || tip === '/' || tip === '\\' || tip === '//' || tip === '\\\\') return 'open';
        return 'closed';
      };
      let left = headOf(leftPart, 'left');
      let right = headOf(rightPart, 'right');
      let fromRaw = m[1];
      let toRaw = m[3];
      if (left !== 'none' && right === 'none') {
        // `B <- A`: drawn from A to B
        [fromRaw, toRaw] = [toRaw, fromRaw];
        [left, right] = [right, left];
      }
      if (left === 'none' && right === 'none') right = 'closed';
      const from = ensure(fromRaw);
      const to = ensure(toRaw);
      const msg: Extract<SeqEvent, { t: 'msg' }> = {
        t: 'msg',
        from,
        to,
        label: m[6] ? splitLabel(m[6]) : [],
        dashed,
        head: right,
        tail: left,
        color,
      };
      if (m[4]) msg.suffix = m[4] as '++' | '--' | '**' | '!!';
      if (autonumber?.on) {
        msg.number = String(autonumber.next);
        autonumber.next += autonumber.step;
      }
      diagram.events.push(msg);
      lastMessage = msg;
      if (msg.suffix === '++') calls.push({ who: to, caller: from });
      if (msg.suffix === '--') {
        const idx = calls.map((c) => c.who).lastIndexOf(from);
        if (idx >= 0) calls.splice(idx, 1);
      }
      if (m[5] && msg.suffix === '++') msg.activationColor = plantColor(m[5]);
      continue;
    }
    if (/^(skinparam|!|scale|newpage|hide\s+(?!footbox)|show\s|header|footer|caption|mainframe|left to right|top to bottom)/i.test(line)) {
      if (/^skinparam\b[^{]*\{\s*$/i.test(line)) i = block(i + 1, /^\}$/).next;
      continue;
    }
    if (/^hide\s+footbox$/i.test(line)) {
      diagram.footbox = false;
      continue;
    }
    if (/^show\s+footbox$/i.test(line)) continue;
    if (/^legend\b/i.test(line)) {
      i = block(i + 1, /^end\s?legend$/i).next;
      continue;
    }
    if (/^(end\s?)?box\b/i.test(line)) continue;
    if ((m = /^title\s*(.*)$/i.exec(line))) {
      if (m[1]) diagram.title = splitLabel(m[1]);
      else {
        const b = block(i + 1, /^end\s?title$/i);
        diagram.title = b.text.map((s) => s.trim());
        i = b.next;
      }
      continue;
    }
    if ((m = /^autonumber\b\s*(.*)$/i.exec(line))) {
      const arg = m[1].trim().toLowerCase();
      if (arg === 'stop') {
        if (autonumber) autonumber.on = false;
      } else if (arg.startsWith('resume')) {
        if (autonumber) autonumber.on = true;
        else autonumber = { next: 1, step: 1, on: true };
      } else {
        const nums = arg.match(/\d+/g) ?? [];
        autonumber = { next: nums[0] ? Number(nums[0]) : 1, step: nums[1] ? Number(nums[1]) : 1, on: true };
      }
      continue;
    }
    if ((m = new RegExp(`^(${PARTICIPANT_KINDS.join('|')})\\s+(.+)$`, 'i').exec(line))) {
      const kind = m[1].toLowerCase() as ParticipantKind;
      let rest = m[2].trim();
      let color: string | undefined;
      let stereotype: string | undefined;
      rest = rest.replace(/\s+order\s+-?\d+\s*$/i, '');
      const colorMatch = /\s+(#[\w/\\|-]+)\s*$/.exec(rest);
      if (colorMatch) {
        color = plantColor(colorMatch[1]);
        rest = rest.slice(0, colorMatch.index);
      }
      const stereoMatch = /\s*<<(.+?)>>\s*$/.exec(rest);
      if (stereoMatch) {
        stereotype = stereoMatch[1].trim();
        rest = rest.slice(0, stereoMatch.index);
      }
      let id: string;
      let label: string;
      let a: RegExpExecArray | null;
      if ((a = /^"([^"]+)"\s+as\s+(\S+)$/i.exec(rest))) [label, id] = [a[1], a[2]];
      else if ((a = /^(\S+)\s+as\s+"([^"]+)"$/i.exec(rest))) [id, label] = [a[1], a[2]];
      else if ((a = /^(\S+)\s+as\s+(\S+)$/i.exec(rest))) [label, id] = [a[1], a[2]];
      else [id, label] = [unquote(rest), unquote(rest)];
      let p = byId.get(id);
      if (!p) {
        p = { id, label: splitLabel(label), kind };
        byId.set(id, p);
        diagram.participants.push(p);
      } else {
        p.label = splitLabel(label);
        p.kind = kind;
      }
      if (color) p.color = color;
      if (stereotype) p.stereotype = stereotype;
      continue;
    }
    if ((m = /^(note|hnote|rnote)\s+(left|right|over)\b\s*(?:of\s+)?([^:#]*?)\s*(#[\w/\\|-]+)?\s*(?::\s?(.*))?$/i.exec(line))) {
      const shape = m[1].toLowerCase() as 'note' | 'hnote' | 'rnote';
      const pos = m[2].toLowerCase() as 'left' | 'right' | 'over';
      let targets = m[3] ? targetsOf(m[3]) : [];
      if (targets.length === 0) {
        // `note left|right` without a participant: next to the last message
        if (lastMessage) {
          const ends = [lastMessage.from, lastMessage.to].filter((id) => id !== '[' && id !== ']');
          const order = ends.map((id) => diagram.participants.findIndex((p) => p.id === id));
          const pick = pos === 'right' ? Math.max(...order) : Math.min(...order);
          targets = pick >= 0 ? [diagram.participants[pick].id] : [];
        }
        if (targets.length === 0) {
          diagram.warnings.push(`line ${i + 1}: note without a participant: ${line}`);
          if (m[5] === undefined) i = block(i + 1, /^end\s?[hr]?note$/i).next;
          continue;
        }
      }
      let text: string[];
      if (m[5] !== undefined) text = splitLabel(m[5]);
      else {
        const b = block(i + 1, /^end\s?[hr]?note$/i);
        text = b.text.map((s) => s.trim());
        i = b.next;
      }
      diagram.events.push({ t: 'note', pos, targets, text, shape, color: plantColor(m[4]) });
      continue;
    }
    if ((m = /^ref\s+over\s+([^:]+?)\s*(?::\s?(.*))?$/i.exec(line))) {
      const targets = targetsOf(m[1]);
      let text: string[];
      if (m[2] !== undefined) text = splitLabel(m[2]);
      else {
        const b = block(i + 1, /^end\s?ref$/i);
        text = b.text.map((s) => s.trim());
        i = b.next;
      }
      diagram.events.push({ t: 'ref', targets, text });
      continue;
    }
    if ((m = new RegExp(`^(${GROUP_KINDS.join('|')})\\b\\s*(?:#[\\w]+\\s*)?(.*)$`, 'i').exec(line))) {
      groupDepth++;
      diagram.events.push({ t: 'groupStart', kind: m[1].toLowerCase(), label: m[2].trim() });
      continue;
    }
    if ((m = /^else\b\s*(?:#\w+\s*)?(.*)$/i.exec(line))) {
      if (groupDepth === 0) diagram.warnings.push(`line ${i + 1}: else outside a group`);
      else diagram.events.push({ t: 'else', label: m[1].trim() });
      continue;
    }
    if (/^end$/i.test(line)) {
      if (groupDepth === 0) diagram.warnings.push(`line ${i + 1}: end without a group`);
      else {
        groupDepth--;
        diagram.events.push({ t: 'groupEnd' });
      }
      continue;
    }
    if ((m = /^activate\s+(\S+?)\s*(#[\w/\\|-]+)?$/i.exec(line))) {
      const who = ensure(m[1]);
      diagram.events.push({ t: 'activate', who, color: plantColor(m[2]) });
      if (lastMessage && lastMessage.to === who) calls.push({ who, caller: lastMessage.from });
      continue;
    }
    if ((m = /^deactivate\s+(\S+)$/i.exec(line))) {
      const who = ensure(m[1]);
      diagram.events.push({ t: 'deactivate', who });
      const idx = calls.map((c) => c.who).lastIndexOf(who);
      if (idx >= 0) calls.splice(idx, 1);
      continue;
    }
    if ((m = /^destroy\s+(\S+)$/i.exec(line))) {
      diagram.events.push({ t: 'destroy', who: ensure(m[1]) });
      continue;
    }
    if ((m = /^==+\s*(.*?)\s*==+$/.exec(line))) {
      diagram.events.push({ t: 'divider', label: m[1] });
      continue;
    }
    if ((m = /^\.\.\.+\s*(.*?)\s*(?:\.\.\.+)?$/.exec(line))) {
      diagram.events.push({ t: 'delay', label: m[1] });
      continue;
    }
    if ((m = /^\|\|(\d*)\|\|?$/.exec(line))) {
      diagram.events.push({ t: 'space', px: m[1] ? Math.min(400, Number(m[1])) : 20 });
      continue;
    }
    if ((m = /^return\b\s*(.*)$/i.exec(line))) {
      const call = calls.pop();
      if (!call) {
        diagram.warnings.push(`line ${i + 1}: return without an activation`);
        continue;
      }
      const msg: Extract<SeqEvent, { t: 'msg' }> = {
        t: 'msg',
        from: call.who,
        to: call.caller,
        label: m[1] ? splitLabel(m[1]) : [],
        dashed: true,
        head: 'open',
        tail: 'none',
      };
      if (autonumber?.on) {
        msg.number = String(autonumber.next);
        autonumber.next += autonumber.step;
      }
      diagram.events.push(msg);
      diagram.events.push({ t: 'deactivate', who: call.who });
      lastMessage = msg;
      continue;
    }
    diagram.warnings.push(`line ${i + 1}: not understood: ${line}`);
  }
  while (groupDepth-- > 0) diagram.events.push({ t: 'groupEnd' });
  // edge pseudo-participants: '[' first, ']' last
  diagram.participants.sort((a, b) => rank(a) - rank(b));
  return diagram;
}

function rank(p: SeqParticipant): number {
  return p.id === '[' && p.kind === 'edge' ? -1 : p.id === ']' && p.kind === 'edge' ? 1 : 0;
}

// ---------------------------------------------------------------------------------- layout + SVG

const FONT = 13;
const LINE = 16;
const FONT_FAMILY = 'Helvetica, Arial, sans-serif';
const COLORS = {
  participantFill: '#E2E2F0',
  stroke: '#181818',
  noteFill: '#FEFFDD',
  groupHeader: '#EEEEEE',
  text: '#000000',
};

/** Approximate text width in px (no canvas: works in workers, jsdom and the export). */
export function textWidth(text: string, size = FONT): number {
  let w = 0;
  for (const ch of text) {
    if (/[iljtf.,:;|!'`]/.test(ch)) w += 0.3;
    else if (ch === ' ') w += 0.3;
    else if (/[mwMW]/.test(ch)) w += 0.85;
    else if (/[A-Z]/.test(ch)) w += 0.68;
    else if (/[0-9]/.test(ch)) w += 0.56;
    else if (/[a-z]/.test(ch)) w += 0.53;
    else w += 0.6;
  }
  return Math.ceil(w * size);
}

function linesWidth(lines: string[], size = FONT): number {
  return lines.reduce((max, l) => Math.max(max, textWidth(l, size)), 0);
}

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface Activation {
  who: string;
  start: number;
  end: number;
  level: number;
  color?: string;
}

interface GroupFrame {
  kind: string;
  label: string;
  top: number;
  bottom: number;
  elses: Array<{ y: number; label: string }>;
  minX: number;
  maxX: number;
  depth: number;
}

export interface SequenceSvgResult {
  svg: string;
  width: number;
  height: number;
  warnings: string[];
}

/** Renders PlantUML sequence-diagram text to a standalone SVG string. Throws PlantUmlSyntaxError when empty. */
export function renderSequenceSvg(source: string): SequenceSvgResult {
  const d = parseSequenceDiagram(source);
  if (d.participants.length === 0 && d.events.length === 0) {
    throw new PlantUmlSyntaxError(d.warnings.length ? `No sequence diagram found (${d.warnings[0]})` : 'No sequence diagram found');
  }
  return layoutAndDraw(d);
}

function layoutAndDraw(d: SequenceDiagram): SequenceSvgResult {
  const ps = d.participants;
  const index = new Map(ps.map((p, i) => [p.id, i]));
  const n = ps.length;

  // ---- horizontal: participant widths and gaps between neighbouring lifelines
  const boxW = ps.map((p) => {
    if (p.kind === 'edge') return 0;
    const labelW = Math.max(linesWidth(p.label), p.stereotype ? textWidth(`«${p.stereotype}»`, FONT - 2) : 0);
    return p.kind === 'participant' || p.kind === 'collections' || p.kind === 'queue' ? Math.max(labelW + 20, 46) : Math.max(labelW + 8, 40);
  });
  const gaps: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const edge = ps[i].kind === 'edge' || ps[i + 1].kind === 'edge';
    gaps.push(edge ? Math.max(boxW[i], boxW[i + 1]) / 2 + 40 : boxW[i] / 2 + boxW[i + 1] / 2 + 24);
  }
  let leftExtra = 0;
  let rightExtra = 0;
  const constraints: Array<{ a: number; b: number; d: number }> = [];
  const msgLabelW = (lines: string[], num?: string): number => linesWidth(lines) + (num ? textWidth(num) + 8 : 0);
  for (const e of d.events) {
    if (e.t === 'msg') {
      const a = index.get(e.from)!;
      const b = index.get(e.to)!;
      const w = msgLabelW(e.label, e.number);
      if (a === b) {
        if (a < n - 1) constraints.push({ a, b: a + 1, d: w + 54 });
        else rightExtra = Math.max(rightExtra, w + 54);
      } else {
        constraints.push({ a: Math.min(a, b), b: Math.max(a, b), d: w + 30 });
      }
    } else if (e.t === 'note' || e.t === 'ref') {
      const w = linesWidth(e.text) + (e.t === 'ref' ? 30 : 24);
      const idx = e.targets.map((t) => index.get(t)!).sort((x, y) => x - y);
      const lo = idx[0];
      const hi = idx[idx.length - 1];
      if (e.t === 'note' && e.pos === 'right') {
        if (lo < n - 1) constraints.push({ a: lo, b: lo + 1, d: w + 24 });
        else rightExtra = Math.max(rightExtra, w + 16);
      } else if (e.t === 'note' && e.pos === 'left') {
        if (lo > 0) constraints.push({ a: lo - 1, b: lo, d: w + 24 });
        else leftExtra = Math.max(leftExtra, w + 16 - boxW[0] / 2);
      } else if (lo === hi) {
        // over one participant: centred on it
        if (lo > 0) constraints.push({ a: lo - 1, b: lo, d: w / 2 + boxW[lo - 1] / 2 + 10 });
        else leftExtra = Math.max(leftExtra, w / 2 - boxW[0] / 2);
        if (lo < n - 1) constraints.push({ a: lo, b: lo + 1, d: w / 2 + boxW[lo + 1] / 2 + 10 });
        else rightExtra = Math.max(rightExtra, w / 2 - boxW[lo] / 2);
      } else {
        constraints.push({ a: lo, b: hi, d: w - 30 });
      }
    }
  }
  constraints.sort((x, y) => x.b - x.a - (y.b - y.a));
  for (const c of constraints) {
    let span = 0;
    for (let k = c.a; k < c.b; k++) span += gaps[k];
    if (span < c.d) gaps[c.b - 1] += c.d - span;
  }
  const margin = 12;
  const xs: number[] = [];
  let x = margin + Math.max(0, leftExtra) + (n ? boxW[0] / 2 : 0);
  for (let i = 0; i < n; i++) {
    xs.push(Math.round(x));
    if (i < n - 1) x += gaps[i];
  }

  // ---- vertical
  const out: string[] = [];
  let y = margin;
  const titleTop = y;
  let maxRight = n ? xs[n - 1] + boxW[n - 1] / 2 + rightExtra : 100;
  let minLeft = margin;
  if (d.title.length) {
    maxRight = Math.max(maxRight, margin + linesWidth(d.title, FONT + 2) + margin);
    y += d.title.length * (LINE + 2) + 12;
  }
  const headerH = Math.max(
    30,
    ...ps.map((p) => participantHeight(p))
  );
  const headTop = y;
  y += headerH;
  const lifelineTop = y;
  y += 18;

  const level = new Map<string, Array<{ start: number; color?: string }>>();
  const activations: Activation[] = [];
  const destroyed = new Map<string, number>();
  const delays: Array<{ top: number; bottom: number; label: string }> = [];
  const dividers: Array<{ y: number; label: string }> = [];
  const groups: GroupFrame[] = [];
  const openGroups: GroupFrame[] = [];
  let lastMsgY: number | null = null;

  const touch = (x1: number, x2: number): void => {
    for (const g of openGroups) {
      g.minX = Math.min(g.minX, x1);
      g.maxX = Math.max(g.maxX, x2);
    }
    maxRight = Math.max(maxRight, x2);
    minLeft = Math.min(minLeft, x1);
  };
  const levelOf = (who: string): number => level.get(who)?.length ?? 0;
  const activate = (who: string, at: number, color?: string): void => {
    const stack = level.get(who) ?? [];
    stack.push({ start: at, color });
    level.set(who, stack);
  };
  const deactivate = (who: string, at: number): void => {
    const stack = level.get(who);
    const top = stack?.pop();
    if (top) activations.push({ who, start: top.start, end: at, level: (stack?.length ?? 0) + 1, color: top.color });
  };
  /** x where a message touches participant `who` arriving from/leaving to the given side. */
  const attach = (who: string, side: 'left' | 'right'): number => {
    const i = index.get(who)!;
    if (ps[i].kind === 'edge') return xs[i];
    const lv = levelOf(who);
    if (lv === 0) return xs[i];
    return side === 'left' ? xs[i] - 5 + (lv - 1) * 5 : xs[i] + 5 + (lv - 1) * 5;
  };

  for (const e of d.events) {
    switch (e.t) {
      case 'msg': {
        const a = index.get(e.from)!;
        const b = index.get(e.to)!;
        const label = e.label;
        const labelH = Math.max(1, label.length) * LINE;
        const stroke = e.color ?? COLORS.stroke;
        const dash = e.dashed ? ' stroke-dasharray="5,5"' : '';
        const numW = e.number ? textWidth(e.number) + 8 : 0;
        if (a === b) {
          const msgY = y + labelH;
          const x0 = attach(e.from, 'right');
          if (e.suffix === '++') activate(e.to, msgY + 14, e.activationColor);
          const x1 = attach(e.to, 'right');
          const loopX = Math.max(x0, x1) + 32;
          out.push(
            `<polyline points="${x0},${msgY} ${loopX},${msgY} ${loopX},${msgY + 14} ${x1},${msgY + 14}" fill="none" stroke="${stroke}"${dash}/>`
          );
          out.push(arrowHead(x1, msgY + 14, -1, e.head, stroke));
          out.push(messageLabel(x0 + 6, msgY - 4 - (label.length - 1) * LINE, label, e.number, 'start'));
          touch(x0, Math.max(loopX, x0 + 6 + numW + linesWidth(label)));
          lastMsgY = msgY;
          y = msgY + 14 + 14;
        } else {
          const msgY = y + labelH;
          const dir = b > a ? 1 : -1;
          if (e.suffix === '++') activate(e.to, msgY, e.activationColor);
          if (e.suffix === '**') activate(e.to, msgY);
          const x0 = attach(e.from, dir > 0 ? 'right' : 'left');
          let x1 = attach(e.to, dir > 0 ? 'left' : 'right');
          if (e.head === 'lost' || e.head === 'circle') x1 -= dir * 8;
          const tailX = e.tail === 'circle' || e.tail === 'lost' ? x0 + dir * 8 : x0;
          out.push(`<line x1="${tailX}" y1="${msgY}" x2="${x1}" y2="${msgY}" stroke="${stroke}"${dash}/>`);
          out.push(arrowHead(x1, msgY, dir, e.head, stroke));
          if (e.tail !== 'none') out.push(arrowHead(tailX, msgY, -dir, e.tail, stroke));
          const lx = Math.min(x0, x1) + (dir > 0 ? 6 : 10);
          out.push(messageLabel(lx, msgY - 4 - (label.length - 1) * LINE, label, e.number, 'start'));
          touch(Math.min(x0, x1), Math.max(x0, x1, lx + numW + linesWidth(label)));
          if (e.suffix === '--') deactivate(e.from, msgY);
          if (e.suffix === '!!') destroyed.set(e.to, msgY);
          lastMsgY = msgY;
          y = msgY + 14;
        }
        break;
      }
      case 'note': {
        const w = linesWidth(e.text) + 20;
        const h = Math.max(1, e.text.length) * LINE + 10;
        const idx = e.targets.map((t) => index.get(t)!).sort((p, q) => p - q);
        const lo = idx[0];
        const hi = idx[idx.length - 1];
        let left: number;
        let width = w;
        if (e.pos === 'right') left = xs[lo] + 8 + levelOf(ps[lo].id) * 5;
        else if (e.pos === 'left') left = xs[lo] - 8 - w;
        else if (lo === hi) left = xs[lo] - w / 2;
        else {
          left = xs[lo] - 20;
          width = Math.max(w, xs[hi] - xs[lo] + 40);
        }
        const top = y;
        out.push(noteShape(left, top, width, h, e.shape, e.color ?? COLORS.noteFill));
        out.push(textLines(left + 8, top + LINE + 1, e.text, 'start'));
        touch(left, left + width);
        y = top + h + 10;
        break;
      }
      case 'ref': {
        const idx = e.targets.map((t) => index.get(t)!).sort((p, q) => p - q);
        const lo = idx[0];
        const hi = idx[idx.length - 1];
        const tw = linesWidth(e.text) + 30;
        const left = Math.min(xs[lo] - 20, (xs[lo] + xs[hi]) / 2 - tw / 2);
        const width = Math.max(xs[hi] - xs[lo] + 40, tw);
        const h = Math.max(1, e.text.length) * LINE + 26;
        const top = y;
        out.push(`<rect x="${left}" y="${top}" width="${width}" height="${h}" fill="#FFFFFF" stroke="${COLORS.stroke}" stroke-width="1.5"/>`);
        out.push(`<path d="M${left},${top} h34 v10 l-8,8 h-26 z" fill="${COLORS.groupHeader}" stroke="${COLORS.stroke}"/>`);
        out.push(`<text x="${left + 5}" y="${top + 13}" font-weight="bold" font-size="${FONT - 1}">ref</text>`);
        out.push(textLines(left + width / 2, top + 20 + LINE, e.text, 'middle'));
        touch(left, left + width);
        y = top + h + 10;
        break;
      }
      case 'groupStart': {
        y += 6;
        const frame: GroupFrame = {
          kind: e.kind,
          label: e.label,
          top: y,
          bottom: y,
          elses: [],
          minX: Infinity,
          maxX: -Infinity,
          depth: openGroups.length,
        };
        openGroups.push(frame);
        groups.push(frame);
        y += 26;
        break;
      }
      case 'else': {
        const g = openGroups[openGroups.length - 1];
        if (g) {
          y += 6;
          g.elses.push({ y, label: e.label });
          y += 20;
        }
        break;
      }
      case 'groupEnd': {
        const g = openGroups.pop();
        if (g) {
          y += 6;
          g.bottom = y;
          y += 8;
          // the enclosing group contains this one (with room for the frame)
          for (const outer of openGroups) {
            outer.minX = Math.min(outer.minX, g.minX - 12);
            outer.maxX = Math.max(outer.maxX, g.maxX + 12);
          }
        }
        break;
      }
      case 'activate':
        activate(e.who, lastMsgY ?? y, e.color);
        touch(xs[index.get(e.who)!] - 5, xs[index.get(e.who)!] + 5);
        break;
      case 'deactivate':
        deactivate(e.who, lastMsgY ?? y);
        break;
      case 'destroy': {
        const at = lastMsgY ?? y;
        destroyed.set(e.who, at);
        while (levelOf(e.who) > 0) deactivate(e.who, at);
        break;
      }
      case 'divider': {
        y += 10;
        dividers.push({ y, label: e.label });
        y += 22;
        break;
      }
      case 'delay': {
        const top = y;
        y += e.label ? 34 : 26;
        delays.push({ top, bottom: y, label: e.label });
        break;
      }
      case 'space':
        y += e.px;
        break;
    }
  }
  const lifelineBottom = y + 12;
  for (const p of ps) while (levelOf(p.id) > 0) deactivate(p.id, destroyed.get(p.id) ?? lifelineBottom);

  // groups: frame around what was drawn inside (all lifelines when nothing was)
  const groupSvg: string[] = [];
  for (const g of groups) {
    const header = `${g.kind}`;
    const headerW = textWidth(header, FONT - 1) + 22;
    const labelW = g.label ? textWidth(`[${g.label}]`, FONT - 1) + 12 : 0;
    let x1 = Number.isFinite(g.minX) ? g.minX - 20 : (xs[0] ?? margin) - 20;
    let x2 = Number.isFinite(g.maxX) ? g.maxX + 20 : (xs[n - 1] ?? margin) + 20;
    for (const el of g.elses) x2 = Math.max(x2, x1 + textWidth(`[${el.label}]`, FONT - 1) + 20);
    x2 = Math.max(x2, x1 + headerW + labelW + 10);
    x1 = Math.max(2, x1);
    maxRight = Math.max(maxRight, x2);
    minLeft = Math.min(minLeft, x1);
    groupSvg.push(
      `<rect x="${x1}" y="${g.top}" width="${x2 - x1}" height="${g.bottom - g.top}" fill="none" stroke="${COLORS.stroke}" stroke-width="1.5"/>`,
      `<path d="M${x1},${g.top} h${headerW} v10 l-8,8 h-${headerW - 8} z" fill="${COLORS.groupHeader}" stroke="${COLORS.stroke}"/>`,
      `<text x="${x1 + 6}" y="${g.top + 13}" font-weight="bold" font-size="${FONT - 1}">${escapeXml(header)}</text>`
    );
    if (g.label) groupSvg.push(`<text x="${x1 + headerW + 8}" y="${g.top + 13}" font-weight="bold" font-size="${FONT - 1}">[${escapeXml(g.label)}]</text>`);
    for (const el of g.elses) {
      groupSvg.push(`<line x1="${x1}" y1="${el.y}" x2="${x2}" y2="${el.y}" stroke="${COLORS.stroke}" stroke-dasharray="2,2"/>`);
      if (el.label) groupSvg.push(`<text x="${x1 + 6}" y="${el.y + 14}" font-size="${FONT - 1}" font-weight="bold">[${escapeXml(el.label)}]</text>`);
    }
  }

  const width = Math.ceil(maxRight + margin);
  const footTop = lifelineBottom;
  const height = Math.ceil((d.footbox ? footTop + headerH : lifelineBottom) + margin);
  const centerX = Math.round(width / 2);

  // lifelines with gaps for delays
  const lifelines: string[] = [];
  ps.forEach((p, i) => {
    if (p.kind === 'edge') return;
    const end = destroyed.get(p.id) ?? lifelineBottom;
    let from = lifelineTop;
    for (const dl of delays) {
      if (dl.top >= end) break;
      lifelines.push(`<line x1="${xs[i]}" y1="${from}" x2="${xs[i]}" y2="${dl.top}" stroke="${COLORS.stroke}" stroke-dasharray="5,5"/>`);
      lifelines.push(`<line x1="${xs[i]}" y1="${dl.top}" x2="${xs[i]}" y2="${dl.bottom}" stroke="${COLORS.stroke}" stroke-dasharray="1,4"/>`);
      from = dl.bottom;
    }
    lifelines.push(`<line x1="${xs[i]}" y1="${from}" x2="${xs[i]}" y2="${end}" stroke="${COLORS.stroke}" stroke-dasharray="5,5"/>`);
    if (destroyed.has(p.id)) {
      lifelines.push(
        `<path d="M${xs[i] - 9},${end - 9} L${xs[i] + 9},${end + 9} M${xs[i] + 9},${end - 9} L${xs[i] - 9},${end + 9}" stroke="#A80036" stroke-width="2"/>`
      );
    }
  });
  const bars = activations.map(
    (a) =>
      `<rect x="${xs[index.get(a.who)!] - 5 + (a.level - 1) * 5}" y="${a.start}" width="10" height="${Math.max(6, a.end - a.start)}" fill="${a.color ?? '#FFFFFF'}" stroke="${COLORS.stroke}"/>`
  );
  const heads = ps.map((p, i) => (p.kind === 'edge' ? '' : participantShape(p, xs[i], headTop, headerH, boxW[i], 'top'))).join('');
  const foots = d.footbox
    ? ps.map((p, i) => (p.kind === 'edge' || destroyed.has(p.id) ? '' : participantShape(p, xs[i], footTop, headerH, boxW[i], 'bottom'))).join('')
    : '';

  const body =
    out.join('') +
    dividers.map((dv) => divider(dv.y, dv.label, width, centerX)).join('') +
    delays
      .filter((dl) => dl.label)
      .map((dl) => `<text x="${centerX}" y="${dl.top + 21}" text-anchor="middle" font-size="${FONT - 1}">${escapeXml(dl.label)}</text>`)
      .join('');
  const shift = minLeft < 2 ? Math.ceil(2 - minLeft) : 0;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="rd-uml-svg" width="${width + shift}" height="${height}" viewBox="${-shift} 0 ${width + shift} ${height}" ` +
    `font-family="${FONT_FAMILY}" font-size="${FONT}" fill="${COLORS.text}" role="img" aria-label="${escapeXml(d.title.join(' ') || 'Sequence diagram')}">` +
    `<rect x="${-shift}" y="0" width="${width + shift}" height="${height}" fill="#FFFFFF" stroke="none"/>` +
    d.title
      .map(
        (l, k) =>
          `<text x="${centerX}" y="${titleTop + (k + 1) * (LINE + 2)}" text-anchor="middle" font-size="${FONT + 2}" font-weight="bold">${escapeXml(l)}</text>`
      )
      .join('') +
    lifelines.join('') +
    bars.join('') +
    groupSvg.join('') +
    heads +
    foots +
    body +
    `</svg>`;
  return { svg, width: width + shift, height, warnings: d.warnings };
}

function participantHeight(p: SeqParticipant): number {
  const lines = Math.max(1, p.label.length) + (p.stereotype ? 1 : 0);
  switch (p.kind) {
    case 'edge':
      return 0;
    case 'participant':
    case 'collections':
    case 'queue':
      return lines * LINE + 14;
    case 'database':
      return 34 + lines * LINE;
    default:
      return 40 + lines * LINE;
  }
}

function textLines(x: number, y: number, lines: string[], anchor: 'start' | 'middle', extra = ''): string {
  if (lines.length === 0) return '';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}"${extra}>${lines
    .map((l, k) => `<tspan x="${x}" dy="${k === 0 ? 0 : LINE}">${escapeXml(l) || ' '}</tspan>`)
    .join('')}</text>`;
}

function messageLabel(x: number, y: number, lines: string[], num: string | undefined, anchor: 'start' | 'middle'): string {
  let out = '';
  let lx = x;
  if (num) {
    out += `<text x="${x}" y="${y}" font-weight="bold">${escapeXml(num)}</text>`;
    lx += textWidth(num) + 8;
  }
  return out + textLines(lx, y, lines, anchor);
}

function arrowHead(x: number, y: number, dir: number, head: ArrowHead, stroke: string): string {
  switch (head) {
    case 'closed':
      return `<polygon points="${x},${y} ${x - dir * 10},${y - 4} ${x - dir * 10},${y + 4}" fill="${stroke}" stroke="${stroke}"/>`;
    case 'open':
      return `<polyline points="${x - dir * 10},${y - 4} ${x},${y} ${x - dir * 10},${y + 4}" fill="none" stroke="${stroke}"/>`;
    case 'lost':
      return `<path d="M${x - 4},${y - 4} L${x + 4},${y + 4} M${x + 4},${y - 4} L${x - 4},${y + 4}" stroke="${stroke}" stroke-width="1.5"/>`;
    case 'circle':
      return `<circle cx="${x + dir * 4}" cy="${y}" r="4" fill="none" stroke="${stroke}"/>`;
    default:
      return '';
  }
}

function noteShape(x: number, y: number, w: number, h: number, shape: 'note' | 'hnote' | 'rnote', fill: string): string {
  if (shape === 'rnote') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${COLORS.stroke}"/>`;
  if (shape === 'hnote') {
    return `<polygon points="${x},${y + h / 2} ${x + 6},${y} ${x + w - 6},${y} ${x + w},${y + h / 2} ${x + w - 6},${y + h} ${x + 6},${y + h}" fill="${fill}" stroke="${COLORS.stroke}"/>`;
  }
  return (
    `<path d="M${x},${y} h${w - 8} l8,8 v${h - 8} h-${w} z" fill="${fill}" stroke="${COLORS.stroke}"/>` +
    `<path d="M${x + w - 8},${y} v8 h8" fill="none" stroke="${COLORS.stroke}"/>`
  );
}

function divider(y: number, label: string, width: number, centerX: number): string {
  const w = label ? textWidth(label) + 20 : 0;
  let s =
    `<line x1="4" y1="${y - 2}" x2="${width - 4}" y2="${y - 2}" stroke="${COLORS.stroke}"/>` +
    `<line x1="4" y1="${y + 2}" x2="${width - 4}" y2="${y + 2}" stroke="${COLORS.stroke}"/>`;
  if (label) {
    s +=
      `<rect x="${centerX - w / 2}" y="${y - 11}" width="${w}" height="22" fill="${COLORS.groupHeader}" stroke="${COLORS.stroke}" stroke-width="1.5"/>` +
      `<text x="${centerX}" y="${y + 5}" text-anchor="middle" font-weight="bold">${escapeXml(label)}</text>`;
  }
  return s;
}

function participantShape(p: SeqParticipant, cx: number, top: number, headerH: number, w: number, where: 'top' | 'bottom'): string {
  const fill = p.color ?? COLORS.participantFill;
  const stroke = COLORS.stroke;
  const lines = p.stereotype ? [`«${p.stereotype}»`, ...p.label] : p.label;
  const h = participantHeight(p);
  // top boxes sit on the lifeline (bottom aligned), bottom boxes hang from it
  const y0 = where === 'top' ? top + headerH - h : top;
  const label = (y: number): string => textLines(cx, y, lines, 'middle');
  switch (p.kind) {
    case 'participant':
    case 'queue':
      return `<rect x="${cx - w / 2}" y="${y0}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` + label(y0 + LINE + 2);
    case 'collections':
      return (
        `<rect x="${cx - w / 2 + 4}" y="${y0 - 4}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
        `<rect x="${cx - w / 2}" y="${y0}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
        label(y0 + LINE + 2)
      );
    case 'database': {
      const iconTop = where === 'top' ? y0 : y0 + lines.length * LINE + 4;
      const icon =
        `<path d="M${cx - 12},${iconTop + 5} a12,5 0 0,0 24,0 a12,5 0 0,0 -24,0 v20 a12,5 0 0,0 24,0 v-20" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
        `<path d="M${cx - 12},${iconTop + 5} a12,5 0 0,0 24,0" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
      return icon + label(where === 'top' ? y0 + 34 + LINE - 4 : y0 + LINE - 2);
    }
    default: {
      // actor, boundary, control, entity: icon with the label below (top) or above (bottom)
      const iconTop = where === 'top' ? y0 : y0 + lines.length * LINE + 4;
      let icon: string;
      if (p.kind === 'actor') {
        icon =
          `<circle cx="${cx}" cy="${iconTop + 7}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
          `<path d="M${cx},${iconTop + 13} v14 M${cx - 10},${iconTop + 18} h20 M${cx},${iconTop + 27} l-8,9 M${cx},${iconTop + 27} l8,9" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
      } else if (p.kind === 'boundary') {
        icon =
          `<circle cx="${cx + 4}" cy="${iconTop + 18}" r="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
          `<path d="M${cx - 14},${iconTop + 6} v24 M${cx - 14},${iconTop + 18} h6" stroke="${stroke}" stroke-width="1.5"/>`;
      } else if (p.kind === 'control') {
        icon =
          `<circle cx="${cx}" cy="${iconTop + 20}" r="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
          `<path d="M${cx + 2},${iconTop + 4} l-6,4 l6,4" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
      } else {
        icon =
          `<circle cx="${cx}" cy="${iconTop + 16}" r="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
          `<path d="M${cx - 12},${iconTop + 32} h24" stroke="${stroke}" stroke-width="1.5"/>`;
      }
      return icon + label(where === 'top' ? y0 + 40 + LINE - 4 : y0 + LINE - 2);
    }
  }
}
