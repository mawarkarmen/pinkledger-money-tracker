import { Router } from 'express';

import {
  reimbursementSchema,
  transactionSchema,
} from '../utils/validation.js';

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
        month,
        type,
        category,
        account,
        q,
      } = req.query;

      let query =
        req.supabase
          .from(
            'transactions',
          )
          .select(`
            *,
            category:categories(
              id,
              name,
              type,
              icon
            ),
            source_account:accounts!transactions_source_account_id_fkey(
              id,
              name
            ),
            destination_account:accounts!transactions_destination_account_id_fkey(
              id,
              name
            )
          `)
          .order(
            'date',
            {
              ascending: false,
            },
          )
          .order(
            'created_at',
            {
              ascending: false,
            },
          );


      if (
        month &&
        /^\d{4}-\d{2}$/.test(
          month,
        )
      ) {
        const [
          year,
          monthNumber,
        ] =
          month
            .split('-')
            .map(Number);

        const start =
          `${month}-01`;

        const next =
          new Date(
            Date.UTC(
              year,
              monthNumber,
              1,
            ),
          )
            .toISOString()
            .slice(0, 10);

        query =
          query
            .gte(
              'date',
              start,
            )
            .lt(
              'date',
              next,
            );
      }


      /*
       * Reimbursement receipts are stored
       * internally as income-side account
       * movements, but they are not normal
       * income.
       */
      if (
        type ===
        'reimbursement'
      ) {
        query =
          query.not(
            'reimburses_transaction_id',
            'is',
            null,
          );
      } else if (
        type === 'income'
      ) {
        query =
          query
            .eq(
              'type',
              'income',
            )
            .is(
              'reimburses_transaction_id',
              null,
            );
      } else if (type) {
        query =
          query.eq(
            'type',
            type,
          );
      }


      if (category) {
        query =
          query.eq(
            'category_id',
            category,
          );
      }


      if (account) {
        query =
          query.or(
            `source_account_id.eq.${account},destination_account_id.eq.${account}`,
          );
      }


      if (q) {
        query =
          query.ilike(
            'description',
            `%${String(q).slice(
              0,
              80,
            )}%`,
          );
      }


      const {
        data,
        error,
      } = await query;

      if (error) {
        throw error;
      }

      res.json(
        data || [],
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
        transactionSchema
          .parse(req.body);

      const isReimbursable =
        input.type ===
          'expense' &&
        input.is_reimbursable ===
          true;

      const payload = {
        ...input,

        user_id:
          req.user.id,

        category_id:
          input.type ===
          'transfer'
            ? null
            : input.category_id ||
              null,

        source_account_id:
          input.type ===
          'income'
            ? null
            : input.source_account_id ||
              null,

        destination_account_id:
          input.type ===
          'expense'
            ? null
            : input.destination_account_id ||
              null,

        is_reimbursable:
          isReimbursable,

        reimbursement_status:
          isReimbursable
            ? 'pending'
            : 'none',

        reimbursed_by:
          isReimbursable
            ? input.reimbursed_by ||
              null
            : null,

        reimbursed_at:
          null,

        reimburses_transaction_id:
          null,
      };


      const {
        data,
        error,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .insert(payload)
          .select('*')
          .single();

      if (error) {
        throw error;
      }

      res
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
      const {
        data: current,
        error:
          currentError,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .select(`
            id,
            type,
            reimbursement_status,
            reimburses_transaction_id
          `)
          .eq(
            'id',
            req.params.id,
          )
          .maybeSingle();

      if (currentError) {
        throw currentError;
      }

      if (!current) {
        return res
          .status(404)
          .json({
            error:
              'Transaction not found.',
          });
      }


      if (
        current
          .reimburses_transaction_id
      ) {
        return res
          .status(400)
          .json({
            error:
              'Reimbursement receipts cannot be edited directly.',
          });
      }


      if (
        current
          .reimbursement_status ===
        'reimbursed'
      ) {
        return res
          .status(400)
          .json({
            error:
              'A reimbursed expense is locked because it already has a repayment record. Delete and recreate it if a correction is required.',
          });
      }


      const input =
        transactionSchema
          .parse(req.body);

      const isReimbursable =
        input.type ===
          'expense' &&
        input.is_reimbursable ===
          true;

      const payload = {
        ...input,

        category_id:
          input.type ===
          'transfer'
            ? null
            : input.category_id ||
              null,

        source_account_id:
          input.type ===
          'income'
            ? null
            : input.source_account_id ||
              null,

        destination_account_id:
          input.type ===
          'expense'
            ? null
            : input.destination_account_id ||
              null,

        is_reimbursable:
          isReimbursable,

        reimbursement_status:
          isReimbursable
            ? 'pending'
            : 'none',

        reimbursed_by:
          isReimbursable
            ? input.reimbursed_by ||
              null
            : null,

        reimbursed_at:
          null,

        reimburses_transaction_id:
          null,
      };


      const {
        data,
        error,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .update(payload)
          .eq(
            'id',
            req.params.id,
          )
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
 * Record repayment of a reimbursable
 * expense.
 */
router.post(
  '/:id/reimburse',
  async (
    req,
    res,
    next,
  ) => {
    let receiptId =
      null;

    try {
      const input =
        reimbursementSchema
          .parse(req.body);


      const {
        data:
          original,
        error:
          originalError,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .select(`
            id,
            type,
            date,
            description,
            amount,
            source_account_id,
            is_reimbursable,
            reimbursement_status,
            reimbursed_by
          `)
          .eq(
            'id',
            req.params.id,
          )
          .maybeSingle();

      if (originalError) {
        throw originalError;
      }


      if (!original) {
        return res
          .status(404)
          .json({
            error:
              'Transaction not found.',
          });
      }


      if (
        original.type !==
          'expense' ||
        !original.is_reimbursable
      ) {
        return res
          .status(400)
          .json({
            error:
              'Only reimbursable expenses can be marked as reimbursed.',
          });
      }


      if (
        original
          .reimbursement_status ===
        'reimbursed'
      ) {
        return res
          .status(409)
          .json({
            error:
              'This expense has already been reimbursed.',
          });
      }


      if (
        input.date <
        original.date
      ) {
        return res
          .status(400)
          .json({
            error:
              'Reimbursement date cannot be earlier than the expense date.',
          });
      }


      const {
        data:
          destinationAccount,
        error:
          accountError,
      } =
        await req.supabase
          .from(
            'accounts',
          )
          .select(
            'id,name',
          )
          .eq(
            'id',
            input
              .destination_account_id,
          )
          .maybeSingle();

      if (accountError) {
        throw accountError;
      }


      if (
        !destinationAccount
      ) {
        return res
          .status(400)
          .json({
            error:
              'Destination account was not found.',
          });
      }


      /*
       * This row increases the physical
       * account balance, but dashboard
       * logic excludes it from income.
       */
      const {
        data:
          receipt,
        error:
          receiptError,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .insert({
            user_id:
              req.user.id,

            type:
              'income',

            date:
              input.date,

            description:
              `Reimbursement: ${original.description}`,

            amount:
              original.amount,

            category_id:
              null,

            source_account_id:
              null,

            destination_account_id:
              input
                .destination_account_id,

            notes:
              original
                .reimbursed_by
                ? `Repaid by ${original.reimbursed_by}`
                : 'Repayment of reimbursable expense',

            is_reimbursable:
              false,

            reimbursement_status:
              'none',

            reimbursed_by:
              null,

            reimbursed_at:
              null,

            reimburses_transaction_id:
              original.id,
          })
          .select('*')
          .single();

      if (receiptError) {
        throw receiptError;
      }

      receiptId =
        receipt.id;


      const {
        data:
          updatedExpense,
        error:
          updateError,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .update({
            reimbursement_status:
              'reimbursed',

            reimbursed_at:
              input.date,
          })
          .eq(
            'id',
            original.id,
          )
          .select('*')
          .single();

      if (updateError) {
        /*
         * Best-effort cleanup so a failed
         * second step does not leave an
         * orphan reimbursement receipt.
         */
        await req.supabase
          .from(
            'transactions',
          )
          .delete()
          .eq(
            'id',
            receiptId,
          );

        throw updateError;
      }


      return res.json({
        ok: true,

        expense:
          updatedExpense,

        reimbursement:
          receipt,
      });
    } catch (error) {
      next(error);
    }
  },
);


router.delete(
  '/:id',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const {
        data:
          transaction,
        error:
          readError,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .select(`
            id,
            reimburses_transaction_id
          `)
          .eq(
            'id',
            req.params.id,
          )
          .maybeSingle();

      if (readError) {
        throw readError;
      }


      if (!transaction) {
        return res
          .status(404)
          .json({
            error:
              'Transaction not found.',
          });
      }


      if (
        transaction
          .reimburses_transaction_id
      ) {
        return res
          .status(400)
          .json({
            error:
              'A reimbursement receipt cannot be deleted directly. Delete the original reimbursable expense instead.',
          });
      }


      const {
        error,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .delete()
          .eq(
            'id',
            req.params.id,
          );

      if (error) {
        throw error;
      }

      res
        .status(204)
        .end();
    } catch (error) {
      next(error);
    }
  },
);


export default router;