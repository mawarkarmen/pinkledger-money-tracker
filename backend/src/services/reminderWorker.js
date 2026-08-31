import {
  adminSupabase,
} from '../supabase.js';

import {
  sendTransactionReminder,
} from './email.js';

import {
  resolveReminderRecipient,
} from './reminderRecipient.js';

import {
  localTimeInTimeZone,
  todayInTimeZone,
} from '../utils/dates.js';


/*
 * ==========================================================
 * MARK REMINDER AS HANDLED
 * ==========================================================
 *
 * This is used when:
 *
 * 1. An email was successfully sent.
 *
 * OR
 *
 * 2. The user already recorded a transaction
 *    today and therefore does not need an email.
 */
async function markReminderHandled(
  userId,
  today,
) {
  const {
    error,
  } =
    await adminSupabase
      .from(
        'reminder_preferences',
      )
      .update({
        last_sent_date:
          today,
      })
      .eq(
        'user_id',
        userId,
      );


  if (error) {
    throw error;
  }
}


/*
 * ==========================================================
 * PROCESS ONE USER
 * ==========================================================
 */
async function processReminderPreference(
  pref,
) {
  /*
   * Every user can have their own timezone.
   *
   * Example:
   *
   * Asia/Jakarta
   * Asia/Singapore
   * UTC
   */
  const timezone =
    pref.timezone ||
    'UTC';


  /*
   * Get today's date according to the
   * user's timezone.
   *
   * Example:
   *
   * 2026-08-31
   */
  const today =
    todayInTimeZone(
      timezone,
    );


  /*
   * Get the current local time according
   * to the user's timezone.
   *
   * Example:
   *
   * 20:05
   */
  const localTime =
    localTimeInTimeZone(
      timezone,
    );


  /*
   * Supabase may return reminder_time as:
   *
   * 20:00:00
   *
   * We only need:
   *
   * 20:00
   */
  const reminderTime =
    String(
      pref.reminder_time ||
        '20:00',
    ).slice(
      0,
      5,
    );


  /*
   * ========================================================
   * CHECK 1
   * REMINDER ENABLED?
   * ========================================================
   */
  if (
    !pref.enabled
  ) {
    return {
      status:
        'disabled',
    };
  }


  /*
   * ========================================================
   * CHECK 2
   * ALREADY HANDLED TODAY?
   * ========================================================
   *
   * If today's reminder has already been
   * processed, do nothing.
   */
  if (
    pref.last_sent_date ===
    today
  ) {
    return {
      status:
        'already_handled',
    };
  }


  /*
   * ========================================================
   * CHECK 3
   * HAS REMINDER TIME ARRIVED?
   * ========================================================
   *
   * Example:
   *
   * User reminder:
   * 20:00
   *
   * Current local time:
   * 19:55
   *
   * Result:
   * do nothing yet.
   */
  if (
    localTime <
    reminderTime
  ) {
    return {
      status:
        'before_time',
    };
  }


  /*
   * ========================================================
   * CHECK 4
   * HAS THE USER ENTERED A TRANSACTION TODAY?
   * ========================================================
   *
   * If they already recorded something,
   * there is no reason to remind them.
   */
  const {
    count,
    error: transactionError,
  } =
    await adminSupabase
      .from(
        'transactions',
      )
      .select(
        'id',
        {
          count:
            'exact',

          head:
            true,
        },
      )
      .eq(
        'user_id',
        pref.user_id,
      )
      .eq(
        'date',
        today,
      );


  if (
    transactionError
  ) {
    throw transactionError;
  }


  /*
   * At least one transaction already
   * exists today.
   */
  if (
    (count || 0) >
    0
  ) {
    /*
     * Mark this date as handled.
     *
     * This prevents the worker from checking
     * this same user again every five minutes
     * for the rest of the day.
     */
    await markReminderHandled(
      pref.user_id,
      today,
    );


    return {
      status:
        'transaction_exists',
    };
  }


  /*
   * ========================================================
   * RESOLVE EMAIL RECIPIENT
   * ========================================================
   *
   * This uses the shared helper created
   * in the previous fix.
   *
   * Priority:
   *
   * 1. profiles.email
   * 2. Supabase Auth email
   */
  const {
    email,
    name,
    emailSource,
  } =
    await resolveReminderRecipient({
      userId:
        pref.user_id,

      profileClient:
        adminSupabase,
    });


  /*
   * If no usable email exists, do not
   * update last_sent_date.
   *
   * This allows the worker to try again
   * after the user adds an email.
   */
  if (
    !email
  ) {
    console.warn(
      `Reminder skipped for ${pref.user_id}: no email address is available.`,
    );


    return {
      status:
        'no_email',
    };
  }


  /*
   * ========================================================
   * SEND REMINDER
   * ========================================================
   */
  await sendTransactionReminder({
    email,
    name,
  });


  /*
   * IMPORTANT:
   *
   * Only mark the reminder as handled
   * AFTER the email succeeds.
   *
   * If SMTP fails, the worker can retry
   * during the next scheduled run.
   */
  await markReminderHandled(
    pref.user_id,
    today,
  );


  console.log(
    `Reminder sent for ${pref.user_id} to ${email} using ${emailSource} email.`,
  );


  return {
    status:
      'sent',
  };
}


/*
 * ==========================================================
 * RUN REMINDER WORKER
 * ==========================================================
 *
 * This function performs ONE complete
 * reminder scan.
 *
 * It does NOT contain a timer.
 *
 * A real external cron service decides
 * when this function should run.
 */
export async function runReminderWorker() {
  const startedAt =
    new Date()
      .toISOString();


  /*
   * Create an execution summary.
   *
   * This is useful when viewing production
   * cron logs.
   */
  const summary = {
    started_at:
      startedAt,

    finished_at:
      null,

    checked:
      0,

    sent:
      0,

    before_time:
      0,

    already_handled:
      0,

    transaction_exists:
      0,

    no_email:
      0,

    failed:
      0,
  };


  /*
   * Only load enabled reminders.
   */
  const {
    data,
    error,
  } =
    await adminSupabase
      .from(
        'reminder_preferences',
      )
      .select(
        `
          user_id,
          enabled,
          reminder_time,
          timezone,
          last_sent_date
        `,
      )
      .eq(
        'enabled',
        true,
      );


  if (
    error
  ) {
    throw error;
  }


  /*
   * Process users sequentially.
   *
   * This prevents the worker from opening
   * too many SMTP connections at once.
   */
  for (
    const pref of
    data || []
  ) {
    summary.checked +=
      1;


    try {
      const result =
        await processReminderPreference(
          pref,
        );


      /*
       * Increase the corresponding
       * summary counter.
       */
      if (
        Object.hasOwn(
          summary,
          result.status,
        )
      ) {
        summary[
          result.status
        ] += 1;
      }

    } catch (error) {
      summary.failed +=
        1;


      /*
       * One user's failure should not stop
       * reminders for every other user.
       */
      console.error(
        `Reminder failed for ${pref.user_id}:`,
        error,
      );
    }
  }


  summary.finished_at =
    new Date()
      .toISOString();


  return summary;
}