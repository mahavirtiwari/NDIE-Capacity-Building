# -*- coding: utf-8 -*-
"""Pages 6-9: who the users are, what they hold, and the post."""
from flowpack import arrow, box, chip, svg, C

W = 1120


def chain():
    """The delegation chain: who appoints whom, and on what."""
    b = []
    tiers = [
        ('Super Admin', 'Owns the masters, the roles\nand the portal itself',
         'Appoints: Admin, Ministry', C['brand05']),
        ('Admin', 'Appoints managers inside its\ncategories and states',
         'Appoints: Operation Manager', '#ffffff'),
        ('Operation Manager', 'Empanels agencies, decides\nprofiles and permits batches',
         'Appoints: Implementing Agency', C['brand05']),
        ('Implementing Agency', 'Raises its batches and\nruns them',
         'Appoints: Coordinator', '#ffffff'),
        ('Coordinator', 'Records what happened\non the day',
         'Appoints: nobody', C['brand05']),
    ]
    y = 70
    for i, (name, what, appoints, tint) in enumerate(tiers):
        x = 40 + i * 212
        lines = [name] + what.split('\n')
        b.append(box(x, y, 196, 76, lines, 'step'))
        b.append(f'<text x="{x + 98}" y="{y + 92}" text-anchor="middle" font-size="9" '
                 f'font-weight="600" fill="{C["ink5"]}">{appoints}</text>')
        if i < len(tiers) - 1:
            b.append(arrow(x + 196, y + 38, x + 212, y + 38, style='ab'))

    b.append(box(40 + 1 * 212, 196, 196, 56, ['Ministry of MSME',
                                              'Oversight. Reads the whole', 'scheme, changes none of it'],
                 'state'))
    b.append(arrow(138, 146, 252, 224, style='ab', bend='h'))

    b.append(box(40 + 4 * 212, 196, 196, 56, ['Applicant',
                                              'The mobile app. Not a portal', 'account at all'], 'state'))

    b.append(f'<text x="40" y="296" font-size="11" font-weight="700" fill="{C["brand"]}">'
             'Two rules hold the chain together</text>')
    b.append(box(40, 308, 520, 62, ['One rung down, and no further',
                                    'A Super Admin cannot reach past an Admin to make a manager.',
                                    'An account is editable only by the tier that creates its kind.'],
                 'system'))
    b.append(box(580, 308, 500, 62, ['Nobody hands on what they do not hold',
                                     'A role can only be given permissions its shaper holds, and only',
                                     'the shaper may reshape it. Allocation narrows, never widens.'],
                 'system'))
    return svg(W, 390, ''.join(b))


def scopes():
    """What each tier is allocated on, and what that narrows."""
    b = []
    rows = [
        ('Super Admin', 'Nothing — unscoped', 'The whole estate'),
        ('Ministry of MSME', 'Nothing — unscoped', 'The whole estate, read only'),
        ('Admin', 'Category, sub-category, State/UT', 'Managers, agencies and batches inside them'),
        ('Operation Manager', 'Programme type, State/UT', 'The agencies it empanelled and their batches'),
        ('Implementing Agency', 'Programme type, State/UT', 'Its own coordinators, batches and candidates'),
        ('Coordinator', 'Programme type, State/UT, district', 'The batches it was given'),
    ]
    b.append(f'<text x="40" y="30" font-size="11" font-weight="700" fill="{C["brand"]}">'
             'Allocation: the axes each tier is given, and what they narrow</text>')
    y = 46
    b.append(f'<rect x="40" y="{y}" width="{W - 80}" height="26" fill="{C["brand"]}"/>')
    for x, t in [(52, 'Tier'), (300, 'Allocated on'), (640, 'Which narrows')]:
        b.append(f'<text x="{x}" y="{y + 13}" dominant-baseline="middle" font-size="10" '
                 f'font-weight="700" fill="#fff">{t}</text>')
    for i, (tier, axes, narrows) in enumerate(rows):
        ry = y + 26 + i * 30
        fill = '#ffffff' if i % 2 == 0 else C['ink1']
        b.append(f'<rect x="40" y="{ry}" width="{W - 80}" height="30" fill="{fill}" '
                 f'stroke="{C["ink2"]}"/>')
        b.append(f'<text x="52" y="{ry + 15}" dominant-baseline="middle" font-size="10" '
                 f'font-weight="700" fill="{C["ink9"]}">{tier}</text>')
        b.append(f'<text x="300" y="{ry + 15}" dominant-baseline="middle" font-size="10" '
                 f'fill="{C["ink7"]}">{axes}</text>')
        b.append(f'<text x="640" y="{ry + 15}" dominant-baseline="middle" font-size="10" '
                 f'fill="{C["ink7"]}">{narrows}</text>')
    return svg(W, y + 26 + len(rows) * 30 + 10, ''.join(b))


def channels():
    """How the system reaches a person: e-mail, push, in-app."""
    b = []
    b.append(box(40, 60, 200, 70, ['Something happens',
                                   'An account is made, a profile', 'decided, a batch permitted'],
                 'step'))
    b.append(box(300, 30, 190, 58, ['E-mail', 'SMTP, settings held', 'in the portal'], 'system'))
    b.append(box(300, 110, 190, 58, ['Push', 'Expo, to the two', 'mobile apps'], 'system'))
    b.append(box(300, 190, 190, 58, ['In-app list', 'Fetched, so nothing', 'is missed'], 'system'))
    for yy in (59, 139, 219):
        b.append(arrow(240, 95, 300, yy, style='ai'))

    b.append(box(560, 30, 230, 58, ['Templates', 'Subject and body editable', 'in the portal'], 'state'))
    b.append(box(560, 110, 230, 58, ['Audiences', 'Everyone, applicants,', 'coordinators, agencies…'],
                 'state'))
    b.append(box(560, 190, 230, 58, ['Read state', 'Per person, written only', 'when one is opened'],
                 'state'))
    for yy in (59, 139, 219):
        b.append(arrow(490, yy, 560, yy, style='a'))

    b.append(box(850, 60, 230, 128, ['The person',
                                     'An applicant on the phone,',
                                     'a coordinator in a hall,',
                                     'an officer at a desk'], 'good'))
    for yy in (59, 139, 219):
        b.append(arrow(790, yy, 850, 124, style='ag'))

    b.append(f'<text x="40" y="290" font-size="9.5" fill="{C["ink6"]}">'
             'Every letter is logged with its outcome. A send that fails does not fail the thing that '
             'caused it: an account is still created when the server will not take the mail, and the '
             'credentials can be sent again from the portal.</text>')
    return svg(W, 305, ''.join(b))
