import { Router } from 'express';
import { accountSchema, accountUpdateSchema } from '../utils/validation.js';
import { accountEffect, asNumber } from '../utils/money.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { data: accounts, error } = await req.supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const { data: transactions, error: txError } = await req.supabase
      .from('transactions')
      .select('type, amount, source_account_id, destination_account_id, date')
      .lte('date', new Date().toISOString().slice(0, 10));
    if (txError) throw txError;

    const today = new Date().toISOString().slice(0, 10);
    const result = (accounts || []).map((account) => ({
      ...account,
      current_balance:
        (account.opening_date <= today ? asNumber(account.opening_balance) : 0) +
        (transactions || []).reduce((sum, tx) => sum + accountEffect(tx, account.id), 0),
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = accountSchema.parse(req.body);
    const { data, error } = await req.supabase
      .from('accounts')
      .insert({ ...input, user_id: req.user.id })
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
    const payload = accountUpdateSchema.parse(req.body);

    const { data, error } = await req.supabase
      .from('accounts')
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

export default router;
