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
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';

import { api } from '../lib/api';

import {
  currentMonth,
  formatDate,
  formatMoney,
} from '../lib/format';

import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import EmptyState from '../components/EmptyState';

export default function TransactionsPage() {
  const [searchParams, setSearchParams] =
    useSearchParams();

  const [transactions, setTransactions] =
    useState([]);

  const [accounts, setAccounts] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [currency, setCurrency] =
    useState('IDR');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [editing, setEditing] =
    useState(null);

  const [modalOpen, setModalOpen] =
    useState(
      searchParams.get('new') === '1',
    );

  const [filters, setFilters] =
    useState({
      month: currentMonth(),
      type: '',
      account: '',
      q: '',
    });

  useEffect(() => {
    if (
      searchParams.get('new') === '1'
    ) {
      setModalOpen(true);
    }
  }, [searchParams]);

  async function loadReference() {
    const [
      accountData,
      categoryData,
      profile,
    ] = await Promise.all([
      api('/accounts'),
      api('/categories'),
      api('/profile'),
    ]);

    setAccounts(accountData);
    setCategories(categoryData);
    setCurrency(
      profile.currency || 'IDR',
    );
  }

  async function loadTransactions() {
    setLoading(true);
    setError('');

    try {
      const params =
        new URLSearchParams();

      if (filters.month) {
        params.set(
          'month',
          filters.month,
        );
      }

      if (filters.type) {
        params.set(
          'type',
          filters.type,
        );
      }

      if (filters.account) {
        params.set(
          'account',
          filters.account,
        );
      }

      if (filters.q) {
        params.set(
          'q',
          filters.q,
        );
      }

      const data = await api(
        `/transactions?${params.toString()}`,
      );

      setTransactions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReference().catch((err) =>
      setError(err.message),
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => loadTransactions(),
      180,
    );

    return () =>
      clearTimeout(timer);
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

    if (searchParams.get('new')) {
      const nextParams =
        new URLSearchParams(
          searchParams,
        );

      nextParams.delete('new');

      setSearchParams(
        nextParams,
        { replace: true },
      );
    }
  }

  async function removeTransaction(id) {
    const confirmed =
      window.confirm(
        'Delete this transaction? Account balances will be recalculated automatically.',
      );

    if (!confirmed) return;

    try {
      await api(
        `/transactions/${id}`,
        {
          method: 'DELETE',
        },
      );

      await Promise.all([
        loadTransactions(),
        loadReference(),
      ]);
    } catch (err) {
      setError(err.message);
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
    ];

    const rows =
      transactions.map((tx) => [
        tx.date,
        tx.type,
        tx.description,
        tx.category?.name || '',
        tx.source_account?.name || '',
        tx.destination_account?.name ||
          '',
        tx.amount,
      ]);

    const escape = (value) =>
      `"${String(
        value ?? '',
      ).replaceAll('"', '""')}"`;

    const csv = [
      header,
      ...rows,
    ]
      .map((row) =>
        row
          .map(escape)
          .join(','),
      )
      .join('\n');

    const blob = new Blob(
      [csv],
      {
        type: 'text/csv;charset=utf-8',
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;

    anchor.download =
      `pinkledger-transactions-${
        filters.month || 'all'
      }.csv`;

    anchor.click();

    URL.revokeObjectURL(url);
  }

  const activeAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account.is_active !== false,
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
            Record income, expenses,
            and account transfers.
          </p>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="button secondary"
            onClick={exportCsv}
            disabled={
              !transactions.length
            }
          >
            <Download size={17} />
            Export CSV
          </button>

          <button
            type="button"
            className="button primary"
            onClick={
              openNewTransaction
            }
          >
            <Plus size={18} />
            Add transaction
          </button>
        </div>
      </div>

      <section className="panel filters-panel">
        <label className="search-field">
          <Search size={17} />

          <input
            value={filters.q}
            onChange={(event) =>
              setFilters({
                ...filters,
                q: event.target.value,
              })
            }
            placeholder="Search description"
          />
        </label>

        <input
          type="month"
          value={filters.month}
          onChange={(event) =>
            setFilters({
              ...filters,
              month:
                event.target.value,
            })
          }
        />

        <select
          value={filters.type}
          onChange={(event) =>
            setFilters({
              ...filters,
              type:
                event.target.value,
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
        </select>

        <select
          value={filters.account}
          onChange={(event) =>
            setFilters({
              ...filters,
              account:
                event.target.value,
            })
          }
        >
          <option value="">
            All accounts
          </option>

          {activeAccounts.map(
            (account) => (
              <option
                key={account.id}
                value={account.id}
              >
                {account.name}
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
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Category</th>
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
                  (tx) => (
                    <tr key={tx.id}>
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
                        <span
                          className={`type-badge ${tx.type}`}
                        >
                          {tx.type}
                        </span>
                      </td>

                      <td>
                        {tx.category
                          ?.name ||
                          'Transfer'}
                      </td>

                      <td>
                        {tx.type ===
                        'income'
                          ? `→ ${
                              tx
                                .destination_account
                                ?.name ||
                              ''
                            }`
                          : tx.type ===
                              'expense'
                            ? `${
                                tx
                                  .source_account
                                  ?.name ||
                                ''
                              } →`
                            : `${
                                tx
                                  .source_account
                                  ?.name ||
                                ''
                              } → ${
                                tx
                                  .destination_account
                                  ?.name ||
                                ''
                              }`}
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

                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() =>
                            removeTransaction(
                              tx.id,
                            )
                          }
                          aria-label="Delete transaction"
                        >
                          <Trash2
                            size={17}
                          />
                        </button>
                      </td>
                    </tr>
                  ),
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
        open={modalOpen}
        title={
          editing
            ? 'Edit transaction'
            : 'Add transaction'
        }
        onClose={closeModal}
        wide
      >
        <TransactionForm
          transaction={editing}
          accounts={accounts}
          categories={categories}
          onCancel={closeModal}
          onSaved={async () => {
            closeModal();

            await Promise.all([
              loadTransactions(),
              loadReference(),
            ]);
          }}
        />
      </Modal>
    </div>
  );
}