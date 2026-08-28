-- ============================================================
-- PinkLedger reimbursement support
-- ============================================================

alter table public.transactions
  add column if not exists is_reimbursable boolean not null default false;

alter table public.transactions
  add column if not exists reimbursement_status text not null default 'none';

alter table public.transactions
  add column if not exists reimbursed_by text;

alter table public.transactions
  add column if not exists reimbursed_at date;

alter table public.transactions
  add column if not exists reimburses_transaction_id uuid;


-- ============================================================
-- Foreign key from reimbursement receipt to original expense
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_reimburses_transaction_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_reimburses_transaction_id_fkey
      foreign key (reimburses_transaction_id)
      references public.transactions(id)
      on delete cascade;
  end if;
end;
$$;


-- Only one reimbursement receipt may exist for an expense.
create unique index if not exists
  idx_transactions_one_reimbursement
on public.transactions (reimburses_transaction_id)
where reimburses_transaction_id is not null;


create index if not exists
  idx_transactions_reimbursement_status
on public.transactions (
  user_id,
  is_reimbursable,
  reimbursement_status
);


-- ============================================================
-- Rebuild transaction-shape constraint
-- ============================================================

alter table public.transactions
  drop constraint if exists transaction_shape;

alter table public.transactions
  add constraint transaction_shape
  check (
    (
      type = 'income'
      and destination_account_id is not null
      and source_account_id is null
      and (
        (
          reimburses_transaction_id is null
          and category_id is not null
        )
        or
        (
          reimburses_transaction_id is not null
          and category_id is null
        )
      )
    )
    or
    (
      type = 'expense'
      and source_account_id is not null
      and destination_account_id is null
      and category_id is not null
      and reimburses_transaction_id is null
    )
    or
    (
      type = 'transfer'
      and source_account_id is not null
      and destination_account_id is not null
      and source_account_id <> destination_account_id
      and category_id is null
      and reimburses_transaction_id is null
    )
  );


-- ============================================================
-- Validate reimbursement metadata
-- ============================================================

alter table public.transactions
  drop constraint if exists reimbursement_status_check;

alter table public.transactions
  add constraint reimbursement_status_check
  check (
    reimbursement_status in (
      'none',
      'pending',
      'reimbursed'
    )
  );


alter table public.transactions
  drop constraint if exists reimbursement_metadata_shape;

alter table public.transactions
  add constraint reimbursement_metadata_shape
  check (
    (
      type = 'expense'
      and (
        (
          is_reimbursable = false
          and reimbursement_status = 'none'
          and reimbursed_at is null
          and reimbursed_by is null
        )
        or
        (
          is_reimbursable = true
          and reimbursement_status = 'pending'
          and reimbursed_at is null
        )
        or
        (
          is_reimbursable = true
          and reimbursement_status = 'reimbursed'
          and reimbursed_at is not null
        )
      )
    )
    or
    (
      type in ('income', 'transfer')
      and is_reimbursable = false
      and reimbursement_status = 'none'
      and reimbursed_by is null
      and reimbursed_at is null
    )
  );


-- ============================================================
-- Ownership + reimbursement validation
-- ============================================================

create or replace function public.validate_transaction_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  original_amount numeric(16,2);
  original_date date;
  original_status text;
begin

  if new.category_id is not null and not exists (
    select 1
    from public.categories c
    where c.id = new.category_id
      and c.user_id = new.user_id
  ) then
    raise exception 'Category does not belong to the user.';
  end if;


  if new.source_account_id is not null and not exists (
    select 1
    from public.accounts a
    where a.id = new.source_account_id
      and a.user_id = new.user_id
  ) then
    raise exception 'Source account does not belong to the user.';
  end if;


  if new.destination_account_id is not null and not exists (
    select 1
    from public.accounts a
    where a.id = new.destination_account_id
      and a.user_id = new.user_id
  ) then
    raise exception 'Destination account does not belong to the user.';
  end if;


  if new.reimburses_transaction_id is not null then

    if new.type <> 'income' then
      raise exception 'A reimbursement receipt must be an income-side account movement.';
    end if;

    select
      t.amount,
      t.date,
      t.reimbursement_status
    into
      original_amount,
      original_date,
      original_status
    from public.transactions t
    where t.id = new.reimburses_transaction_id
      and t.user_id = new.user_id
      and t.type = 'expense'
      and t.is_reimbursable = true;

    if not found then
      raise exception 'Original reimbursable expense was not found.';
    end if;

    if original_status <> 'pending' then
      raise exception 'This expense is no longer awaiting reimbursement.';
    end if;

    if new.amount <> original_amount then
      raise exception 'Reimbursement amount must equal the original expense amount.';
    end if;

    if new.date < original_date then
      raise exception 'Reimbursement date cannot be earlier than the original expense date.';
    end if;

  end if;


  return new;
end;
$$;


drop trigger if exists
  trg_validate_transaction_ownership
on public.transactions;

create trigger
  trg_validate_transaction_ownership
before insert or update
on public.transactions
for each row
execute function public.validate_transaction_ownership();