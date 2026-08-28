import { Router } from 'express';

import {
  parseMonth,
} from '../utils/dates.js';

import {
  asNumber,
  transactionTotalEffect,
} from '../utils/money.js';


const router = Router();


router.get(
  '/',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const month =
        req.query.month ||
        new Date()
          .toISOString()
          .slice(0, 7);


      const {
        start,
        next:
          nextMonth,
        end,
      } =
        parseMonth(
          month,
        );


      const today =
        new Date()
          .toISOString()
          .slice(0, 10);


      const currentMonth =
        today.slice(
          0,
          7,
        );


      const balanceThrough =
        month ===
        currentMonth
          ? today
          : end;


      const [
        accountResult,
        transactionResult,
        claimResult,
      ] =
        await Promise.all([

          req.supabase
            .from(
              'accounts',
            )
            .select(`
              opening_balance,
              opening_date
            `),

          req.supabase
            .from(
              'transactions',
            )
            .select(`
              id,
              type,
              date,
              description,
              amount,
              category_id,
              source_account_id,
              destination_account_id,
              created_at,
              is_reimbursable,
              reimbursement_status,
              reimbursed_at,
              reimbursement_claim_id,
              transaction_group_id,
              category:categories(
                name,
                icon
              )
            `)
            .lte(
              'date',
              balanceThrough,
            )
            .order(
              'date',
              {
                ascending:
                  false,
              },
            )
            .order(
              'created_at',
              {
                ascending:
                  false,
              },
            ),

          req.supabase
            .from(
              'reimbursement_claims',
            )
            .select(`
              id,
              transaction_id,
              person_name,
              amount,
              status,
              reimbursed_at
            `),
        ]);


      if (
        accountResult.error
      ) {
        throw accountResult.error;
      }


      if (
        transactionResult.error
      ) {
        throw transactionResult.error;
      }


      if (
        claimResult.error
      ) {
        throw claimResult.error;
      }


      const accounts =
        accountResult.data ||
        [];


      const transactions =
        transactionResult.data ||
        [];


      const claims =
        claimResult.data ||
        [];


      const transactionMap =
        new Map(
          transactions.map(
            (transaction) => [
              transaction.id,
              transaction,
            ],
          ),
        );


      const openingBalanceBase =
        accounts.reduce(
          (
            sum,
            account,
          ) =>
            sum +
            (
              account.opening_date <=
              start
                ? asNumber(
                    account
                      .opening_balance,
                  )
                : 0
            ),

          0,
        );


      const currentBalanceBase =
        accounts.reduce(
          (
            sum,
            account,
          ) =>
            sum +
            (
              account.opening_date <=
              balanceThrough
                ? asNumber(
                    account
                      .opening_balance,
                  )
                : 0
            ),

          0,
        );


      let openingBalance =
        openingBalanceBase;


      let currentBalance =
        currentBalanceBase;


      let totalIncome =
        0;


      let totalExpenses =
        0;


      let outstandingReimbursements =
        0;


      const categorySpend =
        new Map();


      const categorySpendById =
        new Map();


      for (
        const transaction of
        transactions
      ) {
        const effect =
          transactionTotalEffect(
            transaction,
          );


        currentBalance +=
          effect;


        if (
          transaction.date <
          start
        ) {
          openingBalance +=
            effect;
        } else if (
          transaction.date <
          nextMonth
        ) {

          if (
            transaction.type ===
              'income' &&
            !transaction
              .reimbursement_claim_id
          ) {
            totalIncome +=
              asNumber(
                transaction.amount,
              );
          }


          if (
            transaction.type ===
              'expense' &&
            !transaction
              .is_reimbursable
          ) {
            const amount =
              asNumber(
                transaction.amount,
              );


            totalExpenses +=
              amount;


            const name =
              transaction.category
                ?.name ||
              'Uncategorized';


            categorySpend.set(
              name,

              (
                categorySpend.get(
                  name,
                ) || 0
              ) + amount,
            );


            if (
              transaction
                .category_id
            ) {
              categorySpendById.set(
                transaction
                  .category_id,

                (
                  categorySpendById.get(
                    transaction
                      .category_id,
                  ) || 0
                ) + amount,
              );
            }
          }
        }
      }


      /*
       * Outstanding reimbursement is now
       * calculated per person.
       */

      for (
        const claim of
        claims
      ) {
        const original =
          transactionMap.get(
            claim.transaction_id,
          );


        if (!original) {
          continue;
        }


        if (
          original.date >
          balanceThrough
        ) {
          continue;
        }


        if (
          !claim.reimbursed_at ||
          claim.reimbursed_at >
            balanceThrough
        ) {
          outstandingReimbursements +=
            asNumber(
              claim.amount,
            );
        }
      }


      const {
        data:
          budgets,
        error:
          budgetError,
      } =
        await req.supabase
          .from(
            'budgets',
          )
          .select(`
            amount,
            category_id,
            category:categories(
              name
            )
          `)
          .eq(
            'month',
            start,
          );


      if (
        budgetError
      ) {
        throw budgetError;
      }


      const budgetTotal =
        (budgets || [])
          .reduce(
            (
              sum,
              item,
            ) =>
              sum +
              asNumber(
                item.amount,
              ),

            0,
          );


      const budgetSpent =
        (budgets || [])
          .reduce(
            (
              sum,
              item,
            ) =>
              sum +
              (
                categorySpendById.get(
                  item.category_id,
                ) || 0
              ),

            0,
          );


      res.json({
        month,

        balance_label:
          month ===
          currentMonth
            ? 'Current Balance'
            : 'Period Closing Balance',

        opening_balance:
          openingBalance,

        current_balance:
          currentBalance,

        total_income:
          totalIncome,

        total_expenses:
          totalExpenses,

        net_cash_flow:
          totalIncome -
          totalExpenses,

        outstanding_reimbursements:
          outstandingReimbursements,

        budget_status: {
          total:
            budgetTotal,

          spent:
            budgetSpent,

          remaining:
            budgetTotal -
            budgetSpent,

          percentage:
            budgetTotal > 0
              ? (
                  budgetSpent /
                  budgetTotal
                ) * 100
              : 0,
        },

        category_spending:
          Array
            .from(
              categorySpend.entries(),
            )
            .map(
              ([
                name,
                amount,
              ]) => ({
                name,
                amount,
              }),
            )
            .sort(
              (
                a,
                b,
              ) =>
                b.amount -
                a.amount,
            ),

        recent_transactions:
          transactions
            .filter(
              (transaction) =>
                transaction.date >=
                  start &&
                transaction.date <
                  nextMonth,
            )
            .slice(
              0,
              6,
            ),
      });

    } catch (error) {
      next(error);
    }
  },
);


export default router;