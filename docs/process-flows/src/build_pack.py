# -*- coding: utf-8 -*-
"""Assembles docs/process-flows/cbms-process-flows.html."""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from flow_pages_1 import cover, journey_a, journey_b          # noqa: E402
from flow_pages_2 import programme, reporting                 # noqa: E402
from flow_pages_3 import chain, channels, scopes              # noqa: E402
from flow_pages_4 import app_features, coordinator_day, profile_builder  # noqa: E402

OUT = pathlib.Path('docs/process-flows')

Y, N, P = '<span class="yes">&#10003;</span>', '<span class="no">&mdash;</span>', \
          '<span class="part">part</span>'

TIERS = ['Super<br/>Admin', 'Ministry', 'Admin', 'Operation<br/>Manager',
         'Implementing<br/>Agency', 'Coordinator']

# Taken from the seeded roles, less what each tier is barred from holding.
MATRIX = [
    ('Masters &mdash; categories, types, forms, fee structures', 'masters.view / .manage',
     'V+M', 'V', 'V', 'V', 'V', '-'),
    ('Curriculum and exam papers', 'curriculum.* / exams.*', 'V+M', 'V', 'V', 'V', 'V', '-'),
    ('Training material', 'materials.view / .manage', 'V+M', 'V', 'V', 'V', 'V', 'V'),
    ('Roles &amp; permissions', 'roles.view / .manage', 'V+M', '-', '-', 'V+M', 'V+M', '-'),
    ('Portal users', 'users.view / .manage / .status', 'V', 'V', 'V+M', 'V+S', 'V+M', '-'),
    ('Implementing agencies &mdash; empanelment', 'agencies.view / .manage',
     'V', 'V', 'V', 'V+M', '-', '-'),
    ('Coordinators', 'coordinators.view / .manage', 'V', 'V', 'V', 'V', 'V+M', '-'),
    ('Trainers', 'trainers.view / .manage', 'V', 'V', 'V', 'V', 'V', 'V+M'),
    ('Applicants and the scrutiny queue', 'applications.view', 'V', 'V', 'V', 'V', '-', '-'),
    ('Deciding a profile', 'applications.scrutinise', '-', '-', '-', 'M', '-', '-'),
    ('Programmes &mdash; reading', 'programs.view', 'V', 'V', 'V', 'V', 'V', 'V'),
    ('Raising a programme', 'programs.create', '-', '-', '-', '-', 'M', '-'),
    ('Running one &mdash; sessions, attendance, marks', 'programs.manage',
     '-', '-', '-', '-', 'M', 'M'),
    ('Permitting one', 'programs.approve', '-', '-', '-', 'M', '-', '-'),
    ('Reports', 'reports.view', 'V', 'V', 'V', 'V', 'V', 'V'),
    ('Qualified professionals register', 'professionals.view', 'V', 'V', 'V', 'V', '-', '-'),
    ('Portal branding and settings', 'settings.manage', 'M', '-', '-', '-', '-', '-'),
    ('Notifications &mdash; reading the log', 'notifications.view', 'V', '-', 'V', '-', '-', '-'),
    ('Notifications &mdash; sending one', 'notifications.send', 'M', '-', 'M', '-', '-', '-'),
]

CELL = {'V+M': Y + ' read &amp; edit', 'V+S': Y + ' read, on/off', 'V': Y + ' read',
        'M': Y + ' do it', '-': N}

# Every entry in the portal's navigation, and who sees it. Y where the
# seeded role holds the permission the entry is gated on.
TABS = [
    ('Overview', 'Dashboard', '&mdash;', 'YYYYYY'),
    ('Delivery', 'Programs', 'programs.view', 'YYYYYY'),
    ('Delivery', 'Applicants', 'applications.view + tier', 'YYYY--'),
    ('Delivery', 'Profile scrutiny', 'applications.view + tier', 'YYYY--'),
    ('Delivery', 'Qualified professionals', 'professionals.view', 'YYYY--'),
    ('People and access', 'Portal users', 'users.view', 'YYYYY-'),
    ('People and access', 'Notifications', 'notifications.view', 'Y-Y---'),
    ('People and access', 'Roles &amp; permissions', 'roles.view', 'Y--YY-'),
    ('People and access', 'Implementing agencies', 'agencies.view', 'YYYY--'),
    ('People and access', 'Coordinators', 'coordinators.view', 'YYYYY-'),
    ('Reports', 'View reports', 'reports.view', 'YYYYYY'),
    ('Reports', 'Trainers', 'trainers.view', 'YYYYYY'),
    ('Program setup', 'Categories, sub-categories, program types', 'masters.manage', 'Y-----'),
    ('Program setup', 'Sign-up form, profile forms', 'masters.manage', 'Y-----'),
    ('Program setup', 'Feedback forms, curriculum', 'curriculum.manage', 'Y-----'),
    ('Program setup', 'Fee structures', 'fees.view', 'YYY---'),
    ('Program setup', 'Choice lists, qualifications, skills', 'masters.manage', 'Y-----'),
    ('Program setup', 'Exam papers', 'exams.view', 'YYY---'),
    ('Program setup', 'Training material', 'materials.view', 'YYYYYY'),
    ('Configuration', 'Branding, site text, e-mail, system settings', 'settings.manage', 'Y-----'),
]


def tabs_table():
    head = ''.join(f'<th class="c">{t}</th>' for t in TIERS)
    rows, last = [], None
    for group, name, key, seen in TABS:
        shown = group if group != last else ''
        last = group
        cells = ''.join(f'<td class="c">{Y if ch == "Y" else N}</td>' for ch in seen)
        rows.append(f'<tr><td>{shown}</td><td><b>{name}</b></td>'
                    f'<td><code>{key}</code></td>{cells}</tr>')
    return ('<div class="tight"><table>'
            '<caption>The portal, tab by tab, and who sees each one</caption>'
            '<thead><tr><th style="width:13%">Group</th><th style="width:25%">Tab</th>'
            f'<th style="width:16%">Gated on</th>{head}</tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


EMAILS = [
    ('otp', 'Email verification code', 'Sign-up, and any change of e-mail',
     'The applicant, at the address being verified', 'Six digits, ten minutes'),
    ('applicant-welcome', 'Applicant registered', 'Sign-up accepted', 'The applicant', ''),
    ('applicant-credentials', 'Applicant sign-in details', 'Account opened or reset',
     'The applicant', 'Applicant ID and a first-time password'),
    ('portal-credentials', 'Portal user credentials', 'Fallback where no tier-specific letter fits',
     'The new portal user', ''),
    ('admin-credentials', 'Admin credentials', 'Super Admin appoints an Admin', 'The Admin', ''),
    ('ministry-credentials', 'Ministry of MSME credentials', 'Super Admin appoints the Ministry account',
     'The Ministry user', ''),
    ('ops-manager-credentials', 'Operation Manager credentials', 'An Admin appoints a manager',
     'The manager', 'Carries the allocation they were given'),
    ('agency-credentials', 'Implementing Agency credentials', 'A manager empanels an agency with a login',
     'The agency', ''),
    ('coordinator-credentials', 'Coordinator credentials', 'An agency appoints a coordinator',
     'The coordinator', ''),
    ('agency-empanelled', 'Agency empanelled', 'An agency is taken onto the register',
     'The agency', 'Says what it is empanelled for'),
    ('password-reset', 'Password reset code', 'Forgot password, portal or app',
     'The account holder', 'Code, valid for a set window'),
    ('password-changed', 'Password changed', 'A password is changed or reset',
     'The account holder', 'Says which of the two it was'),
    ('account-updated', 'Account updated', 'A portal account’s particulars are edited',
     'The account holder', ''),
    ('account-status-changed', 'Account switched on or off', 'An account is enabled or disabled',
     'The account holder', 'Carries the reason given'),
    ('application-submitted', 'Application received', 'An applicant applies to a programme',
     'The applicant', ''),
    ('scrutiny-outcome', 'Profile scrutiny outcome', 'A manager accepts or rejects a profile',
     'The applicant', 'A rejection carries the reason'),
    ('programme-raised', 'A batch is waiting on you', 'An agency raises a batch',
     'The Operation Manager answerable for it', 'Added with the permission split'),
    ('postponement-requested', 'A batch is asked to be put off', 'An agency asks for a postponement',
     'The Operation Manager', 'Carries the agency’s written reason'),
    ('programme-schedule', 'Joining details', 'Registration confirmed, or the calendar set',
     'The registered candidate', 'Dates, venue or joining link'),
    ('certificate-issued', 'Certificate issued', 'A certificate is issued or re-sent',
     'The candidate', 'Attached, and verifiable by number'),
    ('applicant-access-changed', 'Access changed', 'An applicant is blocked or unblocked',
     'The applicant', 'Carries the reason'),
]


def matrix_table(rows_in, caption):
    head = ''.join(f'<th class="c">{t}</th>' for t in TIERS)
    rows = []
    for name, key, *cells in rows_in:
        tds = ''.join(f'<td class="c">{CELL[c]}</td>' for c in cells)
        rows.append(f'<tr><td><b>{name}</b></td><td><code>{key}</code></td>{tds}</tr>')
    return (
        f'<table><caption>{caption}</caption><thead><tr><th style="width:27%">Area</th>'
        f'<th style="width:17%">Permission key</th>{head}</tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table>')


def email_table(rows_in, caption):
    rows = []
    for key, name, trigger, who, note in rows_in:
        rows.append(
            f'<tr><td><code>{key}</code></td><td><b>{name}</b></td><td>{trigger}</td>'
            f'<td>{who}</td><td>{note or "&mdash;"}</td></tr>')
    return (
        f'<table><caption>{caption}</caption><thead><tr>'
        '<th style="width:15%">Template</th><th style="width:17%">Name</th>'
        '<th style="width:26%">Raised by</th><th style="width:22%">Goes to</th>'
        '<th>Carries</th></tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table>')


def page(num, heading, lede, body, legend=None, notes=None):
    leg = ''
    if legend:
        leg = '<div class="legend">' + ''.join(
            f'<span><i style="background:{bg};border-color:{bd}"></i>{label}</span>'
            for label, bg, bd in legend) + '</div>'
    nts = ''
    if notes:
        nts = '<div class="notes">' + ''.join(
            f'<div class="note note--{tone}"><b>{t}</b>{d}</div>' for t, d, tone in notes) + '</div>'
    return (f'<section class="page"><div class="head"><h2>{heading}</h2>'
            f'<span class="num">{num}</span></div>'
            f'<p class="lede">{lede}</p>{leg}{body}{nts}</section>')


LEGEND = [('Step somebody takes', '#fdf3f4', '#f7dce0'),
          ('Decision', '#fdeecf', '#f0d9a6'),
          ('What the system does by itself', '#dceaf7', '#b9d4ea'),
          ('Outcome', '#dff2e7', '#b7dfc8'),
          ('Stops here', '#fadcdc', '#f0bdbd'),
          ('Dashed = a letter or a notice', '#ffffff', '#1f4e79')]


def build():
    parts = [
        '<!doctype html><html lang="en-IN"><head><meta charset="utf-8">',
        '<title>CBMS process flows</title>',
        '<link rel="stylesheet" href="_styles.css"></head><body>',
        cover(),
        page('Flow 1 of 5 &middot; page 1', 'The applicant&rsquo;s journey &mdash; registering and being accepted',
             'From opening the app to a profile a manager has decided. Nothing below is reachable '
             'until the profile for that track has been accepted.',
             journey_a(), LEGEND,
             [('The identity is the Applicant ID',
               'Not the e-mail. An applicant may change their e-mail without becoming somebody else.',
               'ok'),
              ('A half-filled form is kept',
               'Sections save as they are typed and survive signing out, so a form started on a bus '
               'is still there that evening.', 'ok'),
              ('Scrutiny is the Operation Manager&rsquo;s',
               'A profile is placed on one manager&rsquo;s desk by the track and the applicant&rsquo;s '
               'state, and only that manager decides it.', 'warn')]),
        page('Flow 1 of 5 &middot; page 2', 'The applicant&rsquo;s journey &mdash; taking a programme',
             'What an accepted applicant can do: find a batch, pay for it where there is a fee, '
             'attend, sit the paper and be certified.',
             journey_b(), LEGEND,
             [('Only what you were accepted for',
               'Programmes open to an applicant are the ones on tracks whose profile has been '
               'accepted. Everything else stays shut.', 'ok'),
              ('Seats close themselves',
               'The maximum set when the batch was raised is the cap. A batch can be reopened for a '
               'stated number of places up to the day before it starts.', 'warn'),
              ('Certificates are verifiable',
               'Each one is numbered and can be checked without signing in, which is what makes it '
               'worth anything to an employer.', 'ok')]),
        page('Flow 2 of 5 &middot; page 1', 'A programme: raised, permitted, run, conducted',
             'The agency raises and runs it, the manager permits and postpones it, the coordinator records the day.',
             programme(), LEGEND,
             [('Raising and permitting are different jobs',
               'An agency holds <code>programs.create</code> and <code>programs.manage</code>; '
               'permitting is <code>programs.approve</code>, held by the manager that empanelled it.',
               'warn'),
              ('Putting a batch off is asked for, not done',
               'The agency sends a reason in writing and the batch does not move. The manager decides, '
               'and granting it answers the request.', 'warn'),
              ('The exam time is the manager&rsquo;s',
               'The agency running the batch cannot set when the paper is sat.', 'bad')]),
        page('Flow 2 of 5 &middot; page 2', 'From a conducted programme to a report',
             'What a finished batch leaves behind, and what can be drawn out of it.',
             reporting(), None,
             [('Five sections, one workbook',
               'Summary, participants, attendance, trainers and monitoring. Pick any of them; up to '
               '25 programmes go into a single file.', 'ok'),
              ('Filtered the way the work is organised',
               'Category, programme type, agency, State/UT and a date range &mdash; the same axes the '
               'scheme is allocated on.', 'ok'),
              ('A report never shows more than the reader may see',
               'The scoping is on the query, not the screen, so a narrower account cannot reach a '
               'wider report by changing the address.', 'ok')]),
        page('Flow 3 of 5 &middot; page 1', 'The portal, tab by tab',
             'Every entry in the navigation, what it is gated on, and which tiers it appears for. '
             'The entry and the route carry the same key, so a tab somebody cannot see is one they '
             'cannot reach by typing the address either.',
             tabs_table(), None, None),
        page('Flow 3 of 5 &middot; page 2', 'Who the users are, and what each one is for',
             'Six portal tiers and one app account. Each is created by the tier above it, and each is '
             'allocated a slice of the scheme to work inside.',
             chain(), None,
             [('Super Admin owns the system, not the operation',
               'The masters, the roles, the portal. It does not empanel, appoint managers&rsquo; '
               'coordinators, raise batches, permit them or decide profiles &mdash; it reads all of it.',
               'warn'),
              ('The Ministry changes nothing',
               'Oversight by design: every view permission, no write permission, and no way to be '
               'granted one.', 'ok'),
              ('A coordinator is capped, not merely ungranted',
               'The narrowest tier is held to a ceiling &mdash; its batches, its faculty, its material '
               'and its reports &mdash; so a mis-saved role cannot hand it the scheme.', 'bad')]),
        page('Flow 3 of 5 &middot; page 3', 'What each tier is allocated, and what that narrows',
             'A permission says what a screen offers. The allocation says whom it may be used on — '
             'and an account allocated nothing on an axis reaches nothing on it.',
             scopes(), None,
             [('An empty allocation means nothing, not everything',
               'A scoped account with no states allocated covers no states. The opposite reading is '
               'how a narrow account quietly becomes a wide one.', 'bad'),
              ('Where the person sits is not what they cover',
               'An officer posted in Delhi may be allocated fifteen States/UTs. The two are separate '
               'fields and the second is the one that governs.', 'warn'),
              ('The district axis is the coordinator’s alone',
               'It is the narrowest rung, and the only one that works at district level.', 'ok')]),
        page('Flow 3 of 5 &middot; page 4', 'A coordinator&rsquo;s day on the handset',
             'From signing in to sealing the record. A workshop opens on four tabs: registration, '
             'program, submission and exit. Everything recorded is queued on the phone and sent '
             'when the signal comes back.',
             coordinator_day(), None,
             [('Only the batches in their name',
               'The list is the server&rsquo;s answer about who the batch was given to, not a filter '
               'applied on the screen.', 'ok'),
              ('The server says what is still missing',
               'No venue photograph, no geo-tag, no trainer, a session with nobody marked. The '
               'submit button stays shut until that list is empty.', 'warn'),
              ('Sealing cannot be undone',
               'Not by the agency and not by the back office. That is what makes the record '
               'evidence rather than a draft.', 'bad')]),
        page('Flow 3 of 5 &middot; page 5', 'What the two apps do',
             'The applicant&rsquo;s app and the coordinator&rsquo;s, feature by feature. Two builds, '
             'two sign-ins, one API behind both.',
             app_features(), None, None),
        page('Flow 3 of 5 &middot; page 6', 'Building a profile form',
             'The form an applicant fills in is not written in code. It is built per track in the '
             'portal, and one definition drives the app, the server&rsquo;s checking and the '
             'scrutiny screen.',
             profile_builder(), LEGEND,
             [('A key and a label, every time',
               'The key is what the answer is stored against; the label is what the applicant '
               'reads. A field missing either is refused by name, and the row is marked.', 'warn'),
              ('Scrutiny is set per track',
               'Turn it off and the programmes under that sub-category open without a profile '
               'having to be decided first.', 'ok'),
              ('Forms carry a version',
               'Answers stay against the version they were given under, so a question added in '
               'March does not make February&rsquo;s profiles incomplete.', 'ok')]),
        page('Flow 4 of 5 &middot; page 1', 'Roles and permissions &mdash; the operation',
             'What every tier may do, by permission key. Read this with the chain two pages back: '
             'the key says what the screen offers, the chain says whom it may be used on.',
             matrix_table(MATRIX[:10], 'Masters, access and the people &mdash; the seeded roles, '
                          'after the rules no role record can override'), None,
             [('Withheld, not just left out',
               'Some keys can never be held by a tier whatever a role record says &mdash; empanelling by '
               'an Admin, approving by an agency, scrutiny by a Super Admin. They are refused on the '
               'roles screen and dropped when the permission set is read.', 'bad'),
              ('Allocation narrows on top of the key',
               'Holding <code>agencies.manage</code> lets a manager empanel &mdash; but only inside the '
               'programme types and States/UTs they were allocated.', 'warn'),
              ('Roles are shaped by whoever owns them',
               'A role can only be given permissions its shaper holds, and only the shaper may reshape '
               'it. Two Admins each appoint managers; neither settles the other&rsquo;s role.', 'ok')]),
        page('Flow 4 of 5 &middot; page 2', 'Roles and permissions &mdash; programmes and the portal',
             'The second half of the same table: running the work, and the parts of the portal that '
             'sit above it.',
             matrix_table(MATRIX[10:], 'Programmes, reports and portal settings'), None,
             [('Raising, running and permitting are three keys',
               '<code>programs.create</code>, <code>programs.manage</code> and '
               '<code>programs.approve</code>. The agency holds the first two, the manager the third, '
               'and a permission you grant yourself is not a permission.', 'bad'),
              ('A coordinator is held to a ceiling',
               'Its batches, its faculty, the material it teaches from and its own reports. Anything '
               'else is dropped when the permission set is read, whatever a role record says.', 'warn'),
              ('Sending to every handset is its own key',
               '<code>notifications.send</code> is separate from reading the log, because a notice to '
               'every applicant in the country is not something to hand out with a read permission.',
               'ok')]),
        page('Flow 5 of 5 &middot; page 1', 'How the system reaches people',
             'Three channels out of one event: a letter by e-mail, a push to the two apps, and a list '
             'inside them that is fetched rather than remembered.',
             channels(), None,
             [('The server holds no password in the repository',
               'SMTP host, port, user and sender are set in the portal; the password is write-only &mdash; '
               'it can be replaced but never read back.', 'ok'),
              ('Templates are editable without a release',
               'Subject and body are rows in the database with named placeholders, so wording is '
               'corrected in the portal rather than in a deployment.', 'ok'),
              ('Push needs one credential of yours',
               'The apps report an Expo push token. Delivery to Android needs a Firebase server key '
               'uploaded to the Expo project &mdash; not to this server, and not into the repository.',
               'warn')]),
        page('Flow 5 of 5 &middot; page 2', 'The letters: accounts, access and passwords',
             'Eleven of the twenty-one templates. Each is raised by one thing happening, goes to one '
             'person, and is logged with whether the server took it.',
             email_table(EMAILS[:11], 'Getting in, and being told about it'), None, None),
        page('Flow 5 of 5 &middot; page 3', 'The letters: the work itself',
             'The remaining ten: what the scheme writes to somebody because of something that happened '
             'to their profile, their batch or their certificate.',
             email_table(EMAILS[11:], 'Profiles, programmes and certificates'), None, None),
        '</body></html>',
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / 'cbms-process-flows.html'
    target.write_text(''.join(parts), encoding='utf-8')
    print('written', target)


if __name__ == '__main__':
    build()
