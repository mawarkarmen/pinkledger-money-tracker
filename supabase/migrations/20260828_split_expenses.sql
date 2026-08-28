-- ============================================================
-- PinkLedger Split Expense Support
-- ============================================================

alter table public.transactions
add column if not exists transaction_group_id uuid;


create index if not exists
  idx_transactions_group_id
on public.transactions (
  user_id,
  transaction_group_id
)
where transaction_group_id is not null;


comment on column public.transactions.transaction_group_id is
'Links multiple transaction rows that originate from one real-world payment, such as a split expense.';