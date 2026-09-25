# -*- coding: utf-8 -*-
"""The CBMS Applicant app, screen by screen."""
from gen import Frame, sheet

BRAND = '#82232f'
TABS = ['Programmes', 'Batches', 'Applications', 'Material', 'Profile']


def splash(x, y):
    f = Frame(x, y, BRAND, '', 'Launch', 'app/index.tsx')
    f.out = []
    f.splash('CBMS', 'Applicant')
    return f.svg() if hasattr(f, 'svg') else '\n'.join(f.out)


def sign_in(x, y):
    f = Frame(x, y, BRAND, 'Sign in', 'Sign in', 'app/(auth)/sign-in.tsx')
    f.note('Enter your applicant ID and password.')
    f.gap(8)
    f.label('Applicant ID')
    f.field('APP240001')
    f.label('Password')
    f.field('Show password')
    f.gap(4)
    f.button('Sign in')
    f.note('Use the applicant ID emailed to you, not your')
    f.note('email address.')
    f.gap(14)
    f.note('New to the scheme?')
    f.button('Create an applicant account', 'ghost')
    return '\n'.join(f.out)


def sign_up(x, y):
    f = Frame(x, y, BRAND, 'Create account', 'Register', 'app/(auth)/sign-up.tsx')
    f.label('Full name')
    f.field('As printed on your PAN')
    f.label('Email')
    f.field('Enter email address')
    f.label('Mobile')
    f.field('Enter mobile number')
    f.label('PAN')
    f.field('ABCDE1234F')
    f.label('Gender')
    f.select('Select a gender')
    f.label('Social category')
    f.select('Select a social category')
    f.label('Category')
    f.select('Select a category')
    f.label('Sub-category')
    f.select('Select a sub-category')
    f.button('Register')
    return '\n'.join(f.out)


def verify(x, y):
    f = Frame(x, y, BRAND, 'Check your email', 'Verify email', 'app/(auth)/verify.tsx')
    f.note('Enter the 6 digit code from your email.')
    f.gap(10)
    f.label('Verification code')
    f.field('000000')
    f.gap(4)
    f.button('Verify email')
    f.button('Resend code', 'ghost')
    f.gap(6)
    f.note('You can change your email later without')
    f.note('affecting how you sign in.')
    return '\n'.join(f.out)


def programs(x, y):
    f = Frame(x, y, BRAND, 'Programmes', 'Programmes (tab 1)', 'app/(tabs)/programs.tsx')
    f.field('Search programmes')
    f.chips(['All categories', 'ZED'], 0)
    f.card('5-day assessor training', ['ZED / Assessor', 'Minimum qualification: Graduation'],
           'Apply')
    f.card('Master trainer programme', ['ZED / Master Trainer', 'Exam'], 'Applied', '#5a6472')
    f.card('Consultant orientation', ['ZED / Consultant', 'Free'], 'Closed', '#8a93a0')
    f.tabbar(TABS, 0)
    return '\n'.join(f.out)


def batches(x, y):
    f = Frame(x, y, BRAND, 'Batches', 'Batches (tab 2)', 'app/(tabs)/batches.tsx')
    f.note('Scheduled batches you can join.')
    f.gap(6)
    f.card('QCI / New Delhi', ['12 Oct to 16 Oct', 'Physical, 30 seats'], 'Apply')
    f.card('QCI / Pune', ['20 Oct to 24 Oct', 'Virtual'], 'Full', '#8a93a0')
    f.card('QCI / Jaipur', ['02 Nov to 06 Nov', 'Physical'], 'Enrolled', '#1f7a4d')
    f.note('You are enrolled on this batch')
    f.tabbar(TABS, 1)
    return '\n'.join(f.out)


def applications(x, y):
    f = Frame(x, y, BRAND, 'Applications', 'Applications (tab 3)', 'app/(tabs)/applications.tsx')
    f.card('5-day assessor training', ['Submitted 24 Sept 2026', 'Payment: Free'], 'View', '#5a6472')
    f.gap(2)
    f.heading('Enrolment')
    f.row('Mode', 'Physical')
    f.row('Starts', '12 Oct 2026')
    f.row('Ends', '16 Oct 2026')
    f.row('Attendance', '5 of 5', True)
    f.row('Exam', 'Passed', True)
    f.row('Result', 'Certified', True)
    f.tabbar(TABS, 2)
    return '\n'.join(f.out)


def materials(x, y):
    f = Frame(x, y, BRAND, 'Material', 'Training material (tab 4)', 'app/(tabs)/materials.tsx')
    f.note('Reading for the programmes you are on.')
    f.gap(6)
    f.card('ZED assessor handbook', ['PDF, 4.2 MB'])
    f.card('Assessment checklist', ['PDF, 820 KB'])
    f.card('Scheme guidelines 2026', ['External link'])
    f.gap(8)
    f.note('No app on this device can open that link.', '#b4690e')
    f.tabbar(TABS, 3)
    return '\n'.join(f.out)


def profile(x, y):
    f = Frame(x, y, BRAND, 'Profile', 'Profile (tab 5)', 'app/(tabs)/profile.tsx')
    f.row('Applicant ID', 'APP240001', True)
    f.row('Category', 'ZED')
    f.row('Sub-category', 'Assessor')
    f.row('Email verified', 'Verified', True)
    f.gap(8)
    f.label('Email')
    f.field('name@example.org', True)
    f.label('Mobile')
    f.field('9812345670', True)
    f.label('State')
    f.select('DELHI')
    f.label('District')
    f.select('NEW DELHI')
    f.button('Save changes')
    f.button('Sign out', 'ghost')
    f.tabbar(TABS, 4)
    return '\n'.join(f.out)


def apply(x, y):
    f = Frame(x, y, BRAND, 'Apply', 'Registration form', 'app/apply/[programTypeId].tsx')
    f.note('Fields come from the form built in the portal.')
    f.gap(6)
    f.label('Full name')
    f.field('As printed on your PAN')
    f.label('Qualification')
    f.select('Select')
    f.label('Years of experience')
    f.field('0')
    f.gap(4)
    f.heading('Fee and tax')
    f.row('Fee payable', 'INR 5,900')
    f.label('TDS deduction')
    f.select('No TDS deduction')
    f.label('TAN')
    f.field('DELA12345B')
    f.row('Total payable', 'INR 5,900', True)
    f.button('Submit application')
    return '\n'.join(f.out)


def application(x, y):
    f = Frame(x, y, BRAND, 'Application', 'Application detail', 'app/application/[id].tsx')
    f.card('5-day assessor training', ['ZED / Assessor'], 'Verified', '#1f7a4d')
    f.row('Submitted', '24 Sept 2026')
    f.row('Payment', 'Free')
    f.row('Score', '82 / 100', True)
    f.gap(8)
    f.heading('Progress')
    f.checkrow('Submitted', 'done')
    f.checkrow('Scrutiny passed', 'done')
    f.checkrow('Enrolled on a batch', 'done')
    f.checkrow('Certificate issued', 'todo')
    f.gap(4)
    f.heading('Your answers')
    f.row('Qualification', 'Graduation')
    f.row('Experience', '4 years')
    f.gap(2)
    f.heading('Documents')
    f.row('PAN card', 'Uploaded')
    return '\n'.join(f.out)


SCREENS = [splash, sign_in, sign_up, verify, programs, batches,
           applications, materials, profile, apply, application]

if __name__ == '__main__':
    sheet('applicant-app-screens.svg', BRAND,
          'CBMS Applicant',
          'Every screen in the applicant app. Copy taken from the source, not invented. '
          'Package in.gov.msme.ntms.applicant.',
          SCREENS)
