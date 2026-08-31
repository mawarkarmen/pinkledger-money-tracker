/*
 * ==========================================================
 * TODAY FOR HTML DATE INPUT
 * ==========================================================
 *
 * Returns the user's LOCAL calendar date.
 *
 * Example:
 *
 * 2026-08-31
 *
 * IMPORTANT:
 *
 * Do not use:
 *
 * new Date().toISOString().slice(0, 10)
 *
 * because toISOString() uses UTC and can return
 * the previous day for users in Asia/Jakarta.
 */
export function todayInput() {
  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      '0',
    );


  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      '0',
    );


  return `${year}-${month}-${day}`;
}


/*
 * ==========================================================
 * CURRENT MONTH FOR HTML MONTH INPUT
 * ==========================================================
 *
 * Returns:
 *
 * YYYY-MM
 *
 * Uses the browser's LOCAL calendar,
 * not UTC.
 */
export function currentMonth() {
  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      '0',
    );


  return `${year}-${month}`;
}


/*
 * ==========================================================
 * FORMAT DATE
 * ==========================================================
 *
 * Database date values such as:
 *
 * 2026-08-31
 *
 * are date-only values.
 *
 * Parsing them directly with:
 *
 * new Date("2026-08-31")
 *
 * may interpret them as UTC.
 *
 * Therefore date-only strings are explicitly
 * interpreted as local calendar dates.
 */
export function formatDate(
  value,
) {
  if (!value) {
    return '—';
  }


  const text =
    String(value);


  let date;


  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text,
    )
  ) {
    /*
     * Date-only database value.
     *
     * Parse manually to avoid UTC shifts.
     */
    const [
      year,
      month,
      day,
    ] =
      text
        .split('-')
        .map(Number);


    date =
      new Date(
        year,
        month - 1,
        day,
      );

  } else {
    /*
     * Timestamp or other valid JS date.
     */
    date =
      new Date(
        text,
      );
  }


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return text;
  }


  return new Intl.DateTimeFormat(
    undefined,
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    date,
  );
}


/*
 * ==========================================================
 * FORMAT MONEY
 * ==========================================================
 *
 * Fixes the old formatter that always used:
 *
 * maximumFractionDigits: 0
 *
 * That caused values such as:
 *
 * USD 12.50
 *
 * to potentially display without cents.
 */
export function formatMoney(
  value,
  currency = 'IDR',
) {
  const numericValue =
    Number(value);


  const amount =
    Number.isFinite(
      numericValue,
    )
      ? numericValue
      : 0;


  const safeCurrency =
    String(
      currency ||
      'IDR',
    )
      .trim()
      .toUpperCase();


  try {
    /*
     * Determine the normal decimal behavior
     * of the selected currency.
     *
     * Examples:
     *
     * USD -> normally 2
     * SGD -> normally 2
     * EUR -> normally 2
     * IDR -> normally 0
     * JPY -> normally 0
     */
    const currencyDefaults =
      new Intl.NumberFormat(
        undefined,
        {
          style:
            'currency',

          currency:
            safeCurrency,
        },
      )
        .resolvedOptions();


    /*
     * Database precision is numeric(16,2),
     * so PinkLedger displays at most
     * two decimal places.
     *
     * maximumFractionDigits is kept at 2
     * so fractional values are not silently
     * destroyed in currencies that need them.
     */
    const minimumFractionDigits =
      Math.min(
        currencyDefaults
          .minimumFractionDigits,
        2,
      );


    return new Intl.NumberFormat(
      undefined,
      {
        style:
          'currency',

        currency:
          safeCurrency,

        minimumFractionDigits,

        maximumFractionDigits:
          2,
      },
    ).format(
      amount,
    );

  } catch {
    /*
     * Safe fallback for an unexpected
     * or unsupported currency code.
     */
    return (
      `${safeCurrency} ` +
      amount.toLocaleString(
        undefined,
        {
          minimumFractionDigits:
            0,

          maximumFractionDigits:
            2,
        },
      )
    );
  }
}