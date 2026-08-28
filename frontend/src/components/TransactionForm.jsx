import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api } from '../lib/api';

import {
  todayInput,
} from '../lib/format';


function createEmptyForm() {
  return {
    type:
      'expense',

    date:
      todayInput(),

    description:
      '',

    category_id:
      '',

    source_account_id:
      '',

    destination_account_id:
      '',

    amount:
      '',

    notes:
      '',

    is_reimbursable:
      false,

    reimbursed_by:
      '',
  };
}


export default function TransactionForm({
  transaction,
  accounts,
  categories,
  onSaved,
  onCancel,
}) {
  const [
    form,
    setForm,
  ] =
    useState(
      () =>
        createEmptyForm(),
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    if (!transaction) {
      setForm(
        createEmptyForm(),
      );

      setError('');

      return;
    }


    setForm({
      type:
        transaction.type ||
        'expense',

      date:
        transaction.date ||
        todayInput(),

      description:
        transaction
          .description ||
        '',

      category_id:
        transaction
          .category_id ||
        '',

      source_account_id:
        transaction
          .source_account_id ||
        '',

      destination_account_id:
        transaction
          .destination_account_id ||
        '',

      amount:
        transaction.amount ??
        '',

      notes:
        transaction.notes ||
        '',

      is_reimbursable:
        Boolean(
          transaction
            .is_reimbursable,
        ),

      reimbursed_by:
        transaction
          .reimbursed_by ||
        '',
    });

    setError('');
  }, [transaction]);


  const matchingCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            category.type ===
              form.type &&
            category
              .is_active !==
              false,
        ),

      [
        categories,
        form.type,
      ],
    );


  const activeAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account
              .is_active !==
              false,
        ),

      [accounts],
    );


  function setField(
    field,
    value,
  ) {
    setForm(
      (current) => ({
        ...current,

        [field]:
          value,
      }),
    );
  }


  function switchType(
    type,
  ) {
    setError('');

    setForm(
      (current) => ({
        ...current,

        type,

        category_id:
          '',

        source_account_id:
          type === 'income'
            ? ''
            : current
                .source_account_id,

        destination_account_id:
          type === 'expense'
            ? ''
            : current
                .destination_account_id,

        /*
         * Reimbursement is only available
         * for expenses.
         */
        is_reimbursable:
          type === 'expense'
            ? current
                .is_reimbursable
            : false,

        reimbursed_by:
          type === 'expense'
            ? current
                .reimbursed_by
            : '',
      }),
    );
  }


  function validate() {
    const amount =
      Number(
        form.amount,
      );


    if (
      !Number.isFinite(
        amount,
      ) ||
      amount <= 0
    ) {
      return (
        'Amount must be greater than zero.'
      );
    }


    if (
      !form.description
        .trim()
    ) {
      return (
        'Description is required.'
      );
    }


    if (
      form.type !==
        'transfer' &&
      !form.category_id
    ) {
      return (
        'Please select a category.'
      );
    }


    if (
      (
        form.type ===
          'expense' ||
        form.type ===
          'transfer'
      ) &&
      !form.source_account_id
    ) {
      return (
        'Please select a source account.'
      );
    }


    if (
      (
        form.type ===
          'income' ||
        form.type ===
          'transfer'
      ) &&
      !form
        .destination_account_id
    ) {
      return (
        'Please select a destination account.'
      );
    }


    if (
      form.type ===
        'transfer' &&
      form.source_account_id ===
        form.destination_account_id
    ) {
      return (
        'Source and destination accounts must be different.'
      );
    }


    return '';
  }


  async function submit(
    event,
  ) {
    event.preventDefault();

    const validationError =
      validate();

    if (
      validationError
    ) {
      setError(
        validationError,
      );

      return;
    }


    setSaving(true);

    setError('');


    try {
      const payload = {
        type:
          form.type,

        date:
          form.date,

        description:
          form
            .description
            .trim(),

        amount:
          Number(
            form.amount,
          ),

        category_id:
          form.type ===
            'transfer'
            ? null
            : form
                .category_id ||
              null,

        source_account_id:
          form.type ===
            'income'
            ? null
            : form
                .source_account_id ||
              null,

        destination_account_id:
          form.type ===
            'expense'
            ? null
            : form
                .destination_account_id ||
              null,

        notes:
          form.notes
            .trim() ||
          null,

        is_reimbursable:
          form.type ===
            'expense'
            ? form
                .is_reimbursable
            : false,

        reimbursed_by:
          form.type ===
              'expense' &&
          form.is_reimbursable
            ? form
                .reimbursed_by
                .trim() ||
              null
            : null,
      };


      const path =
        transaction
          ? `/transactions/${transaction.id}`
          : '/transactions';

      const method =
        transaction
          ? 'PUT'
          : 'POST';


      await api(
        path,
        {
          method,

          body:
            JSON.stringify(
              payload,
            ),
        },
      );


      await onSaved();
    } catch (err) {
      setError(
        err.message ||
          'Unable to save the transaction.',
      );
    } finally {
      setSaving(false);
    }
  }


  return (
    <form
      className="transaction-form"
      onSubmit={submit}
    >
      <div className="transaction-form-scroll">
        <div
          className="segment-control transaction-type-control"
          aria-label="Transaction type"
        >
          {[
            'income',
            'expense',
            'transfer',
          ].map(
            (type) => (
              <button
                type="button"
                key={type}
                className={
                  form.type ===
                  type
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  switchType(
                    type,
                  )
                }
              >
                {type[0]
                  .toUpperCase() +
                  type.slice(
                    1,
                  )}
              </button>
            ),
          )}
        </div>


        <div className="form-grid two">
          <label>
            <span>
              Amount
            </span>

            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              inputMode="decimal"
              value={
                form.amount
              }
              onChange={(
                event,
              ) =>
                setField(
                  'amount',
                  event
                    .target
                    .value,
                )
              }
              placeholder="0"
            />
          </label>


          <label>
            <span>
              Date
            </span>

            <input
              required
              type="date"
              value={
                form.date
              }
              onChange={(
                event,
              ) =>
                setField(
                  'date',
                  event
                    .target
                    .value,
                )
              }
            />
          </label>
        </div>


        <label>
          <span>
            Description
          </span>

          <input
            required
            value={
              form.description
            }
            onChange={(
              event,
            ) =>
              setField(
                'description',
                event
                  .target
                  .value,
              )
            }
            placeholder="Example: Lunch, salary, transfer to wallet"
          />
        </label>


        {form.type ===
          'expense' && (
          <div className="form-grid two">
            <label>
              <span>
                Category
              </span>

              <select
                required
                value={
                  form
                    .category_id
                }
                onChange={(
                  event,
                ) =>
                  setField(
                    'category_id',
                    event
                      .target
                      .value,
                  )
                }
              >
                <option value="">
                  Select category
                </option>

                {matchingCategories.map(
                  (
                    category,
                  ) => (
                    <option
                      key={
                        category.id
                      }
                      value={
                        category.id
                      }
                    >
                      {
                        category.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>


            <label>
              <span>
                Source account
              </span>

              <select
                required
                value={
                  form
                    .source_account_id
                }
                onChange={(
                  event,
                ) =>
                  setField(
                    'source_account_id',
                    event
                      .target
                      .value,
                  )
                }
              >
                <option value="">
                  Select source account
                </option>

                {activeAccounts.map(
                  (
                    account,
                  ) => (
                    <option
                      key={
                        account.id
                      }
                      value={
                        account.id
                      }
                    >
                      {
                        account.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        )}


        {form.type ===
          'income' && (
          <div className="form-grid two">
            <label>
              <span>
                Category
              </span>

              <select
                required
                value={
                  form
                    .category_id
                }
                onChange={(
                  event,
                ) =>
                  setField(
                    'category_id',
                    event
                      .target
                      .value,
                  )
                }
              >
                <option value="">
                  Select category
                </option>

                {matchingCategories.map(
                  (
                    category,
                  ) => (
                    <option
                      key={
                        category.id
                      }
                      value={
                        category.id
                      }
                    >
                      {
                        category.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>


            <label>
              <span>
                Destination account
              </span>

              <select
                required
                value={
                  form
                    .destination_account_id
                }
                onChange={(
                  event,
                ) =>
                  setField(
                    'destination_account_id',
                    event
                      .target
                      .value,
                  )
                }
              >
                <option value="">
                  Select destination account
                </option>

                {activeAccounts.map(
                  (
                    account,
                  ) => (
                    <option
                      key={
                        account.id
                      }
                      value={
                        account.id
                      }
                    >
                      {
                        account.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        )}


        {form.type ===
          'transfer' && (
          <div className="form-grid two">
            <label>
              <span>
                Source account
              </span>

              <select
                required
                value={
                  form
                    .source_account_id
                }
                onChange={(
                  event,
                ) =>
                  setField(
                    'source_account_id',
                    event
                      .target
                      .value,
                  )
                }
              >
                <option value="">
                  Select source account
                </option>

                {activeAccounts.map(
                  (
                    account,
                  ) => (
                    <option
                      key={
                        account.id
                      }
                      value={
                        account.id
                      }
                    >
                      {
                        account.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>


            <label>
              <span>
                Destination account
              </span>

              <select
                required
                value={
                  form
                    .destination_account_id
                }
                onChange={(
                  event,
                ) =>
                  setField(
                    'destination_account_id',
                    event
                      .target
                      .value,
                  )
                }
              >
                <option value="">
                  Select destination account
                </option>

                {activeAccounts.map(
                  (
                    account,
                  ) => (
                    <option
                      key={
                        account.id
                      }
                      value={
                        account.id
                      }
                    >
                      {
                        account.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        )}


        {form.type ===
          'expense' && (
          <>
            <label className="toggle-row">
              <div>
                <strong>
                  Reimbursable expense
                </strong>

                <span>
                  Enable this when you are temporarily paying for someone else. It will reduce the account balance but will not consume your budget or personal expense total.
                </span>
              </div>

              <input
                type="checkbox"
                checked={
                  form
                    .is_reimbursable
                }
                onChange={(
                  event,
                ) =>
                  setForm(
                    (
                      current,
                    ) => ({
                      ...current,

                      is_reimbursable:
                        event
                          .target
                          .checked,

                      reimbursed_by:
                        event
                          .target
                          .checked
                          ? current
                              .reimbursed_by
                          : '',
                    }),
                  )
                }
              />
            </label>


            {form
              .is_reimbursable && (
              <label>
                <span>
                  Reimbursed by{' '}
                  <small>
                    optional
                  </small>
                </span>

                <input
                  value={
                    form
                      .reimbursed_by
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'reimbursed_by',
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Example: John"
                />
              </label>
            )}
          </>
        )}


        <label>
          <span>
            Notes
            <small>
              {' '}
              optional
            </small>
          </span>

          <textarea
            rows="4"
            value={
              form.notes
            }
            onChange={(
              event,
            ) =>
              setField(
                'notes',
                event
                  .target
                  .value,
              )
            }
            placeholder="Add extra context"
          />
        </label>


        {error && (
          <div className="alert error">
            {error}
          </div>
        )}
      </div>


      <div className="transaction-form-footer">
        <button
          type="button"
          className="button ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="button primary"
          disabled={saving}
        >
          {saving
            ? 'Saving...'
            : transaction
              ? 'Update transaction'
              : 'Save transaction'}
        </button>
      </div>
    </form>
  );
}