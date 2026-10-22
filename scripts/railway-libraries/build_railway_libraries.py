#!/usr/bin/env python3
"""
Builds the three railway draw.io libraries of the Shapes tab (original work of this repository,
no third-party symbol files):

  python3 -I scripts/railway-libraries/build_railway_libraries.py public/libraries

  ertms-extra.xml   "ERTMS/ETCS extra": marker boards, ETCS boards, balises, trackside equipment,
                    trains, MA / EoA / danger point / overlap / SvL annotations
  railway-pl.xml    "Polish signalling (PKP PLK)": semafory, tarcze, wskaźniki, przejazdy,
                    kozioł oporowy, rozjazdy, wykolejnice, perony, nastawnie, kilometraż
  track-layout.xml  "Track layout": track pieces, turnouts 1:9 / 1:12, crossovers, slips,
                    diamond crossing, platforms, bridge, tunnel, km marks, gradient/speed boards

Every file is a draw.io `<mxlibrary>` (uncompressed entries `{xml, w, h, title, tags}`; draw.io
ignores `tags`, the app searches it). Symbols are plain draw.io styles or inline `stencil(...)`
shapes (base64 deflate of the URI-encoded stencil XML, as draw.io's Graph.compress), so the
colours stay editable (fillColor / strokeColor; stencil accents read `fillColor2`).

Railway objects carry the catalogue data as draw.io `<object>` attributes (src/railway/catalogue.ts:
`rdKind`, `rdSignalType`, `rdDirection`, `rdAspects`, `rdHand`, ...), like public/libraries/ertms.xml.
IDs are generated on insert (src/railway/insert-ids.ts); balise groups carry `BG1`/`B1`.. so the
references follow the renumbering. Direction convention: Right = nominal (travel left to right,
symbol below the track), Left = reverse. Points hand is physical: seen from the toe, a leg going
up is left when the toe is on the left (travel to the right), right when the toe is on the right.

Signals are groups whose lamps are round filled leaf vertices (states.ts recolours them for the
aspect); masts and feet are edges, frames are unfilled or non-square, so nothing else is a lamp.

Deterministic output; LF line endings.
"""
import base64
import json
import os
import sys
import urllib.parse
import zlib

BLACK = '#000000'
WHITE = '#ffffff'
RED = '#e00000'
GREEN = '#00a651'
ORANGE = '#ff9900'
YELLOW = '#ffd600'
BLUE = '#0050aa'
SHUNT_BLUE = '#1e5bff'
GREY = '#d9d9d9'

LINE = 'endArrow=none;html=1;rounded=0;strokeColor=#000000;strokeWidth=2;'
THIN = 'endArrow=none;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;'
TRACK = 'endArrow=none;html=1;rounded=0;strokeColor=#000000;strokeWidth=4;'
LEG = 'endArrow=none;html=1;rounded=0;strokeColor=#000000;strokeWidth=4;'


def esc(text):
    return (str(text).replace('&', '&amp;').replace('"', '&quot;')
            .replace('<', '&lt;').replace('>', '&gt;'))


def num(v):
    v = round(float(v), 2)
    return str(int(v)) if v == int(v) else repr(v)


def stencil(xml):
    """draw.io Graph.compress: base64(deflateRaw(encodeURIComponent(xml)))."""
    data = urllib.parse.quote(xml, safe="-_.!~*'()").encode('ascii')
    co = zlib.compressobj(9, zlib.DEFLATED, -15)
    raw = co.compress(data) + co.flush()
    return 'stencil(' + base64.b64encode(raw).decode('ascii') + ')'


def shape_xml(name, w, h, background, foreground, connections=''):
    conn = f'<connections>{connections}</connections>' if connections else ''
    # a paint op (stroke/fill) only paints the current path: adjacent paths become one path
    background = background.replace('</path><path>', '')
    foreground = foreground.replace('</path><path>', '')
    return (f'<shape name="{name}" h="{num(h)}" w="{num(w)}" aspect="variable" strokewidth="inherit">'
            f'{conn}<background>{background}</background><foreground>{foreground}</foreground></shape>')


def P(*cmds):
    """Path from ('M'|'L', x, y) tuples and 'Z'."""
    out = []
    for c in cmds:
        if c == 'Z':
            out.append('<close/>')
        else:
            op, x, y = c
            out.append(f'<{"move" if op == "M" else "line"} x="{num(x)}" y="{num(y)}"/>')
    return '<path>' + ''.join(out) + '</path>'


def C(x, y, name=''):
    n = f' name="{name}"' if name else ''
    return f'<constraint x="{num(x)}" y="{num(y)}" perimeter="0"{n}/>'


SIDE_POINTS = C(0, 0.5, 'W') + C(1, 0.5, 'E') + C(0.5, 0, 'N') + C(0.5, 1, 'S')


class Model:
    """mxGraphModel builder; ids from 2, cell 1 is the default layer."""

    def __init__(self):
        self.parts = []
        self.n = 1

    def _id(self):
        self.n += 1
        return str(self.n)

    def _add(self, cid, cell_attrs, geo, label, data):
        if data is not None:
            attrs = ''.join(f' {k}="{esc(v)}"' for k, v in data.items())
            ph = ' placeholders="1"' if '%' in label else ''
            self.parts.append(f'<object label="{esc(label)}"{ph}{attrs} id="{cid}">'
                              f'<mxCell {cell_attrs}>{geo}</mxCell></object>')
        else:
            self.parts.append(f'<mxCell id="{cid}" value="{esc(label)}" {cell_attrs}>{geo}</mxCell>')
        return cid

    def vertex(self, style, x, y, w, h, parent='1', label='', data=None, extra=''):
        cid = self._id()
        geo = f'<mxGeometry x="{num(x)}" y="{num(y)}" width="{num(w)}" height="{num(h)}" as="geometry"/>'
        return self._add(cid, f'style="{esc(style)}" vertex="1" parent="{parent}"{extra}', geo, label, data)

    def edge(self, style, p1, p2, parent='1', points=(), label='', data=None):
        cid = self._id()
        pts = ''.join(f'<mxPoint x="{num(x)}" y="{num(y)}"/>' for x, y in points)
        geo = ('<mxGeometry relative="1" as="geometry">'
               f'<mxPoint x="{num(p1[0])}" y="{num(p1[1])}" as="sourcePoint"/>'
               f'<mxPoint x="{num(p2[0])}" y="{num(p2[1])}" as="targetPoint"/>'
               + (f'<Array as="points">{pts}</Array>' if points else '') + '</mxGeometry>')
        return self._add(cid, f'style="{esc(style)}" edge="1" parent="{parent}"', geo, label, data)

    def group(self, w, h, data=None, label=''):
        return self.vertex('group', 0, 0, w, h, data=data, label=label, extra=' connectable="0"')

    def xml(self):
        return ('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
                + ''.join(self.parts) + '</root></mxGraphModel>')


def entry(title, model, w, h, tags):
    return {'title': title, 'w': w, 'h': h, 'tags': ' '.join(tags.split()), 'xml': model.xml()}


def direction(d):
    return 'nominal' if d == 'R' else 'reverse'


DIR_TAGS = {'R': 'right nominal prawy', 'L': 'left reverse lewy'}
SIGNAL_TAGS = 'signal semafor sygnalizator sygnał'


# --------------------------------------------------------------------------------------------
# Signals (groups: foot + arm edges, round filled lamp vertices)
# --------------------------------------------------------------------------------------------

def light_signal(title, d, lamps, tags, signal_type='main', notes='', lamp=8, frame=False):
    n = len(lamps)
    arm = 5
    inset = 1 if frame else 0
    h = lamp + 4
    w = arm + n * lamp + 2 * inset + 1
    X = (lambda x, ww=0: x) if d == 'R' else (lambda x, ww=0: w - x - ww)
    data = {'rdKind': 'signal', 'rdSignalType': signal_type, 'rdDirection': direction(d), 'rdAspects': str(n)}
    if notes:
        data['rdNotes'] = notes
    m = Model()
    g = m.group(w, h, data=data)
    m.edge(LINE, (X(1), 0), (X(1), h), g)
    m.edge(LINE, (X(1), h / 2), (X(arm), h / 2), g)
    if frame:
        m.vertex('rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1;',
                 X(arm, n * lamp + 2), 0, n * lamp + 2, h, g)
    for i, colour in enumerate(lamps):
        m.vertex(f'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor={colour};strokeColor=#000000;strokeWidth=1;',
                 X(arm + inset + i * lamp, lamp), 2, lamp, lamp, g)
    return entry(title, m, w, h, f'{SIGNAL_TAGS} {DIR_TAGS[d]} {tags}')


def arm_signal(title, d, arms, tags, notes):
    """Semafor kształtowy: mast, lamp, 1 or 2 arms (rotated bars)."""
    w = 18 + 10 * arms
    h = 16
    X = (lambda x, ww=0: x) if d == 'R' else (lambda x, ww=0: w - x - ww)
    rot = -35 if d == 'R' else 35
    data = {'rdKind': 'signal', 'rdSignalType': 'main', 'rdDirection': direction(d),
            'rdAspects': str(arms + 1), 'rdNotes': notes}
    m = Model()
    g = m.group(w, h, data=data)
    m.edge(LINE, (X(1), 0), (X(1), h), g)
    m.edge(LINE, (X(1), 10), (X(w - 2), 10), g)
    m.vertex('ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;',
             X(4, 6), 7, 6, 6, g)
    for i in range(arms):
        m.vertex(f'rounded=0;whiteSpace=wrap;html=1;fillColor={RED};strokeColor=#000000;strokeWidth=1;rotation={rot};',
                 X(10 + 10 * i, 12), 3, 12, 3, g)
    return entry(title, m, w, h, f'{SIGNAL_TAGS} kształtowy ksztaltowy semaphore arm {DIR_TAGS[d]} {tags}')


def disc_signal(title, d, tags, notes):
    """Tarcza ostrzegawcza kształtowa: round disc on a post (the disc takes the aspect colour)."""
    w, h = 18, 14
    X = (lambda x, ww=0: x) if d == 'R' else (lambda x, ww=0: w - x - ww)
    data = {'rdKind': 'signal', 'rdSignalType': 'main', 'rdDirection': direction(d), 'rdAspects': '2', 'rdNotes': notes}
    m = Model()
    g = m.group(w, h, data=data)
    m.edge(LINE, (X(1), 0), (X(1), h), g)
    m.edge(LINE, (X(1), 7), (X(6), 7), g)
    m.vertex(f'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor={ORANGE};strokeColor=#000000;strokeWidth=2;',
             X(6, 11), 1.5, 11, 11, g)
    return entry(title, m, w, h, f'{SIGNAL_TAGS} {DIR_TAGS[d]} {tags}')


# --------------------------------------------------------------------------------------------
# Boards on a post (groups: foot + arm edges, face vertex)
# --------------------------------------------------------------------------------------------

def board(title, d, face_style, fw, fh, label, tags, data=None, strike=False, font=None):
    arm = 5
    h = max(fh, 14)
    w = arm + fw
    X = (lambda x, ww=0: x) if d != 'L' else (lambda x, ww=0: w - x - ww)
    m = Model()
    g = m.group(w, h, data=data)
    m.edge(LINE, (X(1), 0), (X(1), h), g)
    m.edge(LINE, (X(1), h / 2), (X(arm), h / 2), g)
    fy = (h - fh) / 2
    style = face_style
    if label and 'fontSize' not in style:
        style += f'fontSize={font or 7};fontStyle=1;'
    m.vertex(style, X(arm, fw), fy, fw, fh, g, label=label)
    if strike:
        m.edge(THIN, (X(arm), fy + fh), (X(arm + fw), fy), g)
    d_tags = DIR_TAGS[d] if d in DIR_TAGS else ''
    return entry(title, m, w, h, f'board tablica tarcza wskaźnik wskaznik {d_tags} {tags}')


WHITE_FACE = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontColor=#000000;'
ANNOUNCE_FACE = 'shape=card;size=5;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontColor=#000000;'
BLUE_FACE = f'rounded=0;whiteSpace=wrap;html=1;fillColor={BLUE};strokeColor=#000000;strokeWidth=1;fontColor=#ffffff;'


def stencil_face(name, bg, fg, w=12, h=12):
    return stencil(shape_xml(name, w, h, bg, fg))


RECT12 = '<rect x="0" y="0" w="12" h="12"/>'
RECT14 = '<rect x="0" y="0" w="14" h="14"/>'

STOP_MARKER_FACE = stencil_face(
    'ETCS stop marker', RECT12,
    '<fillstroke/><fillcolor color="fillColor2" default="#ffd600"/>'
    + P(('M', 6, 2), ('L', 10, 6), ('L', 7.5, 6), ('L', 7.5, 10), ('L', 4.5, 10), ('L', 4.5, 6), ('L', 2, 6), 'Z')
    + '<fill/>')
LOCATION_MARKER_FACE = stencil_face(
    'ETCS location marker', RECT12,
    '<fillstroke/><fillcolor color="fillColor2" default="#ffd600"/>'
    + P(('M', 6, 2.5), ('L', 10, 9.5), ('L', 2, 9.5), 'Z') + '<fill/>')


def white_symbol(path_xml, dashed=False):
    dash = '<dashed dashed="1"/>' if dashed else ''
    return ('<fillstroke/><strokecolor color="fillColor2" default="#ffffff"/><strokewidth width="1.5"/>'
            + dash + path_xml + '<stroke/>')


OPEN_SWITCH = P(('M', 2, 9), ('L', 5, 9), ('L', 9, 5)) + P(('M', 9, 9), ('L', 12, 9))
NS_ANNOUNCE_FACE = stencil_face('Neutral section announcement', RECT14, white_symbol(OPEN_SWITCH, dashed=True), 14, 14)
NS_BEGIN_FACE = stencil_face('Neutral section begin', RECT14, white_symbol(OPEN_SWITCH), 14, 14)
NS_END_FACE = stencil_face('Neutral section end', RECT14,
                           white_symbol(P(('M', 2, 9), ('L', 12, 9)) + P(('M', 7, 9), ('L', 7, 5))), 14, 14)
PANTO_DOWN_FACE = stencil_face('Lower pantograph', RECT14,
                               white_symbol(P(('M', 2, 11), ('L', 12, 11))
                                            + P(('M', 7, 10), ('L', 3.5, 8.5), ('L', 7, 7), ('L', 10.5, 8.5), 'Z')
                                            + P(('M', 7, 2), ('L', 7, 5)) + P(('M', 5.5, 3.5), ('L', 7, 5), ('L', 8.5, 3.5))), 14, 14)
PANTO_UP_FACE = stencil_face('Raise pantograph', RECT14,
                             white_symbol(P(('M', 2, 12), ('L', 12, 12))
                                          + P(('M', 7, 11), ('L', 4, 7), ('L', 7, 3), ('L', 10, 7), 'Z')), 14, 14)


# --------------------------------------------------------------------------------------------
# Single-cell stencil symbols
# --------------------------------------------------------------------------------------------

def stencil_style(st, fill=WHITE, stroke=BLACK, extra=''):
    return f'shape={st};whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth=1;{extra}'


TRAIN = stencil(shape_xml(
    'Train', 60, 16,
    P(('M', 0, 1), ('L', 46, 1), ('L', 60, 12), ('L', 60, 15), ('L', 0, 15), 'Z'),
    '<fillstroke/>' + P(('M', 47, 3.5), ('L', 54, 9), ('L', 47, 9), 'Z') + '<stroke/>'
    + P(('M', 4, 4), ('L', 12, 4), ('L', 12, 9), ('L', 4, 9), 'Z') + '<stroke/>'
    + '<fillcolor color="fillColor2" default="#ffd600"/>'
    + P(('M', 36, 4), ('L', 43, 4), ('L', 43, 9), ('L', 36, 9), 'Z') + '<fillstroke/>',
    C(0, 0.5, 'W') + C(1, 0.8, 'E')))

AXLE_COUNTER = stencil(shape_xml(
    'Axle counter', 12, 12, '<ellipse x="0" y="0" w="12" h="12"/>',
    '<fillstroke/>' + P(('M', 6, 0), ('L', 6, 12)) + '<stroke/>' + P(('M', 2.5, 4), ('L', 2.5, 8)) + P(('M', 9.5, 4), ('L', 9.5, 8)) + '<stroke/>',
    SIDE_POINTS))

RAIL_JOINT = stencil(shape_xml(
    'Insulated rail joint', 8, 16, P(('M', 2, 0), ('L', 2, 16)),
    '<stroke/>' + P(('M', 6, 0), ('L', 6, 16)) + '<stroke/>', C(0.5, 0.5, 'C')))

EUROLOOP = stencil(shape_xml(
    'Euroloop', 80, 10, '<roundrect x="0" y="2" w="80" h="6" arcsize="50"/>',
    '<fillstroke/><dashed dashed="1"/>' + P(('M', 5, 5), ('L', 75, 5)) + '<stroke/>',
    C(0, 0.5, 'W') + C(1, 0.5, 'E')))

GSMR_MAST = stencil(shape_xml(
    'GSM-R mast', 20, 32, P(('M', 5, 32), ('L', 10, 8), ('L', 15, 32)),
    '<stroke/>' + P(('M', 6.7, 24), ('L', 13.3, 24)) + P(('M', 8.3, 16), ('L', 11.7, 16))
    + P(('M', 6.7, 24), ('L', 11.7, 16)) + '<stroke/>'
    + '<ellipse x="8" y="4" w="4" h="4"/><fillstroke/>'
    + P(('M', 5, 1), ('L', 2.5, 6), ('L', 5, 11)) + P(('M', 15, 1), ('L', 17.5, 6), ('L', 15, 11)) + '<stroke/>',
    C(0.5, 1, 'S')))

RADIO_INFILL = stencil(shape_xml(
    'Radio infill unit', 24, 24, '<rect x="0" y="8" w="24" h="16"/>',
    '<fillstroke/>' + P(('M', 12, 8), ('L', 12, 1)) + P(('M', 8, 1), ('L', 12, 5), ('L', 16, 1)) + '<stroke/>',
    C(0, 0.67, 'W') + C(1, 0.67, 'E') + C(0.5, 1, 'S')))

DANGER_POINT = stencil(shape_xml(
    'Danger point', 12, 24, P(('M', 6, 0), ('L', 6, 24)),
    '<stroke/>' + P(('M', 1, 1), ('L', 11, 11)) + P(('M', 11, 1), ('L', 1, 11)) + '<stroke/>', C(0.5, 1, 'S')))

SVL = stencil(shape_xml(
    'Supervised location', 12, 24, P(('M', 6, 0), ('L', 6, 24)),
    '<stroke/>' + P(('M', 6, 1), ('L', 11, 5), ('L', 6, 9), ('L', 1, 5), 'Z') + '<fillstroke/>', C(0.5, 1, 'S')))

BRIDGE = stencil(shape_xml(
    'Bridge', 60, 24, P(('M', 0, 0), ('L', 6, 4), ('L', 54, 4), ('L', 60, 0)),
    '<stroke/>' + P(('M', 0, 24), ('L', 6, 20), ('L', 54, 20), ('L', 60, 24)) + '<stroke/>',
    C(0, 0.5, 'W') + C(1, 0.5, 'E')))

TUNNEL = stencil(shape_xml(
    'Tunnel', 60, 24, P(('M', 6, 0), ('L', 6, 24)),
    '<stroke/>' + P(('M', 54, 0), ('L', 54, 24)) + '<stroke/>'
    + P(('M', 0, 0), ('L', 6, 4)) + P(('M', 0, 24), ('L', 6, 20)) + P(('M', 60, 0), ('L', 54, 4)) + P(('M', 60, 24), ('L', 54, 20)) + '<stroke/>'
    + '<dashed dashed="1"/>' + P(('M', 6, 3), ('L', 54, 3)) + P(('M', 6, 21), ('L', 54, 21)) + '<stroke/>',
    C(0, 0.5, 'W') + C(1, 0.5, 'E')))

PLATFORM_EDGE = stencil(shape_xml(
    'Platform edge', 120, 8, P(('M', 0, 0), ('L', 120, 0)),
    '<stroke/>' + ''.join(P(('M', 4 + 8 * i, 0), ('L', 8 * i, 8)) for i in range(1, 15)) + '<stroke/>',
    C(0, 0, 'W') + C(1, 0, 'E')))


def gradient_board(up):
    arm = P(('M', 2, 13), ('L', 18, 5)) if up else P(('M', 2, 5), ('L', 18, 13))
    return stencil(shape_xml('Gradient board ' + ('up' if up else 'down'), 20, 26,
                             P(('M', 10, 26), ('L', 10, 9)),
                             '<stroke/><strokewidth width="2"/>' + arm + '<stroke/>', C(0.5, 1, 'S')))


KM_RULER = stencil(shape_xml(
    'km ruler', 100, 10, P(('M', 0, 9), ('L', 100, 9)),
    '<stroke/>' + ''.join(P(('M', 10 * i, 9), ('L', 10 * i, 1 if i % 5 == 0 else 5)) for i in range(11)) + '<stroke/>',
    C(0, 0.9, 'W') + C(1, 0.9, 'E')))

BUFFER_STOP = stencil(shape_xml(
    'Buffer stop', 14, 18, P(('M', 0, 9), ('L', 8, 9)),
    '<stroke/><strokewidth width="3"/>' + P(('M', 8, 1), ('L', 8, 17)) + '<stroke/>'
    + '<strokewidth width="1"/>' + P(('M', 8, 3), ('L', 13, 9), ('L', 8, 15)) + '<stroke/>',
    C(0, 0.5, 'W')))

TRACK_END = stencil(shape_xml(
    'Track end', 10, 18, P(('M', 0, 9), ('L', 6, 9)),
    '<stroke/><strokewidth width="3"/>' + P(('M', 6, 2), ('L', 6, 16)) + '<stroke/>', C(0, 0.5, 'W')))

DERAILER = stencil(shape_xml(
    'Derailer', 14, 10, P(('M', 0, 10), ('L', 14, 10), ('L', 3, 1), 'Z'),
    '<fillstroke/>', C(0.5, 0, 'N') + C(0.5, 1, 'S')))

FROG = stencil(shape_xml(
    'Frog', 24, 12, P(('M', 0, 0), ('L', 12, 6), ('L', 0, 12)),
    '<stroke/>' + P(('M', 12, 6), ('L', 24, 6)) + '<stroke/>', C(0, 0, 'NW') + C(0, 1, 'SW') + C(1, 0.5, 'E')))


def level_crossing_stencil(cat):
    fg = '<stroke/>' + P(('M', 16, 0), ('L', 16, 40)) + '<stroke/>'
    if cat == 'A':
        fg += ('<strokewidth width="2"/>' + P(('M', 0, 6), ('L', 20, 6)) + P(('M', 0, 34), ('L', 20, 34)) + '<stroke/>'
               '<fillcolor color="stroke"/><ellipse x="18" y="4" w="4" h="4"/><fill/><ellipse x="-2" y="32" w="4" h="4"/><fill/>')
    elif cat == 'B':
        fg += ('<strokewidth width="2"/>' + P(('M', 10, 6), ('L', 20, 6)) + P(('M', 0, 34), ('L', 10, 34)) + '<stroke/>'
               '<fillcolor color="stroke"/><ellipse x="18" y="4" w="4" h="4"/><fill/><ellipse x="-2" y="32" w="4" h="4"/><fill/>')
    elif cat == 'C':
        fg += ('<fillcolor color="fillColor2" default="#e00000"/>'
               '<ellipse x="17" y="2" w="5" h="5"/><fillstroke/><ellipse x="-2" y="33" w="5" h="5"/><fillstroke/>')
    else:
        fg += P(('M', 17, 2), ('L', 22, 7)) + P(('M', 22, 2), ('L', 17, 7)) + P(('M', -2, 33), ('L', 3, 38)) + P(('M', 3, 33), ('L', -2, 38)) + '<stroke/>'
    return stencil(shape_xml('Level crossing ' + cat, 20, 40, P(('M', 4, 0), ('L', 4, 40)), fg,
                             C(0.5, 0, 'N') + C(0.5, 1, 'S') + C(0, 0.5, 'W') + C(1, 0.5, 'E')))


BARRIER = stencil(shape_xml(
    'Barrier', 30, 8, P(('M', 4, 4), ('L', 30, 4)),
    '<strokewidth width="3"/><stroke/><strokewidth width="1"/><fillcolor color="stroke"/><ellipse x="0" y="1" w="6" h="6"/><fill/>',
    C(0, 0.5, 'W')))

ROAD_LIGHTS = stencil(shape_xml(
    'Road crossing lights', 16, 30, P(('M', 8, 30), ('L', 8, 12)),
    '<stroke/><rect x="0" y="2" w="16" h="10"/><fillstroke/><fillcolor color="fillColor2" default="#e00000"/>'
    '<ellipse x="1.5" y="4" w="6" h="6"/><fillstroke/><ellipse x="8.5" y="4" w="6" h="6"/><fillstroke/>'
    + P(('M', 1, 0), ('L', 15, 0)) + '<stroke/>',
    C(0.5, 1, 'S')))


def single(title, style, w, h, tags, label='', data=None):
    m = Model()
    m.vertex(style, 0, 0, w, h, label=label, data=data)
    return entry(title, m, w, h, tags)


LABEL_BELOW = 'verticalLabelPosition=bottom;verticalAlign=top;labelBackgroundColor=none;fontSize=8;'
LABEL_ABOVE = 'verticalLabelPosition=top;verticalAlign=bottom;labelBackgroundColor=none;fontSize=8;'


# --------------------------------------------------------------------------------------------
# Track pieces, turnouts, crossovers (top-level edges with track / points data)
# --------------------------------------------------------------------------------------------

def track_data():
    return {'rdKind': 'track'}


def hand_from_geometry(toe, leg):
    """Hand of points read from the TOE (looking from the toe / blade tips towards the frog, the
    diverging leg to the left = 'left'). `toe` = direction from the junction to the toe, `leg` =
    direction from the junction along the diverging leg; screen y grows downwards. Mirrors
    src/railway/hand.ts handFromGeometry."""
    return 'left' if toe[0] * leg[1] - toe[1] * leg[0] > 0 else 'right'


def points_data(toe_left, up):
    side = -1 if toe_left else 1
    hand = hand_from_geometry((side, 0), (-side, -1 if up else 1))
    return {'rdKind': 'points', 'rdHand': hand, 'rdPosition': 'normal'}


def turnout_set(title, ratio, toe_left, up, tags, curved=False):
    leg = 60 if ratio == 9 else 80
    w = leg + 40
    h = 20
    y = h if up else 0
    ye = 0 if up else h
    toe = 20 if toe_left else w - 20
    end = toe + leg if toe_left else toe - leg
    m = Model()
    m.edge(TRACK, (0, y), (w, y), data=track_data())
    style = LEG + ('curved=1;' if curved else '')
    pts = [((toe + end) / 2, y + (ye - y) * 0.25)] if curved else ()
    m.edge(style, (toe, y), (end, ye), points=pts, data=points_data(toe_left, up))
    return entry(title, m, w, h, f'points switch turnout zwrotnica rozjazd track tor {tags}')


def crossover(title, kind, tags):
    """kind: 'down' (\\), 'up' (/), 'scissors'."""
    w, h = 120, 30
    m = Model()
    m.edge(TRACK, (0, 0), (w, 0), data=track_data())
    m.edge(TRACK, (0, h), (w, h), data=track_data())
    if kind in ('down', 'scissors'):
        mid = (50, 10) if kind == 'scissors' else (60, 15)
        m.edge(LEG, (30, 0), mid, data=points_data(True, False))
        m.edge(LEG, (90, h), mid, data=points_data(False, True))
    if kind in ('up', 'scissors'):
        mid = (70, 10) if kind == 'scissors' else (60, 15)
        m.edge(LEG, (30, h), mid, data=points_data(True, True))
        m.edge(LEG, (90, 0), mid, data=points_data(False, False))
    return entry(title, m, w, h, f'crossover rozjazd przejście przejscie zwrotnica points switch track tor {tags}')


def diamond(title, slips, tags):
    w, h = 100, 40
    m = Model()
    m.edge(TRACK, (0, 20), (w, 20), data=track_data())
    m.edge(TRACK, (20, 40), (80, 0), data=track_data())
    if slips >= 1:
        m.edge(LEG + 'curved=1;', (20, 20), (65, 10), points=[(45, 18)], data=points_data(True, True))
    if slips >= 2:
        m.edge(LEG + 'curved=1;', (80, 20), (35, 30), points=[(55, 22)], data=points_data(False, False))
    return entry(title, m, w, h, f'crossing skrzyżowanie skrzyzowanie diamond track tor {tags}')


def track_piece(title, p1, p2, w, h, tags, data=None, style=TRACK):
    m = Model()
    m.edge(style, p1, p2, data=data if data is not None else track_data())
    return entry(title, m, w, h, f'track tor {tags}')


# --------------------------------------------------------------------------------------------
# Balises
# --------------------------------------------------------------------------------------------

def balise_style(d, filled):
    fill = BLACK if filled else WHITE
    direction_style = '' if d == 'R' else 'direction=west;'
    return f'triangle;whiteSpace=wrap;html=1;{direction_style}fillColor={fill};strokeColor=#000000;strokeWidth=1;'


BALISE_TAGS = 'balise balisa eurobalise'


def balise(title, d, filled, tags, notes):
    data = {'rdKind': 'balise', 'rdDirection': direction(d), 'rdNotes': notes}
    return single(title, balise_style(d, filled), 12, 12, f'{BALISE_TAGS} {DIR_TAGS[d]} {tags}', data=data)


def balise_group(title, d, count, filled, tags, function, notes='', linked=False):
    w = 16 * count - 4
    h = 26 if linked else 24
    m = Model()
    m.vertex('text;html=1;align=center;verticalAlign=middle;fontSize=8;whiteSpace=wrap;', 0, 0, w, 10,
             label='%rdId%', data={'rdKind': 'baliseGroup', 'rdId': 'BG1', 'rdCount': str(count),
                                   'rdDirection': direction(d), 'rdFunction': function,
                                   **({'rdNotes': notes} if notes else {})})
    order = range(count) if d == 'R' else range(count - 1, -1, -1)
    for pos, i in enumerate(order, start=1):
        m.vertex(balise_style(d, filled), 16 * i, 11, 12, 12,
                 data={'rdKind': 'balise', 'rdId': f'B{pos}', 'rdGroupId': 'BG1', 'rdPosition': str(pos),
                       'rdDirection': direction(d)})
    if linked:
        arrow = 'endArrow=open;endSize=4;html=1;rounded=0;strokeColor=#000000;strokeWidth=1;dashed=1;'
        p1, p2 = ((0, 25), (w, 25)) if d == 'R' else ((w, 25), (0, 25))
        m.edge(arrow, p1, p2)
    return entry(title, m, w, h, f'{BALISE_TAGS} group grupa bg {DIR_TAGS[d]} {tags}')


# --------------------------------------------------------------------------------------------
# Libraries
# --------------------------------------------------------------------------------------------

def ertms_extra():
    out = []
    for d, side in (('R', 'Right'), ('L', 'Left')):
        flip = '' if d == 'R' else 'flipV=1;'
        out.append(board(f'ETCS Stop Marker {side}', d, stencil_style(STOP_MARKER_FACE, BLUE, extra=flip), 12, 12, '',
                         'etcs stop marker marker board eob wskaźnik zatrzymania etcs',
                         data={'rdKind': 'signal', 'rdSignalType': 'etcsStopMarker', 'rdDirection': direction(d)}))
    for d, side in (('R', 'Right'), ('L', 'Left')):
        flip = '' if d == 'R' else 'flipV=1;'
        out.append(board(f'ETCS Location Marker {side}', d, stencil_style(LOCATION_MARKER_FACE, BLUE, extra=flip), 12, 12, '',
                         'etcs location marker marker board tablica etcs',
                         data={'rdKind': 'signal', 'rdSignalType': 'markerBoard', 'rdDirection': direction(d)}))
    for level in ('L0', 'L1', 'L2', 'L3', 'NTC'):
        out.append(board(f'Level Transition {level}', 'R', WHITE_FACE, 16, 12, level,
                         f'etcs level transition execution board {level.lower()} poziom zmiana poziomu'))
    out.append(board('Level Transition Announcement', 'R', ANNOUNCE_FACE, 16, 12, 'L2',
                     'etcs level transition announcement board zapowiedź zapowiedz poziom'))
    out.append(board('RBC Border Announcement', 'R', ANNOUNCE_FACE, 18, 12, 'RBC',
                     'rbc border handover announcement board granica zapowiedź'))
    out.append(board('RBC Border', 'R', WHITE_FACE, 18, 12, 'RBC', 'rbc border handover execution board granica'))
    out.append(board('Cab Signalling Begin', 'R', WHITE_FACE, 18, 12, 'CAB',
                     'cab signalling begin start board etcs sygnalizacja kabinowa początek poczatek'))
    out.append(board('Cab Signalling End', 'R', WHITE_FACE, 18, 12, 'CAB',
                     'cab signalling end board etcs sygnalizacja kabinowa koniec', strike=True))
    out.append(board('Neutral Section Announcement', 'R', stencil_style(NS_ANNOUNCE_FACE, BLUE), 14, 14, '',
                     'neutral section announcement phase break board sekcja izolowana zapowiedź we'))
    out.append(board('Neutral Section Begin', 'R', stencil_style(NS_BEGIN_FACE, BLUE), 14, 14, '',
                     'neutral section begin open main circuit breaker board sekcja izolowana wyłącz wylacz'))
    out.append(board('Neutral Section End', 'R', stencil_style(NS_END_FACE, BLUE), 14, 14, '',
                     'neutral section end close main circuit breaker board sekcja izolowana załącz zalacz'))
    out.append(board('Lower Pantograph', 'R', stencil_style(PANTO_DOWN_FACE, BLUE), 14, 14, '',
                     'pantograph lower down board opuść opusc pantograf'))
    out.append(board('Raise Pantograph', 'R', stencil_style(PANTO_UP_FACE, BLUE), 14, 14, '',
                     'pantograph raise up board podnieś podnies pantograf'))
    out.append(board('Track Condition Board', 'R', WHITE_FACE, 18, 12, 'TC',
                     'track condition board etcs warunki toru'))
    out.append(board('Non-Stopping Area Board', 'R', WHITE_FACE, 18, 12, 'STOP',
                     'non stopping area track condition board zakaz zatrzymania', strike=True, font=6))
    out.append(board('Release Speed Board', 'R', WHITE_FACE, 16, 12, '40',
                     'release speed vrelease board etcs prędkość zwolnienia predkosc'))
    # balises
    for d, side in (('R', 'Right'), ('L', 'Left')):
        out.append(balise(f'Fixed Balise {side}', d, False, 'fixed stała stala', 'Fixed balise'))
    for d, side in (('R', 'Right'), ('L', 'Left')):
        out.append(balise(f'Switchable Balise {side}', d, True, 'switchable controlled transparent przełączalna przelaczalna sterowana',
                          'Switchable (controlled) balise'))
    for d, side in (('R', 'Right'), ('L', 'Left')):
        out.append(balise_group(f'Balise Group 2 {side}', d, 2, False, 'double podwójna podwojna fixed', 'fixed'))
    for d, side in (('R', 'Right'), ('L', 'Left')):
        out.append(balise_group(f'Switchable Balise Group 2 {side}', d, 2, True, 'double switchable controlled leu przełączalna', 'switchable'))
    out.append(balise_group('Balise Group 3 Right', 'R', 3, False, 'triple fixed', 'fixed'))
    for d, side in (('R', 'Right'), ('L', 'Left')):
        out.append(balise_group(f'Linked Balise Group {side}', d, 2, False, 'linked powiązana powiazana linking', 'fixed',
                                notes='Linked balise group', linked=True))
    out.append(single('Euroloop', stencil_style(EUROLOOP, 'none'), 80, 10, 'euroloop loop infill pętla petla'))
    # equipment
    out.append(single('RBC', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontStyle=1;fontSize=10;',
                      40, 24, 'rbc radio block centre center centrum', label='RBC', data={'rdKind': 'rbc'}))
    out.append(single('LEU', 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontStyle=1;fontSize=8;',
                      30, 16, 'leu lineside electronic unit koder', label='LEU', data={'rdKind': 'leu'}))
    out.append(single('Axle Counter Head', stencil_style(AXLE_COUNTER), 12, 12,
                      'axle counter head detection point licznik osi czujnik punkt detekcji', data={'rdKind': 'axleCounter'}))
    out.append(single('Axle Counter Evaluator', 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontStyle=1;fontSize=8;',
                      30, 16, 'axle counter evaluator ace evaluation licznik osi ewaluator', label='ACE'))
    out.append(single('Insulated Rail Joint', stencil_style(RAIL_JOINT, 'none'), 8, 16,
                      'insulated rail joint track circuit joint irj tc styk izolowany obwód torowy obwod',
                      data={'rdKind': 'insulatedJoint'}))
    out.append(single('Radio Infill Unit', stencil_style(RADIO_INFILL, extra='verticalAlign=bottom;spacingBottom=1;fontSize=7;fontStyle=1;'),
                      24, 24, 'radio infill unit riu euroradio', label='RIU'))
    out.append(single('GSM-R Mast', stencil_style(GSMR_MAST, 'none'), 20, 32, 'gsm-r gsmr mast bts radio antenna maszt'))
    out.append(single('Interlocking', 'shape=ext;double=1;rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontStyle=1;fontSize=10;',
                      44, 28, 'interlocking ixl electronic interlocking nastawnia urządzenia srk', label='IXL'))
    out.append(single('Object Controller', 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontStyle=1;fontSize=8;',
                      30, 16, 'object controller oc sterownik obiektowy', label='OC'))
    # trains
    for d, side in (('R', 'Right'), ('L', 'Left')):
        flip = '' if d == 'R' else 'flipH=1;'
        out.append(single(f'ETCS Train {side}', stencil_style(TRAIN, extra=flip), 60, 16,
                          f'train pociąg pociag etcs onboard obu evc {DIR_TAGS[d]}',
                          data={'rdKind': 'train', 'rdEtcsLevel': '2'}))
    # annotations
    for d, side in (('R', 'Right'), ('L', 'Left')):
        m = Model()
        p1, p2 = ((0, 6), (100, 6)) if d == 'R' else ((100, 6), (0, 6))
        m.edge(f'endArrow=block;endFill=1;html=1;rounded=0;strokeColor={GREEN};strokeWidth=3;fontSize=8;labelBackgroundColor=none;verticalAlign=bottom;',
               p1, p2, label='MA')
        out.append(entry(f'MA Arrow {side}', m, 100, 12, f'movement authority ma arrow zezwolenie na jazdę jazde {DIR_TAGS[d]}'))
    out.append(single('End of Authority', f'shape=line;direction=south;html=1;strokeColor={RED};strokeWidth=3;{LABEL_BELOW}',
                      10, 24, 'end of authority eoa koniec zezwolenia', label='EoA'))
    out.append(single('Danger Point', stencil_style(DANGER_POINT, 'none', RED, LABEL_BELOW), 12, 24,
                      'danger point dp punkt niebezpieczny', label='DP'))
    out.append(single('Supervised Location', stencil_style(SVL, WHITE, BLACK, LABEL_BELOW), 12, 24,
                      'supervised location svl nadzorowane miejsce', label='SvL'))
    m = Model()
    m.edge('endArrow=none;html=1;rounded=0;strokeColor=#c05000;strokeWidth=2;fontSize=8;labelBackgroundColor=none;verticalAlign=bottom;',
           (0, 14), (60, 14), points=[(0, 4), (60, 4)], label='OL')
    out.append(entry('Overlap', m, 60, 14, 'overlap ol bracket zakres ochronny'))
    return out


PL_SIG = 'semafor świetlny swietlny light signal pkp plk'


def railway_pl():
    out = []
    generic = {2: [GREEN, RED], 3: [ORANGE, RED, GREEN], 4: [ORANGE, RED, ORANGE, GREEN], 5: [WHITE, ORANGE, RED, ORANGE, GREEN]}
    for n in (2, 3, 4, 5):
        for d, side in (('R', 'prawy'), ('L', 'lewy')):
            out.append(light_signal(f'Semafor {n}-komorowy {side}', d, generic[n], f'{PL_SIG} {n} komory komór komor',
                                    notes=f'Semafor świetlny {n}-komorowy'))
    kinds = [
        ('Semafor wjazdowy', [WHITE, ORANGE, RED, ORANGE, GREEN], 'wjazdowy entry home signal sz zastępczy zastepczy', 'Semafor wjazdowy (z Sz)'),
        ('Semafor wyjazdowy', [WHITE, RED, ORANGE, GREEN], 'wyjazdowy exit starting signal sz ms2', 'Semafor wyjazdowy (z Sz)'),
        ('Semafor drogowy', [ORANGE, RED, ORANGE, GREEN], 'drogowy intermediate route signal', 'Semafor drogowy'),
        ('Semafor odstępowy', [ORANGE, RED, GREEN], 'odstępowy odstepowy block signal sbl samoczynna blokada liniowa', 'Semafor odstępowy SBL'),
    ]
    for name, lamps, tags, notes in kinds:
        for d, side in (('R', 'prawy'), ('L', 'lewy')):
            out.append(light_signal(f'{name} {side}', d, lamps, f'{PL_SIG} {tags}', notes=notes))
    for d, side in (('R', 'prawy'), ('L', 'lewy')):
        out.append(light_signal(f'Powtarzacz semafora {side}', d, [ORANGE, GREEN], f'{PL_SIG} powtarzacz repeater sp sp1 sp2 sp3 sp4',
                                notes='Powtarzacz semafora (Sp)', frame=True))
    for d, side in (('R', 'prawy'), ('L', 'lewy')):
        out.append(light_signal(f'Tarcza ostrzegawcza świetlna To {side}', d, [ORANGE, GREEN],
                                'tarcza ostrzegawcza to os os1 os2 os3 os4 distant warning signal', notes='Tarcza ostrzegawcza (To)'))
    for d, side in (('R', 'prawy'), ('L', 'lewy')):
        out.append(disc_signal(f'Tarcza ostrzegawcza kształtowa {side}', d,
                               'tarcza ostrzegawcza kształtowa ksztaltowa to os distant disc', 'Tarcza ostrzegawcza kształtowa (To)'))
    for d, side in (('R', 'prawy'), ('L', 'lewy')):
        out.append(light_signal(f'Tarcza ostrzegawcza przejazdowa Osp {side}', d, [ORANGE, WHITE],
                                'tarcza ostrzegawcza przejazdowa osp osp1 osp2 level crossing warning przejazd',
                                notes='Tarcza ostrzegawcza przejazdowa (Osp)'))
    for d, side in (('R', 'prawy'), ('L', 'lewy')):
        out.append(light_signal(f'Tarcza zaporowa Tz {side}', d, [RED, WHITE], 'tarcza zaporowa tz stop shunting ms2',
                                signal_type='shunting', notes='Tarcza zaporowa (Tz)', lamp=7))
    for d, side in (('R', 'prawy'), ('L', 'lewy')):
        out.append(light_signal(f'Tarcza manewrowa Tm {side}', d, [SHUNT_BLUE, WHITE], 'tarcza manewrowa tm ms1 ms2 shunting signal manewry',
                                signal_type='shunting', notes='Tarcza manewrowa (Tm)', lamp=7))
    for d, side in (('R', 'prawy'), ('L', 'lewy')):
        out.append(light_signal(f'Sygnał zastępczy Sz {side}', d, [WHITE], 'sygnał zastępczy sygnal zastepczy sz substitution',
                                notes='Sygnał zastępczy (Sz)'))
    for arms in (1, 2):
        for d, side in (('R', 'prawy'), ('L', 'lewy')):
            out.append(arm_signal(f'Semafor kształtowy {arms}-ramienny {side}', d, arms, f'{arms} ramię ramienny ramie',
                                  f'Semafor kształtowy {arms}-ramienny'))
    # wskaźniki (boards; generic depiction with the code as an editable label)
    for code, title, tags in (
            ('W1', 'Wskaźnik W1', 'w1'),
            ('W4', 'Wskaźnik W4', 'w4 zatrzymania'),
            ('60', 'Wskaźnik W8 (ograniczenie prędkości)', 'w8 ograniczenie prędkości predkosci speed limit'),
            ('60', 'Wskaźnik W9 (zapowiedź ograniczenia)', 'w9 zapowiedź ograniczenia speed warning'),
            ('W24', 'Wskaźnik W24', 'w24'),
            ('W', 'Wskaźnik (pusty)', 'blank pusty generic')):
        face = ANNOUNCE_FACE if code == '60' and 'W9' in title else WHITE_FACE
        out.append(board(title, 'R', face, 16, 12, code, f'pkp plk {tags}'))
    out.append(board('Tarcza D1 (Stój)', 'R', f'rounded=0;whiteSpace=wrap;html=1;fillColor={RED};strokeColor=#000000;strokeWidth=2;', 12, 12, '',
                     'd1 stój stoj stop tarcza zatrzymania pkp plk'))
    # przejazdy
    for cat, protection, desc in (('A', 'fullBarriers', 'rogatki'), ('B', 'halfBarriers', 'półrogatki polrogatki'),
                                  ('C', 'lights', 'sygnalizacja świetlna swietlna'), ('D', 'passive', 'bez zabezpieczeń zabezpieczen')):
        out.append(single(f'Przejazd kat. {cat}', stencil_style(level_crossing_stencil(cat), 'none'), 20, 40,
                          f'przejazd kolejowo-drogowy level crossing kategoria {cat.lower()} {desc}',
                          data={'rdKind': 'levelCrossing', 'rdProtection': protection}))
    out.append(single('Rogatka', stencil_style(BARRIER, 'none'), 30, 8, 'rogatka barrier szlaban przejazd level crossing'))
    out.append(single('Sygnalizator przejazdowy (drogowy)', stencil_style(ROAD_LIGHTS), 16, 30,
                      'sygnalizator przejazdowy drogowy road lights przejazd level crossing'))
    for d, side, flip in (('R', 'z prawej', ''), ('L', 'z lewej', 'flipH=1;')):
        out.append(single(f'Kozioł oporowy {side}', stencil_style(BUFFER_STOP, 'none', extra=flip), 14, 18,
                          'kozioł koziol oporowy buffer stop koniec toru', data={'rdKind': 'bufferStop'}))
    # rozjazdy
    out.append(turnout_set('Rozjazd zwyczajny lewy', 9, True, True, 'zwyczajny lewy left'))
    out.append(turnout_set('Rozjazd zwyczajny prawy', 9, True, False, 'zwyczajny prawy right'))
    out.append(turnout_set('Rozjazd łukowy lewy', 9, True, True, 'łukowy lukowy curved lewy left', curved=True))
    out.append(turnout_set('Rozjazd łukowy prawy', 9, True, False, 'łukowy lukowy curved prawy right', curved=True))
    out.append(diamond('Skrzyżowanie torów', 0, 'skrzyżowanie torów torow diamond crossing'))
    out.append(diamond('Rozjazd krzyżowy pojedynczy', 1, 'rozjazd krzyżowy krzyzowy pojedynczy rkp single slip zwrotnica points'))
    out.append(diamond('Rozjazd krzyżowy podwójny', 2, 'rozjazd krzyżowy krzyzowy podwójny podwojny rkpd double slip zwrotnica points'))
    out.append(single('Styk izolowany', stencil_style(RAIL_JOINT, 'none'), 8, 16,
                      'styk izolowany insulated rail joint obwód torowy obwod tc', data={'rdKind': 'insulatedJoint'}))
    out.append(single('Krzyżownica', stencil_style(FROG, 'none'), 24, 12, 'krzyżownica krzyzownica frog crossing nose'))
    for side, flip in (('prawa', ''), ('lewa', 'flipH=1;')):
        out.append(single(f'Wykolejnica {side}', stencil_style(DERAILER, WHITE, BLACK, flip), 14, 10,
                          'wykolejnica derailer wk zabezpieczenie'))
    out.append(single('Peron jednokrawędziowy', f'rounded=0;whiteSpace=wrap;html=1;fillColor={GREY};strokeColor=#000000;strokeWidth=1;fontSize=8;',
                      160, 12, 'peron platform jednokrawędziowy jednokrawedziowy side platform', label='Peron 1'))
    out.append(single('Peron wyspowy', f'rounded=0;whiteSpace=wrap;html=1;fillColor={GREY};strokeColor=#000000;strokeWidth=1;fontSize=8;',
                      160, 24, 'peron platform wyspowy island platform dwukrawędziowy', label='Peron 2'))
    out.append(single('Nastawnia', 'shape=ext;double=1;rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontSize=9;',
                      60, 28, 'nastawnia signal box interlocking dysponująca dysponujaca wykonawcza', label='Nastawnia'))
    out.append(single('Posterunek', 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontSize=9;',
                      60, 24, 'posterunek ruchu post bocznicowy odgałęźny', label='Posterunek'))
    out.append(single('Słupek hektometrowy', f'shape=line;direction=south;html=1;strokeColor=#000000;strokeWidth=2;{LABEL_BELOW}',
                      8, 14, 'hektometr słupek slupek hectometre post kilometraż kilometraz km', label='12,3'))
    out.append(board('Wskaźnik kilometrowy', 'R', WHITE_FACE, 16, 12, '12', 'kilometrowy km post kilometraż kilometraz'))
    return out


def track_layout():
    out = []
    out.append(track_piece('Straight Track', (0, 0), (120, 0), 120, 1, 'straight prosty'))
    out.append(track_piece('Straight Track Short', (0, 0), (60, 0), 60, 1, 'straight short krótki krotki'))
    out.append(track_piece('Vertical Track', (0, 0), (0, 60), 1, 60, 'vertical pionowy'))
    out.append(track_piece('Diagonal Track Up', (0, 40), (40, 0), 40, 40, 'diagonal skośny skosny up'))
    out.append(track_piece('Diagonal Track Down', (0, 0), (40, 40), 40, 40, 'diagonal skośny skosny down'))
    out.append(track_piece('Track Section', (0, 0), (120, 0), 120, 1, 'track section tvd odcinek izolowany obwód torowy obwod tc',
                           data={'rdKind': 'trackSection', 'rdSectionType': 'tc'},
                           style='endArrow=none;html=1;rounded=0;strokeColor=#0050aa;strokeWidth=4;'))
    for d, flip in (('Right', ''), ('Left', 'flipH=1;')):
        out.append(single(f'Track End {d}', stencil_style(TRACK_END, 'none', extra=flip), 10, 18,
                          'track end end of track koniec toru buffer'))
    for ratio in (9, 12):
        for toe_left in (True, False):
            for up in (True, False):
                hand = points_data(toe_left, up)['rdHand'].capitalize()
                toe = 'toe left' if toe_left else 'toe right'
                out.append(turnout_set(f'Turnout 1:{ratio} {hand} ({toe})', ratio, toe_left, up,
                                       f'1:{ratio} {hand.lower()} {"lewy" if hand == "Left" else "prawy"}'))
    out.append(crossover('Single Crossover Down', 'down', 'single pojedynczy'))
    out.append(crossover('Single Crossover Up', 'up', 'single pojedynczy'))
    out.append(crossover('Scissors Crossover', 'scissors', 'scissors double nożycowy nozycowy podwójny'))
    out.append(diamond('Diamond Crossing', 0, 'diamond crossing'))
    out.append(diamond('Single Slip', 1, 'single slip rkp points switch'))
    out.append(diamond('Double Slip', 2, 'double slip rkpd points switch'))
    out.append(single('Platform Edge', stencil_style(PLATFORM_EDGE, 'none'), 120, 8, 'platform edge krawędź peronu krawedz peron'))
    out.append(single('Platform', f'rounded=0;whiteSpace=wrap;html=1;fillColor={GREY};strokeColor=#000000;strokeWidth=1;fontSize=8;',
                      120, 16, 'platform peron', label='Platform 1'))
    out.append(single('Bridge', stencil_style(BRIDGE, 'none'), 60, 24, 'bridge most wiadukt viaduct'))
    out.append(single('Tunnel', stencil_style(TUNNEL, 'none'), 60, 24, 'tunnel tunel'))
    out.append(single('Level Crossing', stencil_style(level_crossing_stencil('A'), 'none'), 20, 40,
                      'level crossing przejazd road barriers rogatki', data={'rdKind': 'levelCrossing', 'rdProtection': 'fullBarriers'}))
    out.append(single('km Post', f'shape=line;direction=south;html=1;strokeColor=#000000;strokeWidth=2;{LABEL_BELOW}',
                      8, 16, 'km post kilometre marker kilometraż kilometraz chainage', label='12.0'))
    out.append(single('Hectometre Mark', f'shape=line;direction=south;html=1;strokeColor=#000000;strokeWidth=1;{LABEL_BELOW}',
                      8, 10, 'hectometre hektometr mark chainage km', label='12.3'))
    out.append(single('km Ruler', stencil_style(KM_RULER, 'none', extra=LABEL_BELOW), 100, 10,
                      'km ruler scale chainage kilometraż kilometraz linijka', label='1 km'))
    out.append(single('Gradient Board Up', stencil_style(gradient_board(True), 'none', extra=LABEL_ABOVE), 20, 26,
                      'gradient board up incline pochylenie wzniesienie wskaźnik', label='5 ‰'))
    out.append(single('Gradient Board Down', stencil_style(gradient_board(False), 'none', extra=LABEL_ABOVE), 20, 26,
                      'gradient board down decline pochylenie spadek wskaźnik', label='5 ‰'))
    out.append(board('Speed Board', 'R', WHITE_FACE, 16, 12, '80', 'speed board limit prędkość predkosc', font=8))
    out.append(board('Speed Warning Board', 'R', ANNOUNCE_FACE, 16, 12, '80', 'speed warning announcement board zapowiedź prędkość', font=8))
    out.append(single('Track Number', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontStyle=1;fontSize=9;',
                      20, 14, 'track number label numer toru', label='1'))
    return out


def write_library(path, entries):
    titles = [e['title'] for e in entries]
    dupes = {t for t in titles if titles.count(t) > 1}
    if dupes:
        raise SystemExit(f'duplicate titles in {path}: {sorted(dupes)}')
    items = []
    for e in entries:
        items.append({'xml': esc_xml(e['xml']), 'w': e['w'], 'h': e['h'], 'title': e['title'], 'tags': e['tags']})
    text = '<mxlibrary>' + json.dumps(items, ensure_ascii=False, indent=2) + '</mxlibrary>\n'
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    return len(entries)


def esc_xml(xml):
    """As draw.io stores uncompressed entries: the model XML with <, > and & escaped."""
    return xml.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main(argv):
    if len(argv) != 2:
        raise SystemExit('usage: build_railway_libraries.py <public/libraries>')
    out_dir = argv[1]
    counts = {}
    for name, builder in (('ertms-extra.xml', ertms_extra), ('railway-pl.xml', railway_pl), ('track-layout.xml', track_layout)):
        counts[name] = write_library(os.path.join(out_dir, name), builder())
    print(' '.join(f'{k}: {v}' for k, v in counts.items()))


if __name__ == '__main__':
    main(sys.argv)
