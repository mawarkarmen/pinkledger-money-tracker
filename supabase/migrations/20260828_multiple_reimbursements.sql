begin;

-- ============================================================
-- PinkLedger
-- Multiple reimbursement claims
-- ============================================================


-- ============================================================
-- 1. TEMPORARILY REMOVE OLD TRANSACTION VALIDATION TRIGGER
-- ============================================================

drop trigger if exists
  trg_validate_transaction_ownership
on public.transactions;


-- ============================================================
-- 2. CREATE REIMBURSEMENT CLAIMS TABLE
-- ============================================================

create table if not exists
  public.reimbursement_claims
(
  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  transaction_id uuid
    not null
    references public.transactions(id)
    on delete cascade,

  person_name text
    not null,

  amount numeric(16, 2)
    not null,

  status text
    not null
    default 'pending',

  reimbursed_at date,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint reimbursement_claim_person_name
    check (
      length(
        trim(person_name)
      ) between 1 and 80
    ),

  constraint reimbursement_claim_amount
    check (
      amount > 0
    ),

  constraint reimbursement_claim_status
    check (
      status in (
        'pending',
        'reimbursed'
      )
    ),

  constraint reimbursement_claim_status_date
    check (
      (
        status = 'pending'
        and reimbursed_at is null
      )
      or
      (
        status = 'reimbursed'
        and reimbursed_at is not null
      )
    )
);


-- ============================================================
-- 3. INDEXES
-- ============================================================

create index if not exists
  idx_reimbursement_claims_transaction
on public.reimbursement_claims (
  transaction_id
);


create index if not exists
  idx_reimbursement_claims_user_status
on public.reimbursement_claims (
  user_id,
  status
);


-- ============================================================
-- 4. ADD CLAIM REFERENCE TO TRANSACTIONS
-- ============================================================

alter table public.transactions
  add column if not exists
    reimbursement_claim_id uuid;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'transactions_reimbursement_claim_id_fkey'
  ) then

    alter table public.transactions
      add constraint
        transactions_reimbursement_claim_id_fkey

      foreign key (
        reimbursement_claim_id
      )

      references
        public.reimbursement_claims(id)

      on delete cascade;

  end if;

end;
$$;


-- ============================================================
-- 5. REMOVE OLD SINGLE-REIMBURSEMENT LIMIT
-- ============================================================

drop index if exists
  public.idx_transactions_one_reimbursement;


-- Each reimbursement claim can only create one receipt.

create unique index if not exists
  idx_transactions_one_receipt_per_claim
on public.transactions (
  reimbursement_claim_id
)
where reimbursement_claim_id is not null;


-- ============================================================
-- 6. MIGRATE EXISTING REIMBURSABLE EXPENSES
-- ============================================================

insert into public.reimbursement_claims (
  user_id,
  transaction_id,
  person_name,
  amount,
  status,
  reimbursed_at
)

select
  t.user_id,

  t.id,

  coalesce(
    nullif(
      trim(t.reimbursed_by),
      ''
    ),
    'Reimbursement'
  ),

  t.amount,

  case
    when
      t.reimbursement_status =
      'reimbursed'
    then
      'reimbursed'
    else
      'pending'
  end,

  case
    when
      t.reimbursement_status =
      'reimbursed'
    then
      t.reimbursed_at
    else
      null
  end

from public.transactions t

where
  t.type = 'expense'

  and t.is_reimbursable = true

  and not exists (
    select 1

    from public.reimbursement_claims c

    where
      c.transaction_id = t.id
  );


-- ============================================================
-- 7. LINK EXISTING REIMBURSEMENT RECEIPTS TO CLAIMS
-- ============================================================

update public.transactions receipt

set
  reimbursement_claim_id =
    claim.id

from public.reimbursement_claims claim

where
  receipt.reimburses_transaction_id =
    claim.transaction_id

  and receipt.reimbursement_claim_id
    is null;


-- ============================================================
-- 8. CLAIM VALIDATION FUNCTION
-- ============================================================

create or replace function
  public.validate_reimbursement_claim()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

declare

  expense_amount
    numeric(16, 2);

  allocated_amount
    numeric(16, 2);

begin

  select
    t.amount

  into
    expense_amount

  from public.transactions t

  where
    t.id =
      new.transaction_id

    and t.user_id =
      new.user_id

    and t.type =
      'expense'

    and t.is_reimbursable =
      true;


  if not found then

    raise exception
      'Reimbursement claim must belong to a reimbursable expense.';

  end if;


  select
    coalesce(
      sum(c.amount),
      0
    )

  into
    allocated_amount

  from public.reimbursement_claims c

  where
    c.transaction_id =
      new.transaction_id

    and c.id is distinct from
      new.id;


  if
    allocated_amount +
    new.amount >
    expense_amount +
    0.005
  then

    raise exception
      'Total reimbursement claims exceed the reimbursable expense amount.';

  end if;


  return new;

end;

$$;


drop trigger if exists
  trg_validate_reimbursement_claim
on public.reimbursement_claims;


create trigger
  trg_validate_reimbursement_claim

before insert or update

on public.reimbursement_claims

for each row

execute function
  public.validate_reimbursement_claim();


-- ============================================================
-- 9. NEW TRANSACTION VALIDATION FUNCTION
-- ============================================================

create or replace function
  public.validate_transaction_ownership()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

declare

  claim_amount
    numeric(16, 2);

  claim_status
    text;

  claim_transaction_id
    uuid;

  original_date
    date;

begin

  -- ----------------------------------------------------------
  -- Category ownership
  -- ----------------------------------------------------------

  if
    new.category_id
    is not null

    and not exists (
      select 1

      from public.categories c

      where
        c.id =
          new.category_id

        and c.user_id =
          new.user_id
    )
  then

    raise exception
      'Category does not belong to the user.';

  end if;


  -- ----------------------------------------------------------
  -- Source account ownership
  -- ----------------------------------------------------------

  if
    new.source_account_id
    is not null

    and not exists (
      select 1

      from public.accounts a

      where
        a.id =
          new.source_account_id

        and a.user_id =
          new.user_id
    )
  then

    raise exception
      'Source account does not belong to the user.';

  end if;


  -- ----------------------------------------------------------
  -- Destination account ownership
  -- ----------------------------------------------------------

  if
    new.destination_account_id
    is not null

    and not exists (
      select 1

      from public.accounts a

      where
        a.id =
          new.destination_account_id

        and a.user_id =
          new.user_id
    )
  then

    raise exception
      'Destination account does not belong to the user.';

  end if;


  -- ----------------------------------------------------------
  -- Reimbursement receipt validation
  -- ----------------------------------------------------------

  if
    new.reimbursement_claim_id
    is not null
  then

    if
      new.type <> 'income'
    then

      raise exception
        'A reimbursement receipt must be an income-side account movement.';

    end if;


    select
      claim.amount,

      claim.status,

      claim.transaction_id,

      expense.date

    into
      claim_amount,

      claim_status,

      claim_transaction_id,

      original_date

    from public.reimbursement_claims claim

    join public.transactions expense

      on expense.id =
        claim.transaction_id

    where
      claim.id =
        new.reimbursement_claim_id

      and claim.user_id =
        new.user_id

      and expense.user_id =
        new.user_id

      and expense.type =
        'expense'

      and expense.is_reimbursable =
        true;


    if not found then

      raise exception
        'Reimbursement claim was not found.';

    end if;


    -- New reimbursement receipts may only be created
    -- while the claim is still pending.

    if
      tg_op = 'INSERT'

      and claim_status <>
        'pending'
    then

      raise exception
        'This reimbursement claim has already been paid.';

    end if;


    if
      new.reimburses_transaction_id
      is distinct from
      claim_transaction_id
    then

      raise exception
        'Reimbursement receipt does not match its original expense.';

    end if;


    if
      new.amount <>
      claim_amount
    then

      raise exception
        'Reimbursement receipt amount must match the reimbursement claim amount.';

    end if;


    if
      new.date <
      original_date
    then

      raise exception
        'Reimbursement date cannot be earlier than the original expense date.';

    end if;


  elsif
    new.reimburses_transaction_id
    is not null
  then

    raise exception
      'Reimbursement receipt must reference a reimbursement claim.';

  end if;


  return new;

end;

$$;


-- ============================================================
-- 10. RECREATE TRANSACTION VALIDATION TRIGGER
-- ============================================================

drop trigger if exists
  trg_validate_transaction_ownership
on public.transactions;


create trigger
  trg_validate_transaction_ownership

before insert or update

on public.transactions

for each row

execute function
  public.validate_transaction_ownership();


-- ============================================================
-- 11. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table
  public.reimbursement_claims

enable row level security;


-- ============================================================
-- 12. SELECT POLICY
-- ============================================================

drop policy if exists
  reimbursement_claims_select_own
on public.reimbursement_claims;


create policy
  reimbursement_claims_select_own

on public.reimbursement_claims

for select

using (
  auth.uid() =
  user_id
);


-- ============================================================
-- 13. INSERT POLICY
-- ============================================================

drop policy if exists
  reimbursement_claims_insert_own
on public.reimbursement_claims;


create policy
  reimbursement_claims_insert_own

on public.reimbursement_claims

for insert

with check (
  auth.uid() =
  user_id
);


-- ============================================================
-- 14. UPDATE POLICY
-- ============================================================

drop policy if exists
  reimbursement_claims_update_own
on public.reimbursement_claims;


create policy
  reimbursement_claims_update_own

on public.reimbursement_claims

for update

using (
  auth.uid() =
  user_id
)

with check (
  auth.uid() =
  user_id
);


-- ============================================================
-- 15. DELETE POLICY
-- ============================================================

drop policy if exists
  reimbursement_claims_delete_own
on public.reimbursement_claims;


create policy
  reimbursement_claims_delete_own

on public.reimbursement_claims

for delete

using (
  auth.uid() =
  user_id
);


-- ============================================================
-- 16. UPDATED_AT FUNCTION
-- ============================================================

create or replace function
  public.set_reimbursement_claim_updated_at()

returns trigger

language plpgsql

set search_path = ''

as $$

begin

  new.updated_at =
    now();

  return new;

end;

$$;


drop trigger if exists
  trg_reimbursement_claim_updated_at
on public.reimbursement_claims;


create trigger
  trg_reimbursement_claim_updated_at

before update

on public.reimbursement_claims

for each row

execute function
  public.set_reimbursement_claim_updated_at();


-- ============================================================
-- 17. COMPLETE MIGRATION
-- ============================================================

commit;