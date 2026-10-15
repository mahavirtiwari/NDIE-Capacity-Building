/*
 * A thousand handsets, doing what handsets do.
 *
 * The applicant app is where the crowd actually is: a portal user is one
 * of a few hundred officers, and an applicant is one of however many
 * people the scheme is training. This is the journey that matters most
 * at scale and the one easiest to forget to test, because nobody opens
 * it at a desk.
 *
 * One iteration is one applicant opening the app: signing in, reading
 * what is waiting, looking at the programmes open to them, and starting
 * a profile form - which is the heaviest read in the app, because it
 * pulls the form, its sections, its choice lists and the LGD masters
 * behind every address field.
 *
 * Read-only. Nothing is submitted and no photograph is uploaded: that
 * would leave a thousand half-finished profiles on staging. The upload
 * path has a scenario of its own in the README, to be run deliberately
 * and against a database somebody is willing to throw away.
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'https://leanstaging.qci.org.in';
const THINK = Number(__ENV.THINK_SECONDS || 3);

const accounts = new SharedArray('applicant accounts', () => {
  const raw = open(__ENV.ACCOUNTS || './accounts-applicant.csv');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const [applicantCode, password] = line.split(',').map((part) => part.trim());
      return { applicantCode, password };
    });
});

const signInFailures = new Rate('sign_in_failures');
const throttled = new Rate('throttled_429');
const home = new Trend('screen_home', true);
const form = new Trend('screen_profile_form', true);

export const options = {
  stages: [
    { duration: __ENV.RAMP || '2m', target: Number(__ENV.USERS || 1000) },
    { duration: __ENV.HOLD || '10m', target: Number(__ENV.USERS || 1000) },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.005'],
    sign_in_failures: ['rate<0.01'],
    throttled_429: ['rate<0.01'],
    /* A handset is on a district mobile network, so the budget is wider
       than the portal's - but it is the server's share being measured
       here, and the server's share has to leave room for the network. */
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    screen_home: ['p(95)<2000'],
    screen_profile_form: ['p(95)<2500'],
  },
};

function signIn() {
  const who = accounts[exec.vu.idInTest % accounts.length];

  const answer = http.post(
    `${BASE}/api/auth/applicant/login`,
    JSON.stringify({ applicantCode: who.applicantCode, password: who.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'applicant/login' } },
  );

  const ok = check(answer, {
    'signed in': (r) => r.status === 200 && !!r.json('data.token'),
  });

  signInFailures.add(!ok);
  throttled.add(answer.status === 429);

  if (!ok) {
    /* Stop, rather than go round again.
     *
     * A sign-in that fails is never load: it is the wrong account file,
     * the wrong target, or a password that has been changed. Carrying on
     * turns that mistake into hundreds of failed attempts, and the API
     * locks an account out after a handful - so a run with a stale CSV
     * does not just fail, it takes the accounts down with it and
     * somebody has to unlock them before anything can be tested again.
     * That is a discovery from writing this: the first bad run locked
     * the very account it was testing with.
     *
     * A 429 is the exception. It means the accounts are being shared
     * too thinly, which is worth saying plainly rather than aborting on.
     */
    if (answer.status === 429) {
      console.warn(
        'Throttled on sign-in. Too few accounts for this many callers - '
        + 'see deploy/load/README.md.');
      sleep(30);
      return null;
    }

    exec.test.abort(
      `Sign-in failed (${answer.status}). Check the accounts file and the target `
      + 'before running again - repeated failures lock the account out.');
  }

  return answer.json('data.token');
}

export function setup() {
  if (accounts.length === 0) {
    throw new Error('No accounts loaded. See deploy/load/README.md.');
  }
  console.log(`${accounts.length} applicant(s) across ${__ENV.USERS || 1000} handsets`);
}

export default function () {
  const token = signIn();
  if (!token) {
    sleep(THINK);
    return;
  }

  /* The headers and the tag for one call. A function rather than a
     shared object with the tag spread over it: k6 transpiles the script
     and does not take object spread, and this says what it is anyway. */
  const as = (name) => ({
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    tags: { name },
  });

  const watch = (answer, trend, name) => {
    if (trend) trend.add(answer.timings.duration);
    throttled.add(answer.status === 429);
    check(answer, { [`${name} answered`]: (r) => r.status === 200 });
  };

  let subCategoryId = null;

  group('opening the app', () => {
    /* What the app asks for before it can draw anything: who this is,
       what has been said to them, and the branding the shell is painted
       with. */
    const answers = http.batch([
      ['GET', `${BASE}/api/me`, null, as('me')],
      ['GET', `${BASE}/api/my-notifications?pageSize=20`, null,
        as('my-notifications')],
      ['GET', `${BASE}/api/me/profile-submissions`, null,
        as('me/profile-submissions')],
    ]);

    watch(answers[0], home, 'me');

    const held = answers[2].json('data');
    if (Array.isArray(held) && held.length > 0) {
      subCategoryId = held[0].subCategoryId;
    }
  });

  if (!subCategoryId) {
    /* A new account holds no profile yet, and the profile form is the
       heaviest read in the app - so without this the test skips the one
       screen it most needs to measure, and says nothing while doing it.
       The choices are what the app itself offers somebody starting
       their first profile. */
    const choices = http.get(`${BASE}/api/me/profile-choices`, as('me/profile-choices'));
    throttled.add(choices.status === 429);

    const open = choices.json('data');
    if (Array.isArray(open) && open.length > 0) {
      subCategoryId = open[0].subCategoryId;
    }
  }

  sleep(THINK);

  group('what is open to me', () => {
    const answers = http.batch([
      ['GET', `${BASE}/api/me/programs`, null, as('me/programs')],
      ['GET', `${BASE}/api/me/batches`, null, as('me/batches')],
    ]);
    answers.forEach((answer) => throttled.add(answer.status === 429));
  });

  sleep(THINK);

  if (subCategoryId) {
    group('the profile form', () => {
      /* The heaviest read in the app: the form, its sections, its choice
         lists, and - since the address section asks for them - the LGD
         masters behind every State and District field. */
      const answer = http.get(`${BASE}/api/me/profile-form/${subCategoryId}`,
        as('me/profile-form'));
      watch(answer, form, 'profile-form');

      const masters = http.batch([
        ['GET', `${BASE}/api/lookups/states`, null, as('lookups/states')],
        ['GET', `${BASE}/api/lookups/districts?stateCode=7`, null,
          as('lookups/districts')],
      ]);
      masters.forEach((one) => throttled.add(one.status === 429));
    });

    sleep(THINK);
  }

  /* Longer than the others: somebody reading their programmes on a phone
     is not clicking every two seconds. A think time that is too short is
     how a load test reports a problem the real crowd would never cause. */
  sleep(THINK * 3);
}
