import { Router } from 'express';

import {
  budgetSchema,
} from '../utils/validation.js';

import {
  parseMonth,
} from '../utils/dates.js';

import {
  asNumber,
} from '../utils/money.js';


const router =
  Router();


/*
 * ==========================================================
 * GET BUDGETS
 * ==========================================================
 *
 * GET /api/budgets?month=2026-08
 *
 * Returns each category budget together with:
 *
 * - budget amount
 * - personal spending
 * - remaining budget
 * - usage percentage
 *
 *
 * IMPORTANT ACCOUNTING RULE:
 *
 * Budget usage represents only the user's own expense.
 *
 * Therefore:
 *
 * Personal expense
 *      -> counted
 *
 * Fully reimbursable expense
 *      -> NOT counted
 *
 * Reimbursable part of split expense
 *      -> NOT counted
 *
 * Personal part of split expense
 *      -> counted
 *
 * Reimbursement receipt
 *      -> NOT counted
 *
 * Transfer
 *      -> NOT counted
 */
router.get(
  '/',

  async (
    req,
    res,
    next,
  ) => {
    try {

      /*
       * Use requested month.
       *
       * If no month is supplied,
       * use the server's current month.
       */
      const month =
        req.query.month ||
        new Date()
          .toISOString()
          .slice(
            0,
            7,
          );


      /*
       * Example:
       *
       * month:
       * 2026-08
       *
       * start:
       * 2026-08-01
       *
       * nextMonth:
       * 2026-09-01
       */
      const {
        start,
        next: nextMonth,
      } =
        parseMonth(
          month,
        );


      /*
       * ======================================================
       * LOAD MONTHLY BUDGETS
       * ======================================================
       */
      const {
        data: budgets,
        error: budgetError,
      } =
        await req.supabase

          .from(
            'budgets',
          )

          .select(`
            *,

            category:categories(
              id,
              name,
              icon,
              type
            )
          `)

          .eq(
            'user_id',
            req.user.id,
          )

          .eq(
            'month',
            start,
          )

          .order(
            'created_at',
            {
              ascending:
                true,
            },
          );


      if (
        budgetError
      ) {
        throw budgetError;
      }


      /*
       * ======================================================
       * LOAD EXPENSES FOR SELECTED MONTH
       * ======================================================
       *
       * We retrieve:
       *
       * amount
       * category_id
       * is_reimbursable
       *
       * is_reimbursable is required so that
       * someone else's portion does not reduce
       * the user's personal budget.
       */
      const {
        data: expenses,
        error: expenseError,
      } =
        await req.supabase

          .from(
            'transactions',
          )

          .select(`
            amount,
            category_id,
            is_reimbursable
          `)

          .eq(
            'user_id',
            req.user.id,
          )

          .eq(
            'type',
            'expense',
          )

          .gte(
            'date',
            start,
          )

          .lt(
            'date',
            nextMonth,
          );


      if (
        expenseError
      ) {
        throw expenseError;
      }


      /*
       * ======================================================
       * CALCULATE PERSONAL SPENDING BY CATEGORY
       * ======================================================
       */
      const spentByCategory =
        new Map();


      for (
        const transaction of
        expenses || []
      ) {

        /*
         * ----------------------------------------------------
         * CRITICAL RULE
         * ----------------------------------------------------
         *
         * Reimbursable money belongs to someone else's
         * responsibility.
         *
         * Even if a category was selected, it must NOT
         * consume the user's personal monthly budget.
         */
        if (
          transaction
            .is_reimbursable ===
          true
        ) {
          continue;
        }


        /*
         * Expense transactions should normally
         * have a category.
         *
         * Ignore malformed records safely.
         */
        if (
          !transaction
            .category_id
        ) {
          continue;
        }


        const amount =
          asNumber(
            transaction.amount,
          );


        const currentSpent =
          spentByCategory.get(
            transaction.category_id,
          ) ||
          0;


        spentByCategory.set(
          transaction.category_id,

          currentSpent +
            amount,
        );
      }


      /*
       * ======================================================
       * BUILD BUDGET RESPONSE
       * ======================================================
       */
      const result =
        (budgets || [])
          .map(
            (
              budget,
            ) => {

              const amount =
                asNumber(
                  budget.amount,
                );


              /*
               * spent contains only PERSONAL
               * expenses.
               *
               * Reimbursable expenses have already
               * been excluded above.
               */
              const spent =
                spentByCategory.get(
                  budget.category_id,
                ) ||
                0;


              const remaining =
                amount -
                spent;


              const percentage =
                amount > 0

                  ? (
                      spent /
                      amount
                    ) * 100

                  : 0;


              return {
                ...budget,

                /*
                 * Personal spending only.
                 */
                spent,


                remaining,


                percentage,
              };
            },
          );


      return res.json(
        result,
      );

    } catch (
      error
    ) {

      next(
        error,
      );

    }
  },
);


/*
 * ==========================================================
 * CREATE / UPDATE BUDGET
 * ==========================================================
 *
 * POST /api/budgets
 *
 * Example:
 *
 * {
 *   "month": "2026-08",
 *   "category_id": "uuid",
 *   "amount": 2000000
 * }
 *
 *
 * One category can have only one budget
 * for a particular month.
 *
 * Saving the same category again updates
 * the existing budget.
 */
router.post(
  '/',

  async (
    req,
    res,
    next,
  ) => {
    try {

      /*
       * Validate:
       *
       * - month
       * - category UUID
       * - amount
       */
      const input =
        budgetSchema.parse(
          req.body,
        );


      /*
       * Database stores budget month
       * as the first day of the month.
       *
       * Example:
       *
       * 2026-08
       *
       * becomes:
       *
       * 2026-08-01
       */
      const monthDate =
        `${input.month}-01`;


      /*
       * Upsert means:
       *
       * create if no budget exists
       *
       * OR
       *
       * update if the same:
       *
       * user_id
       * + month
       * + category_id
       *
       * already exists.
       */
      const {
        data,
        error,
      } =
        await req.supabase

          .from(
            'budgets',
          )

          .upsert(
            {
              user_id:
                req.user.id,

              month:
                monthDate,

              category_id:
                input.category_id,

              amount:
                input.amount,
            },

            {
              onConflict:
                'user_id,month,category_id',
            },
          )

          .select(`
            *,

            category:categories(
              id,
              name,
              icon,
              type
            )
          `)

          .single();


      if (
        error
      ) {
        throw error;
      }


      return res
        .status(
          201,
        )
        .json(
          data,
        );

    } catch (
      error
    ) {

      next(
        error,
      );

    }
  },
);


/*
 * ==========================================================
 * DELETE BUDGET
 * ==========================================================
 *
 * DELETE /api/budgets/:id
 *
 * This deletes only the budget.
 *
 * It does NOT delete:
 *
 * - category
 * - expense
 * - transaction
 * - reimbursement
 */
router.delete(
  '/:id',

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
            'budgets',
          )

          .delete()

          .eq(
            'id',
            req.params.id,
          )

          .eq(
            'user_id',
            req.user.id,
          )

          .select(
            'id',
          )

          .maybeSingle();


      if (
        error
      ) {
        throw error;
      }


      /*
       * Budget either:
       *
       * - does not exist
       *
       * OR
       *
       * - belongs to another user.
       */
      if (
        !data
      ) {

        return res
          .status(
            404,
          )
          .json({
            error:
              'Budget not found.',
          });

      }


      return res
        .status(
          204,
        )
        .end();

    } catch (
      error
    ) {

      next(
        error,
      );

    }
  },
);


export default router;