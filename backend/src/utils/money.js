export function asNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function transactionTotalEffect(transaction) {
  const amount = asNumber(transaction.amount);
  if (transaction.type === 'income') return amount;
  if (transaction.type === 'expense') return -amount;
  return 0;
}

export function accountEffect(transaction, accountId) {
  const amount = asNumber(transaction.amount);

  if (transaction.type === 'income' && transaction.destination_account_id === accountId) {
    return amount;
  }
  if (transaction.type === 'expense' && transaction.source_account_id === accountId) {
    return -amount;
  }
  if (transaction.type === 'transfer') {
    if (transaction.source_account_id === accountId) return -amount;
    if (transaction.destination_account_id === accountId) return amount;
  }

  return 0;
}
