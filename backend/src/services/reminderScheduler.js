import cron from 'node-cron';
import { adminSupabase } from '../supabase.js';
import { sendTransactionReminder } from './email.js';
import { localTimeInTimeZone, todayInTimeZone } from '../utils/dates.js';
import { config } from '../config.js';

async function processReminderPreference(pref) {
  const timezone = pref.timezone || 'UTC';
  const today = todayInTimeZone(timezone);
  const localTime = localTimeInTimeZone(timezone);
  const reminderTime = String(pref.reminder_time || '20:00').slice(0, 5);

  if (!pref.enabled || pref.last_sent_date === today || localTime < reminderTime) {
    return;
  }

  const { count, error: transactionError } = await adminSupabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', pref.user_id)
    .eq('date', today);

  if (transactionError) throw transactionError;

  if ((count || 0) > 0) {
    await adminSupabase
      .from('reminder_preferences')
      .update({ last_sent_date: today })
      .eq('user_id', pref.user_id);
    return;
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', pref.user_id)
    .single();

  if (profileError) throw profileError;
  if (!profile?.email) return;

  await sendTransactionReminder({
    email: profile.email,
    name: profile.full_name,
  });

  await adminSupabase
    .from('reminder_preferences')
    .update({ last_sent_date: today })
    .eq('user_id', pref.user_id);
}

export function startReminderScheduler() {
  if (config.disableReminderCron) {
    console.log('Reminder scheduler disabled by DISABLE_REMINDER_CRON.');
    return;
  }

  cron.schedule('*/5 * * * *', async () => {
    try {
      const { data, error } = await adminSupabase
        .from('reminder_preferences')
        .select('user_id, enabled, reminder_time, timezone, last_sent_date')
        .eq('enabled', true);

      if (error) throw error;

      for (const pref of data || []) {
        try {
          await processReminderPreference(pref);
        } catch (error) {
          console.error(`Reminder failed for ${pref.user_id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Reminder scheduler error:', error.message);
    }
  });

  console.log('Daily reminder scheduler started.');
}
