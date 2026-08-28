import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from 'lucide-react';

import {
  useSearchParams,
} from 'react-router-dom';

import { api } from '../lib/api';

import {
  currentMonth,
  formatDate,
  formatMoney,
  todayInput,
} from '../lib/format';

import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import EmptyState from '../components/EmptyState';


function groupTransactionRows(
  transactions,
) {
  const groups =
    new Map();


  for (
    const transaction of
    transactions
  ) {
    if (
      !transaction
        .transaction_group_id
    ) {
      continue;
    }


    if (
      !groups.has(
        transaction
          .transaction_group_id,
      )
    ) {
      groups.set(
        transaction
          .transaction_group_id,

        [],
      );
    }


    groups
      .get(
        transaction
          .transaction_group_id,
      )
      .push(
        transaction,
      );
  }


  const handled =
    new Set();


  const result =
    [];


  for (
    const transaction of
    transactions
  ) {
    if (
      !transaction
        .transaction_group_id
    ) {
      result.push(
        transaction,
      );

      continue;
    }


    if (
      handled.has(
        transaction
          .transaction_group_id,
      )
    ) {
      continue;
    }


    handled.add(
      transaction
        .transaction_group_id,
    );


    const parts =
      groups.get(
        transaction
          .transaction_group_id,
      ) || [];


    const personal =
      parts.find(
        (item) =>
          item.type ===
            'expense' &&
          !item
            .is_reimbursable,
      );


    const reimbursable =
      parts.find(
        (item) =>
          item.type ===
            'expense' &&
          item
            .is_reimbursable,
      );


    const base =
      personal ||
      reimbursable ||
      transaction;


    result.push({
      ...base,

      id:
        `split-${transaction.transaction_group_id}`,

      is_split_group:
        true,

      transaction_group_id:
        transaction
          .transaction_group_id,

      amount:
        parts.reduce(
          (
            total,
            item,
          ) =>
            total +
            Number(
              item.amount ||
                0,
            ),

          0,
        ),

      personal_amount:
        Number(
          personal?.amount ||
            0,
        ),

      reimbursable_amount:
        Number(
          reimbursable?.amount ||
            0,
        ),

      reimbursements:
        reimbursable
          ?.reimbursements ||
        [],

      reimbursement_status:
        reimbursable
          ?.reimbursement_status ||
        'none',

      reimbursement_source:
        reimbursable ||
        null,

      delete_target_id:
        personal?.id ||
        reimbursable?.id ||
        transaction.id,
    });
  }


  return result;
}


export default function TransactionsPage() {
  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();


  const [
    transactions,
    setTransactions,
  ] =
    useState([]);


  const [
    accounts,
    setAccounts,
  ] =
    useState([]);


  const [
    categories,
    setCategories,
  ] =
    useState([]);


  const [
    currency,
    setCurrency,
  ] =
    useState('IDR');


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState('');


  const [
    editing,
    setEditing,
  ] =
    useState(null);


  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(
      searchParams.get(
        'new',
      ) === '1',
    );


  const [
    reimbursementTarget,
    setReimbursementTarget,
  ] =
    useState(null);


  const [
    selectedClaim,
    setSelectedClaim,
  ] =
    useState(null);


  const [
    reimbursementForm,
    setReimbursementForm,
  ] =
    useState({
      destination_account_id:
        '',

      date:
        todayInput(),
    });


  const [
    reimbursementSaving,
    setReimbursementSaving,
  ] =
    useState(false);


  const [
    reimbursementError,
    setReimbursementError,
  ] =
    useState('');


  const [
    filters,
    setFilters,
  ] =
    useState({
      month:
        currentMonth(),

      type:
        '',

      account:
        '',

      q:
        '',
    });


  useEffect(() => {
    if (
      searchParams.get(
        'new',
      ) === '1'
    ) {
      setModalOpen(
        true,
      );
    }
  }, [searchParams]);


  async function loadReference() {
    const [
      accountData,
      categoryData,
      profile,
    ] =
      await Promise.all([
        api('/accounts'),
        api('/categories'),
        api('/profile'),
      ]);


    setAccounts(
      accountData,
    );


    setCategories(
      categoryData,
    );


    setCurrency(
      profile.currency ||
        'IDR',
    );
  }


  async function loadTransactions() {
    setLoading(true);

    setError('');


    try {
      const params =
        new URLSearchParams();


      if (
        filters.month
      ) {
        params.set(
          'month',
          filters.month,
        );
      }


      if (
        filters.type
      ) {
        params.set(
          'type',
          filters.type,
        );
      }


      if (
        filters.account
      ) {
        params.set(
          'account',
          filters.account,
        );
      }


      if (
        filters.q
      ) {
        params.set(
          'q',
          filters.q,
        );
      }


      const data =
        await api(
          `/transactions?${params.toString()}`,
        );


      setTransactions(
        data,
      );

    } catch (err) {
      setError(
        err.message,
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadReference()
      .catch(
        (err) =>
          setError(
            err.message,
          ),
      );
  }, []);


  useEffect(() => {
    const timer =
      setTimeout(
        () =>
          loadTransactions(),
        180,
      );


    return () =>
      clearTimeout(
        timer,
      );

  }, [
    filters.month,
    filters.type,
    filters.account,
    filters.q,
  ]);


  const displayTransactions =
    useMemo(
      () =>
        groupTransactionRows(
          transactions,
        ),

      [transactions],
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


  function openNewTransaction() {
    setEditing(null);

    setModalOpen(true);
  }


  function closeModal() {
    setModalOpen(false);

    setEditing(null);


    if (
      searchParams.get(
        'new',
      )
    ) {
      const params =
        new URLSearchParams(
          searchParams,
        );


      params.delete(
        'new',
      );


      setSearchParams(
        params,

        {
          replace:
            true,
        },
      );
    }
  }


  function openReimbursementManager(
    transaction,
  ) {
    const target =
      transaction
        .is_split_group
        ? transaction
            .reimbursement_source
        : transaction;


    setReimbursementTarget(
      target,
    );


    setSelectedClaim(
      null,
    );


    setReimbursementError(
      '',
    );
  }


  function closeReimbursementManager() {
    if (
      reimbursementSaving
    ) {
      return;
    }


    setReimbursementTarget(
      null,
    );


    setSelectedClaim(
      null,
    );


    setReimbursementError(
      '',
    );
  }


  function chooseClaim(
    claim,
  ) {
    setSelectedClaim(
      claim,
    );


    setReimbursementError(
      '',
    );


    setReimbursementForm({
      destination_account_id:
        reimbursementTarget
          ?.source_account_id ||
        '',

      date:
        todayInput(),
    });
  }


  async function submitReimbursement(
    event,
  ) {
    event.preventDefault();


    if (
      !selectedClaim
    ) {
      return;
    }


    if (
      !reimbursementForm
        .destination_account_id
    ) {
      setReimbursementError(
        'Please select the account that received the money.',
      );

      return;
    }


    setReimbursementSaving(
      true,
    );


    setReimbursementError(
      '',
    );


    try {
      await api(
        `/transactions/${reimbursementTarget.id}/reimburse/${selectedClaim.id}`,

        {
          method:
            'POST',

          body:
            JSON.stringify(
              reimbursementForm,
            ),
        },
      );


      closeReimbursementManager();


      await Promise.all([
        loadTransactions(),
        loadReference(),
      ]);

    } catch (err) {
      setReimbursementError(
        err.message ||
          'Unable to record the reimbursement.',
      );

    } finally {
      setReimbursementSaving(
        false,
      );
    }
  }


  async function removeTransaction(
    transaction,
  ) {
    let message =
      'Delete this transaction? Account balances will be recalculated.';


    if (
      transaction
        .is_split_group
    ) {
      message =
        'Delete this entire split expense? All personal, reimbursement, and repayment records linked to it will be removed.';
    }


    if (
      !window.confirm(
        message,
      )
    ) {
      return;
    }


    const targetId =
      transaction
        .is_split_group
        ? transaction
            .delete_target_id
        : transaction.id;


    try {
      await api(
        `/transactions/${targetId}`,

        {
          method:
            'DELETE',
        },
      );


      await Promise.all([
        loadTransactions(),
        loadReference(),
      ]);

    } catch (err) {
      setError(
        err.message,
      );
    }
  }


  function exportCsv() {
    const header = [
      'Date',
      'Type',
      'Description',
      'Category',
      'Source Account',
      'Destination Account',
      'Amount',
      'Reimbursements',
    ];


    const rows =
      displayTransactions.map(
        (transaction) => {

          const reimbursements =
            (
              transaction
                .reimbursements ||
              []
            )
              .map(
                (claim) =>
                  `${claim.person_name}: ${claim.amount} (${claim.status})`,
              )
              .join(
                '; ',
              );


          return [
            transaction.date,

            transaction
              .is_split_group
              ? 'split expense'
              : transaction
                  .reimbursement_claim_id
                ? 'reimbursement'
                : transaction.type,

            transaction.description,

            transaction.category
              ?.name ||
              '',

            transaction.source_account
              ?.name ||
              '',

            transaction.destination_account
              ?.name ||
              '',

            transaction.amount,

            reimbursements,
          ];
        },
      );


    const escape =
      (value) =>
        `"${String(
          value ?? '',
        ).replaceAll(
          '"',
          '""',
        )}"`;


    const csv =
      [
        header,
        ...rows,
      ]
        .map(
          (row) =>
            row
              .map(escape)
              .join(','),
        )
        .join('\n');


    const blob =
      new Blob(
        [csv],

        {
          type:
            'text/csv;charset=utf-8',
        },
      );


    const url =
      URL.createObjectURL(
        blob,
      );


    const anchor =
      document.createElement(
        'a',
      );


    anchor.href =
      url;


    anchor.download =
      `pinkledger-transactions-${filters.month || 'all'}.csv`;


    anchor.click();


    URL.revokeObjectURL(
      url,
    );
  }


  return (
    <div className="page-stack animate-in">

      <div className="page-toolbar">

        <div>
          <h2>
            Transaction history
          </h2>

          <p>
            Record income, expenses, transfers, split payments, and reimbursements.
          </p>
        </div>


        <div className="toolbar-actions">

          <button
            type="button"
            className="button secondary"
            onClick={
              exportCsv
            }
            disabled={
              !displayTransactions.length
            }
          >
            <Download
              size={17}
            />

            Export CSV
          </button>


          <button
            type="button"
            className="button primary"
            onClick={
              openNewTransaction
            }
          >
            <Plus
              size={18}
            />

            Add transaction
          </button>

        </div>

      </div>


      <section className="panel filters-panel">

        <label className="search-field">

          <Search
            size={17}
          />

          <input
            value={
              filters.q
            }
            onChange={(
              event,
            ) =>
              setFilters({
                ...filters,

                q:
                  event
                    .target
                    .value,
              })
            }
            placeholder="Search description"
          />

        </label>


        <input
          type="month"
          value={
            filters.month
          }
          onChange={(
            event,
          ) =>
            setFilters({
              ...filters,

              month:
                event
                  .target
                  .value,
            })
          }
        />


        <select
          value={
            filters.type
          }
          onChange={(
            event,
          ) =>
            setFilters({
              ...filters,

              type:
                event
                  .target
                  .value,
            })
          }
        >
          <option value="">
            All types
          </option>

          <option value="income">
            Income
          </option>

          <option value="expense">
            Expense
          </option>

          <option value="transfer">
            Transfer
          </option>

          <option value="reimbursement">
            Reimbursement
          </option>
        </select>


        <select
          value={
            filters.account
          }
          onChange={(
            event,
          ) =>
            setFilters({
              ...filters,

              account:
                event
                  .target
                  .value,
            })
          }
        >
          <option value="">
            All accounts
          </option>

          {activeAccounts.map(
            (account) => (
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

      </section>


      {error && (
        <div className="alert error">
          {error}
        </div>
      )}


      <section className="panel table-panel">

        {loading ? (
          <div className="loading-panel">
            <div className="loader" />

            Loading transactions...
          </div>

        ) : displayTransactions.length ? (

          <div className="table-scroll">

            <table className="data-table">

              <thead>
                <tr>
                  <th>
                    Date
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Category
                  </th>

                  <th>
                    Account movement
                  </th>

                  <th className="right">
                    Amount
                  </th>

                  <th />
                </tr>
              </thead>


              <tbody>

                {displayTransactions.map(
                  (transaction) => {

                    const isReceipt =
                      Boolean(
                        transaction
                          .reimbursement_claim_id,
                      );


                    const claims =
                      transaction
                        .reimbursements ||
                      [];


                    const pendingClaims =
                      claims.filter(
                        (claim) =>
                          claim.status ===
                          'pending',
                      );


                    return (
                      <tr
                        key={
                          transaction.id
                        }
                      >

                        <td>
                          {formatDate(
                            transaction.date,
                          )}
                        </td>


                        <td>

                          <strong>
                            {
                              transaction.description
                            }
                          </strong>


                          {transaction
                            .is_split_group && (
                            <small>
                              Your portion:{' '}
                              {formatMoney(
                                transaction.personal_amount,
                                currency,
                              )}

                              {' · '}

                              Reimbursable:{' '}
                              {formatMoney(
                                transaction.reimbursable_amount,
                                currency,
                              )}
                            </small>
                          )}


                          {claims.length >
                            0 && (
                            <small>
                              {claims
                                .map(
                                  (claim) =>
                                    `${claim.person_name}: ${formatMoney(
                                      claim.amount,
                                      currency,
                                    )} ${
                                      claim.status ===
                                      'reimbursed'
                                        ? '✓'
                                        : 'pending'
                                    }`,
                                )
                                .join(
                                  ' · ',
                                )}
                            </small>
                          )}

                        </td>


                        <td>

                          {isReceipt ? (
                            <span className="status-badge good">
                              Reimbursement
                            </span>

                          ) : transaction
                              .is_split_group ? (
                            <span className="type-badge expense">
                              Split expense
                            </span>

                          ) : (
                            <span
                              className={`type-badge ${transaction.type}`}
                            >
                              {
                                transaction.type
                              }
                            </span>
                          )}

                        </td>


                        <td>
                          {isReceipt
                            ? 'Reimbursement'
                            : transaction
                                .category
                                ?.name ||
                              'Transfer'}
                        </td>


                        <td>
                          {transaction.type ===
                          'income'
                            ? `→ ${transaction.destination_account?.name || ''}`
                            : transaction.type ===
                                'expense'
                              ? `${transaction.source_account?.name || ''} →`
                              : `${transaction.source_account?.name || ''} → ${transaction.destination_account?.name || ''}`}
                        </td>


                        <td
                          className={`right money-value ${transaction.type}`}
                        >
                          {transaction.type ===
                          'income'
                            ? '+'
                            : transaction.type ===
                                'expense'
                              ? '-'
                              : ''}

                          {formatMoney(
                            transaction.amount,
                            currency,
                          )}
                        </td>


                        <td className="row-actions">

                          {claims.length >
                            0 && (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() =>
                                openReimbursementManager(
                                  transaction,
                                )
                              }
                              title="Manage reimbursements"
                              aria-label="Manage reimbursements"
                            >
                              <UsersRound
                                size={17}
                              />
                            </button>
                          )}


                          {!transaction
                            .is_split_group &&
                            !isReceipt &&
                            pendingClaims.length ===
                              claims.length && (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => {
                                setEditing(
                                  transaction,
                                );

                                setModalOpen(
                                  true,
                                );
                              }}
                              aria-label="Edit transaction"
                            >
                              <Edit3
                                size={17}
                              />
                            </button>
                          )}


                          {!isReceipt && (
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() =>
                                removeTransaction(
                                  transaction,
                                )
                              }
                              aria-label="Delete transaction"
                            >
                              <Trash2
                                size={17}
                              />
                            </button>
                          )}

                        </td>

                      </tr>
                    );
                  },
                )}

              </tbody>

            </table>

          </div>

        ) : (

          <EmptyState
            title="No matching transactions"
            description="Add a transaction or adjust the current filters."
            action={
              <button
                type="button"
                className="button primary"
                onClick={
                  openNewTransaction
                }
              >
                Add transaction
              </button>
            }
          />

        )}

      </section>


      <Modal
        open={
          modalOpen
        }
        title={
          editing
            ? 'Edit transaction'
            : 'Add transaction'
        }
        eyebrow="Transaction"
        onClose={
          closeModal
        }
        wide
      >
        <TransactionForm
          transaction={
            editing
          }
          accounts={
            accounts
          }
          categories={
            categories
          }
          onCancel={
            closeModal
          }
          onSaved={
            async () => {
              closeModal();

              await Promise.all([
                loadTransactions(),
                loadReference(),
              ]);
            }
          }
        />
      </Modal>


      <Modal
        open={
          Boolean(
            reimbursementTarget,
          )
        }
        title="Manage reimbursements"
        eyebrow="Reimbursement"
        onClose={
          closeReimbursementManager
        }
      >

        {reimbursementTarget && (
          <div className="form-stack modal-standard-form">

            <div className="budget-edit-info">

              <span>
                Expense
              </span>

              <strong>
                {
                  reimbursementTarget.description
                }
              </strong>

              <small>
                Each person can repay their portion separately.
              </small>

            </div>


            {(reimbursementTarget
              .reimbursements ||
              [])
              .map(
                (claim) => (
                  <div
                    className="budget-edit-info"
                    key={
                      claim.id
                    }
                  >

                    <span>
                      {
                        claim.person_name
                      }
                    </span>


                    <strong>
                      {formatMoney(
                        claim.amount,
                        currency,
                      )}
                    </strong>


                    <small>
                      {claim.status ===
                      'reimbursed'
                        ? `Reimbursed${
                            claim.reimbursed_at
                              ? ` on ${formatDate(
                                  claim.reimbursed_at,
                                )}`
                              : ''
                          }`
                        : 'Awaiting reimbursement'}
                    </small>


                    {claim.status ===
                      'pending' && (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          chooseClaim(
                            claim,
                          )
                        }
                      >
                        Mark paid
                      </button>
                    )}

                  </div>
                ),
              )}


            {selectedClaim && (
              <form
                className="form-stack"
                onSubmit={
                  submitReimbursement
                }
              >

                <div className="alert success">
                  Recording{' '}
                  {formatMoney(
                    selectedClaim.amount,
                    currency,
                  )}{' '}
                  from{' '}
                  {
                    selectedClaim.person_name
                  }.
                </div>


                <label>
                  <span>
                    Repayment date
                  </span>

                  <input
                    required
                    type="date"
                    min={
                      reimbursementTarget.date
                    }
                    value={
                      reimbursementForm.date
                    }
                    onChange={(
                      event,
                    ) =>
                      setReimbursementForm({
                        ...reimbursementForm,

                        date:
                          event
                            .target
                            .value,
                      })
                    }
                  />
                </label>


                <label>
                  <span>
                    Account that received the money
                  </span>

                  <select
                    required
                    value={
                      reimbursementForm
                        .destination_account_id
                    }
                    onChange={(
                      event,
                    ) =>
                      setReimbursementForm({
                        ...reimbursementForm,

                        destination_account_id:
                          event
                            .target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Select account
                    </option>

                    {activeAccounts.map(
                      (account) => (
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


                {reimbursementError && (
                  <div className="alert error">
                    {
                      reimbursementError
                    }
                  </div>
                )}


                <div className="modal-standard-actions">

                  <button
                    type="button"
                    className="button ghost"
                    disabled={
                      reimbursementSaving
                    }
                    onClick={() =>
                      setSelectedClaim(
                        null,
                      )
                    }
                  >
                    Back
                  </button>


                  <button
                    type="submit"
                    className="button primary"
                    disabled={
                      reimbursementSaving
                    }
                  >
                    {reimbursementSaving
                      ? 'Saving...'
                      : `Confirm ${selectedClaim.person_name}`}
                  </button>

                </div>

              </form>
            )}

          </div>
        )}

      </Modal>

    </div>
  );
}