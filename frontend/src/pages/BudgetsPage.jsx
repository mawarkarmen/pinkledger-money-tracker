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
  currentMonth,
  formatMoney,
} from '../lib/format';

import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

function statusFor(percent) {
  if (percent >= 100) {
    return [
      'Over budget',
      'danger',
    ];
  }

  if (percent >= 90) {
    return [
      'Near limit',
      'warning',
    ];
  }

  if (percent >= 70) {
    return [
      'Approaching limit',
      'watch',
    ];
  }

  return [
    'On track',
    'good',
  ];
}

export default function BudgetsPage() {
  const [month, setMonth] =
    useState(currentMonth());

  const [budgets, setBudgets] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [currency, setCurrency] =
    useState('IDR');

  const [open, setOpen] =
    useState(false);

  const [form, setForm] =
    useState({
      category_id: '',
      amount: '',
    });

  const [error, setError] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  async function load() {
    setError('');

    try {
      const [
        budgetData,
        categoryData,
        profile,
      ] = await Promise.all([
        api(
          `/budgets?month=${month}`,
        ),

        api('/categories'),

        api('/profile'),
      ]);

      setBudgets(
        budgetData,
      );

      setCategories(
        categoryData.filter(
          (item) =>
            item.type ===
              'expense' &&
            item.is_active !==
              false,
        ),
      );

      setCurrency(
        profile.currency ||
          'IDR',
      );
    } catch (err) {
      setError(
        err.message ||
          'Unable to load budgets.',
      );
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  const totals =
    useMemo(() => {
      return budgets.reduce(
        (result, item) => ({
          budget:
            result.budget +
            Number(
              item.amount || 0,
            ),

          spent:
            result.spent +
            Number(
              item.spent || 0,
            ),
        }),

        {
          budget: 0,
          spent: 0,
        },
      );
    }, [budgets]);

  function openBudgetModal() {
    setError('');

    setForm({
      category_id: '',
      amount: '',
    });

    setOpen(true);
  }

  function closeBudgetModal() {
    if (saving) {
      return;
    }

    setOpen(false);

    setForm({
      category_id: '',
      amount: '',
    });

    setError('');
  }

  async function submit(event) {
    event.preventDefault();

    const amount =
      Number(form.amount);

    if (
      !form.category_id
    ) {
      setError(
        'Please select an expense category.',
      );

      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        'Budget amount must be greater than zero.',
      );

      return;
    }

    setSaving(true);
    setError('');

    try {
      await api('/budgets', {
        method: 'POST',

        body: JSON.stringify({
          month,

          category_id:
            form.category_id,

          amount,
        }),
      });

      setOpen(false);

      setForm({
        category_id: '',
        amount: '',
      });

      await load();
    } catch (err) {
      setError(
        err.message ||
          'Unable to save the budget.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    const confirmed =
      window.confirm(
        'Remove this category budget?',
      );

    if (!confirmed) {
      return;
    }

    try {
      await api(
        `/budgets/${id}`,
        {
          method: 'DELETE',
        },
      );

      await load();
    } catch (err) {
      setError(
        err.message ||
          'Unable to remove the budget.',
      );
    }
  }

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div>
          <h2>
            Monthly budgets
          </h2>

          <p>
            Set category limits and
            compare them with actual
            expenses.
          </p>
        </div>

        <div className="toolbar-actions">
          <input
            type="month"
            value={month}
            onChange={(event) =>
              setMonth(
                event.target.value,
              )
            }
          />

          <button
            type="button"
            className="button primary"
            onClick={
              openBudgetModal
            }
          >
            <Plus size={18} />
            Add budget
          </button>
        </div>
      </div>

      <section className="budget-summary-strip">
        <div>
          <span>
            Total budget
          </span>

          <strong>
            {formatMoney(
              totals.budget,
              currency,
            )}
          </strong>
        </div>

        <div>
          <span>
            Spent
          </span>

          <strong>
            {formatMoney(
              totals.spent,
              currency,
            )}
          </strong>
        </div>

        <div>
          <span>
            Remaining
          </span>

          <strong>
            {formatMoney(
              totals.budget -
                totals.spent,
              currency,
            )}
          </strong>
        </div>
      </section>

      {!open && error ? (
        <div className="alert error">
          {error}
        </div>
      ) : null}

      {budgets.length ? (
        <section className="budget-card-grid">
          {budgets.map(
            (budget) => {
              const [
                label,
                tone,
              ] = statusFor(
                Number(
                  budget.percentage,
                ),
              );

              return (
                <article
                  className="budget-card"
                  key={budget.id}
                >
                  <div className="budget-card-header">
                    <div>
                      <span
                        className={`status-dot ${tone}`}
                      />

                      <h3>
                        {budget
                          .category
                          ?.name ||
                          'Category'}
                      </h3>
                    </div>

                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() =>
                        remove(
                          budget.id,
                        )
                      }
                      aria-label="Delete budget"
                    >
                      <Trash2
                        size={16}
                      />
                    </button>
                  </div>

                  <div className="budget-amounts">
                    <strong>
                      {formatMoney(
                        budget.spent,
                        currency,
                      )}
                    </strong>

                    <span>
                      of{' '}
                      {formatMoney(
                        budget.amount,
                        currency,
                      )}
                    </span>
                  </div>

                  <div
                    className={`progress ${tone}`}
                  >
                    <span
                      style={{
                        width:
                          `${Math.min(
                            100,

                            Number(
                              budget.percentage,
                            ),
                          )}%`,
                      }}
                    />
                  </div>

                  <div className="budget-card-footer">
                    <span
                      className={`status-badge ${tone}`}
                    >
                      {label}
                    </span>

                    <strong>
                      {Math.round(
                        Number(
                          budget.percentage,
                        ),
                      )}
                      %
                    </strong>
                  </div>
                </article>
              );
            },
          )}
        </section>
      ) : (
        <div className="panel">
          <EmptyState
            title="No budgets for this month"
            description="Add spending limits for one or more expense categories."
            action={
              <button
                type="button"
                className="button primary"
                onClick={
                  openBudgetModal
                }
              >
                Add budget
              </button>
            }
          />
        </div>
      )}

      <Modal
        open={open}
        title="Set monthly budget"
        eyebrow="Budget"
        onClose={
          closeBudgetModal
        }
      >
        <form
          className="form-stack modal-standard-form"
          onSubmit={submit}
        >
          <label>
            <span>
              Month
            </span>

            <input
              type="month"
              value={month}
              disabled
            />
          </label>

          <label>
            <span>
              Expense category
            </span>

            <select
              required
              value={
                form.category_id
              }
              onChange={(event) =>
                setForm({
                  ...form,

                  category_id:
                    event.target.value,
                })
              }
            >
              <option value="">
                Select category
              </option>

              {categories.map(
                (category) => (
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
              Budget amount
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
              onChange={(event) =>
                setForm({
                  ...form,

                  amount:
                    event.target.value,
                })
              }
              placeholder="0"
            />
          </label>

          {error ? (
            <div className="alert error">
              {error}
            </div>
          ) : null}

          <div className="modal-standard-actions">
            <button
              type="button"
              className="button ghost"
              onClick={
                closeBudgetModal
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
                ? 'Saving...'
                : 'Save budget'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}