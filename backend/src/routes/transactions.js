import { Router } from 'express';

import {
  reimbursementSchema,
  splitExpenseSchema,
  transactionSchema,
} from '../utils/validation.js';


const router = Router();


/*
 * Convert expected database validation errors into useful HTTP responses.
 * Unexpected database errors remain 500 errors and are handled by the
 * application's central error handler.
 */
function throwRpcError(error) {
  const message =
    error?.message ||
    'Database operation failed.';


  const httpError =
    new Error(message);


  if (
    message ===
      'Transaction not found.' ||
    message ===
      'Reimbursement claim not found.'
  ) {
    httpError.status = 404;

    throw httpError;
  }


  if (
    message.includes(
      'already reimbursed',
    ) ||
    message.includes(
      'already been paid',
    )
  ) {
    httpError.status = 409;

    throw httpError;
  }


  const validationMessages = [
    'Authentication required.',
    'Invalid transaction type.',
    'Transaction amount must be greater than zero.',
    'Only expenses can be reimbursable.',
    'Reimbursement people are only allowed for reimbursable expenses.',
    'Reimbursement people must be an array.',
    'Add at least one person who will reimburse this expense.',
    'A maximum of 20 reimbursement people is allowed.',
    'Each reimbursement person must have a valid name.',
    'Each reimbursement amount must be greater than zero.',
    'The reimbursement amounts must equal the reimbursable portion.',
    'Total amount must be greater than zero.',
    'Personal amount must be greater than zero.',
    'Your portion must be smaller than the total payment.',
    'Unable to create the reimbursable split transaction.',
    'Reimbursement receipts cannot be edited directly.',
    'Split expense components cannot be edited individually. Delete the split and create it again.',
    'This expense cannot be edited because one or more people have already reimbursed it.',
    'The reimbursable expense was not found.',
    'Reimbursement date cannot be earlier than the expense date.',
    'Destination account was not found.',
    'Category does not belong to the user.',
    'Source account does not belong to the user.',
    'Destination account does not belong to the user.',
    'Budget category must be an expense category owned by the user.',
    'Reimbursement claim must belong to a reimbursable expense.',
    'Total reimbursement claims exceed the reimbursable expense amount.',
    'A reimbursement receipt must be an income-side account movement.',
    'Reimbursement receipt does not match its original expense.',
    'Reimbursement receipt amount must match the reimbursement claim amount.',
    'Reimbursement receipt must reference a reimbursement claim.',
    'Transaction date cannot be earlier than source account opening date.',
    'Transaction date cannot be earlier than destination account opening date.',
    'Source account is archived.',
    'Destination account is archived.',
    'Transactions belonging to an archived source account cannot be deleted.',
    'Transactions belonging to an archived destination account cannot be deleted.',
  ];


  if (
    validationMessages.some(
      (knownMessage) =>
        message.includes(
          knownMessage,
        ),
    )
  ) {
    httpError.status =
      message ===
        'Authentication required.'
        ? 401
        : 400;

    throw httpError;
  }


  throw error;
}


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


      /*
       * Pagination is opt-in so the existing frontend remains
       * backward compatible.
       *
       * Examples:
       *
       * /api/transactions?page=1&page_size=50
       * /api/transactions?month=2026-08&page=2&page_size=25
       *
       * Response body remains an ARRAY.
       * Pagination metadata is returned in response headers.
       */
      const paginationRequested =
        req.query.page !== undefined ||
        req.query.page_size !== undefined;


      const parsedPage =
        Number.parseInt(
          String(
            req.query.page || '1',
          ),
          10,
        );


      const parsedPageSize =
        Number.parseInt(
          String(
            req.query.page_size || '50',
          ),
          10,
        );


      const page =
        Number.isFinite(parsedPage) &&
        parsedPage > 0
          ? parsedPage
          : 1;


      const pageSize =
        Number.isFinite(parsedPageSize) &&
        parsedPageSize > 0
          ? Math.min(
              parsedPageSize,
              100,
            )
          : 50;


      let query =
        req.supabase
          .from(
            'transactions',
          )
          .select(
            `
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
              ),

              reimbursements:reimbursement_claims!reimbursement_claims_transaction_id_fkey(
                id,
                person_name,
                amount,
                status,
                reimbursed_at
              )
            `,
            paginationRequested
              ? {
                  count: 'exact',
                }
              : undefined,
          )
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
            .slice(
              0,
              10,
            );


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


      if (
        type ===
        'reimbursement'
      ) {
        query =
          query.not(
            'reimbursement_claim_id',
            'is',
            null,
          );

      } else if (
        type ===
        'income'
      ) {
        query =
          query
            .eq(
              'type',
              'income',
            )
            .is(
              'reimbursement_claim_id',
              null,
            );

      } else if (
        type
      ) {
        query =
          query.eq(
            'type',
            type,
          );
      }


      if (
        category
      ) {
        query =
          query.eq(
            'category_id',
            category,
          );
      }


      if (
        account
      ) {
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


      if (
        paginationRequested
      ) {
        const from =
          (page - 1) *
          pageSize;


        const to =
          from +
          pageSize -
          1;


        query =
          query.range(
            from,
            to,
          );
      }


      const {
        data,
        error,
        count,
      } =
        await query;


      if (error) {
        throw error;
      }


      if (
        paginationRequested
      ) {
        const total =
          count || 0;


        const totalPages =
          total > 0
            ? Math.ceil(
                total /
                pageSize,
              )
            : 0;


        res.set({
          'X-Page':
            String(page),

          'X-Page-Size':
            String(pageSize),

          'X-Total-Count':
            String(total),

          'X-Total-Pages':
            String(totalPages),
        });
      }


      return res.json(
        data || [],
      );

    } catch (error) {
      next(error);
    }
  },
);


/*
 * ==========================================================
 * CREATE TRANSACTION
 * ==========================================================
 *
 * The transaction row and all reimbursement claims are now
 * created inside one PostgreSQL RPC transaction.
 */
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
          .parse(
            req.body,
          );


      const {
        data,
        error,
      } =
        await req.supabase
          .rpc(
            'create_transaction_atomic',
            {
              p_payload:
                input,
            },
          );


      if (error) {
        throwRpcError(
          error,
        );
      }


      return res
        .status(201)
        .json(data);
    } catch (error) {
      next(error);
    }
  },
);


/*
 * ==========================================================
 * CREATE SPLIT EXPENSE
 * ==========================================================
 *
 * Both expense rows and all reimbursement claims are created
 * inside one PostgreSQL transaction.
 */
router.post(
  '/split',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const input =
        splitExpenseSchema
          .parse(
            req.body,
          );


      const {
        data,
        error,
      } =
        await req.supabase
          .rpc(
            'create_split_expense_atomic',
            {
              p_payload:
                input,
            },
          );


      if (error) {
        throwRpcError(
          error,
        );
      }


      return res
        .status(201)
        .json(data);
    } catch (error) {
      next(error);
    }
  },
);


/*
 * ==========================================================
 * UPDATE TRANSACTION
 * ==========================================================
 *
 * Updating the transaction, deleting old pending claims,
 * and creating replacement claims now happen atomically.
 */
router.put(
  '/:id',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const input =
        transactionSchema
          .parse(
            req.body,
          );


      const {
        data,
        error,
      } =
        await req.supabase
          .rpc(
            'update_transaction_atomic',
            {
              p_transaction_id:
                req.params.id,

              p_payload:
                input,
            },
          );


      if (error) {
        throwRpcError(
          error,
        );
      }


      return res.json(
        data,
      );
    } catch (error) {
      next(error);
    }
  },
);


/*
 * ==========================================================
 * RECORD REIMBURSEMENT
 * ==========================================================
 *
 * These three writes are now one database transaction:
 *
 * 1. Create reimbursement receipt transaction.
 * 2. Mark the claim reimbursed.
 * 3. Recalculate the parent expense reimbursement status.
 *
 * The database also locks the parent expense and claim so two
 * concurrent requests cannot reimburse the same claim twice.
 */
router.post(
  '/:id/reimburse/:claimId',
  async (
    req,
    res,
    next,
  ) => {
    try {
      const input =
        reimbursementSchema
          .parse(
            req.body,
          );


      const {
        data,
        error,
      } =
        await req.supabase
          .rpc(
            'reimburse_claim_atomic',
            {
              p_transaction_id:
                req.params.id,

              p_claim_id:
                req.params.claimId,

              p_payload:
                input,
            },
          );


      if (error) {
        throwRpcError(
          error,
        );
      }


      return res.json(
        data,
      );
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
            reimbursement_claim_id,
            transaction_group_id
          `)
          .eq(
            'id',
            req.params.id,
          )
          .maybeSingle();


      if (
        readError
      ) {
        throw readError;
      }


      if (
        !transaction
      ) {
        return res
          .status(404)
          .json({
            error:
              'Transaction not found.',
          });
      }


      if (
        transaction
          .reimbursement_claim_id
      ) {
        return res
          .status(400)
          .json({
            error:
              'A reimbursement receipt cannot be deleted directly. Delete its original expense instead.',
          });
      }


      /*
       * A single SQL DELETE statement removes all components
       * of a split expense. A single statement is already
       * atomic in PostgreSQL.
       */
      if (
        transaction
          .transaction_group_id
      ) {
        const {
          error,
        } =
          await req.supabase
            .from(
              'transactions',
            )
            .delete()
            .eq(
              'transaction_group_id',
              transaction
                .transaction_group_id,
            );


        if (error) {
          throw error;
        }


        return res
          .status(204)
          .end();
      }


      /*
       * Deleting an original reimbursable expense is also one
       * SQL statement. Existing foreign keys cascade to its
       * reimbursement claims and reimbursement receipt rows.
       */
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
            transaction.id,
          );


      if (error) {
        throw error;
      }


      return res
        .status(204)
        .end();

    } catch (error) {
      next(error);
    }
  },
);


export default router;
