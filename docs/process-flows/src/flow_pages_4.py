# -*- coding: utf-8 -*-
"""The two handsets, and the profile form builder."""
from flowpack import arrow, box, chip, diamond, lane, mail, svg, C

W = 1120


def coordinator_day():
    """A coordinator's day, from signing in to sealing the record."""
    b = []
    for label, y, h, tint in [('Before the day', 48, 100, '#ffffff'),
                              ('Registration tab', 158, 100, C['brand05']),
                              ('Program tab', 268, 108, '#ffffff'),
                              ('Submission tab', 386, 104, C['ok1'])]:
        b.append(lane(20, y, W - 40, h, label, tint))

    bw, step = 148, 164
    c = [50 + i * step for i in range(6)]
    mid = [x + bw / 2 for x in c]

    # --- before the day --------------------------------------------------
    b.append(box(c[0], 62, bw, 56, ['Sign in', 'The coordinator’s own',
                                    'portal account'], 'step', 1))
    b.append(box(c[1], 62, bw, 56, ['My workshops', 'Only the batches put',
                                    'in their name'], 'step', 2))
    b.append(box(c[2], 62, bw, 56, ['Open one', 'Four tabs: registration,',
                                    'program, submission, exit'], 'step', 3))
    b.append(arrow(c[0] + bw, 90, c[1], 90))
    b.append(arrow(c[1] + bw, 90, c[2], 90))
    b.append(box(c[4], 62, bw + 120, 56,
                 ['Works with no signal', 'Everything recorded is queued on the phone and',
                  'sent when the bars come back'], 'system'))

    # --- registration ----------------------------------------------------
    b.append(box(c[0], 172, bw, 56, ['Register the venue', 'Photographed inside and',
                                     'out, and geo-tagged'], 'step', 4))
    b.append(arrow(mid[2], 118, mid[0], 172, style='ab'))
    b.append(box(c[1], 172, bw, 56, ['Register the trainers', 'Who is actually',
                                     'delivering the day'], 'step', 5))
    b.append(arrow(c[0] + bw, 200, c[1], 200))

    # --- the programme itself ---------------------------------------------
    b.append(box(c[0], 284, bw, 56, ['Sessions', 'Each one named, timed',
                                     'and photographed'], 'step', 6))
    b.append(arrow(mid[1], 228, mid[0], 284, style='ab'))
    b.append(box(c[1], 284, bw, 56, ['On-spot registration', 'Somebody who turned up',
                                     'but never enrolled'], 'step', 7))
    b.append(box(c[2], 284, bw, 56, ['Participant photos', 'One per candidate,',
                                     'against their name'], 'step', 8))
    b.append(box(c[3], 284, bw, 56, ['Attendance', 'Marked per session,',
                                     'not once for the day'], 'step', 9))
    b.append(box(c[4], 284, bw, 56, ['The signed sheet', 'Photographed as it was',
                                     'signed in the room'], 'step', 10))
    for i in range(4):
        b.append(arrow(c[i] + bw, 312, c[i + 1], 312))
    b.append(box(c[5], 284, bw, 56, ['Feedback', 'Collected from the',
                                     'candidates present'], 'step', 11))
    b.append(arrow(c[4] + bw, 312, c[5], 312))

    # --- sealing it --------------------------------------------------------
    b.append(box(c[0], 400, bw + 60, 66,
                 ['What is still missing', 'No venue photo, no geo-tag, no',
                  'trainer, a session nobody marked'], 'warn', 12))
    b.append(arrow(mid[0], 340, mid[0], 400, style='ab'))
    b.append(diamond(c[2] + 150, 433, 160, 74, ['Nothing left?', 'the server decides']))
    b.append(arrow(c[0] + bw + 60, 433, c[2] + 70, 433))
    b.append(box(c[4], 400, bw + 120, 66,
                 ['Seal the record', 'With remarks. Nothing can be edited afterwards —',
                  'not by the agency, not by the back office'], 'good', 13))
    b.append(arrow(c[2] + 230, 433, c[4], 433, 'yes', style='ag'))
    b.append(chip(c[2] + 118, 478, 'Go back and finish it', 'bad', 130))
    b.append(arrow(c[2] + 150, 470, c[2] + 170, 478, style='ar'))
    return svg(W, 500, ''.join(b))


def app_features():
    """What each handset is for, side by side."""
    b = []
    b.append(box(40, 44, 520, 34, ['Applicant app — CBMS Applicant'], 'step'))
    b.append(box(580, 44, 500, 34, ['Coordinator app — CBMS Coordinator'], 'step'))

    left = [
        ('Sign up and verify', 'Register with name, e-mail, mobile and PAN; verify by a code.'),
        ('Your profile', 'One form per track, section by section, saved as it is typed.'),
        ('Programmes', 'What is open on the tracks you were accepted for, near you.'),
        ('Register and pay', 'Take a seat in a batch; pay the fee where there is one.'),
        ('Your batches', 'Dates, venue or joining link, and where each one stands.'),
        ('Examinations', 'Sit the paper on the phone, with a photograph at the start.'),
        ('Certificates', 'Downloaded, shareable, and verifiable by number.'),
        ('Training material', 'Documents and videos released for your track.'),
        ('Invoices and payments', 'Every receipt, kept.'),
        ('Feedback', 'On the programme and the trainer, after the day.'),
        ('Notifications', 'A list and an unread count; a push where one is set up.'),
    ]
    right = [
        ('My workshops', 'Only the batches put in this coordinator’s name.'),
        ('Venue registration', 'Photographs inside and out, geo-tagged where taken.'),
        ('Trainer registration', 'Who actually delivered, against the batch.'),
        ('Sessions', 'Named, timed, and photographed one by one.'),
        ('On-spot registration', 'Somebody who turned up without enrolling.'),
        ('Participant photos', 'One per candidate, against their name.'),
        ('Attendance', 'Per session, not once for the whole day.'),
        ('Attendance sheet', 'The signed paper, photographed in the room.'),
        ('Marksheet', 'Marks against the skills the type evaluates.'),
        ('Feedback collection', 'From the candidates who were present.'),
        ('Final submission', 'Sealed once nothing is missing. Not editable after.'),
    ]
    for col, rows in ((40, left), (580, right)):
        for i, (title, sub) in enumerate(rows):
            y = 90 + i * 38
            w = 520 if col == 40 else 500
            b.append(f'<rect x="{col}" y="{y}" width="{w}" height="34" rx="4" '
                     f'fill="{"#ffffff" if i % 2 == 0 else C["ink1"]}" stroke="{C["ink2"]}"/>')
            b.append(f'<text x="{col + 12}" y="{y + 13}" font-size="10.5" font-weight="700" '
                     f'fill="{C["ink9"]}">{title}</text>')
            b.append(f'<text x="{col + 12}" y="{y + 26}" font-size="9.5" '
                     f'fill="{C["ink6"]}">{sub}</text>')

    y = 90 + 11 * 38 + 8
    b.append(box(40, y, 1040, 46,
                 ['Both apps, on installing',
                  'Notifications, camera, photos and media, and location are asked for together and '
                  'required to go on;',
                  'at least 500 MB has to be free, because a day of photographs taken out of signal '
                  'is held on the phone.'], 'system'))
    return svg(W, y + 56, ''.join(b))


def profile_builder():
    """How a profile form is made, and what the applicant then sees."""
    b = []
    for label, y, h, tint in [('Super Admin builds it', 52, 118, C['brand05']),
                              ('What a field can be', 186, 112, '#ffffff'),
                              ('What the applicant gets', 310, 112, C['info1'])]:
        b.append(lane(20, y, W - 40, h, label, tint))

    bw, step = 158, 174
    c = [50 + i * step for i in range(6)]
    mid = [x + bw / 2 for x in c]

    b.append(box(c[0], 68, bw, 66, ['Pick the track', 'One form per sub-category,',
                                    'with a version'], 'step', 1))
    b.append(box(c[1], 68, bw, 66, ['Add sections', 'Named, ordered, and each',
                                    'one switchable'], 'step', 2))
    b.append(box(c[2], 68, bw, 66, ['Add fields', 'Key and label, type, width,',
                                    'required or not'], 'step', 3))
    b.append(box(c[3], 68, bw, 66, ['Set the rules', 'Length, range, dates, file',
                                    'size, how many photos'], 'step', 4))
    b.append(box(c[4], 68, bw, 66, ['Copy from a form', 'Bring a whole layout across',
                                    'and change what differs'], 'step', 5))
    b.append(box(c[5], 68, bw, 66, ['Publish', 'Active, and scrutiny on',
                                    'or off for the track'], 'good', 6))
    for i in range(5):
        b.append(arrow(c[i] + bw, 101, c[i + 1], 101))

    kinds = [
        ('Text and numbers', 'Single line, paragraph,', 'number'),
        ('Checked formats', 'E-mail, mobile, PAN, TAN,', 'GSTIN, IFSC, pincode, Aadhaar'),
        ('Dates', 'With an earliest and', 'a latest'),
        ('Choices', 'Dropdown, multi-select,', 'radio, checkbox'),
        ('Files and pictures', 'A document, or pictures', 'taken on the spot'),
    ]
    for i, (name, l2, l3) in enumerate(kinds):
        x = 50 + i * 208
        b.append(box(x, 200, 196, 60, [name, l2, l3], 'state', small=True))

    tiles = [
        ('Only the sections it has', 'A question switched off is', 'not asked, nor insisted on'),
        ('Shown when it applies', 'A field can depend on the', 'answer to another one'),
        ('Repeatable where set', 'Add another qualification,', 'another employer'),
        ('Saved as it is typed', 'A draft survives signing out', 'and comes back as it was'),
        ('Sent once complete', 'Send for scrutiny is shut', 'until every section is done'),
    ]
    for i, (t, l2, l3) in enumerate(tiles):
        x = 50 + i * 208
        b.append(box(x, 324, 196, 64, [t, l2, l3], 'good' if i == 4 else 'system', small=True))

    b.append(f'<text x="40" y="438" font-size="9.5" fill="{C["ink6"]}">'
             'The same definition drives all three: the app renders it, the server checks what '
             'comes back against it, and the scrutiny screen reads the answers under the labels '
             'the applicant actually saw.</text>')
    return svg(W, 450, ''.join(b))
