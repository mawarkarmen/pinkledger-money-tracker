import {
  Router,
} from 'express';


import {
  reminderSchema,
} from '../utils/validation.js';


import {
  sendTransactionReminder,
} from '../services/email.js';


import {
  resolveReminderRecipient,
} from '../services/reminderRecipient.js';


const router =
  Router();


/*
 * ==========================================================
 * GET REMINDER PREFERENCES
 * ==========================================================
 *
 * GET /api/reminders
 */
router.get(
  '/',

  async (
    req,
    res,
    next,
  ) => {
    try {
      const {
        data,
        error,
      } =
        await req.supabase
          .from(
            'reminder_preferences',
          )
          .select(
            'enabled, reminder_time, timezone, last_sent_date',
          )
          .eq(
            'user_id',
            req.user.id,
          )
          .maybeSingle();


      if (error) {
        throw error;
      }


      /*
       * Return defaults if the reminder
       * preference row does not exist.
       */
      res.json(
        data || {
          enabled: false,

          reminder_time:
            '20:00:00',

          timezone:
            'UTC',

          last_sent_date:
            null,
        },
      );

    } catch (error) {
      next(error);
    }
  },
);


/*
 * ==========================================================
 * UPDATE REMINDER PREFERENCES
 * ==========================================================
 *
 * PUT /api/reminders
 */
router.put(
  '/',

  async (
    req,
    res,
    next,
  ) => {
    try {
      const input =
        reminderSchema.parse(
          req.body,
        );


      const {
        data,
        error,
      } =
        await req.supabase
          .from(
            'reminder_preferences',
          )
          .upsert({
            user_id:
              req.user.id,

            enabled:
              input.enabled,

            reminder_time:
              input.reminder_time,

            timezone:
              input.timezone,
          })
          .select('*')
          .single();


      if (error) {
        throw error;
      }


      res.json(data);

    } catch (error) {
      next(error);
    }
  },
);


/*
 * ==========================================================
 * TEST REMINDER EMAIL
 * ==========================================================
 *
 * POST /api/reminders/test
 *
 * This endpoint now uses exactly the
 * same recipient resolver used by the
 * automatic reminder scheduler.
 */
router.post(
  '/test',

  async (
    req,
    res,
    next,
  ) => {
    try {
      /*
       * Resolve recipient.
       *
       * Priority:
       *
       * 1. profiles.email
       * 2. Supabase Auth user email
       *
       * req.user is passed because the
       * authenticated route already has
       * the Auth user available.
       */
      const {
        email,
        name,
        emailSource,
      } =
        await resolveReminderRecipient({
          userId:
            req.user.id,

          profileClient:
            req.supabase,

          authUser:
            req.user,
        });


      if (!email) {
        return res
          .status(400)
          .json({
            error:
              'No email address is available for this account.',
          });
      }


      /*
       * Send exactly the same reminder
       * email used by the scheduler.
       */
      await sendTransactionReminder({
        email,
        name,
      });


      return res.json({
        ok:
          true,

        sent_to:
          email,

        /*
         * Helpful while debugging.
         *
         * Possible values:
         *
         * profile
         * auth
         */
        email_source:
          emailSource,
      });

    } catch (error) {
      next(error);
    }
  },
);


export default router;