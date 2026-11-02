/** Minimal RFC 5545 calendar file for a showroom visit (Israel time). */
function pad(n: number) {
  return String(n).padStart(2, '0');
}

function stamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Convert a local Israel date+time to a UTC Date (handles summer time via Intl). */
export function israelToUtc(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Start from the naive UTC guess, then correct by the Asia/Jerusalem offset at that instant.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIsrael = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  const offset = asIsrael - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function buildIcs(opts: { title: string; description: string; location: string; start: Date; minutes: number; uid: string }): string {
  const end = new Date(opts.start.getTime() + opts.minutes * 60000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Avivi Kitchens concept//Showroom visit//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@avivi-concept`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(opts.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    `LOCATION:${esc(opts.location)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT3H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(opts.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function googleCalendarUrl(opts: { title: string; description: string; location: string; start: Date; minutes: number }): string {
  const end = new Date(opts.start.getTime() + opts.minutes * 60000);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    details: opts.description,
    location: opts.location,
    dates: `${stamp(opts.start)}/${stamp(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
