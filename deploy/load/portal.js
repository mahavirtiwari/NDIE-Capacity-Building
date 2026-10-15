/*
 * What a portal user actually does, under a crowd.
 *
 * One iteration is one person's minute: they sign in once and then move
 * between the screens their role opens, pausing the way a person pauses.
 * It is not a hammer on one endpoint - that measures the endpoint and
 * tells you nothing about the system, because the thing that falls over
 * under a crowd is usually the screen nobody thought to test.
 *
 * Read-only. Nothing here creates, approves or deletes anything: a load
 * test that leaves a thousand programmes behind has to be cleaned up
 * before anybody can use the site again, and on staging that is somebody's
 * afternoon. The write path is exercised by the end-to-end suite instead.
 *
 * Accounts come from a file, one per line, because the API counts its
 * rate limit per signed-in account. A thousand callers wearing one login
 * is one account doing a thousand requests a minute, and the limiter -
 * correctly - refuses most of them. See the README.
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'https://leanstaging.qci.org.in';
const THINK = Number(__ENV.THINK_SECONDS || 2);

/* Loaded once per test rather than once per caller: a thousand copies of
   the same file is a thousand times the memory for no benefit. */
const accounts = new SharedArray('portal accounts', () => {
  const raw = open(__ENV.ACCOUNTS || './accounts-portal.csv');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const [username, password] = line.split(',').map((part) => part.trim());
      return { username, password };
    });
});

const signInFailures = new Rate('sign_in_failures');
const throttled = new Rate('throttled_429');
const dashboard = new Trend('screen_dashboard', true);
const programmes = new Trend('screen_programmes', true);
const scrutiny = new Trend('screen_scrutiny', true);

export const options = {
  /* Ramp rather than a wall. A thousand callers arriving in one second
     measures the connection backlog; a thousand arriving over two minutes
     measures the system, which is the question being asked. */
  stages: [
    { duration: __ENV.RAMP || '2m', target: Number(__ENV.USERS || 1000) },
    { duration: __ENV.HOLD || '10m', target: Number(__ENV.USERS || 1000) },
    { duration: '1m', target: 0 },
  ],

  /* What counts as a pass. These are the numbers a person notices rather
     than numbers that look tidy: a screen that answers inside a second
     feels immediate, one that takes three feels broken, and one request
     in two hundred failing is already somebody filing a ticket. */
  thresholds: {
    http_req_failed: ['rate<0.005'],
    sign_in_failures: ['rate<0.01'],
    throttled_429: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    screen_dashboard: ['p(95)<1500'],
    screen_programmes: ['p(95)<1500'],
    screen_scrutiny: ['p(95)<2000'],
  },
};

function signIn() {
  /* One caller, one account, for the length of the test - so the rate
     limit is spread the way it is in life rather than piled on one. */
  const who = accounts[exec.vu.idInTest % accounts.length];

  const answer = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ username: who.username, password: who.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth/login' } },
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
  console.log(`${accounts.length} account(s) across ${__ENV.USERS || 1000} callers`);
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
    trend.add(answer.timings.duration);
    throttled.add(answer.status === 429);
    check(answer, { [`${name} answered`]: (r) => r.status === 200 });
  };

  group('open the dashboard', () => {
    /* A screen is its calls, not its slowest one: the browser asks for
       all of these before anything is readable, so they are batched the
       way the browser batches them. */
    const answers = http.batch([
      ['GET', `${BASE}/api/auth/me`, null, as('auth/me')],
      ['GET', `${BASE}/api/dashboard`, null, as('dashboard')],
      ['GET', `${BASE}/api/my-notifications?pageSize=20`, null,
        as('my-notifications')],
    ]);
    watch(answers[1], dashboard, 'dashboard');
  });

  sleep(THINK);

  group('the programmes register', () => {
    const answers = http.batch([
      ['GET', `${BASE}/api/programs?page=1&pageSize=25`, null,
        as('programs')],
      ['GET', `${BASE}/api/lookups/agencies`, null, as('lookups/agencies')],
      ['GET', `${BASE}/api/lookups/program-types`, null,
        as('lookups/program-types')],
    ]);
    watch(answers[0], programmes, 'programs');

    /* Page two, because the first page of anything is the one that is
       cached, indexed and looked at - and the second is where a bad
       paging query shows itself. */
    const second = http.get(`${BASE}/api/programs?page=2&pageSize=25`,
      as('programs'));
    watch(second, programmes, 'programs page 2');
  });

  sleep(THINK);

  group('the scrutiny queue', () => {
    const answer = http.get(`${BASE}/api/profile-submissions?page=1&pageSize=25`,
      as('profile-submissions'));
    watch(answer, scrutiny, 'profile-submissions');

    const counts = http.get(`${BASE}/api/profile-submissions/counts`,
      as('profile-submissions/counts'));
    throttled.add(counts.status === 429);
  });

  sleep(THINK);

  group('the registers down the side', () => {
    http.batch([
      ['GET', `${BASE}/api/applicants?page=1&pageSize=25`, null,
        as('applicants')],
      ['GET', `${BASE}/api/agencies?page=1&pageSize=25`, null,
        as('agencies')],
      ['GET', `${BASE}/api/trainers?page=1&pageSize=25`, null,
        as('trainers')],
    ]).forEach((answer) => throttled.add(answer.status === 429));
  });

  sleep(THINK * 2);
}
