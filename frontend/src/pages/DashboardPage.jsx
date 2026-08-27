import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { currentMonth, formatDate, formatMoney } from '../lib/format';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [currency, setCurrency] = useState('IDR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashboard, profile] = await Promise.all([
        api(`/dashboard?month=${month}`),
        api('/profile'),
      ]);
      setData(dashboard);
      setCurrency(profile.currency || 'IDR');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [month]);

  const maxSpend = useMemo(
    () => Math.max(1, ...(data?.category_spending || []).map((item) => Number(item.amount))),
    [data],
  );

  if (loading) return <div className="panel loading-panel"><div className="loader" />Loading monthly summary…</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!data) return null;

  const budgetPercentage = Math.max(0, Number(data.budget_status.percentage || 0));

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div>
          <h2>Monthly overview</h2>
          <p>Monitor balances, cash flow, and spending performance.</p>
        </div>
        <label className="compact-field">
          <span>Month</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      <section className="stats-grid">
        <StatCard label="Opening Balance" value={formatMoney(data.opening_balance, currency)} icon={Landmark} />
        <StatCard label={data.balance_label} value={formatMoney(data.current_balance, currency)} icon={PiggyBank} tone="blue" />
        <StatCard label="Total Income" value={formatMoney(data.total_income, currency)} icon={ArrowUpRight} tone="green" />
        <StatCard label="Total Expenses" value={formatMoney(data.total_expenses, currency)} icon={ArrowDownRight} tone="red" />
        <StatCard label="Net Cash Flow" value={formatMoney(data.net_cash_flow, currency)} icon={TrendingUp} tone={data.net_cash_flow >= 0 ? 'green' : 'red'} />
      </section>

      <section className="dashboard-grid">
        <article className="panel budget-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Budget status</span><h3>Monthly spending limit</h3></div>
            <strong>{Math.round(budgetPercentage)}%</strong>
          </div>
          {Number(data.budget_status.total) > 0 ? (
            <>
              <div className="big-progress"><span style={{ width: `${Math.min(100, budgetPercentage)}%` }} /></div>
              <div className="budget-numbers">
                <div><span>Spent</span><strong>{formatMoney(data.budget_status.spent, currency)}</strong></div>
                <div><span>Budget</span><strong>{formatMoney(data.budget_status.total, currency)}</strong></div>
                <div><span>Remaining</span><strong>{formatMoney(data.budget_status.remaining, currency)}</strong></div>
              </div>
              {budgetPercentage >= 100 ? <div className="alert warning">Your expenses have reached or exceeded the current monthly budget.</div> : null}
            </>
          ) : (
            <EmptyState title="No budget yet" description="Set category budgets to measure spending against a monthly plan." />
          )}
        </article>

        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Spending</span><h3>Expenses by category</h3></div></div>
          {data.category_spending.length ? (
            <div className="bar-list">
              {data.category_spending.slice(0, 6).map((item) => (
                <div className="bar-row" key={item.name}>
                  <div className="bar-label"><span>{item.name}</span><strong>{formatMoney(item.amount, currency)}</strong></div>
                  <div className="bar-track"><span style={{ width: `${(Number(item.amount) / maxSpend) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No expense activity" description="Expense categories will appear here after transactions are recorded." />
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Activity</span><h3>Recent transactions</h3></div></div>
        {data.recent_transactions.length ? (
          <div className="transaction-list compact-list">
            {data.recent_transactions.map((tx) => (
              <div className="transaction-row" key={tx.id}>
                <div className={`transaction-dot ${tx.type}`} />
                <div className="transaction-main"><strong>{tx.description}</strong><span>{formatDate(tx.date)} · {tx.category?.name || 'Transfer'}</span></div>
                <strong className={`money-value ${tx.type}`}>{tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{formatMoney(tx.amount, currency)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing recorded this month" description="Add your first transaction to start building the monthly summary." />
        )}
      </section>
    </div>
  );
}
