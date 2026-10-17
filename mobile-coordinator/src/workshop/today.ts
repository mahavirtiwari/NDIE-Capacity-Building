/**
 * The date it is in India, as yyyy-mm-dd.
 *
 * Every screen that asks "is this today?" was asking UTC — the comment
 * beside one of them said "by the phone's own clock", which is what
 * `new Date().toISOString()` is not. It is the clock in Greenwich.
 *
 * The server does not ask UTC. Marking a register says so in as many
 * words: "Today is India's today. The server runs on UTC and a workshop
 * does not", and it compares against Asia/Kolkata. So for the five and a
 * half hours between midnight and half past five each morning, the app
 * and the server named different days: the app offered the previous day
 * as the one that could still be marked, and the server refused exactly
 * that day as somebody remembering Tuesday on a Friday — while refusing
 * to let the real today be marked at all.
 *
 * India rather than the device, deliberately. The rule being tested is
 * the server's, and the server's rule is India; a phone with its
 * timezone set wrongly, or a coordinator who has travelled, should not
 * be told a different answer from the one that will be enforced.
 *
 * en-CA formats as yyyy-mm-dd, which is the shape the rest of the app
 * and the API already pass dates around in.
 */
export function indiaToday(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
