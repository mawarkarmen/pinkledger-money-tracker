import { useEffect, useState } from 'react';
import { Archive, Plus } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'expense', icon: 'CircleDollarSign' });
  const [error, setError] = useState('');

  async function load() {
    try { setCategories(await api('/categories')); } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault(); setError('');
    try {
      await api('/categories', { method: 'POST', body: JSON.stringify(form) });
      setOpen(false); setForm({ name: '', type: 'expense', icon: 'CircleDollarSign' }); await load();
    } catch (err) { setError(err.message); }
  }

  async function archive(category) {
    if (!window.confirm(`Archive ${category.name}? Existing history will be preserved.`)) return;
    try { await api(`/categories/${category.id}`, { method: 'PUT', body: JSON.stringify({ is_active: false }) }); await load(); } catch (err) { setError(err.message); }
  }

  const renderGroup = (type) => (
    <article className="panel category-panel">
      <div className="panel-heading"><div><span className="eyebrow">{type}</span><h3>{type === 'income' ? 'Income categories' : 'Expense categories'}</h3></div></div>
      <div className="category-list">
        {categories.filter((item) => item.type === type).map((category) => (
          <div className={`category-row ${category.is_active ? '' : 'archived'}`} key={category.id}>
            <div className={`category-mark ${type}`}>{category.name.slice(0, 1).toUpperCase()}</div>
            <div><strong>{category.name}</strong><span>{category.is_active ? 'Active' : 'Archived'}</span></div>
            {category.is_active ? <button className="icon-button" onClick={() => archive(category)} aria-label="Archive category"><Archive size={16} /></button> : null}
          </div>
        ))}
      </div>
    </article>
  );

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar"><div><h2>Categories</h2><p>Keep income and expense labels organized for reporting and budgets.</p></div><button className="button primary" onClick={() => setOpen(true)}><Plus size={18} /> Add category</button></div>
      {error ? <div className="alert error">{error}</div> : null}
      <section className="dashboard-grid">{renderGroup('income')}{renderGroup('expense')}</section>
      <Modal open={open} title="Add category" onClose={() => setOpen(false)}>
        <form className="form-stack" onSubmit={submit}>
          <label><span>Category name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Example: Education" /></label>
          <label><span>Category type</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <div className="form-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Create category</button></div>
        </form>
      </Modal>
    </div>
  );
}
