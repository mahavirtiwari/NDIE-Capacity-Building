# -*- coding: utf-8 -*-
"""Pages 4-5: the programme, raised to reported."""
from flowpack import arrow, box, chip, diamond, lane, mail, svg, C

W = 1120


def programme():
    """Seven columns, so nothing has to be squeezed against the margin."""
    b = []
    for label, y, h, tint in [('Implementing Agency', 52, 116, '#ffffff'),
                              ('Operation Manager', 180, 126, C['brand05']),
                              ('Coordinator', 318, 102, '#ffffff')]:
        b.append(lane(20, y, W - 40, h, label, tint))

    bw, step = 135, 151
    c = [50 + i * step for i in range(7)]
    mid = [x + bw / 2 for x in c]

    # --- the agency raises it, or asks for it to be put off -------------
    b.append(box(c[0], 68, bw, 62, ['Raise a batch', 'Type, coordinator, venue',
                                    'or link, dates, seats'], 'step', 1))
    b.append(box(c[1], 68, bw, 62, ['Floor and ceiling', 'At least the type’s',
                                    'minimum; agency sets max'], 'state'))
    b.append(box(c[2], 68, bw, 62, ['Ask to put it off', 'A reason, in writing.',
                                    'The batch does not move.'], 'warn', 9))
    b.append(arrow(c[0] + bw, 99, c[1], 99))
    b.append(arrow(c[1] + bw, 99, c[2], 99))

    # --- the manager's register, and the decision ------------------------
    b.append(box(c[1], 194, bw, 62, ['On the register', 'The moment it is raised,',
                                     'with an e-mail to say so'], 'step', 2))
    b.append(arrow(mid[1], 130, mid[1], 194, style='ab'))
    b.append(mail(c[1] - 6, 266, 'A batch is waiting on you'))

    b.append(diamond(mid[3], 243, 150, 82, ['Permit it?', 'the manager alone']))
    b.append(arrow(c[1] + bw, 225, mid[3] - 75, 243))
    b.append(arrow(mid[2], 130, mid[3] - 52, 212, style='a', dashed=True))

    b.append(chip(c[2], 196, 'Permission rejected', 'bad', bw))
    b.append(chip(c[2] + 28, 282, 'Postponed', 'warn', 80))
    b.append(arrow(mid[3] - 62, 228, c[2] + bw + 4, 208, style='ar'))
    b.append(arrow(mid[3] - 62, 258, c[2] + 112, 282, style='ar'))

    # --- open, run, examine ----------------------------------------------
    b.append(box(c[4], 68, bw, 62, ['Registration opens', 'Applicants on that track',
                                    'and State/UT are told'], 'good', 3))
    b.append(arrow(mid[3], 202, mid[4] - 30, 130, 'permitted', style='ag'))
    b.append(mail(c[4] + 6, 138, 'Joining details'))

    b.append(box(c[4], 334, bw, 62, ['Run the day', 'Sessions, attendance,',
                                     'trainers, photographs'], 'step', 4))
    b.append(arrow(mid[4], 130, mid[4], 334, style='ab', dashed=True))

    b.append(box(c[5], 194, bw, 62, ['Set the exam time', 'The manager’s to set;',
                                     'the agency cannot'], 'step', 5))
    b.append(arrow(c[4] + bw, 99, c[5] + 20, 194, style='a'))
    b.append(box(c[5], 334, bw, 62, ['Marksheet', 'Marks against the skills',
                                     'the type evaluates'], 'step', 6))
    b.append(arrow(c[4] + bw, 365, c[5], 365))
    b.append(arrow(mid[5], 256, mid[5], 334, style='ab', dashed=True))

    # --- conducted, and the certificates ----------------------------------
    b.append(box(c[6], 68, bw, 62, ['Conducted', 'Only with the paper held',
                                    'and the day recorded'], 'good', 7))
    b.append(arrow(c[5] + bw, 350, mid[6], 130, style='ag'))
    b.append(box(c[6], 194, bw, 62, ['Certificates', 'To whoever passed:',
                                     'numbered, verifiable'], 'good', 8))
    b.append(arrow(mid[6], 130, mid[6], 194, style='ag'))
    b.append(mail(c[6] - 14, 272, 'Certificate e-mailed'))
    b.append(arrow(mid[6], 256, mid[6] - 6, 272, style='ai', dashed=True))

    # --- the status rail ---------------------------------------------------
    b.append(f'<text x="40" y="444" font-size="11" font-weight="700" fill="{C["brand"]}">'
             'Programme status</text>')
    rail = [('New', 'state', 180), ('Permission accepted', 'warn', 248),
            ('Calendar created', 'warn', 400), ('Conducted', 'good', 538)]
    for text, kind, x in rail:
        b.append(chip(x, 434, text, kind))
    for i in range(len(rail) - 1):
        b.append(arrow(rail[i][2] + len(rail[i][0]) * 5.6 + 18, 442, rail[i + 1][2] - 4, 442))
    for text, x in [('Permission rejected', 660), ('Postponed', 800), ('QC rejected', 898)]:
        b.append(chip(x, 434, text, 'bad'))
    b.append(f'<text x="996" y="446" font-size="9.5" fill="{C["ink6"]}">'
             'Three ways it stops.</text>')
    return svg(W, 458, ''.join(b))


def reporting():
    """What comes out of a conducted programme."""
    b = []
    b.append(lane(20, 40, W - 40, 150, 'Sources', C['brand05']))
    b.append(lane(20, 202, W - 40, 110, 'Report', '#ffffff'))
    b.append(lane(20, 324, W - 40, 100, 'Out', C['info1']))

    cards = [('Summary', 'The batch: type, agency,\nvenue, dates, seats'),
             ('Participants', 'Who enrolled, their result\nand their certificate'),
             ('Attendance', 'Session by session,\nmarked on the day'),
             ('Trainers', 'Who delivered which\nsession'),
             ('Monitoring', 'Venue, session and sheet\nphotographs, geo-tagged')]
    for i, (name, sub) in enumerate(cards):
        x = 58 + i * 208
        b.append(box(x, 62, 190, 64, [name] + sub.split('\n'), 'step'))
        b.append(arrow(x + 95, 126, x + 95, 202, style='ab'))

    b.append(box(300, 222, 520, 70,
                 ['One programme report',
                  'Filtered by category, programme type, agency, State/UT and dates.',
                  'Up to 25 programmes in a single workbook.'], 'system'))

    b.append(box(220, 340, 200, 64, ['Excel workbook', 'One sheet per section,',
                                     'stamped with the date'], 'good'))
    b.append(box(460, 340, 200, 64, ['On screen', 'The same sections,', 'read in the portal'], 'good'))
    b.append(box(700, 340, 200, 64, ['Dashboard', 'Counts, coverage map', 'and the charts'], 'good'))
    for x in (320, 560, 800):
        b.append(arrow(560, 292, x, 340, style='ag'))

    b.append(f'<text x="58" y="448" font-size="9.5" fill="{C["ink6"]}">'
             'Everything in a report is scoped to the reader: an agency sees its own batches, a '
             'manager those in the States/UTs and programme types allocated to them, the Ministry '
             'and the Super Admin the whole estate.</text>')
    return svg(W, 462, ''.join(b))
