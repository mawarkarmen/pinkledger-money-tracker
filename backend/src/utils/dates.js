export function parseMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) {
    throw new Error('Month must be in YYYY-MM format.');
  }

  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error('Invalid month.');
  }

  const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  const next = nextMonth.toISOString().slice(0, 10);

  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const end = endDate.toISOString().slice(0, 10);

  return { start, next, end, year, monthNumber };
}

export function todayInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function localTimeInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('hour')}:${get('minute')}`;
}
