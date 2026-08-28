import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CheckCircle2,
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
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
    reimbursing,
    setReimbursing,
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
        api(
          '/accounts',
        ),

        api(
          '/categories',
        ),

        api(
          '/profile',
        ),
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
      setLoading(
        false,
      );
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
      const nextParams =
        new URLSearchParams(
          searchParams,
        );

      nextParams.delete(
        'new',
      );

      setSearchParams(
        nextParams,

        {
          replace: true,
        },
      );
    }
  }


  function openReimbursement(
    transaction,
  ) {
    setReimbursementError(
      '',
    );

    setReimbursing(
      transaction,
    );

    setReimbursementForm({
      /*
       * Default to the same account that
       * originally paid the expense.
       */
      destination_account_id:
        transaction
          .source_account_id ||
        '',

      date:
        todayInput(),
    });
  }


  function closeReimbursement() {
    if (
      reimbursementSaving
    ) {
      return;
    }

    setReimbursing(
      null,
    );

    setReimbursementError(
      '',
    );
  }


  async function submitReimbursement(
    event,
  ) {
    event.preventDefault();

    if (
      !reimbursementForm
        .destination_account_id
    ) {
      setReimbursementError(
        'Please select the account that received the repayment.',
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
        `/transactions/${reimbursing.id}/reimburse`,

        {
          method:
            'POST',

          body:
            JSON.stringify(
              reimbursementForm,
            ),
        },
      );


      setReimbursing(
        null,
      );


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
      'Delete this transaction? Account balances will be recalculated automatically.';


    if (
      transaction
        .reimbursement_status ===
      'reimbursed'
    ) {
      message =
        'Delete this reimbursed expense? Its linked reimbursement receipt will also be deleted and account balances will be recalculated.';
    }


    if (
      !window.confirm(
        message,
      )
    ) {
      return;
    }


    try {
      await api(
        `/transactions/${transaction.id}`,

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
      'Reimbursable',
      'Reimbursement Status',
      'Reimbursed By',
    ];


    const rows =
      transactions.map(
        (tx) => [
          tx.date,

          tx
            .reimburses_transaction_id
            ? 'reimbursement'
            : tx.type,

          tx.description,

          tx.category
            ?.name ||
            '',

          tx.source_account
            ?.name ||
            '',

          tx.destination_account
            ?.name ||
            '',

          tx.amount,

          tx.is_reimbursable
            ? 'Yes'
            : 'No',

          tx.reimbursement_status ||
            'none',

          tx.reimbursed_by ||
            '',
        ],
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
              .map(
                escape,
              )
              .join(
                ',',
              ),
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


  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div>
          <h2>
            Transaction history
          </h2>

          <p>
            Record income,
            expenses, transfers,
            and reimbursable
            payments.
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
              !transactions.length
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
        ) : transactions.length ? (
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
                {transactions.map(
                  (tx) => {
                    const isReceipt =
                      Boolean(
                        tx
                          .reimburses_transaction_id,
                      );

                    const isPending =
                      tx
                        .is_reimbursable &&
                      tx
                        .reimbursement_status ===
                        'pending';

                    const isReimbursed =
                      tx
                        .is_reimbursable &&
                      tx
                        .reimbursement_status ===
                        'reimbursed';


                    return (
                      <tr
                        key={
                          tx.id
                        }
                      >
                        <td>
                          {formatDate(
                            tx.date,
                          )}
                        </td>


                        <td>
                          <strong>
                            {
                              tx.description
                            }
                          </strong>

                          {tx.notes && (
                            <small>
                              {
                                tx.notes
                              }
                            </small>
                          )}
                        </td>


                        <td>
                          {isReceipt ? (
                            <span className="status-badge good">
                              Reimbursement
                            </span>
                          ) : (
                            <>
                              <span
                                className={`type-badge ${tx.type}`}
                              >
                                {
                                  tx.type
                                }
                              </span>

                              {isPending && (
                                <span className="status-badge warning">
                                  Pending reimbursement
                                </span>
                              )}

                              {isReimbursed && (
                                <span className="status-badge good">
                                  Reimbursed
                                </span>
                              )}
                            </>
                          )}
                        </td>


                        <td>
                          {isReceipt
                            ? 'Reimbursement'
                            : tx.category
                                ?.name ||
                              'Transfer'}
                        </td>


                        <td>
                          {tx.type ===
                          'income'
                            ? `→ ${tx.destination_account?.name || ''}`
                            : tx.type ===
                                'expense'
                              ? `${tx.source_account?.name || ''} →`
                              : `${tx.source_account?.name || ''} → ${tx.destination_account?.name || ''}`}
                        </td>


                        <td
                          className={`right money-value ${tx.type}`}
                        >
                          {tx.type ===
                          'income'
                            ? '+'
                            : tx.type ===
                                'expense'
                              ? '-'
                              : ''}

                          {formatMoney(
                            tx.amount,
                            currency,
                          )}
                        </td>


                        <td className="row-actions">
                          {isPending && (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() =>
                                openReimbursement(
                                  tx,
                                )
                              }
                              title="Mark reimbursed"
                              aria-label="Mark reimbursed"
                            >
                              <CheckCircle2
                                size={17}
                              />
                            </button>
                          )}


                          {!isReceipt &&
                            !isReimbursed && (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => {
                                setEditing(
                                  tx,
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
                                  tx,
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
            reimbursing,
          )
        }
        title="Mark as reimbursed"
        eyebrow="Reimbursement"
        onClose={
          closeReimbursement
        }
      >
        {reimbursing && (
          <form
            className="form-stack modal-standard-form"
            onSubmit={
              submitReimbursement
            }
          >
            <div className="budget-edit-info">
              <span>
                Original expense
              </span>

              <strong>
                {
                  reimbursing.description
                }
              </strong>

              <small>
                {formatMoney(
                  reimbursing.amount,
                  currency,
                )}

                {reimbursing
                  .reimbursed_by
                  ? ` · Expected from ${reimbursing.reimbursed_by}`
                  : ''}
              </small>
            </div>


            <label>
              <span>
                Repayment date
              </span>

              <input
                required
                type="date"
                min={
                  reimbursing.date
                }
                value={
                  reimbursementForm
                    .date
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


            <div className="alert warning">
              This repayment will increase the selected account balance, but it will not be counted as income.
            </div>


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
                onClick={
                  closeReimbursement
                }
                disabled={
                  reimbursementSaving
                }
              >
                Cancel
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
                  : 'Confirm reimbursement'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}