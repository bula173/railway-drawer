/**
 * @file etcs-schema.ts
 * @brief The ETCS balise telegram schema of the "ETCS data" editor: telegram header and packet
 *        layouts (UNISIG SUBSET-026 v3.6.0 chapters 7/8; the same in 3.7.0 for these packets),
 *        variables with bit sizes, value kinds (distances scaled by Q_SCALE, speeds in 5 km/h
 *        steps, times, gradients), ranges, enums and special values. Pure data, model only (no
 *        DOM): used by the data model / validation (etcs-data.ts), the computed values, the rule
 *        checks, the dialog, the exports and the AI tools. The long help texts (EN/PL) live in
 *        etcs-help.ts (lazy). Bit sizes and codes marked `uncertain` are from the specification as
 *        we know it and are documented as such in docs/architecture/etcs-data.md: check them
 *        against the SUBSET-026 edition of the project before production use.
 */

export interface Bi {
  en: string;
  pl: string;
}

/**
 * Value kind of a variable. Stored (JSON) values are physical: `dist` metres (encoded with the
 * packet's Q_SCALE: 10 cm / 1 m / 10 m), `speed` km/h (5 km/h steps), `time` s, `grad` ‰,
 * `int` / `enum` / `count` the encoded integer, `text` a Latin-1 string (L_TEXT + X_TEXT bytes),
 * `bits` hex digits (4 bits each). Special codes (e.g. T_LOA 1023 = no time-out) are stored as
 * their keyword (`"inf"`).
 */
export type VarKind = 'int' | 'enum' | 'count' | 'dist' | 'speed' | 'time' | 'grad' | 'text' | 'bits';

export interface VarOption {
  v: number;
  label: Bi;
}

export interface VarSpecial {
  /** Keyword stored in the JSON instead of a number. */
  key: string;
  raw: number;
  label: Bi;
}

export interface VarDef {
  name: string;
  /** Bits in the telegram (text / bits: per character / hex digit). */
  bits: number;
  kind: VarKind;
  /** Physical unit shown in the editor. */
  unit?: string;
  /** Range of the stored value (int/enum: raw; physical kinds: physical). */
  min?: number;
  max?: number;
  options?: VarOption[];
  specials?: VarSpecial[];
  /** Default of a new packet / iteration entry. */
  def?: number | string;
  /** Bit size / codes not verified against a vendored copy of the specification. */
  uncertain?: boolean;
}

/** An item of a packet layout: a variable, a repeated block (N_ITER) or a conditional block. */
export type PacketItem =
  | { v: string; key?: string }
  | { iter: string; label: Bi; items: PacketItem[] }
  | { if: string; in: number[]; items: PacketItem[] };

export interface PacketDef {
  nid: number;
  name: Bi;
  /** Has Q_DIR (every packet except 255). */
  qdir: boolean;
  /** Has Q_SCALE (distances). */
  scale: boolean;
  items: PacketItem[];
  /** Variable paths the drawing can fill (`D_LINK`, `links.*.D_LINK`, ...). */
  computed?: string[];
  /** Part of the layout we could not verify. */
  uncertain?: string;
}

const o = (v: number, en: string, pl: string): VarOption => ({ v, label: { en, pl } });
const sp = (key: string, raw: number, en: string, pl: string): VarSpecial => ({ key, raw, label: { en, pl } });

/** Resolution in metres of one distance step for Q_SCALE 0/1/2 (10 cm, 1 m, 10 m). */
export const Q_SCALE_RESOLUTION: readonly number[] = [0.1, 1, 10];

/** Largest raw value of a 15-bit distance (D_*, L_*). */
export const DIST_MAX_RAW = 32767;

const dist = (name: string, extra: Partial<VarDef> = {}): VarDef => ({ name, bits: 15, kind: 'dist', unit: 'm', min: 0, ...extra });
const speed = (name: string, extra: Partial<VarDef> = {}): VarDef => ({ name, bits: 7, kind: 'speed', unit: 'km/h', min: 0, max: 600, ...extra });
const time = (name: string, extra: Partial<VarDef> = {}): VarDef => ({
  name,
  bits: 10,
  kind: 'time',
  unit: 's',
  min: 0,
  max: 1022,
  specials: [sp('inf', 1023, 'infinite (no time-out)', 'nieskończony (bez limitu czasu)')],
  ...extra,
});
const flag = (name: string, off: Bi, on: Bi, def = 0): VarDef => ({ name, bits: 1, kind: 'enum', options: [{ v: 0, label: off }, { v: 1, label: on }], def });
const RELEASE_SPECIALS = [sp('national', 126, 'use the national value', 'wartość krajowa'), sp('onboard', 127, 'calculated on-board', 'obliczana przez pojazd')];
const LEVELS = [o(0, 'Level 0', 'Poziom 0'), o(1, 'Level NTC', 'Poziom NTC'), o(2, 'Level 1', 'Poziom 1'), o(3, 'Level 2', 'Poziom 2'), o(4, 'Level 3', 'Poziom 3')];
const MODES = [
  o(0, 'Full Supervision', 'FS'),
  o(1, 'On Sight', 'OS'),
  o(2, 'Staff Responsible', 'SR'),
  o(3, 'Shunting', 'SH'),
  o(4, 'Unfitted', 'UN'),
  o(5, 'Sleeping', 'SL'),
  o(6, 'Stand By', 'SB'),
  o(7, 'Trip', 'TR'),
  o(8, 'Post Trip', 'PT'),
  o(9, 'System Failure', 'SF'),
  o(10, 'Isolation', 'IS'),
  o(11, 'Non Leading', 'NL'),
  o(12, 'Limited Supervision', 'LS'),
  o(13, 'National System (SN)', 'SN'),
  o(14, 'Reversing', 'RV'),
  o(15, 'no mode limitation', 'bez ograniczenia trybu'),
];

/** The variables (one definition per name, SUBSET-026 chapter 7). */
export const VARS: Readonly<Record<string, VarDef>> = Object.fromEntries(
  (
    [
      // ---- telegram header
      { name: 'Q_UPDOWN', bits: 1, kind: 'enum', options: [o(0, 'down-link (train to track)', 'pojazd → tor'), o(1, 'up-link (track to train)', 'tor → pojazd')], def: 1 },
      {
        name: 'M_VERSION',
        bits: 7,
        kind: 'enum',
        options: [o(16, '1.0', '1.0'), o(17, '1.1', '1.1'), o(32, '2.0 (Baseline 3)', '2.0 (Baseline 3)'), o(33, '2.1 (Baseline 3 R2)', '2.1 (Baseline 3 R2)')],
        def: 33,
        uncertain: true,
      },
      { name: 'Q_MEDIA', bits: 1, kind: 'enum', options: [o(0, 'balise', 'balisa'), o(1, 'loop', 'pętla')], def: 0 },
      { name: 'N_PIG', bits: 3, kind: 'int', min: 0, max: 7 },
      { name: 'N_TOTAL', bits: 3, kind: 'int', min: 0, max: 7 },
      {
        name: 'M_DUP',
        bits: 2,
        kind: 'enum',
        options: [o(0, 'no duplicates', 'brak duplikatów'), o(1, 'duplicate of the next balise', 'duplikat następnej balisy'), o(2, 'duplicate of the previous balise', 'duplikat poprzedniej balisy')],
        def: 0,
      },
      {
        name: 'M_MCOUNT',
        bits: 8,
        kind: 'int',
        min: 0,
        max: 253,
        specials: [sp('never', 254, 'telegram never fits any message', 'telegram nie pasuje do żadnej wiadomości'), sp('all', 255, 'telegram fits all telegrams of the group', 'pasuje do wszystkich telegramów grupy')],
        def: 'all',
      },
      { name: 'NID_C', bits: 10, kind: 'int', min: 0, max: 1023 },
      { name: 'NID_BG', bits: 14, kind: 'int', min: 0, max: 16383 },
      { name: 'Q_LINK', bits: 1, kind: 'enum', options: [o(0, 'unlinked', 'nielinkowana'), o(1, 'linked', 'linkowana')], def: 1 },
      // ---- packet header
      { name: 'NID_PACKET', bits: 8, kind: 'int', min: 0, max: 255 },
      { name: 'Q_DIR', bits: 2, kind: 'enum', options: [o(0, 'reverse', 'przeciwny'), o(1, 'nominal', 'zasadniczy'), o(2, 'both directions', 'oba kierunki')], def: 1 },
      { name: 'L_PACKET', bits: 13, kind: 'int', min: 0, max: 8191 },
      { name: 'Q_SCALE', bits: 2, kind: 'enum', options: [o(0, '10 cm', '10 cm'), o(1, '1 m', '1 m'), o(2, '10 m', '10 m')], def: 1 },
      { name: 'N_ITER', bits: 5, kind: 'count', min: 0, max: 31 },
      // ---- 5 linking
      dist('D_LINK'),
      flag('Q_NEWCOUNTRY', { en: 'same country (no NID_C)', pl: 'ten sam kraj' }, { en: 'other country (NID_C follows)', pl: 'inny kraj (NID_C)' }),
      flag('Q_LINKORIENTATION', { en: 'reverse', pl: 'przeciwny' }, { en: 'nominal', pl: 'zasadniczy' }, 1),
      { name: 'Q_LINKREACTION', bits: 2, kind: 'enum', options: [o(0, 'train trip', 'wyzwolenie (trip)'), o(1, 'apply service brake', 'hamowanie służbowe'), o(2, 'no reaction', 'brak reakcji')], def: 1 },
      { name: 'Q_LOCACC', bits: 6, kind: 'int', unit: 'm', min: 0, max: 63, def: 5 },
      // ---- 12 level 1 MA
      speed('V_MAIN', { def: 0 }),
      speed('V_LOA', { def: 0 }),
      time('T_LOA', { def: 'inf' }),
      dist('L_SECTION'),
      flag('Q_SECTIONTIMER', { en: 'no section timer', pl: 'bez zegara sekcji' }, { en: 'section timer', pl: 'zegar sekcji' }),
      time('T_SECTIONTIMER'),
      dist('D_SECTIONTIMERSTOPLOC'),
      dist('L_ENDSECTION'),
      flag('Q_ENDTIMER', { en: 'no end section timer', pl: 'bez zegara końca' }, { en: 'end section timer', pl: 'zegar sekcji końcowej' }),
      time('T_ENDTIMER'),
      dist('D_ENDTIMERSTARTLOC'),
      flag('Q_DANGERPOINT', { en: 'no danger point', pl: 'brak punktu zagrożenia' }, { en: 'danger point', pl: 'punkt zagrożenia' }),
      dist('D_DP'),
      speed('V_RELEASEDP', { specials: RELEASE_SPECIALS }),
      flag('Q_OVERLAP', { en: 'no overlap', pl: 'brak zakładki' }, { en: 'overlap', pl: 'zakładka' }),
      dist('D_STARTOL'),
      time('T_OL'),
      dist('D_OL'),
      speed('V_RELEASEOL', { specials: RELEASE_SPECIALS }),
      // ---- 21 gradient
      dist('D_GRADIENT'),
      flag('Q_GDIR', { en: 'downhill', pl: 'spadek' }, { en: 'uphill', pl: 'wzniesienie' }, 1),
      { name: 'G_A', bits: 8, kind: 'grad', unit: '‰', min: 0, max: 254, specials: [sp('end', 255, 'end of the gradient profile', 'koniec profilu')], def: 0 },
      // ---- 27 international SSP
      dist('D_STATIC'),
      speed('V_STATIC', { specials: [sp('end', 127, 'end of the static speed profile', 'koniec profilu prędkości')] }),
      flag('Q_FRONT', { en: 'train length delay', pl: 'z opóźnieniem o długość pociągu' }, { en: 'no train length delay', pl: 'bez opóźnienia' }),
      {
        name: 'Q_DIFF',
        bits: 2,
        kind: 'enum',
        options: [
          o(0, 'cant deficiency specific category', 'kategoria niedoboru przechyłki'),
          o(1, 'other category, replaces the cant deficiency SSP', 'inna kategoria, zastępuje profil przechyłki'),
          o(2, 'other category, does not replace it', 'inna kategoria, nie zastępuje'),
        ],
        def: 0,
      },
      {
        name: 'NC_CDDIFF',
        bits: 4,
        kind: 'enum',
        options: [80, 100, 130, 150, 165, 180, 210, 225, 245, 275, 300].map((mm, i) => o(i, `cant deficiency ${mm} mm`, `niedobór przechyłki ${mm} mm`)),
        def: 0,
      },
      {
        name: 'NC_DIFF',
        bits: 4,
        kind: 'enum',
        options: [o(0, 'freight train, braked in P', 'towarowy, hamulec P'), o(1, 'freight train, braked in G', 'towarowy, hamulec G'), o(2, 'passenger train', 'pasażerski')],
        def: 2,
      },
      speed('V_DIFF'),
      // ---- 41 / 46 level transition
      dist('D_LEVELTR', { specials: [sp('now', 32767, 'now (immediate)', 'natychmiast')] }),
      { name: 'M_LEVELTR', bits: 3, kind: 'enum', options: LEVELS, def: 3, uncertain: true },
      { name: 'NID_NTC', bits: 8, kind: 'int', min: 0, max: 255 },
      dist('L_ACKLEVELTR'),
      // ---- 44 national / external application data
      { name: 'NID_XUSER', bits: 9, kind: 'int', min: 0, max: 511 },
      { name: 'XUSER_DATA', bits: 4, kind: 'bits', uncertain: true, def: '' },
      // ---- 65 / 66 TSR
      { name: 'NID_TSR', bits: 8, kind: 'int', min: 0, max: 254, specials: [sp('nonrevocable', 255, 'non revocable TSR', 'TSR nieodwołalne')], def: 1 },
      dist('D_TSR'),
      dist('L_TSR'),
      speed('V_TSR'),
      // ---- 72 plain text
      flag('Q_TEXTCLASS', { en: 'auxiliary information', pl: 'informacja pomocnicza' }, { en: 'important information', pl: 'informacja ważna' }),
      flag('Q_TEXTDISPLAY', { en: 'as soon as one start event is fulfilled', pl: 'po spełnieniu jednego warunku' }, { en: 'when all start events are fulfilled', pl: 'po spełnieniu wszystkich warunków' }),
      dist('D_TEXTDISPLAY', { specials: [sp('none', 32767, 'no start location', 'bez miejsca początku')] }),
      { name: 'M_MODETEXTDISPLAY', bits: 4, kind: 'enum', options: MODES, def: 15 },
      { name: 'M_LEVELTEXTDISPLAY', bits: 3, kind: 'enum', options: [...LEVELS, o(5, 'no level limitation', 'bez ograniczenia poziomu')], def: 5, uncertain: true },
      dist('L_TEXTDISPLAY', { specials: [sp('none', 32767, 'not limited by distance', 'bez ograniczenia odległości')], def: 'none' }),
      time('T_TEXTDISPLAY', { def: 'inf' }),
      {
        name: 'Q_TEXTCONFIRM',
        bits: 2,
        kind: 'enum',
        options: [
          o(0, 'no confirmation', 'bez potwierdzenia'),
          o(1, 'confirmation required', 'wymagane potwierdzenie'),
          o(2, 'confirmation, else service brake', 'potwierdzenie, inaczej hamowanie służbowe'),
          o(3, 'confirmation, else emergency brake', 'potwierdzenie, inaczej hamowanie nagłe'),
        ],
        def: 0,
      },
      flag('Q_CONFTEXTDISPLAY', { en: 'acknowledgement ends the display', pl: 'potwierdzenie kończy wyświetlanie' }, { en: 'acknowledgement or end events end the display', pl: 'potwierdzenie lub warunki końca' }),
      flag('Q_TEXTREPORT', { en: 'no report', pl: 'bez raportu' }, { en: 'report the acknowledgement', pl: 'raport potwierdzenia' }),
      { name: 'NID_TEXTMESSAGE', bits: 8, kind: 'int', min: 0, max: 255 },
      { name: 'NID_RBC', bits: 14, kind: 'int', min: 0, max: 16383 },
      { name: 'X_TEXT', bits: 8, kind: 'text', def: '' },
      // ---- 79 geographical position
      dist('D_POSOFF'),
      flag('Q_MPOSITION', { en: 'opposite to the nominal direction', pl: 'przeciwnie do kierunku zasadniczego' }, { en: 'same as the nominal direction', pl: 'zgodnie z kierunkiem zasadniczym' }, 1),
      { name: 'M_POSITION', bits: 20, kind: 'int', unit: 'm', min: 0, max: 9999999, specials: [sp('nomore', 1048575, 'no more calculation', 'koniec obliczania')] },
      // ---- 132 / 137
      flag('Q_ASPECT', { en: 'stop if in SH mode', pl: 'stój w trybie SH' }, { en: 'go if in SH mode', pl: 'jazda w trybie SH' }),
      flag('Q_SRSTOP', { en: 'stop if in SR mode', pl: 'stój w trybie SR' }, { en: 'go if in SR mode', pl: 'jazda w trybie SR' }),
    ] as VarDef[]
  ).map((d) => [d.name, d])
);

const v = (name: string, key?: string): PacketItem => (key ? { v: name, key } : { v: name });
const iter = (key: string, en: string, pl: string, items: PacketItem[]): PacketItem => ({ iter: key, label: { en, pl }, items });
const when = (name: string, values: number[], items: PacketItem[]): PacketItem => ({ if: name, in: values, items });

const LINK_ENTRY: PacketItem[] = [v('D_LINK'), v('Q_NEWCOUNTRY'), when('Q_NEWCOUNTRY', [1], [v('NID_C')]), v('NID_BG'), v('Q_LINKORIENTATION'), v('Q_LINKREACTION'), v('Q_LOCACC')];
const SPEED_DIFF: PacketItem = iter('diff', 'Train category speeds', 'Prędkości kategorii pociągów', [
  v('Q_DIFF'),
  when('Q_DIFF', [0], [v('NC_CDDIFF')]),
  when('Q_DIFF', [1, 2], [v('NC_DIFF')]),
  v('V_DIFF'),
]);
const LEVEL_ENTRY: PacketItem[] = [v('M_LEVELTR'), when('M_LEVELTR', [1], [v('NID_NTC')])];

/** The supported packets (SUBSET-026 chapter 8). */
export const PACKETS: readonly PacketDef[] = [
  {
    nid: 5,
    name: { en: 'Linking', pl: 'Linkowanie' },
    qdir: true,
    scale: true,
    items: [...LINK_ENTRY, iter('links', 'Further linked groups', 'Kolejne grupy linkowane', LINK_ENTRY)],
    computed: ['D_LINK', 'Q_NEWCOUNTRY', 'NID_C', 'NID_BG', 'Q_LINKORIENTATION', 'links.*.D_LINK', 'links.*.Q_NEWCOUNTRY', 'links.*.NID_C', 'links.*.NID_BG', 'links.*.Q_LINKORIENTATION'],
  },
  {
    nid: 12,
    name: { en: 'Level 1 Movement Authority', pl: 'Zezwolenie na jazdę (MA) poziomu 1' },
    qdir: true,
    scale: true,
    items: [
      v('V_MAIN'),
      v('V_LOA'),
      v('T_LOA'),
      iter('sections', 'Sections before the end section', 'Sekcje przed sekcją końcową', [
        v('L_SECTION'),
        v('Q_SECTIONTIMER'),
        when('Q_SECTIONTIMER', [1], [v('T_SECTIONTIMER'), v('D_SECTIONTIMERSTOPLOC')]),
      ]),
      v('L_ENDSECTION'),
      v('Q_SECTIONTIMER'),
      when('Q_SECTIONTIMER', [1], [v('T_SECTIONTIMER'), v('D_SECTIONTIMERSTOPLOC')]),
      v('Q_ENDTIMER'),
      when('Q_ENDTIMER', [1], [v('T_ENDTIMER'), v('D_ENDTIMERSTARTLOC')]),
      v('Q_DANGERPOINT'),
      when('Q_DANGERPOINT', [1], [v('D_DP'), v('V_RELEASEDP')]),
      v('Q_OVERLAP'),
      when('Q_OVERLAP', [1], [v('D_STARTOL'), v('T_OL'), v('D_OL'), v('V_RELEASEOL')]),
    ],
    computed: ['L_ENDSECTION'],
  },
  {
    nid: 21,
    name: { en: 'Gradient profile', pl: 'Profil pochyleń' },
    qdir: true,
    scale: true,
    items: [v('D_GRADIENT'), v('Q_GDIR'), v('G_A'), iter('steps', 'Further gradient changes', 'Kolejne zmiany pochylenia', [v('D_GRADIENT'), v('Q_GDIR'), v('G_A')])],
    computed: ['D_GRADIENT', 'Q_GDIR', 'G_A', 'steps.*.D_GRADIENT', 'steps.*.Q_GDIR', 'steps.*.G_A'],
  },
  {
    nid: 27,
    name: { en: 'International Static Speed Profile', pl: 'Statyczny profil prędkości (SSP)' },
    qdir: true,
    scale: true,
    items: [
      v('D_STATIC'),
      v('V_STATIC'),
      v('Q_FRONT'),
      SPEED_DIFF,
      iter('steps', 'Further speed changes', 'Kolejne zmiany prędkości', [v('D_STATIC'), v('V_STATIC'), v('Q_FRONT'), SPEED_DIFF]),
    ],
    computed: ['D_STATIC', 'V_STATIC', 'steps.*.D_STATIC', 'steps.*.V_STATIC'],
  },
  {
    nid: 41,
    name: { en: 'Level transition order', pl: 'Rozkaz zmiany poziomu' },
    qdir: true,
    scale: true,
    items: [v('D_LEVELTR'), ...LEVEL_ENTRY, v('L_ACKLEVELTR'), iter('levels', 'Further levels (priority order)', 'Kolejne poziomy (wg priorytetu)', [...LEVEL_ENTRY, v('L_ACKLEVELTR')])],
  },
  {
    nid: 44,
    name: { en: 'Data for national applications', pl: 'Dane aplikacji krajowych' },
    qdir: true,
    scale: false,
    items: [v('NID_XUSER'), when('NID_XUSER', [102], [v('NID_NTC')]), v('XUSER_DATA')],
    uncertain: 'The content after NID_XUSER is national (bits as hex here); NID_NTC after NID_XUSER = 102 as we read SUBSET-026.',
  },
  {
    nid: 46,
    name: { en: 'Conditional level transition order', pl: 'Warunkowy rozkaz zmiany poziomu' },
    qdir: true,
    scale: false,
    items: [...LEVEL_ENTRY, iter('levels', 'Further levels', 'Kolejne poziomy', LEVEL_ENTRY)],
  },
  {
    nid: 65,
    name: { en: 'Temporary speed restriction', pl: 'Doraźne ograniczenie prędkości (TSR)' },
    qdir: true,
    scale: true,
    items: [v('NID_TSR'), v('D_TSR'), v('L_TSR'), v('Q_FRONT'), v('V_TSR')],
  },
  {
    nid: 66,
    name: { en: 'Temporary speed restriction revocation', pl: 'Odwołanie TSR' },
    qdir: true,
    scale: false,
    items: [v('NID_TSR')],
  },
  {
    nid: 72,
    name: { en: 'Plain text message', pl: 'Komunikat tekstowy' },
    qdir: true,
    scale: true,
    items: [
      v('Q_TEXTCLASS'),
      v('Q_TEXTDISPLAY'),
      v('D_TEXTDISPLAY'),
      v('M_MODETEXTDISPLAY'),
      v('M_LEVELTEXTDISPLAY'),
      when('M_LEVELTEXTDISPLAY', [1], [v('NID_NTC')]),
      v('L_TEXTDISPLAY'),
      v('T_TEXTDISPLAY'),
      v('M_MODETEXTDISPLAY', 'M_MODETEXTDISPLAY_END'),
      v('M_LEVELTEXTDISPLAY', 'M_LEVELTEXTDISPLAY_END'),
      when('M_LEVELTEXTDISPLAY_END', [1], [v('NID_NTC', 'NID_NTC_END')]),
      v('Q_TEXTCONFIRM'),
      when('Q_TEXTCONFIRM', [1, 2, 3], [v('Q_CONFTEXTDISPLAY'), v('Q_TEXTREPORT'), when('Q_TEXTREPORT', [1], [v('NID_TEXTMESSAGE'), v('NID_C'), v('NID_RBC')])]),
      v('X_TEXT'),
    ],
    uncertain: 'Q_CONFTEXTDISPLAY / Q_TEXTREPORT (+ NID_TEXTMESSAGE, NID_C, NID_RBC) as in the 3.x layout we know.',
  },
  {
    nid: 79,
    name: { en: 'Geographical position information', pl: 'Informacja o położeniu geograficznym' },
    qdir: true,
    scale: true,
    items: [
      v('Q_NEWCOUNTRY'),
      when('Q_NEWCOUNTRY', [1], [v('NID_C')]),
      v('NID_BG'),
      v('D_POSOFF'),
      v('Q_MPOSITION'),
      v('M_POSITION'),
      iter('positions', 'Further reference points', 'Kolejne punkty odniesienia', [v('Q_NEWCOUNTRY'), when('Q_NEWCOUNTRY', [1], [v('NID_C')]), v('NID_BG'), v('D_POSOFF'), v('Q_MPOSITION'), v('M_POSITION')]),
    ],
  },
  { nid: 132, name: { en: 'Danger for shunting information', pl: 'Zagrożenie dla manewrów' }, qdir: true, scale: false, items: [v('Q_ASPECT')] },
  {
    nid: 136,
    name: { en: 'Infill location reference', pl: 'Odniesienie lokalizacji infill' },
    qdir: true,
    scale: false,
    items: [v('Q_NEWCOUNTRY'), when('Q_NEWCOUNTRY', [1], [v('NID_C')]), v('NID_BG')],
  },
  { nid: 137, name: { en: 'Stop if in Staff Responsible', pl: 'Stój w trybie SR' }, qdir: true, scale: false, items: [v('Q_SRSTOP')] },
  { nid: 255, name: { en: 'End of information', pl: 'Koniec informacji' }, qdir: false, scale: false, items: [] },
];

/** Telegram header variables in transmission order (SUBSET-026 7.4.2 / 8.4.2: 50 bits). */
export const HEADER_VARS = ['Q_UPDOWN', 'M_VERSION', 'Q_MEDIA', 'N_PIG', 'N_TOTAL', 'M_DUP', 'M_MCOUNT', 'NID_C', 'NID_BG', 'Q_LINK'] as const;
export type HeaderVar = (typeof HEADER_VARS)[number];
/** Header variables stored in the group's data (the others come from the drawing: NID_C, NID_BG, N_TOTAL, N_PIG). */
export const STORED_HEADER_VARS = ['Q_UPDOWN', 'M_VERSION', 'Q_MEDIA', 'M_DUP', 'M_MCOUNT', 'Q_LINK'] as const;
export type StoredHeaderVar = (typeof STORED_HEADER_VARS)[number];

/**
 * User data bits of a balise telegram (SUBSET-036): long format 830, short format 210 (the
 * header and packet 255 included). The encoded telegram adds the shaped/scrambled frame, not
 * modelled here.
 */
export const TELEGRAM_CAPACITY = { long: 830, short: 210 } as const;

export function getPacketDef(nid: number): PacketDef | undefined {
  return PACKETS.find((p) => p.nid === nid);
}

export function getVarDef(name: string): VarDef | undefined {
  return VARS[name];
}

/** The key a variable item is stored under. */
export function itemKey(item: { v: string; key?: string }): string {
  return item.key ?? item.v;
}

/** `links.*.D_LINK` matches `links.3.D_LINK`. */
export function pathMatches(pattern: string, path: string): boolean {
  const a = pattern.split('.');
  const b = path.split('.');
  return a.length === b.length && a.every((p, i) => p === '*' || p === b[i]);
}
