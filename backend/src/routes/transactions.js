import { Router } from 'express';
import { transactionSchema } from '../utils/validation.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { month, type, category, account, q } = req.query;
    let query = req.supabase
      .from('transactions')
      .select(`
        *,
        category:categories(id,name,type,icon),
        source_account:accounts!transactions_source_account_id_fkey(id,name),
        destination_account:accounts!transactions_destination_account_id_fkey(id,name)
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNumber] = month.split('-').map(Number);
      const start = `${month}-01`;
      const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
      query = query.gte('date', start).lt('date', next);
    }
    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category_id', category);
    if (account) {
      query = query.or(`source_account_id.eq.${account},destination_account_id.eq.${account}`);
    }
    if (q) query = query.ilike('description', `%${String(q).slice(0, 80)}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = transactionSchema.parse(req.body);
    const payload = {
      ...input,
      user_id: req.user.id,
      category_id: input.type === 'transfer' ? null : input.category_id || null,
      source_account_id: input.type === 'income' ? null : input.source_account_id || null,
      destination_account_id: input.type === 'expense' ? null : input.destination_account_id || null,
    };

    const { data, error } = await req.supabase
      .from('transactions')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const input = transactionSchema.parse(req.body);
    const payload = {
      ...input,
      category_id: input.type === 'transfer' ? null : input.category_id || null,
      source_account_id: input.type === 'income' ? null : input.source_account_id || null,
      destination_account_id: input.type === 'expense' ? null : input.destination_account_id || null,
    };

    const { data, error } = await req.supabase
      .from('transactions')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await req.supabase
      .from('transactions')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
