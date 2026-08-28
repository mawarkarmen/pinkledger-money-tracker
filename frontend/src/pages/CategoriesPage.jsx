import {
  useEffect,
  useState,
} from 'react';

import {
  Archive,
  Plus,
} from 'lucide-react';

import { api } from '../lib/api';

import Modal from '../components/Modal';

const initialForm = {
  name: '',
  type: 'expense',
  icon: 'CircleDollarSign',
};

export default function CategoriesPage() {
  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(initialForm);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState('');

  const [
    modalError,
    setModalError,
  ] = useState('');

  async function load() {
    setLoading(true);
    setPageError('');

    try {
      const data =
        await api('/categories');

      setCategories(data);
    } catch (err) {
      setPageError(
        err.message ||
          'Unable to load categories.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCategoryModal() {
    setModalError('');

    setForm(initialForm);

    setOpen(true);
  }

  function closeCategoryModal() {
    if (saving) {
      return;
    }

    setOpen(false);

    setForm(initialForm);

    setModalError('');
  }

  async function submit(event) {
    event.preventDefault();

    const name =
      form.name.trim();

    if (!name) {
      setModalError(
        'Category name is required.',
      );

      return;
    }

    setSaving(true);
    setModalError('');

    try {
      await api('/categories', {
        method: 'POST',

        body: JSON.stringify({
          name,

          type:
            form.type,

          icon:
            form.icon,
        }),
      });

      setOpen(false);

      setForm(initialForm);

      await load();
    } catch (err) {
      setModalError(
        err.message ||
          'Unable to create category.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(category) {
    const confirmed =
      window.confirm(
        `Archive ${category.name}? Existing transaction history will be preserved.`,
      );

    if (!confirmed) {
      return;
    }

    setPageError('');

    try {
      await api(
        `/categories/${category.id}`,
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
          'Unable to archive category.',
      );
    }
  }

  function renderGroup(type) {
    const items =
      categories.filter(
        (item) =>
          item.type === type,
      );

    const title =
      type === 'income'
        ? 'Income categories'
        : 'Expense categories';

    return (
      <article className="panel category-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              {type}
            </span>

            <h3>
              {title}
            </h3>
          </div>
        </div>

        <div className="category-list">
          {items.length ? (
            items.map(
              (category) => (
                <div
                  className={`category-row ${
                    category.is_active
                      ? ''
                      : 'archived'
                  }`}
                  key={category.id}
                >
                  <div
                    className={`category-mark ${type}`}
                  >
                    {category.name
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>
                      {category.name}
                    </strong>

                    <span>
                      {category.is_active
                        ? 'Active'
                        : 'Archived'}
                    </span>
                  </div>

                  {category.is_active ? (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        archive(
                          category,
                        )
                      }
                      aria-label={`Archive ${category.name}`}
                    >
                      <Archive
                        size={16}
                      />
                    </button>
                  ) : null}
                </div>
              ),
            )
          ) : (
            <div className="empty-inline">
              No {type} categories yet.
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div>
          <h2>
            Categories
          </h2>

          <p>
            Keep income and expense
            labels organized for
            reporting and budgets.
          </p>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={
            openCategoryModal
          }
        >
          <Plus size={18} />
          Add category
        </button>
      </div>

      {pageError ? (
        <div className="alert error">
          {pageError}
        </div>
      ) : null}

      {loading ? (
        <div className="loading-panel">
          <div className="loader" />

          Loading categories...
        </div>
      ) : (
        <section className="dashboard-grid">
          {renderGroup('income')}

          {renderGroup('expense')}
        </section>
      )}

      <Modal
        open={open}
        title="Add category"
        eyebrow="Category"
        onClose={
          closeCategoryModal
        }
      >
        <form
          className="form-stack modal-standard-form"
          onSubmit={submit}
        >
          <label>
            <span>
              Category name
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
              placeholder="Example: Education"
            />
          </label>

          <label>
            <span>
              Category type
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
              <option value="expense">
                Expense
              </option>

              <option value="income">
                Income
              </option>
            </select>
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
                closeCategoryModal
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
                : 'Create category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}