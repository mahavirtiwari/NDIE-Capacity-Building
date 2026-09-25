# -*- coding: utf-8 -*-
"""Draws every screen of both mobile apps as one SVG sheet per app.

The copy is lifted from the screens themselves rather than invented, so a
frame that disagrees with the app is a fault in one of the two, not a
difference of opinion about what it ought to say.
"""
import io

W, H = 300, 620
GAP_X, GAP_Y = 44, 84
COLS = 4
PAD = 52

INK = '#16202e'
MUTED = '#6a7686'
LINE = '#dfe3e9'
FIELD = '#f4f6f8'
OK = '#3d6b11'
WARN = '#a16207'
BLUSH = '#fbecee'      # the portal's pale navigation tint
SURFACE = '#ffffff'    # cards sit on the blush, as they do in the portal


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


class Frame:
    def __init__(self, x, y, brand, title, caption, route):
        self.x, self.y0, self.brand = x, y, brand
        self.title, self.caption, self.route = title, caption, route
        self.cy = y + 108
        self.out = []
        self.chrome()

    def _t(self, x, y, s, size=11, fill=INK, weight='400', anchor='start', mono=False):
        fam = "Consolas,'SF Mono',monospace" if mono else "-apple-system,'Segoe UI',Roboto,sans-serif"
        self.out.append(
            '<text x="%.1f" y="%.1f" font-family="%s" font-size="%s" fill="%s" '
            'font-weight="%s" text-anchor="%s">%s</text>'
            % (x, y, fam, size, fill, weight, anchor, esc(s)))

    def chrome(self):
        x, y, o = self.x, self.y0, self.out
        o.append('<rect x="%d" y="%d" width="%d" height="%d" rx="26" fill="%s" '
                 'stroke="%s" stroke-width="1.5"/>' % (x, y, W, H, BLUSH, LINE))
        self._t(x + 18, y + 24, '9:41', 9, MUTED, '600')
        for i, r in enumerate([2, 2.6, 3.2]):
            o.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>'
                     % (x + W - 42 + i * 9, y + 20.5, r, MUTED))
        o.append('<path d="M%d %d h%d v52 h-%d z" fill="%s"/>' % (x, y + 32, W, W, BLUSH))
        o.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#f1d8dc"/>'
                 % (x, y + 84, x + W, y + 84))
        self._t(x + 18, y + 68, self.title, 13, INK, '600')
        self._t(x + 2, y + H + 26, self.caption, 12.5, INK, '600')
        self._t(x + 2, y + H + 42, self.route, 9.5, MUTED, '400', mono=True)

    def gap(self, n=10):
        self.cy += n

    def heading(self, s):
        self._t(self.x + 18, self.cy, s, 12.5, INK, '600')
        self.cy += 20

    def note(self, s, fill=MUTED):
        self._t(self.x + 18, self.cy, s, 9.5, fill)
        self.cy += 15

    def label(self, s):
        self._t(self.x + 18, self.cy, s, 9, MUTED, '600')
        self.cy += 13

    def field(self, placeholder, filled=False):
        self.out.append('<rect x="%d" y="%.1f" width="%d" height="30" rx="7" fill="%s" '
                        'stroke="%s"/>' % (self.x + 18, self.cy, W - 36, SURFACE, LINE))
        self._t(self.x + 28, self.cy + 19.5, placeholder, 10, INK if filled else '#9aa4b2')
        self.cy += 38

    def select(self, s):
        self.out.append('<rect x="%d" y="%.1f" width="%d" height="30" rx="7" fill="%s" '
                        'stroke="%s"/>' % (self.x + 18, self.cy, W - 36, SURFACE, LINE))
        self._t(self.x + 28, self.cy + 19.5, s, 10, '#9aa4b2')
        self.out.append('<path d="M%d %.1f l4 5 l4 -5" stroke="%s" stroke-width="1.5" '
                        'fill="none"/>' % (self.x + W - 38, self.cy + 13, MUTED))
        self.cy += 38

    def button(self, s, kind='primary'):
        fill = self.brand if kind == 'primary' else '#ffffff'
        txt = '#ffffff' if kind == 'primary' else self.brand
        stroke = 'none' if kind == 'primary' else self.brand
        self.out.append('<rect x="%d" y="%.1f" width="%d" height="34" rx="8" fill="%s" '
                        'stroke="%s"/>' % (self.x + 18, self.cy, W - 36, fill, stroke))
        self._t(self.x + W / 2, self.cy + 22, s, 11, txt, '600', 'middle')
        self.cy += 44

    def card(self, title, subs, badge=None, badge_fill=None):
        h = 30 + 14 * len(subs)
        self.out.append('<rect x="%d" y="%.1f" width="%d" height="%d" rx="9" fill="#ffffff" '
                        'stroke="%s"/>' % (self.x + 18, self.cy, W - 36, h, LINE))
        self._t(self.x + 30, self.cy + 20, title, 10.5, INK, '600')
        for i, s in enumerate(subs):
            self._t(self.x + 30, self.cy + 36 + i * 14, s, 9, MUTED)
        if badge:
            bw = 6.4 * len(badge) + 14
            self.out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="17" rx="8.5" '
                            'fill="%s"/>' % (self.x + W - 30 - bw, self.cy + 9, bw,
                                             badge_fill or self.brand))
            self._t(self.x + W - 30 - bw / 2, self.cy + 21, badge, 8.5, '#ffffff', '600', 'middle')
        self.cy += h + 10

    def row(self, left, right, strong=False):
        self._t(self.x + 18, self.cy, left, 10, MUTED)
        self._t(self.x + W - 18, self.cy, right, 10, INK, '600' if strong else '400', 'end')
        self.cy += 17

    def photobox(self, caption):
        self.out.append('<rect x="%d" y="%.1f" width="%d" height="62" rx="9" fill="%s" '
                        'stroke="#c3cbd6" stroke-dasharray="4 3"/>'
                        % (self.x + 18, self.cy, W - 36, FIELD))
        cx, cy = self.x + W / 2, self.cy + 26
        self.out.append('<rect x="%.1f" y="%.1f" width="26" height="19" rx="3.5" fill="none" '
                        'stroke="%s" stroke-width="1.6"/>' % (cx - 13, cy - 9, MUTED))
        self.out.append('<circle cx="%.1f" cy="%.1f" r="5" fill="none" stroke="%s" '
                        'stroke-width="1.6"/>' % (cx, cy + 0.5, MUTED))
        self._t(cx, self.cy + 53, caption, 8.5, MUTED, '400', 'middle')
        self.cy += 70

    def chips(self, items, active=0):
        cx = self.x + 18
        for i, s in enumerate(items):
            w = 6.2 * len(s) + 18
            on = (i == active)
            self.out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="22" rx="11" fill="%s" '
                            'stroke="%s"/>' % (cx, self.cy, w, self.brand if on else '#ffffff',
                                               self.brand if on else LINE))
            self._t(cx + w / 2, self.cy + 15, s, 9, '#ffffff' if on else MUTED, '600', 'middle')
            cx += w + 6
        self.cy += 32

    def checkrow(self, s, state):
        cols = {'done': OK, 'todo': '#c3cbd6', 'warn': WARN}
        self.out.append('<circle cx="%d" cy="%.1f" r="7" fill="none" stroke="%s" '
                        'stroke-width="1.6"/>' % (self.x + 25, self.cy - 4, cols[state]))
        if state == 'done':
            self.out.append('<path d="M%.1f %.1f l3 3 l5 -6" stroke="%s" stroke-width="1.8" '
                            'fill="none" stroke-linecap="round"/>' % (self.x + 21.5, self.cy - 4.5, OK))
        self._t(self.x + 40, self.cy, s, 10, INK)
        self.cy += 21

    def toggle(self, s, on):
        self._t(self.x + 18, self.cy, s, 10, INK)
        tx = self.x + W - 52
        self.out.append('<rect x="%.1f" y="%.1f" width="34" height="19" rx="9.5" fill="%s"/>'
                        % (tx, self.cy - 14, OK if on else '#ccd3db'))
        self.out.append('<circle cx="%.1f" cy="%.1f" r="7.5" fill="#ffffff"/>'
                        % (tx + (24.5 if on else 9.5), self.cy - 4.5))
        self.cy += 26

    def tabbar(self, names, active):
        y = self.y0 + H - 54
        self.out.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#f1d8dc"/>'
                        % (self.x, y, self.x + W, y))
        step = W / len(names)
        for i, n in enumerate(names):
            cx = self.x + step * (i + 0.5)
            on = (i == active)
            self.out.append('<rect x="%.1f" y="%.1f" width="15" height="15" rx="4" fill="none" '
                            'stroke="%s" stroke-width="1.6"/>'
                            % (cx - 7.5, y + 13, self.brand if on else '#aeb7c2'))
            self._t(cx, y + 43, n, 7.8, self.brand if on else MUTED, '600' if on else '400', 'middle')

    def splash(self, word, sub):
        cx, cy = self.x + W / 2, self.y0 + H / 2 - 20
        self.out.append('<rect x="%d" y="%d" width="%d" height="%d" rx="26" fill="%s" '
                        'stroke="%s" stroke-width="1.5"/>' % (self.x, self.y0, W, H, BLUSH, LINE))
        # the uploaded mark, drawn as the block it occupies
        self.out.append('<rect x="%.1f" y="%.1f" width="120" height="44" rx="8" fill="%s"/>'
                        % (cx - 60, cy - 30, self.brand))
        self._t(cx, cy + 1, word, 19, '#ffffff', '700', 'middle')
        self._t(cx, cy + 40, 'NDIE logo, served by the API', 8.5, MUTED, '400', 'middle')
        self._t(cx, cy + 74, sub, 10.5, INK, '400', 'middle')
        self.out.append('<circle cx="%.1f" cy="%.1f" r="12" fill="none" stroke="%s" '
                        'stroke-opacity="0.6" stroke-width="2.5" stroke-dasharray="14 10"/>'
                        % (cx, cy + 118, self.brand))
        self._t(self.x + 2, self.y0 + H + 26, self.caption, 12.5, INK, '600')
        self._t(self.x + 2, self.y0 + H + 42, self.route, 9.5, MUTED, '400', mono=True)


def sheet(path, brand, heading, subtitle, builders):
    rows = (len(builders) + COLS - 1) // COLS
    width = PAD * 2 + COLS * W + (COLS - 1) * GAP_X
    height = 150 + rows * (H + GAP_Y)
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
             'viewBox="0 0 %d %d">' % (width, height, width, height),
             '<rect width="100%" height="100%" fill="#f7f8fa"/>',
             '<text x="%d" y="62" font-family="-apple-system,\'Segoe UI\',Roboto,sans-serif" '
             'font-size="26" font-weight="700" fill="%s">%s</text>' % (PAD, brand, esc(heading)),
             '<text x="%d" y="88" font-family="-apple-system,\'Segoe UI\',Roboto,sans-serif" '
             'font-size="13" fill="%s">%s</text>' % (PAD, MUTED, esc(subtitle))]

    for i, build in enumerate(builders):
        x = PAD + (i % COLS) * (W + GAP_X)
        y = 130 + (i // COLS) * (H + GAP_Y)
        parts.append(build(x, y))

    parts.append('</svg>')
    io.open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(parts))
    print('wrote %s  (%d screens, %dx%d)' % (path, len(builders), width, height))
