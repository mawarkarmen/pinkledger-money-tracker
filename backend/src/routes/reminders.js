import { Router } from 'express';

import {
  reminderSchema,
} from '../utils/validation.js';

import {
  sendTransactionReminder,
} from '../services/email.js';

const router = Router();

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

      res.json(
        data || {
          enabled: false,
          reminder_time:
            '20:00:00',
          timezone: 'UTC',
          last_sent_date: null,
        },
      );
    } catch (error) {
      next(error);
    }
  },
);

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

router.post(
  '/test',
  async (
    req,
    res,
    next,
  ) => {
    try {
      /*
       * Use maybeSingle here so test-email
       * does not fail solely because the
       * profile row is absent.
       */
      const {
        data: profile,
        error,
      } =
        await req.supabase
          .from('profiles')
          .select(
            'email, full_name',
          )
          .eq(
            'id',
            req.user.id,
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      /*
       * Prefer the profile email, but
       * fall back to the authenticated
       * Supabase user's email.
       */
      const email =
        profile?.email ||
        req.user?.email;

      const name =
        profile?.full_name ||
        req.user?.user_metadata
          ?.full_name ||
        'there';

      if (!email) {
        return res
          .status(400)
          .json({
            error:
              'No email address is available for this account.',
          });
      }

      await sendTransactionReminder({
        email,
        name,
      });

      return res.json({
        ok: true,
        sent_to: email,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;