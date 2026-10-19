/**
 * @file templates.ts
 * @brief Example Railway Scripts (panel "Examples" menu, docs/RAILWAY-SCRIPT.md, tests).
 */
export interface ScriptTemplate {
  id: string;
  title: string;
  text: string;
}

const SCHEMA_LINE = '# yaml-language-server: $schema=https://railwaydrawer.mksystemdesign.org/schemas/railway-script-1.schema.json';

export const SCRIPT_TEMPLATES: readonly ScriptTemplate[] = [
  {
    id: 'simple-line',
    title: 'Simple line',
    text: `${SCHEMA_LINE}
railwayScript: 1
name: Simple line
tracks:
  - id: T1
    name: Main line
    startKm: 0.000
    endKm: 2.000
    bufferStops: [start, end]
signals:
  - { id: S1, track: T1, at: 0.200, direction: nominal, type: main, aspects: 3 }
  - { id: S2, track: T1, at: 1.000, direction: nominal, type: main, aspects: 3 }
  - { id: S3, track: T1, at: 1.800, direction: nominal, type: main }
  - { id: S4, track: T1, at: 1.700, direction: reverse, type: main }
routes:
  - { id: R1, from: S1, to: S2 }
  - { id: R2, from: S2, to: S3 }
`,
  },
  {
    id: 'station-two-points',
    title: 'Station with two points',
    text: `${SCHEMA_LINE}
railwayScript: 1
name: Station with two points
page:
  scale: 0.5          # drawing units per metre
tracks:
  - id: T1
    name: Main track
    startKm: 0.000
    endKm: 1.600
    points:
      - { id: W1, at: 0.400, to: T2, hand: right }
      - { id: W2, at: 1.200, to: T2, hand: left }
    signals:
      - { id: S1, at: 0.200, direction: nominal, type: main, aspects: 3 }
      - { id: S4, at: 1.000, direction: nominal, type: main }
      - { id: S2, at: 1.400, direction: nominal, type: main }
  - id: T2
    name: Loop
    kind: siding
    startKm: 0.400
    endKm: 1.200
    signals:
      - { id: S3, at: 1.000, direction: nominal, type: shunting }
routes:
  - id: R1             # main line through the station
    from: S1
    to: S4
  - id: R2             # into the loop
    from: S1
    to: S3
    via: { W1: reverse }
  - { id: R3, from: S4, to: S2 }
  - { id: R4, from: S3, to: S2, via: { W2: reverse } }
`,
  },
  {
    id: 'etcs-l2-block',
    title: 'ETCS Level 2 block',
    text: `${SCHEMA_LINE}
railwayScript: 1
name: ETCS L2 block section
tracks:
  - id: T1
    name: Line 1
    startKm: 10.000
    endKm: 13.000
axleCounters:
  - { id: AC1, track: T1, at: 10.050 }
  - { id: AC2, track: T1, at: 11.000 }
  - { id: AC3, track: T1, at: 12.000 }
  - { id: AC4, track: T1, at: 12.950 }
sections:
  - { id: TS1, from: AC1, to: AC2, type: axleCounter }
  - { id: TS2, from: AC2, to: AC3, type: axleCounter }
  - { id: TS3, from: AC3, to: AC4, type: axleCounter }
signals:   # ETCS marker boards at the block ends
  - { id: MB1, track: T1, at: 10.980, direction: nominal, type: markerBoard }
  - { id: MB2, track: T1, at: 11.980, direction: nominal, type: markerBoard }
  - { id: MB3, track: T1, at: 12.930, direction: nominal, type: markerBoard }
baliseGroups:
  - { id: BG1, track: T1, at: 10.900, direction: nominal, nidC: 353, nidBg: 101, balises: 2 }
  - { id: BG2, track: T1, at: 11.900, direction: nominal, nidC: 353, nidBg: 102, balises: 2 }
  - { id: BG3, track: T1, at: 12.850, direction: nominal, nidC: 353, nidBg: 103, balises: 2 }
rbcs:
  - { id: RBC1, nidC: 353, nidRbc: 1 }
trains:
  - { id: TR1, track: T1, at: 10.400, length: 200, direction: nominal, etcsLevel: '2', rbc: RBC1 }
routes:
  - { id: R1, from: MB1, to: MB2 }
  - { id: R2, from: MB2, to: MB3 }
`,
  },
];
