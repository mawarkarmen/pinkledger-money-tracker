import { useEffect, useState } from 'react';
import { Archive, CreditCard, Landmark, Plus, Smartphone, WalletCards } from 'lucide-react';
import { api } from '../lib/api';
import { formatMoney, todayInput } from '../lib/format';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const accountTypes = [
  ['cash', 'Cash'], ['bank', 'Bank account'], ['ewallet', 'E-wallet'], ['savings', 'Savings'], ['credit_card', 'Credit card'], ['other', 'Other'],
];

const iconFor = (type) => type === 'bank' || type === 'savings' ? Landmark : type === 'ewallet' ? Smartphone : type === 'credit_card' ? CreditCard : WalletCards;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [currency, setCurrency] = useState('IDR');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'bank', opening_balance: 0, opening_date: todayInput(), currency: 'IDR' });

  async function load() {
    try {
      const [data, profile] = await Promise.all([api('/accounts'), api('/profile')]);
      setAccounts(data);
      setCurrency(profile.currency || 'IDR');
      setForm((current) => ({ ...current, currency: profile.currency || 'IDR' }));
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      await api('/accounts', { method: 'POST', body: JSON.stringify({ ...form, opening_balance: Number(form.opening_balance) }) });
      setOpen(false);
      setForm({ name: '', type: 'bank', opening_balance: 0, opening_date: todayInput(), currency });
      await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function archive(account) {
    if (!window.confirm(`Archive ${account.name}? Historical transactions will be kept.`)) return;
    try {
      await api(`/accounts/${account.id}`, { method: 'PUT', body: JSON.stringify({ is_active: false }) });
      await load();
    } catch (err) { setError(err.message); }
  }

  const active = accounts.filter((item) => item.is_active !== false);
  const total = active.reduce((sum, item) => sum + Number(item.current_balance || 0), 0);

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div><h2>Your accounts</h2><p>Balances are calculated from each opening balance and transaction history.</p></div>
        <button className="button primary" onClick={() => setOpen(true)}><Plus size={18} /> Add account</button>
      </div>

      <article className="balance-hero"><span>Total active balance</span><strong>{formatMoney(total, currency)}</strong><small>{active.length} active account{active.length === 1 ? '' : 's'}</small></article>
      {error ? <div className="alert error">{error}</div> : null}

      {accounts.length ? (
        <section className="account-grid">
          {accounts.map((account) => {
            const Icon = iconFor(account.type);
            return (
              <article className={`account-card ${account.is_active ? '' : 'archived'}`} key={account.id}>
                <div className="account-icon"><Icon size={21} /></div>
                <div className="account-card-head"><div><h3>{account.name}</h3><span>{accountTypes.find(([key]) => key === account.type)?.[1] || account.type}</span></div>{!account.is_active ? <span className="muted-badge">Archived</span> : null}</div>
                <strong className="account-balance">{formatMoney(account.current_balance, account.currency || currency)}</strong>
                <div className="account-footer"><span>Opening: {formatMoney(account.opening_balance, account.currency || currency)} on {account.opening_date}</span>{account.is_active ? <button className="icon-button" onClick={() => archive(account)} aria-label="Archive"><Archive size={16} /></button> : null}</div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="panel"><EmptyState title="Create your first account" description="Add cash, bank, e-wallet, savings, or another account before recording transactions." action={<button className="button primary" onClick={() => setOpen(true)}>Add account</button>} /></div>
      )}

      <Modal open={open} title="Add account" onClose={() => setOpen(false)}>
        <form className="form-stack" onSubmit={submit}>
          <label><span>Account name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Example: Main bank" /></label>
          <label><span>Account type</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{accountTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span>Opening balance</span><input required type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></label>
          <label><span>Opening date</span><input required type="date" value={form.opening_date} onChange={(e) => setForm({ ...form, opening_date: e.target.value })} /></label>
          <label><span>Currency</span><input required maxLength="3" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label>
          {error ? <div className="alert error">{error}</div> : null}
          <div className="form-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Create account'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
