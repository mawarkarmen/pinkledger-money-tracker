/*
 * ==========================================================
 * PARSE YYYY-MM
 * ==========================================================
 */
export function parseMonth(
  month,
) {
  if (
    !/^\d{4}-\d{2}$/.test(
      month || '',
    )
  ) {
    throw new Error(
      'Month must be in YYYY-MM format.',
    );
  }


  const [
    year,
    monthNumber,
  ] =
    month
      .split('-')
      .map(Number);


  if (
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error(
      'Invalid month.',
    );
  }


  const start =
    `${year}-${String(
      monthNumber,
    ).padStart(
      2,
      '0',
    )}-01`;


  /*
   * Date.UTC is safe here.
   *
   * We are only doing abstract calendar
   * arithmetic to determine the next month.
   *
   * We are NOT using this as the user's
   * current date.
   */
  const nextMonth =
    new Date(
      Date.UTC(
        year,
        monthNumber,
        1,
      ),
    );


  const next =
    nextMonth
      .toISOString()
      .slice(
        0,
        10,
      );


  const endDate =
    new Date(
      Date.UTC(
        year,
        monthNumber,
        0,
      ),
    );


  const end =
    endDate
      .toISOString()
      .slice(
        0,
        10,
      );


  return {
    start,
    next,
    end,
    year,
    monthNumber,
  };
}


/*
 * ==========================================================
 * VALIDATE IANA TIMEZONE
 * ==========================================================
 *
 * Examples of valid values:
 *
 * Asia/Jakarta
 * Asia/Singapore
 * Europe/London
 * America/New_York
 * UTC
 */
export function isValidTimeZone(
  timeZone,
) {
  if (
    typeof timeZone !==
      'string' ||
    !timeZone.trim()
  ) {
    return false;
  }


  try {
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          timeZone.trim(),
      },
    ).format(
      new Date(),
    );


    return true;
  } catch {
    return false;
  }
}


/*
 * ==========================================================
 * NORMALIZE TIMEZONE
 * ==========================================================
 *
 * Never use an unvalidated timezone.
 *
 * Invalid or missing values fall back
 * to UTC.
 */
export function normalizeTimeZone(
  timeZone,
  fallback = 'UTC',
) {
  const candidate =
    typeof timeZone ===
      'string'
      ? timeZone.trim()
      : '';


  if (
    isValidTimeZone(
      candidate,
    )
  ) {
    return candidate;
  }


  if (
    isValidTimeZone(
      fallback,
    )
  ) {
    return fallback;
  }


  return 'UTC';
}


/*
 * ==========================================================
 * TODAY IN USER TIMEZONE
 * ==========================================================
 *
 * Example:
 *
 * UTC:
 * 2026-08-31 17:30
 *
 * Asia/Jakarta:
 * 2026-09-01 00:30
 *
 * Result:
 * 2026-09-01
 */
export function todayInTimeZone(
  timeZone,
) {
  const safeTimeZone =
    normalizeTimeZone(
      timeZone,
    );


  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          safeTimeZone,

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',
      },
    ).formatToParts(
      new Date(),
    );


  const get =
    (type) =>
      parts.find(
        (part) =>
          part.type ===
          type,
      )?.value;


  return (
    `${get('year')}-` +
    `${get('month')}-` +
    `${get('day')}`
  );
}


/*
 * ==========================================================
 * CURRENT MONTH IN USER TIMEZONE
 * ==========================================================
 *
 * Returns:
 *
 * YYYY-MM
 */
export function currentMonthInTimeZone(
  timeZone,
) {
  return todayInTimeZone(
    timeZone,
  ).slice(
    0,
    7,
  );
}


/*
 * ==========================================================
 * LOCAL TIME IN USER TIMEZONE
 * ==========================================================
 *
 * Used by the reminder worker.
 *
 * Returns:
 *
 * HH:mm
 */
export function localTimeInTimeZone(
  timeZone,
) {
  const safeTimeZone =
    normalizeTimeZone(
      timeZone,
    );


  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          safeTimeZone,

        hour:
          '2-digit',

        minute:
          '2-digit',

        hourCycle:
          'h23',
      },
    ).formatToParts(
      new Date(),
    );


  const get =
    (type) =>
      parts.find(
        (part) =>
          part.type ===
          type,
      )?.value;


  return (
    `${get('hour')}:` +
    `${get('minute')}`
  );
}