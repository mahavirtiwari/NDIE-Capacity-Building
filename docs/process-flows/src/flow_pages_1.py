# -*- coding: utf-8 -*-
"""Pages 1-3: the cover and the applicant's journey, both halves."""
from flowpack import arrow, box, chip, diamond, lane, mail, svg, C

W = 1120


def cover():
    return """
<section class="page">
  <div class="cover">
    <div class="cover__eyebrow">Ministry of MSME &middot; National Division for Industry Excellence</div>
    <h1>Capacity Building<br/>Management System</h1>
    <div class="cover__sub">Process flows, as the system is built: who does what, in what
      order, what each tier may and may not do, and every letter the system sends.</div>
    <div class="cover__list">
      <div class="cover__item"><b>1</b><span>The applicant's journey, end to end</span></div>
      <div class="cover__item"><b>2</b><span>A programme: raised, permitted, run, reported</span></div>
      <div class="cover__item"><b>3</b><span>What each kind of user does</span></div>
      <div class="cover__item"><b>4</b><span>Roles and permissions</span></div>
      <div class="cover__item"><b>5</b><span>E-mail and notifications</span></div>
    </div>
    <div class="cover__foot">Drawn from the system itself &mdash; statuses, guards, templates and
      permission keys are the ones in the code, not a description of them.</div>
  </div>
</section>"""


def journey_a():
    """Sign-up through to a decided profile."""
    b = []
    for label, y, h, tint in [('Applicant', 58, 112, '#ffffff'),
                              ('System', 182, 92, C['info1']),
                              ('Operation Manager', 286, 150, C['brand05'])]:
        b.append(lane(20, y, W - 40, h, label, tint))

    # --- the applicant, six even steps --------------------------------
    steps = [
        ('Sign up', 'Name, e-mail, mobile,', 'PAN, category'),
        ('Verify e-mail', 'A six-digit code,', 'good for ten minutes'),
        ('Sign in', 'By Applicant ID,', 'never by e-mail'),
        ('Choose the track', 'The sub-category', 'being applied for'),
        ('Fill the profile form', 'Section by section,', 'saved as it is typed'),
        ('Send for scrutiny', 'Only once every', 'section is complete'),
    ]
    x0, bw, gap = 58, 158, 14
    for i, (t, l2, l3) in enumerate(steps):
        x = x0 + i * (bw + gap)
        b.append(box(x, 76, bw, 62, [t, l2, l3], 'step', i + 1))
        if i:
            b.append(arrow(x - gap, 107, x, 107))

    # --- what the system does in between -------------------------------
    b.append(mail(x0 + 60, 200, 'Verification code'))
    b.append(mail(x0 + (bw + gap) + 48, 200, 'Applicant ID + password'))
    b.append(box(x0 + 4 * (bw + gap), 192, bw, 46,
                 ['Draft held on the server', 'A half-filled form survives signing out'], 'system'))
    qx = 846
    b.append(box(qx, 192, 215, 46,
                 ['Placed on one desk', 'By the track and the applicant’s state'], 'system'))

    b.append(arrow(x0 + 70, 138, x0 + 70, 200, style='ai', dashed=True))
    b.append(arrow(x0 + (bw + gap) + 70, 138, x0 + (bw + gap) + 58, 200, style='ai', dashed=True))
    b.append(arrow(x0 + 4 * (bw + gap) + 79, 138, x0 + 4 * (bw + gap) + 79, 192,
                   style='ai', dashed=True))
    b.append(arrow(x0 + 5 * (bw + gap) + 79, 138, qx + 107, 192, style='ai', dashed=True))

    # --- the manager decides -------------------------------------------
    b.append(box(qx, 300, 215, 62, ['Scrutiny queue', 'The manager it was placed with,',
                                    'and nobody else'], 'step', 7))
    b.append(arrow(qx + 107, 238, qx + 107, 300, style='ai', dashed=True))
    b.append(diamond(660, 331, 150, 80, ['Decide', 'accept or reject']))
    b.append(arrow(qx, 331, 740, 331))

    b.append(chip(466, 300, 'Accepted', 'good', 86))
    b.append(chip(420, 356, 'Rejected, with the reason', 'bad', 158))
    b.append(arrow(600, 316, 556, 308, style='ag'))
    b.append(arrow(600, 348, 580, 360, style='ar'))
    b.append(mail(170, 358, 'Outcome e-mailed to the applicant'))

    # --- the status rail -------------------------------------------------
    b.append(f'<text x="40" y="474" font-size="11" font-weight="700" fill="{C["brand"]}">'
             'Profile status</text>')
    rail = [('Draft', 'state', 150), ('Submitted', 'warn', 250),
            ('Under scrutiny', 'warn', 370), ('Approved', 'good', 520)]
    for text, kind, x in rail:
        b.append(chip(x, 464, text, kind))
    for i in range(len(rail) - 1):
        b.append(arrow(rail[i][2] + len(rail[i][0]) * 5.6 + 18, 472, rail[i + 1][2] - 4, 472))
    b.append(chip(370, 506, 'Rejected', 'bad'))
    b.append(arrow(405, 483, 405, 506, style='ar'))
    b.append(f'<text x="640" y="470" font-size="9.5" fill="{C["ink6"]}">'
             'A rejected profile can be answered and sent again.</text>'
             f'<text x="640" y="484" font-size="9.5" fill="{C["ink6"]}">'
             'The attempt is numbered, and the reason given stays on the record.</text>')
    return svg(W, 530, ''.join(b))


def journey_b():
    """An accepted applicant, through a programme and out the other side."""
    b = []
    for label, y, h, tint in [('Applicant', 56, 172, '#ffffff'),
                              ('System', 240, 88, C['info1']),
                              ('Agency / Coordinator', 340, 96, C['brand05'])]:
        b.append(lane(20, y, W - 40, h, label, tint))

    bw, step = 135, 151
    c = [50 + i * step for i in range(7)]
    mid = [x + bw / 2 for x in c]

    b.append(box(c[0], 72, bw, 62, ['Programmes open to you', 'Only on tracks whose',
                                    'profile was accepted'], 'step', 8))
    b.append(box(c[1], 72, bw, 62, ['Register for a batch', 'Seats are first come,',
                                    'first served'], 'step', 9))
    b.append(diamond(mid[2], 103, 140, 70, ['Fee payable?', 'per the fee structure']))
    b.append(box(c[3], 72, bw, 62, ['Pay', 'By card or net banking;',
                                    'an invoice is raised'], 'step', 10))
    b.append(box(c[4], 72, bw, 62, ['Attend', 'Marked present by',
                                    'the coordinator'], 'step', 11))
    b.append(box(c[5], 72, bw, 62, ['Sit the paper', 'Where the programme',
                                    'type requires one'], 'step', 12))
    b.append(box(c[6], 72, bw, 62, ['Result', 'Pass or fail, against',
                                    'the certification policy'], 'good', 13))

    b.append(arrow(c[0] + bw, 103, c[1], 103))
    b.append(arrow(c[1] + bw, 103, mid[2] - 70, 103))
    b.append(arrow(mid[2] + 70, 103, c[3], 103, 'yes'))
    b.append(arrow(mid[2], 68, mid[4] - 20, 68, 'no fee'))
    b.append(arrow(c[3] + bw, 103, c[4], 103))
    b.append(arrow(c[4] + bw, 103, c[5], 103))
    b.append(arrow(c[5] + bw, 103, c[6], 103))

    b.append(box(c[5], 152, bw, 54, ['Feedback', 'On the programme',
                                     'and the trainer'], 'step', 15))
    b.append(arrow(mid[4], 134, c[5] + 20, 152))

    # --- what the system does ---------------------------------------------
    b.append(mail(c[1] - 4, 256, 'Joining details: dates, venue or link'))
    b.append(arrow(mid[1], 134, c[1] + 4, 256, style='ai', dashed=True))
    b.append(box(c[3], 252, 286, 46, ['Seats close by themselves',
                                      'The cap is the cap; a batch can be reopened'], 'system'))
    b.append(arrow(mid[3], 134, mid[3], 252, style='ai', dashed=True))

    b.append(box(c[6], 250, bw, 60, ['Certificate', 'Numbered, and',
                                     'verifiable by anyone'], 'good', 14))
    b.append(arrow(mid[6], 134, mid[6], 250, style='ag'))
    b.append(mail(c[5] + 10, 274, 'Certificate e-mailed'))
    b.append(arrow(c[6], 280, c[5] + 128, 280, style='ai', dashed=True))

    # --- what the agency and the coordinator put in ------------------------
    b.append(box(c[4], 354, bw, 60, ['Attendance & evidence', 'Photographs of venue,',
                                     'sessions and sheets'], 'step'))
    b.append(box(c[3], 354, bw, 60, ['Sessions run', 'On the day, from the',
                                     'coordinator’s phone'], 'step'))
    b.append(arrow(mid[4], 354, mid[4], 136, style='ab', dashed=True))
    b.append(arrow(c[3] + bw, 384, c[4], 384))

    # --- the status rail ----------------------------------------------------
    b.append(f'<text x="40" y="462" font-size="11" font-weight="700" fill="{C["brand"]}">'
             'Where the applicant stands</text>')
    rail = [('Registered', 'state', 230), ('Paid', 'state', 345), ('Enrolled', 'warn', 425),
            ('Attended', 'warn', 525), ('Passed', 'good', 640), ('Certified', 'good', 730)]
    for text, kind, x in rail:
        b.append(chip(x, 452, text, kind))
    for i in range(len(rail) - 1):
        b.append(arrow(rail[i][2] + len(rail[i][0]) * 5.6 + 18, 460, rail[i + 1][2] - 4, 460))
    b.append(chip(640, 486, 'Failed', 'bad'))
    b.append(arrow(668, 471, 668, 486, style='ar'))
    b.append(f'<text x="840" y="464" font-size="9.5" fill="{C["ink6"]}">'
             'A failure can be re-sat where the type allows it.</text>')
    return svg(W, 508, ''.join(b))
