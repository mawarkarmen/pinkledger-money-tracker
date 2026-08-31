import { Router } from 'express';

import {
  normalizeTimeZone,
  parseMonth,
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


      const currentMonth =
        today.slice(
          0,
          7,
        );


      const month =
        req.query.month ||
        currentMonth;


      const {
        end,
      } =
        parseMonth(month);


      /*
       * Current month is calculated only through the user's
       * local current date.
       *
       * Historical months use their last calendar day.
       */
      const balanceThrough =
        month === currentMonth
          ? today
          : end;


      /*
       * All major balance, cash-flow, reimbursement, category,
       * budget, and recent-transaction aggregation now happens
       * in PostgreSQL.
       *
       * This avoids loading the user's complete history into
       * the Express process for every Dashboard request.
       */
      const {
        data,
        error,
      } =
        await req.supabase
          .rpc(
            'get_dashboard_summary',
            {
              p_month:
                month,

              p_balance_through:
                balanceThrough,
            },
          );


      if (error) {
        throw error;
      }


      const dashboard =
        data || {};


      return res.json({
        ...dashboard,

        /*
         * Keep this label in Node because it depends on the
         * request-time local timezone decision above.
         */
        balance_label:
          month === currentMonth
            ? 'Current Balance'
            : 'Period Closing Balance',
      });

    } catch (error) {
      next(error);
    }
  },
);


export default router;
