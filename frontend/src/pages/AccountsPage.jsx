import {
  useEffect,
  useState,
} from 'react';

import {
  Archive,
  CreditCard,
  Landmark,
  Plus,
  Smartphone,
  WalletCards,
} from 'lucide-react';

import { api } from '../lib/api';

import {
  formatMoney,
  todayInput,
} from '../lib/format';

import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const accountTypes = [
  ['cash', 'Cash'],
  ['bank', 'Bank account'],
  ['ewallet', 'E-wallet'],
  ['savings', 'Savings'],
  ['credit_card', 'Credit card'],
  ['other', 'Other'],
];

function iconFor(type) {
  if (
    type === 'bank' ||
    type === 'savings'
  ) {
    return Landmark;
  }

  if (type === 'ewallet') {
    return Smartphone;
  }

  if (type === 'credit_card') {
    return CreditCard;
  }

  return WalletCards;
}

function createInitialForm(
  currency = 'IDR',
) {
  return {
    name: '',
    type: 'bank',
    opening_balance: '',
    opening_date: todayInput(),
    currency,
  };
}

export default function AccountsPage() {
  const [
    accounts,
    setAccounts,
  ] = useState([]);

  const [
    currency,
    setCurrency,
  ] = useState('IDR');

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState('');

  const [
    modalError,
    setModalError,
  ] = useState('');

  const [
    form,
    setForm,
  ] = useState(
    createInitialForm(),
  );

  async function load() {
    setLoading(true);
    setPageError('');

    try {
      const [
        data,
        profile,
      ] = await Promise.all([
        api('/accounts'),
        api('/profile'),
      ]);

      const profileCurrency =
        profile.currency || 'IDR';

      setAccounts(data);

      setCurrency(
        profileCurrency,
      );

      setForm((current) => ({
        ...current,

        currency:
          current.currency ||
          profileCurrency,
      }));
    } catch (err) {
      setPageError(
        err.message ||
          'Unable to load accounts.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAccountModal() {
    setModalError('');

    setForm(
      createInitialForm(
        currency,
      ),
    );

    setOpen(true);
  }

  function closeAccountModal() {
    if (saving) {
      return;
    }

    setOpen(false);

    setModalError('');

    setForm(
      createInitialForm(
        currency,
      ),
    );
  }

  async function submit(event) {
    event.preventDefault();

    const name =
      form.name.trim();

    const openingBalance =
      Number(
        form.opening_balance,
      );

    const normalizedCurrency =
      form.currency
        .trim()
        .toUpperCase();

    if (!name) {
      setModalError(
        'Account name is required.',
      );

      return;
    }

    if (
      !Number.isFinite(
        openingBalance,
      )
    ) {
      setModalError(
        'Opening balance must be a valid number.',
      );

      return;
    }

    if (
      normalizedCurrency.length !== 3
    ) {
      setModalError(
        'Currency must contain exactly 3 letters, for example IDR or USD.',
      );

      return;
    }

    setSaving(true);
    setModalError('');

    try {
      await api('/accounts', {
        method: 'POST',

        body: JSON.stringify({
          name,

          type:
            form.type,

          opening_balance:
            openingBalance,

          opening_date:
            form.opening_date,

          currency:
            normalizedCurrency,
        }),
      });

      setOpen(false);

      setForm(
        createInitialForm(
          currency,
        ),
      );

      await load();
    } catch (err) {
      setModalError(
        err.message ||
          'Unable to create the account.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(
    account,
  ) {
    const confirmed =
      window.confirm(
        `Archive ${account.name}? Historical transactions will be kept.`,
      );

    if (!confirmed) {
      return;
    }

    setPageError('');

    try {
      await api(
        `/accounts/${account.id}`,
        {
          method: 'PUT',

          body: JSON.stringify({
            is_active: false,
          }),
        },
      );

      await load();
    } catch (err) {
      setPageError(
        err.message ||
          'Unable to archive the account.',
      );
    }
  }

  const active =
    accounts.filter(
      (item) =>
        item.is_active !== false,
    );

  const total =
    active.reduce(
      (sum, item) =>
        sum +
        Number(
          item.current_balance ||
            0,
        ),
      0,
    );

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div>
          <h2>
            Your accounts
          </h2>

          <p>
            Balances are calculated
            from each opening balance
            and transaction history.
          </p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={
            openAccountModal
          }
        >
          <Plus size={18} />
          Add account
        </button>
      </div>

      <article className="balance-hero">
        <span>
          Total active balance
        </span>

        <strong>
          {formatMoney(
            total,
            currency,
          )}
        </strong>

        <small>
          {active.length}{' '}
          active account
          {active.length === 1
            ? ''
            : 's'}
        </small>
      </article>

      {pageError ? (
        <div className="alert error">
          {pageError}
        </div>
      ) : null}

      {loading ? (
        <div className="loading-panel">
          <div className="loader" />

          Loading accounts...
        </div>
      ) : accounts.length ? (
        <section className="account-grid">
          {accounts.map(
            (account) => {
              const Icon =
                iconFor(
                  account.type,
                );

              const accountTypeLabel =
                accountTypes.find(
                  ([key]) =>
                    key ===
                    account.type,
                )?.[1] ||
                account.type;

              return (
                <article
                  className={`account-card ${
                    account.is_active
                      ? ''
                      : 'archived'
                  }`}
                  key={account.id}
                >
                  <div className="account-icon">
                    <Icon
                      size={21}
                    />
                  </div>

                  <div className="account-card-head">
                    <div>
                      <h3>
                        {
                          account.name
                        }
                      </h3>

                      <span>
                        {
                          accountTypeLabel
                        }
                      </span>
                    </div>

                    {!account.is_active ? (
                      <span className="muted-badge">
                        Archived
                      </span>
                    ) : null}
                  </div>

                  <strong className="account-balance">
                    {formatMoney(
                      account.current_balance,
                      account.currency ||
                        currency,
                    )}
                  </strong>

                  <div className="account-footer">
                    <span>
                      Opening:{' '}
                      {formatMoney(
                        account.opening_balance,
                        account.currency ||
                          currency,
                      )}{' '}
                      on{' '}
                      {
                        account.opening_date
                      }
                    </span>

                    {account.is_active ? (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          archive(
                            account,
                          )
                        }
                        aria-label={`Archive ${account.name}`}
                      >
                        <Archive
                          size={16}
                        />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            },
          )}
        </section>
      ) : (
        <div className="panel">
          <EmptyState
            title="Create your first account"
            description="Add cash, bank, e-wallet, savings, or another account before recording transactions."
            action={
              <button
                type="button"
                className="button primary"
                onClick={
                  openAccountModal
                }
              >
                Add account
              </button>
            }
          />
        </div>
      )}

      <Modal
        open={open}
        title="Add account"
        eyebrow="Account"
        onClose={
          closeAccountModal
        }
      >
        <form
          className="form-stack modal-standard-form"
          onSubmit={submit}
        >
          <label>
            <span>
              Account name
            </span>

            <input
              required
              autoFocus
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,

                  name:
                    event.target.value,
                })
              }
              placeholder="Example: Main bank"
            />
          </label>

          <label>
            <span>
              Account type
            </span>

            <select
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,

                  type:
                    event.target.value,
                })
              }
            >
              {accountTypes.map(
                ([
                  key,
                  label,
                ]) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="form-grid two">
            <label>
              <span>
                Opening balance
              </span>

              <input
                required
                type="number"
                step="0.01"
                inputMode="decimal"
                value={
                  form.opening_balance
                }
                onChange={(event) =>
                  setForm({
                    ...form,

                    opening_balance:
                      event.target.value,
                  })
                }
                placeholder="0"
              />
            </label>

            <label>
              <span>
                Opening date
              </span>

              <input
                required
                type="date"
                value={
                  form.opening_date
                }
                onChange={(event) =>
                  setForm({
                    ...form,

                    opening_date:
                      event.target.value,
                  })
                }
              />
            </label>
          </div>

          <label>
            <span>
              Currency
            </span>

            <input
              required
              maxLength="3"
              value={form.currency}
              onChange={(event) =>
                setForm({
                  ...form,

                  currency:
                    event.target.value
                      .toUpperCase(),
                })
              }
              placeholder="IDR"
            />

            <small>
              Use a 3-letter currency
              code such as IDR, USD,
              EUR, or SGD.
            </small>
          </label>

          {modalError ? (
            <div className="alert error">
              {modalError}
            </div>
          ) : null}

          <div className="modal-standard-actions">
            <button
              type="button"
              className="button ghost"
              onClick={
                closeAccountModal
              }
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
                ? 'Creating...'
                : 'Create account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}