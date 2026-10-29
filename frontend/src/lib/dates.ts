/**
 * Formats a calendar date like "2025-01-01" (an app page's `lastUpdated`). Parsing it with
 * `new Date(string)` treats it as midnight UTC, which shows as the day before in western time zones,
 * so this builds a local date from its parts. Anything else is parsed normally; unparseable input is
 * returned as is.
 */
export function formatCalendarDate(date: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const value = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : new Date(date);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
