import { Router } from 'express';

import {
  accountSchema,
  accountUpdateSchema,
} from '../utils/validation.js';

import {
  normalizeTimeZone,
  todayInTimeZone,
} from '../utils/dates.js';


const router = Router();


router.get(
  '/',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const timeZone =
        normalizeTimeZone(
          req.get('x-timezone'),
          'UTC',
        );


      const today =
        todayInTimeZone(
          timeZone,
        );


      /*
       * Balance calculation now happens
       * entirely inside PostgreSQL.
       *
       * The backend no longer downloads
       * the complete transaction history
       * and reduces it once per account.
       */
      const {
        data,
        error,
      } =
        await req.supabase
          .rpc(
            'get_accounts_with_balances',
            {
              p_through_date:
                today,
            },
          );


      if (error) {
        throw error;
      }


      return res.json(
        Array.isArray(data)
          ? data
          : [],
      );

    } catch (error) {
      next(error);
    }
  },
);


router.post(
  '/',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const input =
        accountSchema.parse(
          req.body,
        );


      const {
        data,
        error,
      } =
        await req.supabase
          .from('accounts')
          .insert({
            ...input,

            user_id:
              req.user.id,
          })
          .select('*')
          .single();


      if (error) {
        throw error;
      }


      return res
        .status(201)
        .json(data);

    } catch (error) {
      next(error);
    }
  },
);


router.put(
  '/:id',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const payload =
        accountUpdateSchema.parse(
          req.body,
        );


      const {
        data,
        error,
      } =
        await req.supabase
          .from('accounts')
          .update(payload)
          .eq(
            'id',
            req.params.id,
          )
          .select('*')
          .maybeSingle();


      if (error) {
        throw error;
      }


      if (!data) {
        return res
          .status(404)
          .json({
            error:
              'Account not found.',
          });
      }


      return res.json(data);

    } catch (error) {
      next(error);
    }
  },
);


export default router;