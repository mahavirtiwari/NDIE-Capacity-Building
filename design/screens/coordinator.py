# -*- coding: utf-8 -*-
"""The CBMS Coordinator app, screen by screen."""
from gen import Frame, sheet

MAROON = '#82232f'
TABS = ['Registration', 'Programme', 'Submission', 'Exit']


def splash(x, y):
    f = Frame(x, y, MAROON, '', 'Launch', 'app/index.tsx')
    f.out = []
    f.splash('CBMS', 'Workshop monitoring')
    return '\n'.join(f.out)


def sign_in(x, y):
    f = Frame(x, y, MAROON, 'Sign in', 'Sign in', 'app/(auth)/sign-in.tsx')
    f.heading('CBMS')
    f.note('Workshop monitoring')
    f.gap(14)
    f.label('User ID')
    f.field('CO0001')
    f.label('Password')
    f.field('Your password')
    f.gap(4)
    f.button('Sign in')
    f.gap(10)
    f.note('Capacity Building Management System')
    f.note('Ministry of MSME')
    return '\n'.join(f.out)


def workshops(x, y):
    f = Frame(x, y, MAROON, 'My workshops', 'Assigned workshops', 'app/workshops.tsx')
    f.card('5-day assessor training', ['QCI, New Delhi', '12 Oct to 16 Oct 2026'], 'Open')
    f.card('Master trainer programme', ['QCI, Pune', '20 Oct to 24 Oct 2026'], 'Open')
    f.card('Consultant orientation', ['QCI, Jaipur', '02 Sept to 06 Sept 2026'],
           'Submitted', '#5a6472')
    f.gap(10)
    f.note('No workshops assigned')
    f.gap(140)
    f.button('Sign out', 'ghost')
    return '\n'.join(f.out)


def registration(x, y):
    f = Frame(x, y, MAROON, 'Registration', 'Venue and trainers',
              'app/workshop/[id]/(tabs)/registration.tsx')
    f.heading('Venue')
    f.card('Not registered yet', ['Geo-tag and two photos required'])
    f.button('Register venue')
    f.gap(6)
    f.heading('Trainers')
    f.note('No trainer registered yet')
    f.gap(8)
    f.button('Register trainer', 'ghost')
    f.tabbar(TABS, 0)
    return '\n'.join(f.out)


def programme(x, y):
    f = Frame(x, y, MAROON, 'Programme', 'The day as it happens',
              'app/workshop/[id]/(tabs)/programme.tsx')
    f.note('Record the workshop as it happens.')
    f.gap(6)
    f.card('Session management', ['No session recorded yet'])
    f.card('On-spot registration', ['Nobody registered yet'])
    f.card('Participant photo', ['Optional, one photo per participant'])
    f.card('Programme attendance', ['Register participants first'])
    f.card('Add attendance photo', ['Signed sheets not uploaded yet'])
    f.card('Participant feedback', ['Not given'])
    f.tabbar(TABS, 1)
    return '\n'.join(f.out)


def submit(x, y):
    f = Frame(x, y, MAROON, 'Submission', 'Final submission',
              'app/workshop/[id]/(tabs)/submit.tsx')
    f.row('Venue', 'Registered', True)
    f.row('Geo-tag', 'Captured', True)
    f.row('Venue photos', '2', True)
    f.row('Trainers', '2', True)
    f.row('Sessions', '4', True)
    f.row('Participants', '28', True)
    f.row('Present', '26', True)
    f.row('Signed sheets', '3', True)
    f.row('Feedback', '26', True)
    f.gap(8)
    f.heading('Still to do')
    f.note('Everything required has been captured.', '#1f7a4d')
    f.gap(6)
    f.label('Remarks')
    f.field('Anything the reviewer should know (optional)')
    f.button('Submit finally')
    f.tabbar(TABS, 2)
    return '\n'.join(f.out)


def exit_tab(x, y):
    f = Frame(x, y, MAROON, 'Exit', 'Leave the workshop',
              'app/workshop/[id]/(tabs)/exit.tsx')
    f.gap(170)
    f.button('Back to my workshops', 'ghost')
    f.gap(8)
    f.button('Sign out')
    f.gap(14)
    f.note('You will need your user ID and password to')
    f.note('sign back in.')
    f.tabbar(TABS, 3)
    return '\n'.join(f.out)


def venue(x, y):
    f = Frame(x, y, MAROON, 'Register venue', 'Venue with geo-tag',
              'app/workshop/[id]/venue.tsx')
    f.label('Venue name')
    f.field('Venue name')
    f.label('Address')
    f.field('Street, area, city')
    f.label('Landmark')
    f.field('Optional')
    f.gap(4)
    f.heading('Geo-tag')
    f.note('No location captured yet')
    f.button('Capture location', 'ghost')
    f.photobox('Exterior photo, with any signage visible')
    f.photobox('Interior photo, the hall as set up')
    f.button('Save venue')
    return '\n'.join(f.out)


def trainer(x, y):
    f = Frame(x, y, MAROON, 'Add a trainer', 'Trainer', 'app/workshop/[id]/trainer.tsx')
    f.label('Full name')
    f.field('Trainer')
    f.label('Mobile')
    f.field('Enter mobile number')
    f.label('Email')
    f.field('Enter email address')
    f.label('Designation')
    f.field('Designation')
    f.label('Organisation')
    f.field('Organisation')
    f.gap(6)
    f.button('Add trainer')
    return '\n'.join(f.out)


def session(x, y):
    f = Frame(x, y, MAROON, 'Record a session', 'Session', 'app/workshop/[id]/session.tsx')
    f.label('Trainer')
    f.select('Select the trainer')
    f.label('Topic')
    f.select('Select the topic')
    f.label('Sub-topic')
    f.select('Choose a topic first')
    f.gap(4)
    f.photobox('Session photo, participants visible')
    f.label('Comments')
    f.field('Optional')
    f.button('Save session')
    return '\n'.join(f.out)


def participant(x, y):
    f = Frame(x, y, MAROON, 'Register participant', 'On-spot registration',
              'app/workshop/[id]/participant.tsx')
    f.label('Full name')
    f.field('As they would like it on the certificate')
    f.label('Mobile')
    f.field('Enter mobile number')
    f.label('Email')
    f.field('Enter email address')
    f.label('Enterprise name')
    f.field('Name of the unit')
    f.label('Udyam number')
    f.field('UDYAM-XX-00-0000000')
    f.note('Tap NA if the enterprise is not registered.')
    f.label('Gender')
    f.select('Select a gender')
    f.label('Social category')
    f.select('Select a social category')
    f.button('Register participant')
    return '\n'.join(f.out)


def participant_photo(x, y):
    f = Frame(x, y, MAROON, 'Participant photo', 'One photo each',
              'app/workshop/[id]/participant-photo.tsx')
    f.note('Optional. A clear head and shoulders shot.')
    f.gap(6)
    f.card('Anita Sharma', ['Photo taken'], 'Done', '#1f7a4d')
    f.card('Rakesh Kumar', ['No photo'], 'Upload')
    f.card('Sunita Devi', ['No photo'], 'Upload')
    f.gap(6)
    f.photobox('Upload photo')
    return '\n'.join(f.out)


def attendance(x, y):
    f = Frame(x, y, MAROON, 'Attendance', 'Mark present or absent',
              'app/workshop/[id]/attendance.tsx')
    f.chips(['All present', 'Clear'], 0)
    f.toggle('Anita Sharma', True)
    f.toggle('Rakesh Kumar', True)
    f.toggle('Sunita Devi', False)
    f.toggle('Imran Qureshi', True)
    f.toggle('Meera Nair', True)
    f.gap(10)
    f.note('Not marked: 0')
    f.gap(80)
    f.button('Save attendance')
    return '\n'.join(f.out)


def attendance_photo(x, y):
    f = Frame(x, y, MAROON, 'Signed sheet', 'Signed attendance sheets',
              'app/workshop/[id]/attendance-photo.tsx')
    f.note('One photo per page. Make sure the signatures')
    f.note('are readable.')
    f.gap(8)
    f.photobox('Add a signed sheet')
    f.gap(4)
    f.note('No sheets uploaded yet.')
    f.gap(10)
    f.card('Sheet 1', ['Uploaded 12 Oct, 16:40'])
    f.card('Sheet 2', ['Uploaded 12 Oct, 16:42'])
    f.button('Upload sheet')
    return '\n'.join(f.out)


def feedback(x, y):
    f = Frame(x, y, MAROON, 'Feedback', 'Participant feedback',
              'app/workshop/[id]/feedback.tsx')
    f.heading('Anita Sharma')
    f.label('Rating')
    f.chips(['1', '2', '3', '4', '5'], 4)
    f.label('Comments')
    f.field('Optional')
    f.gap(6)
    f.heading('Rakesh Kumar')
    f.label('Rating')
    f.chips(['1', '2', '3', '4', '5'], 3)
    f.gap(6)
    f.note('Not given: 24')
    f.gap(40)
    f.button('Save feedback')
    return '\n'.join(f.out)


SCREENS = [splash, sign_in, workshops, registration, programme, submit, exit_tab,
           venue, trainer, session, participant, participant_photo,
           attendance, attendance_photo, feedback]

if __name__ == '__main__':
    sheet('coordinator-app-screens.svg', MAROON,
          'CBMS Coordinator',
          'Every screen in the coordinator app. Copy taken from the source, not invented. '
          'Package in.gov.msme.cbms.coordinator.',
          SCREENS)
