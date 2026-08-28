import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import {
  reimbursementSchema,
  splitExpenseSchema,
  transactionSchema,
} from '../utils/validation.js';


const router = Router();


async function createClaims({
  supabase,
  userId,
  transactionId,
  people,
}) {
  if (!people.length) {
    return [];
  }


  const rows =
    people.map(
      (person) => ({
        user_id:
          userId,

        transaction_id:
          transactionId,

        person_name:
          person.person_name
            .trim(),

        amount:
          Number(
            person.amount,
          ),

        status:
          'pending',

        reimbursed_at:
          null,
      }),
    );


  const {
    data,
    error,
  } =
    await supabase
      .from(
        'reimbursement_claims',
      )
      .insert(rows)
      .select('*');


  if (error) {
    throw error;
  }


  return data || [];
}


async function updateExpenseReimbursementStatus({
  supabase,
  transactionId,
}) {
  const {
    data:
      claims,
    error,
  } =
    await supabase
      .from(
        'reimbursement_claims',
      )
      .select(`
        status,
        reimbursed_at
      `)
      .eq(
        'transaction_id',
        transactionId,
      );


  if (error) {
    throw error;
  }


  const allReimbursed =
    claims?.length > 0 &&
    claims.every(
      (claim) =>
        claim.status ===
        'reimbursed',
    );


  const reimbursedDates =
    (claims || [])
      .map(
        (claim) =>
          claim.reimbursed_at,
      )
      .filter(Boolean)
      .sort();


  const {
    error:
      updateError,
  } =
    await supabase
      .from(
        'transactions',
      )
      .update({
        reimbursement_status:
          allReimbursed
            ? 'reimbursed'
            : 'pending',

        reimbursed_at:
          allReimbursed
            ? reimbursedDates[
                reimbursedDates.length -
                  1
              ] || null
            : null,
      })
      .eq(
        'id',
        transactionId,
      );


  if (updateError) {
    throw updateError;
  }
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
            ),
            reimbursements:reimbursement_claims!reimbursement_claims_transaction_id_fkey(
              id,
              person_name,
              amount,
              status,
              reimbursed_at
            )
          `)
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
    let transactionId =
      null;


    try {
      const input =
        transactionSchema
          .parse(
            req.body,
          );


      const {
        reimbursement_people,
        ...transactionInput
      } = input;


      const isReimbursable =
        input.type ===
          'expense' &&
        input.is_reimbursable ===
          true;


      const payload = {
        user_id:
          req.user.id,

        type:
          transactionInput.type,

        date:
          transactionInput.date,

        description:
          transactionInput.description,

        amount:
          transactionInput.amount,

        category_id:
          transactionInput.type ===
            'transfer'
            ? null
            : transactionInput.category_id ||
              null,

        source_account_id:
          transactionInput.type ===
            'income'
            ? null
            : transactionInput.source_account_id ||
              null,

        destination_account_id:
          transactionInput.type ===
            'expense'
            ? null
            : transactionInput.destination_account_id ||
              null,

        notes:
          transactionInput.notes ||
          null,

        is_reimbursable:
          isReimbursable,

        reimbursement_status:
          isReimbursable
            ? 'pending'
            : 'none',

        reimbursed_by:
          null,

        reimbursed_at:
          null,

        reimburses_transaction_id:
          null,

        reimbursement_claim_id:
          null,

        transaction_group_id:
          null,
      };


      const {
        data:
          transaction,
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


      transactionId =
        transaction.id;


      let claims = [];


      if (
        isReimbursable
      ) {
        claims =
          await createClaims({
            supabase:
              req.supabase,

            userId:
              req.user.id,

            transactionId:
              transaction.id,

            people:
              reimbursement_people,
          });
      }


      return res
        .status(201)
        .json({
          ...transaction,

          reimbursements:
            claims,
        });
    } catch (error) {

      if (
        transactionId
      ) {
        await req.supabase
          .from(
            'transactions',
          )
          .delete()
          .eq(
            'id',
            transactionId,
          );
      }


      next(error);
    }
  },
);


router.post(
  '/split',
  async (
    req,
    res,
    next,
  ) => {
    let groupId =
      null;


    try {
      const input =
        splitExpenseSchema
          .parse(
            req.body,
          );


      const reimbursableAmount =
        Number(
          (
            input.total_amount -
            input.personal_amount
          ).toFixed(2),
        );


      groupId =
        randomUUID();


      const rows = [
        {
          user_id:
            req.user.id,

          type:
            'expense',

          date:
            input.date,

          description:
            input.description,

          amount:
            input.personal_amount,

          category_id:
            input.category_id,

          source_account_id:
            input.source_account_id,

          destination_account_id:
            null,

          notes:
            input.notes ||
            null,

          is_reimbursable:
            false,

          reimbursement_status:
            'none',

          reimbursed_by:
            null,

          reimbursed_at:
            null,

          reimburses_transaction_id:
            null,

          reimbursement_claim_id:
            null,

          transaction_group_id:
            groupId,
        },

        {
          user_id:
            req.user.id,

          type:
            'expense',

          date:
            input.date,

          description:
            input.description,

          amount:
            reimbursableAmount,

          category_id:
            input.category_id,

          source_account_id:
            input.source_account_id,

          destination_account_id:
            null,

          notes:
            input.notes ||
            null,

          is_reimbursable:
            true,

          reimbursement_status:
            'pending',

          reimbursed_by:
            null,

          reimbursed_at:
            null,

          reimburses_transaction_id:
            null,

          reimbursement_claim_id:
            null,

          transaction_group_id:
            groupId,
        },
      ];


      const {
        data:
          transactions,
        error,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .insert(rows)
          .select('*');


      if (error) {
        throw error;
      }


      const reimbursableTransaction =
        transactions.find(
          (transaction) =>
            transaction
              .is_reimbursable,
        );


      const claims =
        await createClaims({
          supabase:
            req.supabase,

          userId:
            req.user.id,

          transactionId:
            reimbursableTransaction.id,

          people:
            input
              .reimbursement_people,
        });


      return res
        .status(201)
        .json({
          group_id:
            groupId,

          total_amount:
            input.total_amount,

          personal_amount:
            input.personal_amount,

          reimbursable_amount:
            reimbursableAmount,

          transactions,

          reimbursements:
            claims,
        });
    } catch (error) {

      if (
        groupId
      ) {
        await req.supabase
          .from(
            'transactions',
          )
          .delete()
          .eq(
            'transaction_group_id',
            groupId,
          );
      }


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
        data:
          current,
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
            reimbursement_claim_id,
            transaction_group_id
          `)
          .eq(
            'id',
            req.params.id,
          )
          .maybeSingle();


      if (
        currentError
      ) {
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
          .reimbursement_claim_id
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
          .transaction_group_id
      ) {
        return res
          .status(400)
          .json({
            error:
              'Split expense components cannot be edited individually. Delete the split and create it again.',
          });
      }


      const {
        data:
          currentClaims,
        error:
          claimError,
      } =
        await req.supabase
          .from(
            'reimbursement_claims',
          )
          .select(`
            id,
            status
          `)
          .eq(
            'transaction_id',
            current.id,
          );


      if (claimError) {
        throw claimError;
      }


      if (
        currentClaims?.some(
          (claim) =>
            claim.status ===
            'reimbursed',
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'This expense cannot be edited because one or more people have already reimbursed it.',
          });
      }


      const input =
        transactionSchema
          .parse(
            req.body,
          );


      const {
        reimbursement_people,
        ...transactionInput
      } = input;


      const isReimbursable =
        transactionInput.type ===
          'expense' &&
        transactionInput.is_reimbursable ===
          true;


      const payload = {
        type:
          transactionInput.type,

        date:
          transactionInput.date,

        description:
          transactionInput.description,

        amount:
          transactionInput.amount,

        category_id:
          transactionInput.type ===
            'transfer'
            ? null
            : transactionInput.category_id ||
              null,

        source_account_id:
          transactionInput.type ===
            'income'
            ? null
            : transactionInput.source_account_id ||
              null,

        destination_account_id:
          transactionInput.type ===
            'expense'
            ? null
            : transactionInput.destination_account_id ||
              null,

        notes:
          transactionInput.notes ||
          null,

        is_reimbursable:
          isReimbursable,

        reimbursement_status:
          isReimbursable
            ? 'pending'
            : 'none',

        reimbursed_by:
          null,

        reimbursed_at:
          null,

        reimburses_transaction_id:
          null,

        reimbursement_claim_id:
          null,
      };


      const {
        data:
          updated,
        error:
          updateError,
      } =
        await req.supabase
          .from(
            'transactions',
          )
          .update(payload)
          .eq(
            'id',
            current.id,
          )
          .select('*')
          .single();


      if (
        updateError
      ) {
        throw updateError;
      }


      const {
        error:
          deleteClaimsError,
      } =
        await req.supabase
          .from(
            'reimbursement_claims',
          )
          .delete()
          .eq(
            'transaction_id',
            current.id,
          );


      if (
        deleteClaimsError
      ) {
        throw deleteClaimsError;
      }


      let claims = [];


      if (
        isReimbursable
      ) {
        claims =
          await createClaims({
            supabase:
              req.supabase,

            userId:
              req.user.id,

            transactionId:
              current.id,

            people:
              reimbursement_people,
          });
      }


      return res.json({
        ...updated,

        reimbursements:
          claims,
      });

    } catch (error) {
      next(error);
    }
  },
);


router.post(
  '/:id/reimburse/:claimId',
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
          .parse(
            req.body,
          );


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
            is_reimbursable
          `)
          .eq(
            'id',
            req.params.id,
          )
          .maybeSingle();


      if (
        originalError
      ) {
        throw originalError;
      }


      if (
        !original ||
        original.type !==
          'expense' ||
        !original
          .is_reimbursable
      ) {
        return res
          .status(400)
          .json({
            error:
              'The reimbursable expense was not found.',
          });
      }


      const {
        data:
          claim,
        error:
          claimError,
      } =
        await req.supabase
          .from(
            'reimbursement_claims',
          )
          .select('*')
          .eq(
            'id',
            req.params.claimId,
          )
          .eq(
            'transaction_id',
            original.id,
          )
          .maybeSingle();


      if (
        claimError
      ) {
        throw claimError;
      }


      if (!claim) {
        return res
          .status(404)
          .json({
            error:
              'Reimbursement claim not found.',
          });
      }


      if (
        claim.status ===
        'reimbursed'
      ) {
        return res
          .status(409)
          .json({
            error:
              `${claim.person_name} has already reimbursed this amount.`,
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
          .select(`
            id,
            name
          `)
          .eq(
            'id',
            input
              .destination_account_id,
          )
          .maybeSingle();


      if (
        accountError
      ) {
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
              `Reimbursement from ${claim.person_name}: ${original.description}`,

            amount:
              claim.amount,

            category_id:
              null,

            source_account_id:
              null,

            destination_account_id:
              input
                .destination_account_id,

            notes:
              `Repayment from ${claim.person_name}`,

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

            reimbursement_claim_id:
              claim.id,

            transaction_group_id:
              null,
          })
          .select('*')
          .single();


      if (
        receiptError
      ) {
        throw receiptError;
      }


      receiptId =
        receipt.id;


      const {
        error:
          claimUpdateError,
      } =
        await req.supabase
          .from(
            'reimbursement_claims',
          )
          .update({
            status:
              'reimbursed',

            reimbursed_at:
              input.date,
          })
          .eq(
            'id',
            claim.id,
          );


      if (
        claimUpdateError
      ) {
        await req.supabase
          .from(
            'transactions',
          )
          .delete()
          .eq(
            'id',
            receiptId,
          );


        throw claimUpdateError;
      }


      await updateExpenseReimbursementStatus({
        supabase:
          req.supabase,

        transactionId:
          original.id,
      });


      return res.json({
        ok: true,

        person:
          claim.person_name,

        amount:
          claim.amount,

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