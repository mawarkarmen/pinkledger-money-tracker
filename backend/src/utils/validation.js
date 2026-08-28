import { z } from 'zod';

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80),

  type: z.enum([
    'cash',
    'bank',
    'ewallet',
    'savings',
    'credit_card',
    'other',
  ]),

  opening_balance: z
    .coerce
    .number()
    .finite()
    .default(0),

  opening_date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
    ),

  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .default('IDR'),
});


export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(60),

  type: z.enum([
    'income',
    'expense',
  ]),

  icon: z
    .string()
    .trim()
    .max(40)
    .optional()
    .default(
      'CircleDollarSign',
    ),
});


export const transactionSchema = z
  .object({
    type: z.enum([
      'income',
      'expense',
      'transfer',
    ]),

    date: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
      ),

    description: z
      .string()
      .trim()
      .min(1)
      .max(160),

    amount: z
      .coerce
      .number()
      .positive(),

    category_id: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    source_account_id: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    destination_account_id: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    notes: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),

    is_reimbursable: z
      .boolean()
      .optional()
      .default(false),

    reimbursed_by: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .optional(),
  })
  .superRefine(
    (value, ctx) => {
      if (
        value.type ===
        'income'
      ) {
        if (
          !value.destination_account_id
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Income requires a destination account.',
          });
        }

        if (
          !value.category_id
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Income requires a category.',
          });
        }

        if (
          value.is_reimbursable
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Only expenses can be reimbursable.',
          });
        }
      }


      if (
        value.type ===
        'expense'
      ) {
        if (
          !value.source_account_id
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Expense requires a source account.',
          });
        }

        if (
          !value.category_id
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Expense requires a category.',
          });
        }
      }


      if (
        value.type ===
        'transfer'
      ) {
        if (
          !value.source_account_id ||
          !value.destination_account_id
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Transfer requires source and destination accounts.',
          });
        }

        if (
          value.source_account_id &&
          value.destination_account_id &&
          value.source_account_id ===
            value.destination_account_id
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Transfer accounts must be different.',
          });
        }

        if (
          value.is_reimbursable
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode
                .custom,

            message:
              'Transfers cannot be reimbursable.',
          });
        }
      }
    },
  );


export const reimbursementSchema =
  z.object({
    destination_account_id: z
      .string()
      .uuid(),

    date: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
      ),
  });


export const budgetSchema =
  z.object({
    month: z
      .string()
      .regex(
        /^\d{4}-\d{2}$/,
      ),

    category_id: z
      .string()
      .uuid(),

    amount: z
      .coerce
      .number()
      .positive(),
  });


export const reminderSchema =
  z.object({
    enabled: z.boolean(),

    reminder_time: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):[0-5]\d$/,
      ),

    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(
        (zone) => {
          try {
            new Intl.DateTimeFormat(
              'en-US',
              {
                timeZone: zone,
              },
            ).format();

            return true;
          } catch {
            return false;
          }
        },

        'Invalid IANA timezone.',
      ),
  });


export const accountUpdateSchema =
  accountSchema
    .partial()
    .extend({
      is_active: z
        .boolean()
        .optional(),
    });


export const categoryUpdateSchema =
  categorySchema
    .partial()
    .extend({
      is_active: z
        .boolean()
        .optional(),
    });