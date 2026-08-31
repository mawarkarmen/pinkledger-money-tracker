import {
  runReminderWorker,
} from '../services/reminderWorker.js';


/*
 * ==========================================================
 * STANDALONE REMINDER JOB
 * ==========================================================
 *
 * This script:
 *
 * 1. Starts
 * 2. Processes reminders once
 * 3. Prints a summary
 * 4. Exits
 *
 * It does NOT start Express.
 *
 * It does NOT stay running.
 *
 * It is designed specifically for an
 * external cron service.
 */
async function main() {
  try {
    console.log(
      'Starting PinkLedger reminder worker...',
    );


    const summary =
      await runReminderWorker();


    console.log(
      'PinkLedger reminder worker completed:',
      summary,
    );


    /*
     * Exit successfully.
     */
    process.exitCode =
      0;

  } catch (error) {
    console.error(
      'PinkLedger reminder worker failed:',
      error,
    );


    /*
     * Non-zero exit code tells the cron
     * provider that this run failed.
     */
    process.exitCode =
      1;
  }
}


await main();