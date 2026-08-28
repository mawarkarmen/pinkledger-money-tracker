import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Plus,
  Trash2,
} from 'lucide-react';

import { api } from '../lib/api';

import {
  todayInput,
} from '../lib/format';


function blankPerson() {
  return {
    person_name: '',
    amount: '',
  };
}


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

    is_split_expense:
      false,

    personal_amount:
      '',

    reimbursement_people: [
      blankPerson(),
    ],
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


    const claims =
      Array.isArray(
        transaction.reimbursements,
      ) &&
      transaction.reimbursements.length
        ? transaction.reimbursements.map(
            (claim) => ({
              person_name:
                claim.person_name,

              amount:
                String(
                  claim.amount,
                ),
            }),
          )
        : [
            blankPerson(),
          ];


    setForm({
      type:
        transaction.type ||
        'expense',

      date:
        transaction.date ||
        todayInput(),

      description:
        transaction.description ||
        '',

      category_id:
        transaction.category_id ||
        '',

      source_account_id:
        transaction.source_account_id ||
        '',

      destination_account_id:
        transaction.destination_account_id ||
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

      is_split_expense:
        false,

      personal_amount:
        '',

      reimbursement_people:
        claims,
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


  const totalAmount =
    Number(
      form.amount,
    ) || 0;


  const personalAmount =
    Number(
      form.personal_amount,
    ) || 0;


  const reimbursableAmount =
    form.is_split_expense
      ? Math.max(
          0,

          totalAmount -
          personalAmount,
        )
      : form.is_reimbursable
        ? totalAmount
        : 0;


  const allocatedReimbursement =
    form.reimbursement_people
      .reduce(
        (
          total,
          person,
        ) =>
          total +
          (
            Number(
              person.amount,
            ) || 0
          ),

        0,
      );


  const remainingAllocation =
    reimbursableAmount -
    allocatedReimbursement;


  function setField(
    field,
    value,
  ) {
    setForm(
      (
        current,
      ) => ({
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
      (
        current,
      ) => ({
        ...current,

        type,

        category_id:
          '',

        source_account_id:
          type ===
          'income'
            ? ''
            : current
                .source_account_id,

        destination_account_id:
          type ===
          'expense'
            ? ''
            : current
                .destination_account_id,

        is_reimbursable:
          type ===
          'expense'
            ? current
                .is_reimbursable
            : false,

        is_split_expense:
          type ===
          'expense'
            ? current
                .is_split_expense
            : false,

        personal_amount:
          type ===
          'expense'
            ? current
                .personal_amount
            : '',
      }),
    );
  }


  function toggleSplit(
    enabled,
  ) {
    setError('');


    setForm(
      (
        current,
      ) => ({
        ...current,

        is_split_expense:
          enabled,

        is_reimbursable:
          enabled
            ? false
            : current
                .is_reimbursable,

        personal_amount:
          enabled
            ? current
                .personal_amount
            : '',

        reimbursement_people:
          current
            .reimbursement_people
            .length
            ? current
                .reimbursement_people
            : [
                blankPerson(),
              ],
      }),
    );
  }


  function toggleEntireReimbursable(
    enabled,
  ) {
    setError('');


    setForm(
      (
        current,
      ) => ({
        ...current,

        is_reimbursable:
          enabled,

        is_split_expense:
          enabled
            ? false
            : current
                .is_split_expense,

        personal_amount:
          enabled
            ? ''
            : current
                .personal_amount,

        reimbursement_people:
          current
            .reimbursement_people
            .length
            ? current
                .reimbursement_people
            : [
                blankPerson(),
              ],
      }),
    );
  }


  function updatePerson(
    index,
    field,
    value,
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        reimbursement_people:
          current
            .reimbursement_people
            .map(
              (
                person,
                personIndex,
              ) =>
                personIndex ===
                index
                  ? {
                      ...person,

                      [field]:
                        value,
                    }
                  : person,
            ),
      }),
    );
  }


  function addPerson() {
    setForm(
      (
        current,
      ) => ({
        ...current,

        reimbursement_people: [
          ...current
            .reimbursement_people,

          blankPerson(),
        ],
      }),
    );
  }


  function removePerson(
    index,
  ) {
    setForm(
      (
        current,
      ) => {

        if (
          current
            .reimbursement_people
            .length === 1
        ) {
          return {
            ...current,

            reimbursement_people: [
              blankPerson(),
            ],
          };
        }


        return {
          ...current,

          reimbursement_people:
            current
              .reimbursement_people
              .filter(
                (
                  _person,
                  personIndex,
                ) =>
                  personIndex !==
                  index,
              ),
        };
      },
    );
  }


  function validatePeople(
    expectedAmount,
  ) {
    if (
      !form
        .reimbursement_people
        .length
    ) {
      return (
        'Add at least one person who will reimburse you.'
      );
    }


    for (
      const person of
      form
        .reimbursement_people
    ) {
      if (
        !person
          .person_name
          .trim()
      ) {
        return (
          'Enter a name for every person who will reimburse you.'
        );
      }


      const amount =
        Number(
          person.amount,
        );


      if (
        !Number.isFinite(
          amount,
        ) ||
        amount <= 0
      ) {
        return (
          `Enter a valid reimbursement amount for ${person.person_name || 'each person'}.`
        );
      }
    }


    const expectedCents =
      Math.round(
        expectedAmount *
          100,
      );


    const allocatedCents =
      Math.round(
        allocatedReimbursement *
          100,
      );


    if (
      expectedCents !==
      allocatedCents
    ) {
      return (
        'The amounts assigned to people must equal the total reimbursable amount.'
      );
    }


    return '';
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
      !form
        .source_account_id
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
      form
        .source_account_id ===
        form
          .destination_account_id
    ) {
      return (
        'Source and destination accounts must be different.'
      );
    }


    if (
      form.type ===
        'expense' &&
      form
        .is_split_expense
    ) {
      if (
        !Number.isFinite(
          personalAmount,
        ) ||
        personalAmount <= 0
      ) {
        return (
          'Enter the amount that belongs to you.'
        );
      }


      if (
        personalAmount >=
        amount
      ) {
        return (
          'Your portion must be smaller than the total payment.'
        );
      }


      const peopleError =
        validatePeople(
          reimbursableAmount,
        );


      if (
        peopleError
      ) {
        return peopleError;
      }
    }


    if (
      form.type ===
        'expense' &&
      form
        .is_reimbursable
    ) {
      const peopleError =
        validatePeople(
          amount,
        );


      if (
        peopleError
      ) {
        return peopleError;
      }
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

      const people =
        form
          .reimbursement_people
          .map(
            (person) => ({
              person_name:
                person
                  .person_name
                  .trim(),

              amount:
                Number(
                  person.amount,
                ),
            }),
          );


      if (
        form.type ===
          'expense' &&
        form
          .is_split_expense
      ) {
        await api(
          '/transactions/split',

          {
            method:
              'POST',

            body:
              JSON.stringify({
                date:
                  form.date,

                description:
                  form
                    .description
                    .trim(),

                total_amount:
                  Number(
                    form.amount,
                  ),

                personal_amount:
                  Number(
                    form
                      .personal_amount,
                  ),

                category_id:
                  form.category_id,

                source_account_id:
                  form
                    .source_account_id,

                reimbursement_people:
                  people,

                notes:
                  form.notes
                    .trim() ||
                  null,
              }),
          },
        );


        await onSaved();

        return;
      }


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
            : form.category_id ||
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

        reimbursement_people:
          form.type ===
              'expense' &&
          form
            .is_reimbursable
            ? people
            : [],
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


  const showPeople =
    form.type ===
      'expense' &&
    (
      form
        .is_split_expense ||
      form
        .is_reimbursable
    );


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
                  type.slice(1)}
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
            placeholder="Example: Dinner"
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
                  form.category_id
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
                  form.category_id
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
          <div className="expense-option-grid">

            <label
              className={`expense-option-card ${
                form
                  .is_split_expense
                  ? 'active'
                  : ''
              }`}
            >
              <div className="expense-option-content">

                <div className="expense-option-text">
                  <strong>
                    Split expense
                  </strong>

                  <span>
                    Part of the payment is yours and the rest will be reimbursed.
                  </span>
                </div>


                <input
                  type="checkbox"
                  className="small-checkbox"
                  checked={
                    form
                      .is_split_expense
                  }
                  onChange={(
                    event,
                  ) =>
                    toggleSplit(
                      event
                        .target
                        .checked,
                    )
                  }
                />

              </div>
            </label>


            <label
              className={`expense-option-card ${
                form
                  .is_reimbursable
                  ? 'active'
                  : ''
              }`}
            >
              <div className="expense-option-content">

                <div className="expense-option-text">
                  <strong>
                    Entire expense is reimbursable
                  </strong>

                  <span>
                    The complete payment will be paid back by one or more people.
                  </span>
                </div>


                <input
                  type="checkbox"
                  className="small-checkbox"
                  checked={
                    form
                      .is_reimbursable
                  }
                  onChange={(
                    event,
                  ) =>
                    toggleEntireReimbursable(
                      event
                        .target
                        .checked,
                    )
                  }
                />

              </div>
            </label>

          </div>
        )}


        {form
          .is_split_expense && (
          <div className="form-grid two">

            <label>
              <span>
                Your portion
              </span>

              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={
                  form
                    .personal_amount
                }
                onChange={(
                  event,
                ) =>
                  setField(
                    'personal_amount',
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Example: 30000"
              />
            </label>


            <label>
              <span>
                Total reimbursable
              </span>

              <input
                readOnly
                value={
                  reimbursableAmount
                }
              />
            </label>

          </div>
        )}


        {showPeople && (
          <>
            <div className="budget-edit-info">

              <span>
                Reimbursement allocation
              </span>

              <strong>
                Rp{' '}
                {allocatedReimbursement
                  .toLocaleString()}
                {' / '}
                Rp{' '}
                {reimbursableAmount
                  .toLocaleString()}
              </strong>

              <small>
                Remaining:{' '}
                Rp{' '}
                {remainingAllocation
                  .toLocaleString()}
              </small>

            </div>


            {form
              .reimbursement_people
              .map(
                (
                  person,
                  index,
                ) => (
                  <div
                    key={
                      index
                    }
                  >

                    <div className="form-grid two">

                      <label>
                        <span>
                          Person
                        </span>

                        <input
                          value={
                            person
                              .person_name
                          }
                          onChange={(
                            event,
                          ) =>
                            updatePerson(
                              index,
                              'person_name',
                              event
                                .target
                                .value,
                            )
                          }
                          placeholder="Example: John"
                        />
                      </label>


                      <label>
                        <span>
                          Amount
                        </span>

                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={
                            person
                              .amount
                          }
                          onChange={(
                            event,
                          ) =>
                            updatePerson(
                              index,
                              'amount',
                              event
                                .target
                                .value,
                            )
                          }
                          placeholder="0"
                        />
                      </label>

                    </div>


                    <div className="form-actions">

                      <button
                        type="button"
                        className="button ghost"
                        onClick={() =>
                          removePerson(
                            index,
                          )
                        }
                      >
                        <Trash2
                          size={15}
                        />

                        Remove
                      </button>

                    </div>

                  </div>
                ),
              )}


            <button
              type="button"
              className="button secondary"
              onClick={
                addPerson
              }
            >
              <Plus
                size={16}
              />

              Add another person
            </button>

          </>
        )}


        <label>
          <span>
            Notes{' '}
            <small>
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
          onClick={
            onCancel
          }
          disabled={
            saving
          }
        >
          Cancel
        </button>


        <button
          type="submit"
          className="button primary"
          disabled={
            saving
          }
        >
          {saving
            ? 'Saving...'
            : form
                .is_split_expense
              ? 'Save split expense'
              : transaction
                ? 'Update transaction'
                : 'Save transaction'}
        </button>

      </div>

    </form>
  );
}