import { Router } from 'express';
import { parseMonth } from '../utils/dates.js';
import { asNumber, transactionTotalEffect } from '../utils/money.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const { start, next: nextMonth, end } = parseMonth(month);
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const balanceThrough = month === currentMonth ? today : end;

    const [{ data: accounts, error: accountError }, { data: transactions, error: txError }] =
      await Promise.all([
        req.supabase.from('accounts').select('opening_balance, opening_date'),
        req.supabase
          .from('transactions')
          .select('id,type,date,description,amount,category_id,source_account_id,destination_account_id,created_at,category:categories(name,icon)')
          .lte('date', balanceThrough)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

    if (accountError) throw accountError;
    if (txError) throw txError;

    const openingBalanceBase = (accounts || []).reduce(
      (sum, account) => sum + (account.opening_date <= start ? asNumber(account.opening_balance) : 0),
      0,
    );
    const currentBalanceBase = (accounts || []).reduce(
      (sum, account) => sum + (account.opening_date <= balanceThrough ? asNumber(account.opening_balance) : 0),
      0,
    );

    let openingBalance = openingBalanceBase;
    let currentBalance = currentBalanceBase;
    let totalIncome = 0;
    let totalExpenses = 0;
    const categorySpend = new Map();
    const categorySpendById = new Map();

    for (const tx of transactions || []) {
      const effect = transactionTotalEffect(tx);
      currentBalance += effect;

      if (tx.date < start) {
        openingBalance += effect;
      } else if (tx.date < nextMonth) {
        if (tx.type === 'income') totalIncome += asNumber(tx.amount);
        if (tx.type === 'expense') {
          const amount = asNumber(tx.amount);
          totalExpenses += amount;
          const name = tx.category?.name || 'Uncategorized';
          categorySpend.set(name, (categorySpend.get(name) || 0) + amount);
          if (tx.category_id) {
            categorySpendById.set(tx.category_id, (categorySpendById.get(tx.category_id) || 0) + amount);
          }
        }
      }
    }

    const { data: budgets, error: budgetError } = await req.supabase
      .from('budgets')
      .select('amount, category_id, category:categories(name)')
      .eq('month', start);
    if (budgetError) throw budgetError;

    const budgetTotal = (budgets || []).reduce((sum, item) => sum + asNumber(item.amount), 0);
    const budgetSpent = (budgets || []).reduce(
      (sum, item) => sum + (categorySpendById.get(item.category_id) || 0),
      0,
    );

    res.json({
      month,
      balance_label: month === currentMonth ? 'Current Balance' : 'Period Closing Balance',
      opening_balance: openingBalance,
      current_balance: currentBalance,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net_cash_flow: totalIncome - totalExpenses,
      budget_status: {
        total: budgetTotal,
        spent: budgetSpent,
        remaining: budgetTotal - budgetSpent,
        percentage: budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0,
      },
      category_spending: Array.from(categorySpend.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
      recent_transactions: (transactions || [])
        .filter((tx) => tx.date >= start && tx.date < nextMonth)
        .slice(0, 6),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
