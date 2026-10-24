/**
 * Small layouts for the train run tests (1 drawing unit = 1 m: every section has rdLength = its
 * drawn length).
 *
 *   S1>      TC1          TC2     S2>     TC3      S3>    TC4
 *   |==================|==========|============|=========|     y = 100
 *   0                 200        400          600       800
 *   R1: S1 -> S2 (TC1, TC2, overlap TC3), R2: S2 -> S3 (TC3, overlap TC4)
 *
 * The points layout (POINTS_LAYOUT): TC1 0..150, W1 leg (150,100)->(230,180) 113.1 m, TC3 230..500;
 * R1: S1 (x 40) -> S3 (x 440) over TC1, W1 reverse, TC3.
 */
const obj = (id: string, attrs: string, cell: string): string => `<object label="" id="${id}" ${attrs}>${cell}</object>`;
const line = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;
const SECTION = 'edgeStyle=none;endArrow=none;html=1;strokeColor=#000000;strokeWidth=4;';
const SIGNAL = 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';
const section = (id: string, x1: number, x2: number, extra = '', y = 100): string =>
  obj(id.toLowerCase(), `rdKind="trackSection" rdId="${id}" rdLength="${Math.abs(x2 - x1)}" ${extra}`, `<mxCell style="${SECTION}" edge="1" parent="1">${line(x1, y, x2, y)}</mxCell>`);
const signal = (id: string, cx: number, y = 110): string =>
  obj(id.toLowerCase(), `rdKind="signal" rdId="${id}" rdDirection="nominal"`, `<mxCell style="${SIGNAL}" vertex="1" parent="1"><mxGeometry x="${cx - 10}" y="${y}" width="20" height="20" as="geometry"/></mxCell>`);
const route = (id: string, attrs: string): string =>
  obj(id.toLowerCase(), `rdKind="route" rdId="${id}" ${attrs}`, `<mxCell style="edgeStyle=none;strokeColor=#ff8f00;strokeWidth=5;opacity=60;" edge="1" parent="rd-routes">${line(0, 60, 400, 60)}</mxCell>`);

export function lineLayout(opts: { tc2Extra?: string; kmOnTc1?: boolean; noLengths?: boolean; train?: boolean } = {}): string {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${section('TC1', 0, 200, opts.kmOnTc1 ? 'rdKmStart="12.000" rdKmEnd="12.200"' : '')}
${section('TC2', 200, 400, opts.tc2Extra ?? '')}
${section('TC3', 400, 600)}
${section('TC4', 600, 800)}
${signal('S1', 0)}
${signal('S2', 400)}
${signal('S3', 600)}
${opts.train ? obj('tr1', 'rdKind="train" rdId="TR1" rdEtcsLevel="2"', '<mxCell style="rounded=0;" vertex="1" parent="1"><mxGeometry x="-120" y="70" width="60" height="20" as="geometry"/></mxCell>') : ''}
<mxCell id="rd-routes" value="Routes" parent="0"/>
${route('R1', 'rdEntrySignal="S1" rdExitSignal="S2" rdSections="TC1, TC2" rdOverlap="TC3"')}
${route('R2', 'rdEntrySignal="S2" rdExitSignal="S3" rdSections="TC3" rdOverlap="TC4"')}
</root></mxGraphModel>`;
  if (opts.noLengths) xml = xml.replace(/ rdLength="\d+"/g, '');
  return xml;
}

export const POINTS_LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${section('TC1', 0, 150)}
${obj('tc3', 'rdKind="trackSection" rdId="TC3" rdLength="270"', `<mxCell style="${SECTION}" edge="1" parent="1">${line(230, 180, 500, 180)}</mxCell>`)}
${obj('tc2', 'rdKind="trackSection" rdId="TC2" rdLength="350"', `<mxCell style="${SECTION}" edge="1" parent="1">${line(150, 100, 500, 100)}</mxCell>`)}
${obj('w1', 'rdKind="points" rdId="W1" rdPosition="normal"', `<mxCell style="edgeStyle=none;endArrow=none;strokeColor=#a5a5a5;strokeWidth=6;" edge="1" parent="1">${line(150, 100, 230, 180)}</mxCell>`)}
${signal('S1', 40)}
${signal('S3', 440, 190)}
<mxCell id="rd-routes" value="Routes" parent="0"/>
${route('R1', 'rdEntrySignal="S1" rdExitSignal="S3" rdPoints="W1:reverse" rdSections="TC1, TC3"')}
</root></mxGraphModel>`;
