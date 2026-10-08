# -*- coding: utf-8 -*-
"""Builds the CBMS process-flow pack as print-ready HTML.

The diagrams are generated rather than hand-placed so that the lanes,
the gaps and the arrowheads line up the same way on every page.
"""
import html
import pathlib

OUT = pathlib.Path('docs/process-flows')

# --------------------------------------------------------------- palette
C = {
    'brand': '#82232f', 'brand6': '#9b2c3c', 'brand1': '#f7dce0', 'brand05': '#fdf3f4',
    'ink9': '#241c1a', 'ink7': '#4a403d', 'ink6': '#6b5f5b', 'ink5': '#8a7d78',
    'ink3': '#ccc4c1', 'ink2': '#e6e0de', 'ink1': '#f4f0ef',
    'ok': '#1d6b45', 'ok1': '#dff2e7',
    'warn': '#8a5a06', 'warn1': '#fdeecf',
    'bad': '#9b2226', 'bad1': '#fadcdc',
    'info': '#1f4e79', 'info1': '#dceaf7',
}

KIND = {
    'step':    (C['brand05'], C['brand1'], C['ink9']),
    'actor':   ('#ffffff', C['ink2'], C['ink9']),
    'system':  (C['info1'], '#b9d4ea', C['info']),
    'good':    (C['ok1'], '#b7dfc8', C['ok']),
    'bad':     (C['bad1'], '#f0bdbd', C['bad']),
    'warn':    (C['warn1'], '#f0d9a6', C['warn']),
    'state':   (C['ink1'], C['ink3'], C['ink7']),
}


def esc(t):
    return html.escape(str(t))


def defs():
    out = ['<defs>']
    for name, colour in [('a', C['ink6']), ('ab', C['brand']), ('ag', C['ok']),
                         ('ar', C['bad']), ('ai', C['info'])]:
        out.append(
            f'<marker id="{name}" viewBox="0 0 10 10" refX="9" refY="5" '
            f'markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
            f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{colour}"/></marker>')
    out.append('</defs>')
    return ''.join(out)


def lane(x, y, w, h, label, tint='#ffffff'):
    """A horizontal band with its owner named down the left edge."""
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{tint}" '
        f'stroke="{C["ink2"]}"/>'
        f'<rect x="{x}" y="{y}" width="26" height="{h}" rx="6" fill="{C["ink1"]}" '
        f'stroke="{C["ink2"]}"/>'
        f'<text x="{x + 13}" y="{y + h / 2}" transform="rotate(-90 {x + 13} {y + h / 2})" '
        f'text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" '
        f'fill="{C["ink7"]}" letter-spacing="0.5">{esc(label)}</text>')


def box(x, y, w, h, lines, kind='step', num=None, small=False):
    fill, stroke, ink = KIND[kind]
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{fill}" '
           f'stroke="{stroke}" stroke-width="1.2"/>']
    if num is not None:
        # On the corner, not inside: a badge sitting in the text column
        # covers the first word of any title wide enough to reach it.
        out.append(
            f'<circle cx="{x}" cy="{y}" r="8.5" fill="{C["brand"]}" stroke="#fff" '
            f'stroke-width="1.5"/>'
            f'<text x="{x}" y="{y + 0.5}" text-anchor="middle" dominant-baseline="middle" '
            f'font-size="9.5" font-weight="700" fill="#fff">{num}</text>')
    size = 10 if small else 11
    lead = 12.5 if small else 13.5
    total = len(lines) * lead
    top = y + h / 2 - total / 2 + lead / 2
    for i, line in enumerate(lines):
        weight = '700' if i == 0 else '400'
        colour = ink if i == 0 else C['ink6']
        fs = size if i == 0 else size - 1
        out.append(
            f'<text x="{x + w / 2}" y="{top + i * lead}" text-anchor="middle" '
            f'dominant-baseline="middle" font-size="{fs}" font-weight="{weight}" '
            f'fill="{colour}">{esc(line)}</text>')
    return ''.join(out)


def diamond(cx, cy, w, h, lines, kind='warn'):
    fill, stroke, ink = KIND[kind]
    pts = f'{cx},{cy - h / 2} {cx + w / 2},{cy} {cx},{cy + h / 2} {cx - w / 2},{cy}'
    out = [f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>']
    top = cy - (len(lines) - 1) * 6
    for i, line in enumerate(lines):
        out.append(
            f'<text x="{cx}" y="{top + i * 12}" text-anchor="middle" dominant-baseline="middle" '
            f'font-size="10" font-weight="{"700" if i == 0 else "400"}" '
            f'fill="{ink if i == 0 else C["ink6"]}">{esc(line)}</text>')
    return ''.join(out)


def arrow(x1, y1, x2, y2, label=None, style='a', dashed=False, bend=None, above=True):
    colour = {'a': C['ink6'], 'ab': C['brand'], 'ag': C['ok'],
              'ar': C['bad'], 'ai': C['info']}[style]
    dash = ' stroke-dasharray="5 3"' if dashed else ''
    if bend == 'v':                      # across then down/up then across
        mid = (x1 + x2) / 2
        d = f'M {x1} {y1} H {mid} V {y2} H {x2}'
    elif bend == 'h':                    # down/up then across then into
        mid = (y1 + y2) / 2
        d = f'M {x1} {y1} V {mid} H {x2} V {y2}'
    else:
        d = f'M {x1} {y1} L {x2} {y2}'
    out = [f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="1.6"{dash} '
           f'marker-end="url(#{style})"/>']
    if label:
        lx, ly = (x1 + x2) / 2, (y1 + y2) / 2 + (-6 if above else 13)
        out.append(
            f'<rect x="{lx - len(label) * 2.7 - 3}" y="{ly - 7}" width="{len(label) * 5.4 + 6}" '
            f'height="13" rx="2.5" fill="#fff" opacity="0.92"/>'
            f'<text x="{lx}" y="{ly}" text-anchor="middle" dominant-baseline="middle" '
            f'font-size="9" font-weight="600" fill="{colour}">{esc(label)}</text>')
    return ''.join(out)


def mail(x, y, text):
    """An envelope marker: where the system writes to somebody."""
    return (
        f'<g><rect x="{x}" y="{y}" width="17" height="12" rx="2" fill="#fff" '
        f'stroke="{C["info"]}" stroke-width="1.2"/>'
        f'<path d="M {x + 1.5} {y + 2} L {x + 8.5} {y + 7.5} L {x + 15.5} {y + 2}" fill="none" '
        f'stroke="{C["info"]}" stroke-width="1.2"/>'
        f'<text x="{x + 21}" y="{y + 6.5}" dominant-baseline="middle" font-size="9" '
        f'fill="{C["info"]}" font-weight="600">{esc(text)}</text></g>')


def chip(x, y, text, kind='state', w=None):
    fill, stroke, ink = KIND[kind]
    w = w or (len(text) * 5.6 + 16)
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="17" rx="8.5" fill="{fill}" stroke="{stroke}"/>'
        f'<text x="{x + w / 2}" y="{y + 9}" text-anchor="middle" dominant-baseline="middle" '
        f'font-size="9" font-weight="700" fill="{ink}">{esc(text)}</text>')


def title(x, y, text, sub=None):
    out = [f'<text x="{x}" y="{y}" font-size="12" font-weight="700" '
           f'fill="{C["brand"]}">{esc(text)}</text>']
    if sub:
        out.append(f'<text x="{x}" y="{y + 14}" font-size="9.5" fill="{C["ink6"]}">{esc(sub)}</text>')
    return ''.join(out)


def svg(w, h, body):
    return (f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img">{defs()}{body}</svg>')
