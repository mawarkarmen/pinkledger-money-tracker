import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { currentMonth, formatMoney } from '../lib/format';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

function statusFor(percent) {
  if (percent >= 100) return ['Over budget', 'danger'];
  if (percent >= 90) return ['Near limit', 'warning'];
  if (percent >= 70) return ['Approaching limit', 'watch'];
  return ['On track', 'good'];
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currency, setCurrency] = useState('IDR');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [budgetData, categoryData, profile] = await Promise.all([
        api(`/budgets?month=${month}`), api('/categories'), api('/profile'),
      ]);
      setBudgets(budgetData);
      setCategories(categoryData.filter((item) => item.type === 'expense' && item.is_active !== false));
      setCurrency(profile.currency || 'IDR');
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, [month]);

  const totals = useMemo(() => budgets.reduce((result, item) => ({
    budget: result.budget + Number(item.amount || 0), spent: result.spent + Number(item.spent || 0),
  }), { budget: 0, spent: 0 }), [budgets]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api('/budgets', { method: 'POST', body: JSON.stringify({ month, category_id: form.category_id, amount: Number(form.amount) }) });
      setOpen(false); setForm({ category_id: '', amount: '' }); await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function remove(id) {
    if (!window.confirm('Remove this category budget?')) return;
    try { await api(`/budgets/${id}`, { method: 'DELETE' }); await load(); } catch (err) { setError(err.message); }
  }

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div><h2>Monthly budgets</h2><p>Set category limits and compare them with actual expenses.</p></div>
        <div className="toolbar-actions"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><button className="button primary" onClick={() => setOpen(true)}><Plus size={18} /> Add budget</button></div>
      </div>

      <section className="budget-summary-strip">
        <div><span>Total budget</span><strong>{formatMoney(totals.budget, currency)}</strong></div>
        <div><span>Spent</span><strong>{formatMoney(totals.spent, currency)}</strong></div>
        <div><span>Remaining</span><strong>{formatMoney(totals.budget - totals.spent, currency)}</strong></div>
      </section>
      {error ? <div className="alert error">{error}</div> : null}

      {budgets.length ? (
        <section className="budget-card-grid">
          {budgets.map((budget) => {
            const [label, tone] = statusFor(Number(budget.percentage));
            return (
              <article className="budget-card" key={budget.id}>
                <div className="budget-card-header"><div><span className={`status-dot ${tone}`} /><h3>{budget.category?.name || 'Category'}</h3></div><button className="icon-button danger" onClick={() => remove(budget.id)} aria-label="Delete budget"><Trash2 size={16} /></button></div>
                <div className="budget-amounts"><strong>{formatMoney(budget.spent, currency)}</strong><span>of {formatMoney(budget.amount, currency)}</span></div>
                <div className={`progress ${tone}`}><span style={{ width: `${Math.min(100, Number(budget.percentage))}%` }} /></div>
                <div className="budget-card-footer"><span className={`status-badge ${tone}`}>{label}</span><strong>{Math.round(Number(budget.percentage))}%</strong></div>
              </article>
            );
          })}
        </section>
      ) : <div className="panel"><EmptyState title="No budgets for this month" description="Add spending limits for one or more expense categories." action={<button className="button primary" onClick={() => setOpen(true)}>Add budget</button>} /></div>}

      <Modal open={open} title="Set monthly budget" onClose={() => setOpen(false)}>
        <form className="form-stack" onSubmit={submit}>
          <label><span>Month</span><input type="month" value={month} disabled /></label>
          <label><span>Expense category</span><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span>Budget amount</span><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></label>
          {error ? <div className="alert error">{error}</div> : null}
          <div className="form-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save budget'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
