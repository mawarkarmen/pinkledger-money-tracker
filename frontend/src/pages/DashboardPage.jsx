import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowDownRight,
  ArrowUpRight,
  HandCoins,
  Landmark,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';

import { api } from '../lib/api';

import {
  currentMonth,
  formatDate,
  formatMoney,
} from '../lib/format';

import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';


export default function DashboardPage() {
  const [
    month,
    setMonth,
  ] = useState(
    currentMonth(),
  );


  const [
    data,
    setData,
  ] = useState(null);


  const [
    currency,
    setCurrency,
  ] = useState('IDR');


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState('');


  /*
   * ==========================================================
   * LOAD DASHBOARD
   * ==========================================================
   */
  async function load() {
    setLoading(true);

    setError('');


    try {
      const [
        dashboard,
        profile,
      ] =
        await Promise.all([
          api(
            `/dashboard?month=${month}`,
          ),

          api(
            '/profile',
          ),
        ]);


      setData(
        dashboard || {},
      );


      setCurrency(
        profile?.currency ||
          'IDR',
      );
    } catch (err) {
      console.error(
        'Dashboard load error:',
        err,
      );


      setError(
        err.message ||
          'Unable to load the dashboard.',
      );
    } finally {
      setLoading(false);
    }
  }


  /*
   * Reload whenever the selected
   * month changes.
   */
  useEffect(
    () => {
      load();
    },
    [month],
  );


  /*
   * ==========================================================
   * SAFE API NORMALIZATION
   * ==========================================================
   */
  const budgetStatus = {
    total:
      Number(
        data
          ?.budget_status
          ?.total ??
          0,
      ),

    spent:
      Number(
        data
          ?.budget_status
          ?.spent ??
          0,
      ),

    remaining:
      Number(
        data
          ?.budget_status
          ?.remaining ??
          0,
      ),

    percentage:
      Number(
        data
          ?.budget_status
          ?.percentage ??
          0,
      ),
  };


  const categorySpending =
    Array.isArray(
      data
        ?.category_spending,
    )
      ? data.category_spending
      : [];


  const recentTransactions =
    Array.isArray(
      data
        ?.recent_transactions,
    )
      ? data.recent_transactions
      : [];


  /*
   * Used to normalize category spending bars.
   */
  const maxSpend =
    useMemo(
      () =>
        Math.max(
          1,

          ...categorySpending.map(
            (item) =>
              Number(
                item.amount ||
                  0,
              ),
          ),
        ),

      [categorySpending],
    );


  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */
  if (loading) {
    return (
      <div className="panel loading-panel">
        <div className="loader" />

        Loading monthly summary...
      </div>
    );
  }


  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */
  if (error) {
    return (
      <div className="alert error">
        {error}
      </div>
    );
  }


  if (!data) {
    return (
      <div className="alert error">
        Dashboard data is unavailable.
      </div>
    );
  }


  /*
   * ==========================================================
   * NORMALIZED VALUES
   * ==========================================================
   */
  const budgetPercentage =
    Math.max(
      0,
      budgetStatus.percentage,
    );


  const openingBalance =
    Number(
      data.opening_balance ??
        0,
    );


  const currentBalance =
    Number(
      data.current_balance ??
        0,
    );


  const totalIncome =
    Number(
      data.total_income ??
        0,
    );


  const totalExpenses =
    Number(
      data.total_expenses ??
        0,
    );


  const netCashFlow =
    Number(
      data.net_cash_flow ??
        0,
    );


  const outstandingReimbursements =
    Number(
      data
        .outstanding_reimbursements ??
        0,
    );


  const balanceLabel =
    data.balance_label ||
    'Current Balance';



  return (
    <div className="page-stack animate-in">

      <div className="page-toolbar">

        <div>
          <h2>
            Monthly overview
          </h2>

          <p>
            Monitor balances,
            personal cash flow,
            spending performance,
            and money awaiting
            reimbursement.
          </p>
        </div>


        <label className="compact-field">

          <span>
            Month
          </span>

          <input
            type="month"
            value={month}
            onChange={
              (event) =>
                setMonth(
                  event
                    .target
                    .value,
                )
            }
          />

        </label>

      </div>


      <section className="stats-grid">

        <StatCard
          label="Opening Balance"
          value={
            formatMoney(
              openingBalance,
              currency,
            )
          }
          icon={Landmark}
        />


        <StatCard
          label={balanceLabel}
          value={
            formatMoney(
              currentBalance,
              currency,
            )
          }
          icon={PiggyBank}
          tone="blue"
        />


        <StatCard
          label="Total Income"
          value={
            formatMoney(
              totalIncome,
              currency,
            )
          }
          icon={ArrowUpRight}
          tone="green"
        />


        <StatCard
          label="Total Expenses"
          value={
            formatMoney(
              totalExpenses,
              currency,
            )
          }
          icon={ArrowDownRight}
          tone="red"
        />


        <StatCard
          label="Net Cash Flow"
          value={
            formatMoney(
              netCashFlow,
              currency,
            )
          }
          icon={TrendingUp}
          tone={
            netCashFlow >= 0
              ? 'green'
              : 'red'
          }
        />


        <StatCard
          label="Outstanding Reimbursements"
          value={
            formatMoney(
              outstandingReimbursements,
              currency,
            )
          }
          icon={HandCoins}
          tone="blue"
        />

      </section>


      <section className="dashboard-grid">

        <article className="panel budget-panel">

          <div className="panel-heading">

            <div>
              <span className="eyebrow">
                Budget status
              </span>

              <h3>
                Monthly spending limit
              </h3>
            </div>


            <strong>
              {Math.round(
                budgetPercentage,
              )}
              %
            </strong>

          </div>


          {budgetStatus.total > 0 ? (
            <>

              <div className="big-progress">

                <span
                  style={{
                    width:
                      `${Math.min(
                        100,
                        budgetPercentage,
                      )}%`,
                  }}
                />

              </div>


              <div className="budget-numbers">

                <div>
                  <span>
                    Spent
                  </span>

                  <strong>
                    {formatMoney(
                      budgetStatus.spent,
                      currency,
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Budget
                  </span>

                  <strong>
                    {formatMoney(
                      budgetStatus.total,
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
                      budgetStatus.remaining,
                      currency,
                    )}
                  </strong>
                </div>

              </div>

            </>
          ) : (
            <EmptyState
              title="No budget yet"
              description="Set category budgets to measure spending against a monthly plan."
            />
          )}

        </article>


        <article className="panel">

          <div className="panel-heading">

            <div>
              <span className="eyebrow">
                Spending
              </span>

              <h3>
                Expenses by category
              </h3>
            </div>

          </div>


          {categorySpending.length ? (
            <div className="bar-list">

              {categorySpending
                .slice(
                  0,
                  6,
                )
                .map(
                  (item) => (
                    <div
                      className="bar-row"
                      key={
                        item.name
                      }
                    >

                      <div className="bar-label">

                        <span>
                          {
                            item.name
                          }
                        </span>


                        <strong>
                          {formatMoney(
                            Number(
                              item.amount ||
                                0,
                            ),
                            currency,
                          )}
                        </strong>

                      </div>


                      <div className="bar-track">

                        <span
                          style={{
                            width:
                              `${(
                                Number(
                                  item.amount ||
                                    0,
                                ) /
                                maxSpend
                              ) * 100}%`,
                          }}
                        />

                      </div>

                    </div>
                  ),
                )}

            </div>
          ) : (
            <EmptyState
              title="No expense activity"
              description="Personal expense categories will appear here after transactions are recorded."
            />
          )}

        </article>

      </section>


      <section className="panel">

        <div className="panel-heading">

          <div>
            <span className="eyebrow">
              Activity
            </span>

            <h3>
              Recent transactions
            </h3>
          </div>

        </div>


        {recentTransactions.length ? (
          <div className="transaction-list compact-list">

            {recentTransactions.map(
              (tx) => {

                /*
                 * ==================================================
                 * REIMBURSEMENT RECEIPT DETECTION
                 * ==================================================
                 *
                 * IMPORTANT FIX:
                 *
                 * OLD:
                 *
                 * tx.reimburses_transaction_id
                 *
                 * NEW:
                 *
                 * tx.reimbursement_claim_id
                 *
                 *
                 * Every reimbursement receipt created by the new
                 * reimbursement system references the specific
                 * reimbursement_claim_id.
                 *
                 * Therefore this is the authoritative field used
                 * to identify reimbursement income.
                 */
                const isReimbursementReceipt =
                  Boolean(
                    tx
                      .reimbursement_claim_id,
                  );


                /*
                 * Default transaction detail.
                 */
                let detail =
                  tx.category
                    ?.name ||
                  (
                    tx.type ===
                    'transfer'
                      ? 'Transfer'
                      : tx.type ===
                          'income'
                        ? 'Income'
                        : 'Expense'
                  );


                /*
                 * ==================================================
                 * REIMBURSEMENT RECEIPT
                 * ==================================================
                 *
                 * Do not display it as:
                 *
                 * Transfer
                 * Income
                 * Uncategorized
                 *
                 * It is explicitly a reimbursement.
                 */
                if (
                  isReimbursementReceipt
                ) {

                  detail =
                    'Reimbursement';

                } else if (
                  tx
                    .is_reimbursable
                ) {

                  /*
                   * =================================================
                   * REIMBURSABLE EXPENSE
                   * =================================================
                   */
                  const reimbursementLabel =
                    tx
                      .reimbursement_status ===
                    'reimbursed'
                      ? 'Reimbursed'
                      : 'Awaiting reimbursement';


                  detail =
                    `${detail} · ${reimbursementLabel}`;
                }


                /*
                 * ==================================================
                 * MONEY SIGN
                 * ==================================================
                 *
                 * Reimbursement receipts are income-side account
                 * movements, so they display a positive sign.
                 */
                const amountPrefix =
                  tx.type ===
                  'expense'
                    ? '-'
                    : tx.type ===
                        'income'
                      ? '+'
                      : '';


                return (
                  <div
                    className="transaction-row"
                    key={tx.id}
                  >

                    <div
                      className={`transaction-dot ${
                        isReimbursementReceipt
                          ? 'income'
                          : tx.type
                      }`}
                    />


                    <div className="transaction-main">

                      <strong>
                        {
                          tx.description
                        }
                      </strong>


                      <span>
                        {formatDate(
                          tx.date,
                        )}

                        {' · '}

                        {detail}
                      </span>

                    </div>


                    <strong
                      className={`money-value ${
                        isReimbursementReceipt
                          ? 'income'
                          : tx.type
                      }`}
                    >

                      {amountPrefix}


                      {formatMoney(
                        Number(
                          tx.amount ||
                            0,
                        ),
                        currency,
                      )}

                    </strong>

                  </div>
                );
              },
            )}

          </div>
        ) : (
          <EmptyState
            title="Nothing recorded this month"
            description="Add your first transaction to start building the monthly summary."
          />
        )}

      </section>

    </div>
  );
}