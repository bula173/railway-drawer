#!/usr/bin/env python3
"""
Builds the app's ERTMS library (public/libraries/ertms.xml) from the user's draw.io export
(ERTMSDrawioTemplate/ERTMS.xml, never modified):

  python3 -I scripts/ertms-library/build_app_library.py ../ERTMSDrawioTemplate/ERTMS.xml public/libraries/ertms.xml

Steps (deterministic; entries that do not change keep their exact bytes):
 1. removes ERTMS scenarios 14, 15 and 18 (library indices 31, 32, 35), on the user's request;
 2. renames the signal labels "KBS<n>" to "S<n>" (numbers and suffixes kept, image data untouched);
 3. palette elements (the 18 titled entries): the railway data the app pre-assigned by title on
    insert is stored in the entry as a draw.io <object>/<UserObject> (rdKind + preset values, no ID:
    the ID is generated on insert);
 4. scenario templates: every railway symbol gets its kind and data, decorations stay untyped:
    - tracks: horizontal track lines (vsdxID=17, stroke >= 4, length >= 15) on the same y are
      merged into one `track` edge T<n> (the grey drawing edge, extended over the drawn union and
      kept at the position of the first edge of that line, so coloured MA/route highlight edges
      drawn over the line stay on top; the other grey edges of that line are removed); diagonal
      track edges are points legs `points` W<n> (hand from the leg: down to the right = left, as
      the library's "Point Left"; coloured highlight legs over a grey leg stay decoration; leg ends drawn up to 12 px short of a track are extended onto it);
    - TVD sections (Part 6): each track is covered by `trackSection` edges TC<n> (same stroke, on
      top of the track, below the highlights) split at the TC joint markers drawn on it and at the
      points legs' ends; a track without markers or points is split at its signals; a track
      without any of these is one section. Sections carry rdTrackId and rdSectionType=tc (when
      demarcated by TC markers). TC joint markers themselves stay untyped (decoration);
    - signals: groups with signal heads (vsdxID 229/231): `signal`, type main (shunting for
      "SS<n>" labels), direction nominal when the mast is left of the lamps ("Signal Right"),
      reverse otherwise, aspects = number of lamps, ID from the label inside/next to it (S<n>, ...);
    - balises: 12x12 triangles within 40 px of a track (others are legend symbols): `balise` B<n>, direction from the triangle (west = reverse); a
      "BG<n>" label with balises within 40 px becomes their `baliseGroup` (ID BG<n>, NID_BG n,
      count); a balise without a BG label becomes its own group (count 1, generated BG<n> /
      NID_BG n, function infill for "*_infill") on the text label within 25 px whose nearest
      balise it is (LTA, LTO, S2_BG, S4_infill: the level transition templates); balises are not
      grouped by distance, since neighbouring balises there (LTA / S4_infill, 26 px) are different
      groups; balises get groupId and position (left to right); balise groups get no NID_C: they use
      the diagram's default country (rdCountryId on the root cell, 510 when not set; the app's
      project-settings.ts), so a template follows the country of the diagram it is inserted into;
    - trains: groups with the train stencils: `train` TR<n>.
    IDs are unique per template; the app renumbers colliding IDs on insert (insertTemplate).
"""
import html
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

SEP = '\n  },\n  {\n'
REMOVED_INDICES = (31, 32, 35)  # ERTMS scenario 14, 15, 18
KBS = re.compile(r'(?<![A-Za-z0-9+/])[Kk][Bb][Ss](\d+[A-Za-z0-9_]*)(?![A-Za-z0-9+/=])')
ID_LABEL = re.compile(r'^[A-Z]{1,3}\d+[A-Za-z0-9_]*$')
GREY = '#a5a5a5'
# a balise without a BG<n> label becomes a group on the text label this close to it (centres)
LABEL_GROUP_DISTANCE = 25


# ------------------------------------------------------------------------------------------------
# file level
# ------------------------------------------------------------------------------------------------

def split(text):
    start = text.index('[\n  {\n') + len('[\n  {\n')
    end = text.rindex('\n  }\n]')
    parts = text[start:end].split(SEP)
    for p in parts:
        json.loads('{\n' + p + '\n}')
    return text[:start], parts, text[end:]


def join(head, parts, tail):
    return head + SEP.join(parts) + tail


def entry_of(part):
    return json.loads('{\n' + part + '\n}')


def replace_xml(part, new_model):
    """Writes `new_model` (model XML) into the raw entry text, keeping the other keys' bytes."""
    m = re.match(r'(\s*"xml": )("(?:[^"\\]|\\.)*")', part)
    assert m, part[:80]
    escaped = new_model.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return m.group(1) + json.dumps(escaped, ensure_ascii=False) + part[m.end():]


def model_text(root_el):
    return ET.tostring(root_el, encoding='unicode').replace(' />', '/>')


# ------------------------------------------------------------------------------------------------
# model helpers
# ------------------------------------------------------------------------------------------------

def cell_of(el):
    return el if el.tag == 'mxCell' else el.find('mxCell')


def style_str(el):
    c = cell_of(el)
    return c.get('style', '') if c is not None else ''


def style_map(el):
    return dict(kv.split('=', 1) for kv in style_str(el).split(';') if '=' in kv)


def style_names(el):
    return [kv for kv in style_str(el).split(';') if kv and '=' not in kv]


def label_of(el):
    raw = el.get('label') if el.tag != 'mxCell' else el.get('value')
    return re.sub(r'<[^>]+>', '', raw or '').replace('&nbsp;', ' ').strip()


def num(v, d=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return d


class Model:
    def __init__(self, xml):
        self.doc = ET.fromstring(xml)
        self.root = self.doc.find('root')
        self.by_id = {}
        self.kids = {}
        for el in list(self.root):
            self.by_id[el.get('id')] = el
        for el in list(self.root):
            c = cell_of(el)
            if c is None:
                continue
            self.kids.setdefault(c.get('parent'), []).append(el)

    def children(self, el):
        return self.kids.get(el.get('id'), [])

    def descendants(self, el):
        out = []
        for k in self.children(el):
            out.append(k)
            out.extend(self.descendants(k))
        return out

    def top(self):
        return self.kids.get('1', [])

    def is_edge(self, el):
        return cell_of(el).get('edge') == '1'

    def geo(self, el):
        return cell_of(el).find('mxGeometry')

    def box(self, el):
        g = self.geo(el)
        return (num(g.get('x')), num(g.get('y')), num(g.get('width')), num(g.get('height')))

    def edge_points(self, el):
        g = self.geo(el)
        src = tgt = None
        for p in g.findall('mxPoint'):
            if p.get('as') == 'sourcePoint':
                src = (num(p.get('x')), num(p.get('y')))
            elif p.get('as') == 'targetPoint':
                tgt = (num(p.get('x')), num(p.get('y')))
        return src, tgt

    def abs_origin(self, el):
        """Absolute offset of `el`'s coordinate system (sum of the ancestor groups' x/y)."""
        x = y = 0.0
        c = cell_of(el)
        pid = c.get('parent')
        while pid not in (None, '0', '1'):
            p = self.by_id[pid]
            bx, by, _, _ = self.box(p)
            x += bx
            y += by
            pid = cell_of(p).get('parent')
        return x, y

    def referenced(self, cell_id):
        for el in self.root:
            c = cell_of(el)
            if c is not None and cell_id in (c.get('source'), c.get('target'), c.get('parent')):
                return True
        return False

    def next_id(self, prefix):
        n = 1
        while f'{prefix}{n}' in self.by_id:
            n += 1
        return f'{prefix}{n}'


def set_data(model, el, attrs):
    """Gives `el` railway data: attributes on its <object>/<UserObject>, wrapping a plain mxCell."""
    if el.tag == 'mxCell':
        idx = list(model.root).index(el)
        obj = ET.Element('object')
        obj.set('label', el.get('value', ''))
        for k, v in attrs.items():
            obj.set(k, v)
        obj.set('id', el.get('id'))
        del el.attrib['id']
        if 'value' in el.attrib:
            del el.attrib['value']
        model.root.remove(el)
        obj.append(el)
        model.root.insert(idx, obj)
        model.by_id[obj.get('id')] = obj
        # keep the parent index pointing at the wrapper
        for lst in model.kids.values():
            for i, k in enumerate(lst):
                if k is el:
                    lst[i] = obj
        return obj
    ident = el.attrib.pop('id')
    for k, v in attrs.items():
        el.set(k, v)
    el.set('id', ident)  # draw.io writes the id last
    return el


# ------------------------------------------------------------------------------------------------
# palette elements
# ------------------------------------------------------------------------------------------------

def element_preset(title):
    t = re.sub(r'\s+', ' ', (title or '').replace('\xa0', ' ')).strip().lower()
    m = re.match(r'^signal (left|right) (\d)$', t)
    if m:
        return {'rdKind': 'signal', 'rdSignalType': 'main',
                'rdDirection': 'reverse' if m.group(1) == 'left' else 'nominal', 'rdAspects': m.group(2)}
    m = re.match(r'^(?:single )?balise (left|right)$', t)
    if m:
        return {'rdKind': 'balise', 'rdDirection': 'reverse' if m.group(1) == 'left' else 'nominal'}
    if t == 'tc':
        return {'rdKind': 'trackSection', 'rdSectionType': 'tc'}
    if t == 'track':
        return {'rdKind': 'track'}
    m = re.match(r'^point (left|right)$', t)
    if m:
        return {'rdKind': 'points', 'rdHand': m.group(1), 'rdPosition': 'normal'}
    if t in ('train', 'train connected'):
        return {'rdKind': 'train'}
    return None


def annotate_element(xml, title):
    preset = element_preset(title)
    if not preset:
        return None
    model = Model(xml)
    top = model.top()
    assert len(top) == 1, title
    set_data(model, top[0], preset)
    return model_text(model.doc)


# ------------------------------------------------------------------------------------------------
# templates
# ------------------------------------------------------------------------------------------------

def child_sig(model, el):
    d = style_map(el)
    return ('E' if model.is_edge(el) else 'V') + ':' + d.get('vsdxID', '')


def classify_group(model, el):
    sigs = [child_sig(model, k) for k in model.descendants(el)]
    if any(s in ('V:229', 'V:231') for s in sigs) and 'E:227' in sigs:
        return 'signal'
    if any(s == 'V:350' for s in sigs):
        return 'train'
    if 'E:74' in sigs or 'V:73' in sigs:
        return 'tc'
    return None


def centre_abs(model, el):
    ox, oy = model.abs_origin(el)
    if model.is_edge(el):
        s, t = model.edge_points(el)
        if s is None or t is None:
            return None
        return (ox + (s[0] + t[0]) / 2, oy + (s[1] + t[1]) / 2)
    x, y, w, h = model.box(el)
    return (ox + x + w / 2, oy + y + h / 2)


def signal_data(model, el):
    lamps = []
    mast = []
    for k in model.descendants(el):
        s = child_sig(model, k)
        c = centre_abs(model, k)
        if c is None:
            continue
        if s in ('V:229', 'V:231'):
            lamps.append(c[0])
        elif s == 'E:227':
            mast.append(c[0])
    rot = num(style_map(el).get('rotation'), 0) % 360
    nominal = (sum(mast) / len(mast)) < (sum(lamps) / len(lamps))
    if 90 < rot < 270:
        nominal = not nominal
    return 'nominal' if nominal else 'reverse', len(lamps)


def dist_box(p, b):
    x, y, w, h = b
    dx = max(x - p[0], 0, p[0] - (x + w))
    dy = max(y - p[1], 0, p[1] - (y + h))
    return math.hypot(dx, dy)


def is_grey(el):
    """The drawing's plain track colour (#a5a5a5, also inside light-dark())."""
    return GREY in style_map(el).get('strokeColor', '').lower()


def on_segment(p, a, b, tol=3.0):
    vx, vy = b[0] - a[0], b[1] - a[1]
    l2 = vx * vx + vy * vy
    if l2 == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1]) <= tol
    k = max(0.0, min(1.0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2))
    return math.hypot(p[0] - a[0] - k * vx, p[1] - a[1] - k * vy) <= tol


def track_edges(model):
    out = []
    for el in model.top():
        if not model.is_edge(el):
            continue
        d = style_map(el)
        if d.get('vsdxID') != '17' or num(d.get('strokeWidth'), 1) < 4:
            continue
        s, t = model.edge_points(el)
        if s is None or t is None or math.hypot(t[0] - s[0], t[1] - s[1]) < 15:
            continue
        if cell_of(el).get('source') or cell_of(el).get('target'):
            # geometry points are only hints when the edge is connected; the drawing never connects tracks
            pass
        out.append((el, s, t))
    return out


def make_section(model, track_el, x0, x1, y, ident, track_id, typed_tc, cell_id):
    style = style_str(track_el)
    obj = ET.Element('object')
    obj.set('label', '')
    obj.set('rdKind', 'trackSection')
    obj.set('rdId', ident)
    if typed_tc:
        obj.set('rdSectionType', 'tc')
    obj.set('rdTrackId', track_id)
    obj.set('id', cell_id)
    cell = ET.SubElement(obj, 'mxCell', {'edge': '1', 'parent': '1', 'style': style})
    g = ET.SubElement(cell, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
    ET.SubElement(g, 'mxPoint', {'x': fmt(x0), 'y': fmt(y), 'as': 'sourcePoint'})
    ET.SubElement(g, 'mxPoint', {'x': fmt(x1), 'y': fmt(y), 'as': 'targetPoint'})
    return obj


def fmt(v):
    r = round(v, 2)
    return str(int(r)) if r == int(r) else str(r)


def annotate_template(xml, report):
    model = Model(xml)
    top = list(model.top())
    used = set()

    def unique(prefix, wanted=None):
        if wanted and wanted.upper() not in used:
            used.add(wanted.upper())
            return wanted
        n = 1
        while f'{prefix}{n}'.upper() in used:
            n += 1
        used.add(f'{prefix}{n}'.upper())
        return f'{prefix}{n}'

    texts = []
    for el in top:
        if not model.is_edge(el) and 'text' in style_names(el) and not model.children(el):
            texts.append((el, label_of(el), model.box(el)))

    # ---- tracks and points legs
    horizontal = []
    legs = []
    for el, s, t in track_edges(model):
        if abs(t[1] - s[1]) < 1.5:
            horizontal.append((el, min(s[0], t[0]), max(s[0], t[0]), (s[1] + t[1]) / 2))
        elif abs(t[0] - s[0]) > 5:
            legs.append((el, s, t))
    lines = []  # [{'y', 'x0', 'x1', 'edges': [...]}]
    for el, x0, x1, y in sorted(horizontal, key=lambda h: (round(h[3]), h[1])):
        for line in lines:
            if abs(line['y'] - y) < 1.5 and x0 <= line['x1'] + 8 and x1 >= line['x0'] - 8:
                line['x0'] = min(line['x0'], x0)
                line['x1'] = max(line['x1'], x1)
                line['edges'].append(el)
                break
        else:
            lines.append({'y': y, 'x0': x0, 'x1': x1, 'edges': [el]})
    # merge lines that grew into each other
    merged = True
    while merged:
        merged = False
        for a in lines:
            for b in lines:
                if a is not b and abs(a['y'] - b['y']) < 1.5 and b['x0'] <= a['x1'] + 8 and b['x1'] >= a['x0'] - 8:
                    a['x0'] = min(a['x0'], b['x0'])
                    a['x1'] = max(a['x1'], b['x1'])
                    a['edges'] += b['edges']
                    lines.remove(b)
                    merged = True
                    break
            if merged:
                break
    lines.sort(key=lambda l: (round(l['y']), l['x0']))
    order = {id(el): i for i, el in enumerate(model.root)}
    for line in lines:
        greys = [e for e in line['edges'] if is_grey(e)]
        pool = greys or line['edges']
        connected = lambda e: bool(cell_of(e).get('source') or cell_of(e).get('target'))
        rep = max(pool, key=lambda e: (not connected(e), abs(model.edge_points(e)[1][0] - model.edge_points(e)[0][0])))
        # the track spans the drawn line by its own points (a terminal would override them)
        for key in ('source', 'target'):
            cell_of(rep).attrib.pop(key, None)
        first = min(line['edges'], key=lambda e: order[id(e)])
        # representative at the position of the line's first edge, spanning the whole line
        model.root.remove(rep)
        model.root.insert(list(model.root).index(first) if first is not rep else order[id(rep)], rep)
        g = model.geo(rep)
        for p in g.findall('mxPoint'):
            if p.get('as') == 'sourcePoint':
                p.set('x', fmt(line['x0']))
                p.set('y', fmt(line['y']))
            elif p.get('as') == 'targetPoint':
                p.set('x', fmt(line['x1']))
                p.set('y', fmt(line['y']))
        for e in greys:
            if e is not rep and not model.referenced(e.get('id')):
                model.root.remove(e)
        line['rep'] = rep
        line['id'] = unique('T')
        line['el'] = set_data(model, rep, {'rdKind': 'track', 'rdId': line['id']})
        order = {id(el): i for i, el in enumerate(model.root)}
    # a coloured leg drawn over a grey one (route/MA highlight) is decoration
    grey_legs = [(s, t) for el, s, t in legs if is_grey(el)]
    legs = [(el, s, t) for el, s, t in legs
            if is_grey(el) or not any(on_segment(s, a, b) and on_segment(t, a, b) for a, b in grey_legs)]
    # points legs drawn a few px short of a track are extended onto it (topology joins within 8)
    fixed_legs = []
    for el, s, t in legs:
        ends = [s, t]
        for i, p in enumerate(ends):
            q = ends[1 - i]
            for line in lines:
                if 0 < abs(p[1] - line['y']) <= 12 and line['x0'] - 8 <= p[0] <= line['x1'] + 8 and q[1] != p[1]:
                    k = (line['y'] - q[1]) / (p[1] - q[1])
                    ends[i] = (q[0] + (p[0] - q[0]) * k, line['y'])
                    break
        if ends != [s, t]:
            for pt in model.geo(el).findall('mxPoint'):
                which = {'sourcePoint': 0, 'targetPoint': 1}.get(pt.get('as'))
                if which is not None:
                    pt.set('x', fmt(ends[which][0]))
                    pt.set('y', fmt(ends[which][1]))
        fixed_legs.append((el, ends[0], ends[1]))
    legs = fixed_legs
    for el, s, t in sorted(legs, key=lambda l: (min(l[1][0], l[2][0]), min(l[1][1], l[2][1]))):
        a, b = (s, t) if s[0] <= t[0] else (t, s)
        hand = 'left' if b[1] > a[1] else 'right'
        set_data(model, el, {'rdKind': 'points', 'rdId': unique('W'), 'rdHand': hand, 'rdPosition': 'normal'})

    # ---- symbols
    signals, tcs = [], []
    for el in top:
        if model.is_edge(el) or not model.children(el):
            continue
        kind = classify_group(model, el)
        b = model.box(el)
        if kind == 'signal':
            direction, aspects = signal_data(model, el)
            inner = [label_of(k) for k in model.descendants(el) if 'text' in style_names(k)]
            candidates = [x for x in inner if ID_LABEL.match(x)]
            if not candidates:
                near = sorted((dist_box((tb[0] + tb[2] / 2, tb[1] + tb[3] / 2), b), lab) for _, lab, tb in texts if ID_LABEL.match(lab) and lab.upper().startswith('S'))
                candidates = [lab for d, lab in near if d <= 20][:1]
            wanted = candidates[0] if candidates else None
            ident = unique('S', wanted)
            stype = 'shunting' if ident.upper().startswith('SS') else 'main'
            signals.append((el, b, direction))
            set_data(model, el, {'rdKind': 'signal', 'rdId': ident, 'rdSignalType': stype,
                                 'rdDirection': direction, 'rdAspects': str(aspects)})
        elif kind == 'train':
            set_data(model, el, {'rdKind': 'train', 'rdId': unique('TR')})
        elif kind == 'tc':
            tcs.append(b)
    # loose TC joint bars (vsdxID 73 without their group)
    for el in model.top():
        if model.is_edge(el) or model.children(el) or style_map(el).get('vsdxID') != '73':
            continue
        tcs.append(model.box(el))

    balises = []
    for el in list(model.top()):
        if model.is_edge(el) or model.children(el) or 'triangle' not in style_names(el):
            continue
        x, y, w, h = model.box(el)
        if abs(w - 12) > 0.5 or abs(h - 12) > 0.5:
            continue
        c = (x + w / 2, y + h / 2)
        # a balise away from every track (legend, explanation) is decoration
        if not any(on_segment(c, (l['x0'], l['y']), (l['x1'], l['y']), 40) for l in lines):
            continue
        balises.append([el, c, style_map(el).get('direction') == 'west'])
    groups = []
    for el, lab, tb in texts:
        m = re.match(r'^BG(\d+)$', lab)
        if not m:
            continue
        c = (tb[0] + tb[2] / 2, tb[1] + tb[3] / 2)
        groups.append({'el': el, 'id': lab, 'n': m.group(1), 'c': c, 'members': []})
    for bal in sorted(balises, key=lambda b: (b[1][1], b[1][0])):
        near = sorted((math.hypot(g['c'][0] - bal[1][0], g['c'][1] - bal[1][1]), i) for i, g in enumerate(groups))
        if near and near[0][0] <= 40:
            groups[near[0][1]]['members'].append(bal)
    group_of = {}
    report_ungrouped = []
    for g in groups:
        if not g['members']:
            continue
        ident = unique('BG', g['id'])
        rev = all(m[2] for m in g['members'])
        nom = not any(m[2] for m in g['members'])
        attrs = {'rdKind': 'baliseGroup', 'rdId': ident, 'rdNidBg': g['n'], 'rdCount': str(len(g['members']))}
        if rev or nom:
            attrs['rdDirection'] = 'reverse' if rev else 'nominal'
        set_data(model, g['el'], attrs)
        for pos, m in enumerate(sorted(g['members'], key=lambda b: b[1][0]), 1):
            group_of[id(m[0])] = (ident, pos)
    # balises without a BG label: each is its own group, typed on its function label (LTA, LTO,
    # S4_infill, S2_BG, ...: the text within LABEL_GROUP_DISTANCE whose nearest balise it is).
    # Not grouped by distance: in "Level transition L1 -> L2 (staff responsible)" the LTA and the
    # S4_infill balises are 26 px apart but are two groups with different functions.
    taken = {id(g['el']) for g in groups}
    free_texts = [(el, lab, tb) for el, lab, tb in texts
                  if id(el) not in taken and lab and not re.match(r'^BG\d+$', lab)]
    for bal in sorted(balises, key=lambda b: (b[1][0], b[1][1])):
        if id(bal[0]) in group_of:
            continue
        best = None
        for el, lab, tb in free_texts:
            tc = (tb[0] + tb[2] / 2, tb[1] + tb[3] / 2)
            d = math.hypot(tc[0] - bal[1][0], tc[1] - bal[1][1])
            if d > LABEL_GROUP_DISTANCE:
                continue
            nearest = min(balises, key=lambda b: math.hypot(tc[0] - b[1][0], tc[1] - b[1][1]))
            if nearest is bal and (best is None or d < best[0]):
                best = (d, el, lab)
        if best is None:
            report_ungrouped.append(bal)
            continue
        _d, el, lab = best
        free_texts = [t for t in free_texts if t[0] is not el]
        ident = unique('BG')
        attrs = {'rdKind': 'baliseGroup', 'rdId': ident, 'rdNidBg': ident[2:], 'rdCount': '1',
                 'rdDirection': 'reverse' if bal[2] else 'nominal'}
        if 'infill' in lab.lower():
            attrs['rdFunction'] = 'infill'
        set_data(model, el, attrs)
        group_of[id(bal[0])] = (ident, 1)
    for bal in sorted(balises, key=lambda b: (b[1][1], b[1][0])):
        attrs = {'rdKind': 'balise', 'rdId': unique('B'), 'rdDirection': 'reverse' if bal[2] else 'nominal'}
        if id(bal[0]) in group_of:
            attrs['rdGroupId'], pos = group_of[id(bal[0])]
            attrs['rdPosition'] = str(pos)
        set_data(model, bal[0], attrs)

    # ---- TVD sections over each track
    sec_n = 0
    sections_report = []
    for line in lines:
        y, x0, x1 = line['y'], line['x0'], line['x1']
        cuts = []
        by_tc = False
        for (bx, by, bw, bh) in tcs:
            cx, cy = bx + bw / 2, by + bh / 2
            if abs(cy - y) <= 8 and x0 + 15 < cx < x1 - 15:
                cuts.append(cx)
                by_tc = True
        for el, s, t in legs:
            for p in (s, t):
                if abs(p[1] - y) <= 8 and x0 + 15 < p[0] < x1 - 15:
                    cuts.append(p[0])
        rule = 'TC markers' if by_tc else 'points' if cuts else ''
        if not cuts:
            for el, b, _d in signals:
                cx, cy = b[0] + b[2] / 2, b[1] + b[3] / 2
                if abs(cy - y) <= 30 and x0 + 15 < cx < x1 - 15:
                    cuts.append(cx)
            rule = 'signals' if cuts else 'whole track'
        cuts = sorted(cuts)
        clean = []
        for c in cuts:
            if not clean or c - clean[-1] >= 15:
                clean.append(c)
        bounds = [x0] + clean + [x1]
        insert_at = list(model.root).index(line['el']) + 1
        names = []
        for a, b in zip(bounds, bounds[1:]):
            sec_n += 1
            ident = unique('TC', f'TC{sec_n}')
            cell = make_section(model, line['rep'], a, b, y, ident, line['id'], by_tc, model.next_id('tc-'))
            model.by_id[cell.get('id')] = cell
            model.root.insert(insert_at, cell)
            insert_at += 1
            names.append(ident)
        sections_report.append(f"{line['id']}: {', '.join(names)} ({rule})")
    report.append('; '.join(sections_report) + (f'; {len(report_ungrouped)} balise(s) without group' if report_ungrouped else ''))
    return model_text(model.doc)


def build(src, dst):
    text = open(src, encoding='utf-8').read()
    head, parts, tail = split(text)
    assert len(parts) == 40, len(parts)
    parts = [p for i, p in enumerate(parts) if i not in REMOVED_INDICES]
    parts = [KBS.sub(lambda m: 'S' + m.group(1), p) for p in parts]
    out = []
    report = []
    for i, part in enumerate(parts):
        entry = entry_of(part)
        xml = html.unescape(entry['xml'])
        if i < 18:
            new = annotate_element(xml, entry.get('title'))
        else:
            sections = []
            new = annotate_template(xml, sections)
            report.append(f'template {i}: ' + sections[0])
        out.append(replace_xml(part, new) if new is not None else part)
    open(dst, 'w', encoding='utf-8', newline='').write(join(head, out, tail))
    return report


if __name__ == '__main__':
    for line in build(sys.argv[1], sys.argv[2]):
        print(line)
