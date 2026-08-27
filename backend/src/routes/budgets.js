import { Router } from 'express';
import { budgetSchema } from '../utils/validation.js';
import { parseMonth } from '../utils/dates.js';
import { asNumber } from '../utils/money.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, next: nextMonth } = parseMonth(month);

    const { data: budgets, error } = await req.supabase
      .from('budgets')
      .select('*, category:categories(id,name,icon,type)')
      .eq('month', start)
      .order('created_at');
    if (error) throw error;

    const { data: expenses, error: expenseError } = await req.supabase
      .from('transactions')
      .select('amount, category_id')
      .eq('type', 'expense')
      .gte('date', start)
      .lt('date', nextMonth);
    if (expenseError) throw expenseError;

    const spentByCategory = new Map();
    for (const tx of expenses || []) {
      spentByCategory.set(
        tx.category_id,
        (spentByCategory.get(tx.category_id) || 0) + asNumber(tx.amount),
      );
    }

    const result = (budgets || []).map((budget) => {
      const spent = spentByCategory.get(budget.category_id) || 0;
      const amount = asNumber(budget.amount);
      return {
        ...budget,
        spent,
        remaining: amount - spent,
        percentage: amount > 0 ? (spent / amount) * 100 : 0,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = budgetSchema.parse(req.body);
    const monthDate = `${input.month}-01`;
    const { data, error } = await req.supabase
      .from('budgets')
      .upsert(
        {
          user_id: req.user.id,
          month: monthDate,
          category_id: input.category_id,
          amount: input.amount,
        },
        { onConflict: 'user_id,month,category_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await req.supabase.from('budgets').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
