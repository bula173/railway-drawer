/**
 * @file etcs-dialog.ts
 * @brief "ETCS data…" of a balise group (lazy chunk; Railway menu, context menu, Data panel): a
 *        modal (core/modal.ts) with the telegram header, the packet list (add / remove / move),
 *        a form per packet generated from the packet schema (types, units, ranges, enums, help
 *        EN/PL, iterations, conditional variables), live validation, "Recompute from drawing"
 *        (values from the drawing marked, hand-set values kept and differences flagged), the
 *        telegram of each balise (N_PIG, M_DUP, bits, hex) and a JSON download. Save stores the
 *        data on the group (one undoable edit; refused while there are errors).
 */
import type { Cell, GraphDataModel } from '@maxgraph/core';
import { openModal } from '../../core/modal';
import { readObjectId } from '../object-data';
import type { RailwayNotifier } from '../install-railway-data';
import './etcs-dialog.css';
import type { EtcsBlock, EtcsGroupData, EtcsPacket, EtcsProblem, EtcsValue } from './etcs-data';
import {
  EDITABLE_PACKETS,
  baliseHeaderValue,
  buildTelegrams,
  cloneEtcsData,
  emptyEtcsData,
  formatValue,
  newIterEntry,
  newPacket,
  numericValue,
  packetLength,
  readEtcsData,
  serializeEtcsData,
  setEtcsData,
  validateEtcsData,
} from './etcs-data';
import { etcsEnvFromModel } from './etcs-compute';
import type { Mismatch } from './etcs-recompute';
import { recomputeGroup, setPath } from './etcs-recompute';
import type { PacketItem, StoredHeaderVar, VarDef } from './etcs-schema';
import { STORED_HEADER_VARS, TELEGRAM_CAPACITY, VARS, getPacketDef, itemKey } from './etcs-schema';
import { varHelp } from './etcs-help';

export interface EtcsDialogOptions {
  model: GraphDataModel;
  cell: Cell;
  notify: RailwayNotifier;
  download: (blob: Blob, fileName: string) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string, onClick: () => void, label?: string): HTMLButtonElement {
  const b = el('button', `rd-route-btn ${className}`, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

const DIR_LABEL = ['reverse', 'nominal', 'both'];

/** Text of an input -> stored value ('' removes it). */
function parseInput(d: VarDef, text: string): EtcsValue | undefined {
  const t = text.trim();
  if (t === '') return undefined;
  if (d.kind === 'text' || d.kind === 'bits') return text;
  const special = d.specials?.find((s) => s.key === t);
  if (special) return special.key;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : t;
}

/** Opens the dialog for the balise group `cell`; returns a function that closes it. */
export function openEtcsDialog(options: EtcsDialogOptions): () => void {
  const { model, cell } = options;
  document.querySelector('.rd-route-dialog-overlay')?.remove();
  const env0 = etcsEnvFromModel(model);
  const groupId = readObjectId(cell) || `cell ${String(cell.getId())}`;
  // the group's context (NID_C, NID_BG, N_TOTAL, orientation) does not change while the modal is open
  const g0 = env0.byCell.get(String(cell.getId()))!;
  const stored = readEtcsData(cell);
  let data: EtcsGroupData = stored.data ? cloneEtcsData(stored.data) : emptyEtcsData();
  let selected = data.packets.length > 0 ? 0 : -1;
  let mismatches: Mismatch[] = [];
  let view: 'packets' | 'telegrams' = 'packets';

  const overlay = el('div', 'rd-route-dialog-overlay');
  const dialog = el('div', 'rd-route-dialog rd-etcs-dialog');
  dialog.dataset.testid = 'etcs-dialog';
  overlay.append(dialog);
  const title = el('h3', 'rd-route-dialog-title', `ETCS data — balise group ${groupId}`);
  const sub = el('p', 'rd-etcs-sub');
  const ctx = g0.ctx;
  sub.textContent = [
    `NID_C ${ctx.nidC ?? '?'}`,
    `NID_BG ${ctx.nidBg ?? '?'}`,
    `${ctx.nTotal + 1} balise${ctx.nTotal === 0 ? '' : 's'} (N_TOTAL ${ctx.nTotal})`,
    `orientation ${g0.orientation ?? 'unknown'}`,
    g0.o.values.km ? `km ${g0.o.values.km}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const tabs = el('div', 'rd-route-tabs');
  tabs.setAttribute('role', 'tablist');
  const tabButtons = (['packets', 'telegrams'] as const).map((id) => {
    const b = el('button', 'rd-route-tab', id === 'packets' ? 'Header & packets' : 'Telegrams per balise');
    b.type = 'button';
    b.dataset.tab = id;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => {
      view = id;
      render();
    });
    tabs.append(b);
    return b;
  });
  const content = el('div', 'rd-route-dialog-content rd-etcs-content');
  const problemsBox = el('div', 'rd-etcs-problems');
  problemsBox.setAttribute('role', 'alert');
  const resultBox = el('div', 'rd-etcs-result');
  resultBox.setAttribute('aria-live', 'polite');
  const error = el('p', 'rd-rules-error rd-etcs-error');
  error.setAttribute('role', 'alert');

  const actions = el('div', 'rd-route-dialog-actions');
  const recompute = button('Recompute from drawing', 'rd-etcs-recompute', () => doRecompute());
  recompute.title = 'Fill D_LINK, L_ENDSECTION, gradient and speed profile from the drawing (metres from track length / km); hand-set values are kept and differences flagged';
  const json = button('Export JSON', 'rd-etcs-json', () => {
    options.download(new Blob([JSON.stringify({ group: groupId, nidC: ctx.nidC, nidBg: ctx.nidBg, ...JSON.parse(serializeEtcsData(data)) }, null, 2)], { type: 'application/json' }), `${groupId}-etcs.json`);
  });
  const cancel = button('Cancel', 'rd-route-dialog-close', () => close());
  const save = button('Save', 'rd-route-create rd-etcs-save', () => doSave());
  actions.append(recompute, json, el('span', 'rd-etcs-spacer'), cancel, save);
  dialog.append(title, sub, tabs, content, problemsBox, resultBox, error, actions);

  // ---- helpers bound to the working copy
  const currentPacket = (): EtcsPacket | null => data.packets[selected] ?? null;
  const markManual = (p: EtcsPacket, path: string): void => {
    if (p.auto) p.auto = p.auto.filter((a) => a !== path);
    mismatches = mismatches.filter((m) => !(m.packet === data.packets.indexOf(p) && m.path === path));
  };
  let problems: EtcsProblem[] = [];
  const revalidate = (): void => {
    problems = validateEtcsData(data, ctx);
    const errors = problems.filter((p) => p.severity === 'error');
    const warnings = problems.filter((p) => p.severity === 'warning');
    // a refused Save's message goes once the errors are fixed
    if (errors.length === 0 && error.textContent?.startsWith('Not saved')) error.textContent = '';
    problemsBox.replaceChildren();
    if (problems.length > 0) {
      problemsBox.append(el('div', 'rd-etcs-problems-title', `${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`));
      const list = el('ul');
      for (const p of problems.slice(0, 12)) list.append(el('li', `rd-rw-problem-${p.severity}`, p.message));
      problemsBox.append(list);
    }
    // field marks
    content.querySelectorAll<HTMLElement>('[data-path]').forEach((input) => {
      const path = `packets.${selected}.${input.dataset.path}`;
      const bad = problems.some((p) => p.severity === 'error' && p.path === path);
      input.classList.toggle('rd-rw-invalid', bad);
      if (bad) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
    content.querySelectorAll<HTMLElement>('[data-header]').forEach((input) => {
      const bad = problems.some((p) => p.severity === 'error' && p.path === `header.${input.dataset.header}`);
      input.classList.toggle('rd-rw-invalid', bad);
    });
    content.querySelectorAll<HTMLElement>('.rd-etcs-packet-item').forEach((li) => {
      const i = Number(li.dataset.index);
      li.classList.toggle('rd-etcs-has-error', problems.some((p) => p.severity === 'error' && (p.path === `packets.${i}` || p.path.startsWith(`packets.${i}.`))));
    });
  };

  // ---- field rendering
  function fieldRow(d: VarDef, label: string, value: EtcsValue | undefined, attrs: Record<string, string>, onValue: (v: EtcsValue | undefined) => void, extra?: HTMLElement[]): HTMLElement {
    const row = el('div', 'rd-etcs-row');
    const id = `rd-etcs-${Object.values(attrs).join('-').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const lab = el('label', 'rd-etcs-label', d.unit ? `${label} [${d.unit}]` : label);
    lab.htmlFor = id;
    let input: HTMLInputElement | HTMLSelectElement;
    if (d.kind === 'enum') {
      const s = el('select', 'rd-rw-input rd-etcs-input');
      if (value === undefined) {
        const empty = el('option', undefined, '—');
        empty.value = '';
        s.append(empty);
      }
      for (const o of d.options ?? []) {
        const opt = el('option', undefined, `${o.v} – ${o.label.en}`);
        opt.value = String(o.v);
        s.append(opt);
      }
      const n = numericValue(value);
      if (n !== null && !(d.options ?? []).some((o) => o.v === n)) {
        const unknown = el('option', undefined, `${n} (unknown)`);
        unknown.value = String(n);
        s.append(unknown);
      }
      s.value = value === undefined ? '' : String(value);
      s.addEventListener('change', () => onValue(s.value === '' ? undefined : Number(s.value)));
      input = s;
    } else {
      const i = el('input', 'rd-rw-input rd-etcs-input');
      i.type = 'text';
      i.autocomplete = 'off';
      i.spellcheck = false;
      if (d.kind !== 'text' && d.kind !== 'bits') i.inputMode = 'decimal';
      i.value = value === undefined ? '' : String(value);
      const range = d.min !== undefined && d.max !== undefined ? `${d.min}–${d.max}${d.unit ? ` ${d.unit}` : ''}` : '';
      const specials = (d.specials ?? []).map((s) => `"${s.key}" = ${s.label.en}`).join(', ');
      i.placeholder = [range, specials ? (d.specials ?? []).map((s) => s.key).join(' / ') : ''].filter(Boolean).join(' or ');
      i.title = [range && `Range ${range}`, specials && `Special: ${specials}`].filter(Boolean).join(' · ');
      i.addEventListener('change', () => onValue(parseInput(d, i.value)));
      i.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          i.dispatchEvent(new Event('change'));
        }
      });
      input = i;
    }
    input.id = id;
    for (const [k, v] of Object.entries(attrs)) input.dataset[k] = v;
    const help = varHelp(d.name, 'en');
    const helpPl = varHelp(d.name, 'pl');
    row.append(lab, input, ...(extra ?? []));
    if (d.uncertain) row.append(el('span', 'rd-etcs-uncertain', 'check spec'));
    if (help) {
      const hint = el('div', 'rd-etcs-help');
      hint.append(el('span', undefined, help));
      if (helpPl) {
        const pl = el('span', 'rd-etcs-help-pl', ` ${helpPl}`);
        pl.lang = 'pl';
        hint.append(pl);
      }
      row.append(hint);
    }
    return row;
  }

  function packetField(p: EtcsPacket, index: number, item: { v: string; key?: string }, block: EtcsBlock, prefix: string): HTMLElement {
    const d = VARS[item.v];
    const key = itemKey(item);
    const path = prefix + key;
    const value = block[key] as EtcsValue | undefined;
    const extra: HTMLElement[] = [];
    if (p.auto?.includes(path)) {
      const badge = el('span', 'rd-etcs-auto', 'from drawing');
      badge.title = 'Filled by "Recompute from drawing"; an edit makes it a hand-set value';
      extra.push(badge);
    }
    const mm = mismatches.find((m) => m.packet === index && m.path === path);
    if (mm) {
      const box = el('span', 'rd-etcs-mismatch', `drawing: ${formatValue(d, mm.computed)}`);
      box.append(
        button('Use', 'rd-etcs-use', () => {
          setPath(p.vars, path, mm.computed);
          p.auto = [...new Set([...(p.auto ?? []), path])];
          mismatches = mismatches.filter((m) => m !== mm);
          render();
        }, `Use the drawing value for ${key}`)
      );
      extra.push(box);
    }
    return fieldRow(d, key === item.v ? key : `${item.v} (${key.endsWith('_END') ? 'end' : key})`, value, { path, var: item.v }, (v) => {
      setPath(p.vars, path, v);
      markManual(p, path);
      // conditional variables follow their control value
      if (d.kind === 'enum') render();
      else revalidate();
    }, extra);
  }

  function renderItems(p: EtcsPacket, index: number, items: PacketItem[], block: EtcsBlock, prefix: string, iterPath: string[], into: HTMLElement): void {
    for (const it of items) {
      if ('v' in it) into.append(packetField(p, index, it, block, prefix));
      else if ('if' in it) {
        const ctl = numericValue(block[it.if] as EtcsValue) ?? numericValue(VARS[it.if]?.def);
        if (ctl !== null && it.in.includes(ctl)) renderItems(p, index, it.items, block, prefix, iterPath, into);
      } else {
        const entries = (Array.isArray(block[it.iter]) ? block[it.iter] : (block[it.iter] = [])) as EtcsBlock[];
        const fs = el('fieldset', 'rd-etcs-iter');
        fs.dataset.iter = prefix + it.iter;
        const legend = el('legend', undefined, `${it.label.en} · N_ITER = ${entries.length}`);
        legend.title = it.label.pl;
        fs.append(legend);
        entries.forEach((entry, i) => {
          const sub = el('div', 'rd-etcs-entry');
          sub.dataset.entry = `${prefix}${it.iter}.${i}`;
          const head = el('div', 'rd-etcs-entry-head');
          head.append(
            el('span', undefined, `${it.iter} ${i + 1}`),
            button('Remove', 'rd-etcs-entry-remove', () => {
              entries.splice(i, 1);
              p.auto = (p.auto ?? []).filter((a) => !a.startsWith(`${prefix}${it.iter}.`));
              render();
            }, `Remove ${it.iter} ${i + 1}`)
          );
          sub.append(head);
          renderItems(p, index, it.items, entry, `${prefix}${it.iter}.${i}.`, [...iterPath, it.iter], sub);
          fs.append(sub);
        });
        fs.append(
          button(`+ Add ${it.iter.replace(/s$/, '')}`, 'rd-etcs-entry-add', () => {
            entries.push(newIterEntry(p.nid, it.iter, iterPath));
            render();
          })
        );
        into.append(fs);
      }
    }
  }

  // ---- views
  function renderHeader(): HTMLElement {
    const fs = el('fieldset', 'rd-etcs-header');
    fs.append(el('legend', undefined, 'Telegram header'));
    const grid = el('div', 'rd-etcs-grid');
    const c = ctx;
    for (const name of STORED_HEADER_VARS) {
      const d = VARS[name];
      grid.append(
        fieldRow(d, name, data.header[name], { header: name }, (v) => {
          if (v === undefined) delete data.header[name];
          else data.header[name] = v;
          revalidate();
        })
      );
    }
    const fixed = el('div', 'rd-etcs-fixed');
    fixed.textContent = `From the drawing: NID_C ${c.nidC ?? '— (set it)'}, NID_BG ${c.nidBg ?? '— (set it)'}, N_TOTAL ${c.nTotal}, N_PIG 0–${c.nTotal} (per balise)`;
    fs.append(grid, fixed);
    return fs;
  }

  function renderPacketList(): HTMLElement {
    const box = el('div', 'rd-etcs-list');
    box.append(el('div', 'rd-etcs-list-title', 'Packets'));
    const ul = el('ul', 'rd-etcs-packets');
    ul.setAttribute('role', 'listbox');
    ul.setAttribute('aria-label', 'Packets');
    data.packets.forEach((p, i) => {
      const def = getPacketDef(p.nid);
      const li = el('li', 'rd-etcs-packet-item');
      li.dataset.index = String(i);
      li.dataset.nid = String(p.nid);
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === selected));
      li.tabIndex = 0;
      const dir = def?.qdir ? DIR_LABEL[numericValue(p.vars.Q_DIR as EtcsValue) ?? 1] ?? '?' : '';
      li.append(el('span', 'rd-etcs-nid', String(p.nid)), el('span', 'rd-etcs-pname', def ? def.name.en : 'unknown packet'), el('span', 'rd-etcs-pdir', dir));
      const choose = (): void => {
        selected = i;
        render();
      };
      li.addEventListener('click', choose);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          choose();
        }
      });
      ul.append(li);
    });
    if (data.packets.length === 0) ul.append(el('li', 'rd-etcs-empty', 'No packets yet (255 ends every telegram).'));
    const add = el('div', 'rd-etcs-add-row');
    const select = el('select', 'rd-rw-input rd-etcs-add-select');
    select.setAttribute('aria-label', 'Packet to add');
    for (const nid of EDITABLE_PACKETS) {
      const o = el('option', undefined, `${nid} – ${getPacketDef(nid)!.name.en}`);
      o.value = String(nid);
      select.append(o);
    }
    add.append(
      select,
      button('Add', 'rd-etcs-add', () => {
        data.packets.push(newPacket(Number(select.value)));
        selected = data.packets.length - 1;
        render();
      })
    );
    const move = el('div', 'rd-etcs-move');
    const p = currentPacket();
    const up = button('↑', 'rd-etcs-up', () => swap(selected, selected - 1), 'Move packet up');
    const down = button('↓', 'rd-etcs-down', () => swap(selected, selected + 1), 'Move packet down');
    const remove = button('Remove', 'rd-etcs-remove', () => {
      data.packets.splice(selected, 1);
      mismatches = mismatches.filter((m) => m.packet !== selected).map((m) => (m.packet > selected ? { ...m, packet: m.packet - 1 } : m));
      selected = Math.min(selected, data.packets.length - 1);
      render();
    }, 'Remove packet');
    up.disabled = !p || selected === 0;
    down.disabled = !p || selected >= data.packets.length - 1;
    remove.disabled = !p;
    move.append(up, down, remove);
    box.append(ul, add, move);
    return box;
  }

  function swap(a: number, b: number): void {
    if (b < 0 || b >= data.packets.length) return;
    [data.packets[a], data.packets[b]] = [data.packets[b], data.packets[a]];
    mismatches = mismatches.map((m) => (m.packet === a ? { ...m, packet: b } : m.packet === b ? { ...m, packet: a } : m));
    selected = b;
    render();
  }

  function renderPacketForm(): HTMLElement {
    const form = el('div', 'rd-etcs-form');
    const p = currentPacket();
    if (!p) {
      form.append(el('p', 'rd-il-note', 'Add a packet (e.g. 5 Linking, 27 Static speed profile), then fill it or press "Recompute from drawing".'));
      return form;
    }
    const def = getPacketDef(p.nid);
    form.dataset.nid = String(p.nid);
    form.append(el('div', 'rd-etcs-form-title', def ? `Packet ${p.nid}: ${def.name.en} / ${def.name.pl}` : `Packet ${p.nid}`));
    if (!def) return form;
    if (def.uncertain) form.append(el('p', 'rd-etcs-uncertain-note', `Check against the specification: ${def.uncertain}`));
    if (def.qdir) form.append(packetField(p, selected, { v: 'Q_DIR' }, p.vars, ''));
    if (def.scale) form.append(packetField(p, selected, { v: 'Q_SCALE' }, p.vars, ''));
    // balises carrying the packet
    const c = ctx;
    if (c.nTotal > 0) {
      const row = el('div', 'rd-etcs-row rd-etcs-pigs');
      row.append(el('span', 'rd-etcs-label', 'In balises (N_PIG)'));
      for (let pig = 0; pig <= c.nTotal; pig++) {
        const lab = el('label', 'rd-etcs-pig');
        const box = el('input');
        box.type = 'checkbox';
        box.dataset.pig = String(pig);
        box.checked = !p.pig || p.pig.length === 0 || p.pig.includes(pig);
        box.addEventListener('change', () => {
          const all = Array.from(row.querySelectorAll<HTMLInputElement>('input[data-pig]'));
          const on = all.filter((b) => b.checked).map((b) => Number(b.dataset.pig));
          p.pig = on.length === all.length ? undefined : on;
          revalidate();
        });
        lab.append(box, el('span', undefined, ` ${pig}`));
        row.append(lab);
      }
      form.append(row);
    }
    renderItems(p, selected, def.items, p.vars, '', [], form);
    form.append(el('div', 'rd-etcs-len', `L_PACKET = ${packetLength(p)} bits`));
    return form;
  }

  function renderTelegrams(): HTMLElement {
    const box = el('div', 'rd-etcs-telegrams');
    const c = ctx;
    for (const t of buildTelegrams(data, c)) {
      const sec = el('section', 'rd-etcs-telegram');
      sec.dataset.pig = String(t.pig);
      const over = t.bits > TELEGRAM_CAPACITY.long;
      sec.append(el('h4', undefined, `Balise ${t.pig + 1} — N_PIG ${t.pig}${t.pig === 0 ? ' (location reference)' : ''}`));
      const head = el('div', 'rd-etcs-grid');
      for (const name of ['M_DUP', 'M_MCOUNT'] as StoredHeaderVar[]) {
        head.append(
          fieldRow(VARS[name], name, baliseHeaderValue(data, t.pig, name), { baliseHeader: `${t.pig}-${name}` }, (v) => {
            const list = (data.balises ??= []);
            let b = list.find((x) => x.pig === t.pig);
            if (!b) list.push((b = { pig: t.pig }));
            if (v === undefined || v === (data.header[name] ?? VARS[name].def)) delete b[name as 'M_DUP'];
            else (b as unknown as Record<string, EtcsValue>)[name] = v;
            data.balises = list.filter((x) => x.M_DUP !== undefined || x.M_MCOUNT !== undefined);
            render();
          })
        );
      }
      sec.append(head);
      const table = el('table', 'rd-route-table rd-etcs-tgtable');
      const tr = el('tr');
      for (const h of ['Packet', 'Q_DIR', 'L_PACKET [bits]']) tr.append(el('th', undefined, h));
      table.append(el('thead'), el('tbody'));
      table.tHead!.append(tr);
      const headerRow = el('tr');
      headerRow.append(el('td', undefined, 'Header'), el('td', undefined, ''), el('td', undefined, String(t.header.reduce((s, f) => s + f.bits, 0))));
      table.tBodies[0].append(headerRow);
      for (const p of t.packets) {
        const row = el('tr');
        const def = getPacketDef(p.packet.nid);
        row.append(el('td', undefined, `${p.packet.nid} ${def?.name.en ?? ''}`), el('td', undefined, def?.qdir ? DIR_LABEL[numericValue(p.packet.vars.Q_DIR as EtcsValue) ?? 1] : ''), el('td', undefined, String(p.bits)));
        table.tBodies[0].append(row);
      }
      const end = el('tr');
      end.append(el('td', undefined, '255 End of information'), el('td', undefined, ''), el('td', undefined, '8'));
      table.tBodies[0].append(end);
      sec.append(table);
      const total = el('div', over ? 'rd-etcs-total rd-rw-problem-error' : 'rd-etcs-total', `${t.bits} of ${TELEGRAM_CAPACITY.long} user bits (long telegram)${t.bits <= TELEGRAM_CAPACITY.short ? `; fits a short telegram (${TELEGRAM_CAPACITY.short})` : ''}`);
      sec.append(total, el('code', 'rd-etcs-hex', t.hex));
      box.append(sec);
    }
    box.append(el('p', 'rd-il-note', 'User data bits (header, packets, 255) in hex, before the SUBSET-036 telegram encoding. NID_C / NID_BG / N_TOTAL come from the group, N_PIG from the balise positions.'));
    return box;
  }

  function render(): void {
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && content.contains(active) ? active.dataset.path ?? active.dataset.header ?? null : null;
    tabButtons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === view)));
    content.replaceChildren();
    if (view === 'packets') {
      const layout = el('div', 'rd-etcs-layout');
      const left = el('div', 'rd-etcs-left');
      left.append(renderHeader(), renderPacketList());
      layout.append(left, renderPacketForm());
      content.append(layout);
    } else content.append(renderTelegrams());
    revalidate();
    if (focusKey) content.querySelector<HTMLElement>(`[data-path="${CSS.escape(focusKey)}"], [data-header="${CSS.escape(focusKey)}"]`)?.focus();
  }

  function doRecompute(): void {
    const env = etcsEnvFromModel(model);
    const g = env.byCell.get(String(cell.getId()));
    if (!g) return;
    const r = recomputeGroup(env, g, data);
    data = r.data;
    mismatches = r.mismatches;
    resultBox.replaceChildren();
    const summary = el('div', 'rd-etcs-result-title', `Recomputed: ${r.filled.length} value${r.filled.length === 1 ? '' : 's'} from the drawing, ${r.mismatches.length} difference${r.mismatches.length === 1 ? '' : 's'} to hand-set values`);
    resultBox.append(summary);
    const list = el('ul');
    for (const m of r.mismatches) list.append(el('li', 'rd-rw-problem-warning', m.message));
    for (const n of r.notes) list.append(el('li', 'rd-etcs-note', n));
    resultBox.append(list);
    if (data.packets.length === 0) resultBox.append(el('p', 'rd-etcs-note', 'Add packets first: 5 (linking), 12 (MA), 21 (gradient), 27 (speed profile) get values from the drawing.'));
    render();
  }

  function doSave(): void {
    revalidate();
    const errors = problems.filter((p) => p.severity === 'error');
    if (errors.length > 0) {
      error.textContent = `Not saved: ${errors.length} error${errors.length === 1 ? '' : 's'} (${errors[0].message}${errors.length > 1 ? '; …' : ''})`;
      return;
    }
    const before = stored.data ? serializeEtcsData(stored.data) : '';
    const empty = data.packets.length === 0 && !stored.data;
    const changed = !empty && serializeEtcsData(data) !== before;
    if (changed) setEtcsData(model, [cell], data);
    options.notify.success(changed ? `ETCS data of ${groupId} saved (${data.packets.length} packet${data.packets.length === 1 ? '' : 's'})` : `ETCS data of ${groupId} unchanged`);
    close();
  }

  const modal = openModal({ overlay, dialog, labelledBy: title, testId: 'etcs-dialog', backdropEvent: 'click' });
  const close = (): void => modal.close();
  render();
  if (stored.problems.length > 0) error.textContent = `The stored ETCS data could not be read: ${stored.problems[0].message}`;
  tabButtons[0].focus();
  return close;
}
