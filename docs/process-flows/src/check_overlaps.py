# -*- coding: utf-8 -*-
"""Reports where two drawn things sit on top of each other.

Boxes come from the generator's own registry. Text is read back out of the
finished SVG and measured, because a label that runs out of its box is the
failure that actually shows on the page.
"""
import html
import re
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import flowpack
import flow_pages_1 as p1
import flow_pages_2 as p2
import flow_pages_3 as p3
import flow_pages_4 as p4

W = 1120
PAGES = [('journey A', p1.journey_a), ('journey B', p1.journey_b),
         ('programme', p2.programme), ('reporting', p2.reporting),
         ('chain', p3.chain), ('scopes', p3.scopes), ('channels', p3.channels),
         ('coordinator day', p4.coordinator_day), ('app features', p4.app_features),
         ('profile builder', p4.profile_builder)]

TEXT = re.compile(
    r'<text([^>]*)>(.*?)</text>', re.S)
ATTR = re.compile(r'(\S+)="([^"]*)"')
# Segoe UI at weight 400/700: measured against the rendered pages.
NARROW, BOLD = 0.50, 0.545


def text_boxes(svg):
    out = []
    for attrs, body in TEXT.findall(svg):
        a = dict(ATTR.findall(attrs))
        if 'transform' in a:            # the rotated lane labels
            continue
        label = html.unescape(re.sub(r'<[^>]+>', '', body)).strip()
        if not label:
            continue
        size = float(a.get('font-size', 11))
        per = BOLD if a.get('font-weight') in ('600', '700') else NARROW
        w = len(label) * size * per
        x, y = float(a.get('x', 0)), float(a.get('y', 0))
        anchor = a.get('text-anchor', 'start')
        if anchor == 'middle':
            x -= w / 2
        elif anchor == 'end':
            x -= w
        out.append({'label': label, 'x': x, 'y': y - size * 0.72,
                    'w': w, 'h': size * 1.08})
    return out


def hit(a, b, slack=1.0):
    dx = min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x'])
    dy = min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y'])
    return dx > slack and dy > slack, dx, dy


def inside(t, n, pad=3):
    x, y, w, h = n.get('full', (n['x'], n['y'], n['w'], n['h']))
    return (t['x'] >= x - pad and t['x'] + t['w'] <= x + w + pad
            and t['y'] >= y - pad and t['y'] + t['h'] <= y + h + pad)


def main():
    bad = 0
    for name, fn in PAGES:
        flowpack.reset()
        svg = fn()
        height = float(svg.split('viewBox="0 0 1120 ')[1].split('"')[0])
        nodes = list(flowpack.NODES)

        for i, a in enumerate(nodes):
            if a['x'] < 26 or a['x'] + a['w'] > W - 20 or a['y'] + a['h'] > height:
                print(f'[{name}] OFF PAGE   {a["kind"]:8} "{a["label"][:32]}" '
                      f'x={a["x"]:.0f}..{a["x"] + a["w"]:.0f}')
                bad += 1
            for b in nodes[i + 1:]:
                ok, dx, dy = hit(a, b)
                if ok:
                    print(f'[{name}] OVERLAP {dx:.0f}x{dy:.0f}  "{a["label"][:26]}" '
                          f'vs "{b["label"][:26]}"')
                    bad += 1

        # A line wider than the box it was written into is the overlap
        # people actually see: it runs over the border and into whatever
        # is beside it.
        for t in text_boxes(svg):
            if t['label'].isdigit():
                continue
            cx, cy = t['x'] + t['w'] / 2, t['y'] + t['h'] / 2
            for n in nodes:
                x, y, w, h = n.get('full', (n['x'], n['y'], n['w'], n['h']))
                if not (x <= cx <= x + w and y <= cy <= y + h):
                    continue
                if t['w'] > w - 6:
                    print(f'[{name}] TEXT TOO WIDE  "{t["label"][:40]}" needs '
                          f'{t["w"]:.0f}px in a {w:.0f}px {n["kind"]}')
                    bad += 1

        for t in text_boxes(svg):
            # The step numbers sit on a box corner by design.
            if t['label'].isdigit():
                continue
            if t['x'] + t['w'] > W - 14:
                print(f'[{name}] TEXT OFF PAGE  "{t["label"][:44]}" '
                      f'ends at {t["x"] + t["w"]:.0f}')
                bad += 1
            for n in nodes:
                if inside(t, n):
                    continue
                ok, dx, dy = hit(t, n, slack=2.0)
                if ok:
                    print(f'[{name}] TEXT ON A BOX  "{t["label"][:36]}" '
                          f'over "{n["label"][:26]}" ({dx:.0f}x{dy:.0f})')
                    bad += 1

    print(f'\n{bad} problem(s)' if bad else '\nNothing overlaps, nothing off the page.')
    return bad


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
