begin;

-- ============================================================
-- PinkLedger
-- Integrity, single-currency enforcement, account-date rules,
-- archive consistency, SQL aggregation, and supporting indexes.
--
-- Run after:
-- 20260828_reimbursements.sql
-- 20260828_multiple_reimbursements.sql
-- 20260828_split_expenses.sql
-- 20260831_atomic_reimbursement_operations.sql
-- ============================================================


-- ============================================================
-- NORMALIZE CURRENCY CODES
-- ============================================================

update public.profiles
set currency = upper(trim(currency))
where currency is not null;

update public.accounts
set currency = upper(trim(currency))
where currency is not null;


-- ============================================================
-- PREFLIGHT: INVALID CURRENCY CODES
-- ============================================================

do $$
begin
  if exists (
    select 1
    from public.profiles
    where currency is null
       or currency !~ '^[A-Z]{3}$'
  ) then
    raise exception
      'Migration stopped: every profile currency must be a valid three-letter uppercase currency code.';
  end if;

  if exists (
    select 1
    from public.accounts
    where currency is null
       or currency !~ '^[A-Z]{3}$'
  ) then
    raise exception
      'Migration stopped: every account currency must be a valid three-letter uppercase currency code.';
  end if;

  if exists (
    select 1
    from public.accounts a
    join public.profiles p
      on p.id = a.user_id
    where a.currency <> p.currency
  ) then
    raise exception
      'Migration stopped: one or more account currencies do not match the user profile currency. PinkLedger now uses one base currency per user until FX conversion is implemented.';
  end if;
end;
$$;


-- ============================================================
-- ACCOUNT TRANSACTION EFFECT HELPER
-- ============================================================
-- Returns only transaction movement for an account.
-- Opening balance is intentionally excluded.
-- ============================================================

create or replace function public.account_transaction_effect(
  p_user_id uuid,
  p_account_id uuid,
  p_through_date date default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    sum(
      case
        when t.destination_account_id = p_account_id
             and t.type in ('income', 'transfer')
          then t.amount
        else 0
      end
      +
      case
        when t.source_account_id = p_account_id
             and t.type in ('expense', 'transfer')
          then -t.amount
        else 0
      end
    ),
    0
  )::numeric
  from public.transactions t
  where t.user_id = p_user_id
    and (
      t.source_account_id = p_account_id
      or t.destination_account_id = p_account_id
    )
    and (
      p_through_date is null
      or t.date <= p_through_date
    );
$$;

revoke all
on function public.account_transaction_effect(uuid, uuid, date)
from public;


-- ============================================================
-- ACCOUNT BALANCE HELPER
-- ============================================================

create or replace function public.account_balance_value(
  p_user_id uuid,
  p_account_id uuid,
  p_through_date date default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account public.accounts%rowtype;
  v_opening numeric := 0;
  v_effect numeric := 0;
begin
  select a.*
  into v_account
  from public.accounts a
  where a.id = p_account_id
    and a.user_id = p_user_id;

  if not found then
    return 0;
  end if;

  if p_through_date is null
     or v_account.opening_date <= p_through_date then
    v_opening := coalesce(v_account.opening_balance, 0);
  end if;

  select coalesce(
    sum(
      case
        when t.destination_account_id = p_account_id
             and t.type in ('income', 'transfer')
          then t.amount
        else 0
      end
      +
      case
        when t.source_account_id = p_account_id
             and t.type in ('expense', 'transfer')
          then -t.amount
        else 0
      end
    ),
    0
  )
  into v_effect
  from public.transactions t
  where t.user_id = p_user_id
    and (
      t.source_account_id = p_account_id
      or t.destination_account_id = p_account_id
    )
    and t.date >= v_account.opening_date
    and (
      p_through_date is null
      or t.date <= p_through_date
    );

  return round(
    coalesce(v_opening, 0)
    + coalesce(v_effect, 0),
    2
  );
end;
$$;

revoke all
on function public.account_balance_value(uuid, uuid, date)
from public;


-- ============================================================
-- PREFLIGHT: TRANSACTIONS BEFORE ACCOUNT OPENING DATE
-- ============================================================

do $$
begin
  if exists (
    select 1
    from public.transactions t
    join public.accounts a
      on a.id = t.source_account_id
     and a.user_id = t.user_id
    where t.source_account_id is not null
      and t.date < a.opening_date
  ) then
    raise exception
      'Migration stopped: one or more source-account transactions predate the account opening date. Correct those transaction dates or opening dates first.';
  end if;

  if exists (
    select 1
    from public.transactions t
    join public.accounts a
      on a.id = t.destination_account_id
     and a.user_id = t.user_id
    where t.destination_account_id is not null
      and t.date < a.opening_date
  ) then
    raise exception
      'Migration stopped: one or more destination-account transactions predate the account opening date. Correct those transaction dates or opening dates first.';
  end if;
end;
$$;


-- ============================================================
-- PREFLIGHT: ARCHIVED ACCOUNTS MUST BE ZERO
-- ============================================================

do $$
declare
  v_problem record;
begin
  select
    a.id,
    a.name,
    public.account_balance_value(a.user_id, a.id, null) as balance
  into v_problem
  from public.accounts a
  where a.is_active = false
    and abs(
      public.account_balance_value(a.user_id, a.id, null)
    ) > 0.005
  limit 1;

  if found then
    raise exception
      'Migration stopped: archived account "%" has a non-zero balance of %. Reactivate it and bring its balance to zero before archiving.',
      v_problem.name,
      v_problem.balance;
  end if;
end;
$$;


-- ============================================================
-- ENFORCE ONE BASE CURRENCY PER USER
-- ============================================================

create or replace function public.enforce_account_base_currency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile_currency text;
begin
  new.currency := upper(trim(new.currency));

  if new.currency is null
     or new.currency !~ '^[A-Z]{3}$' then
    raise exception
      'Account currency must be a valid three-letter currency code.';
  end if;

  select upper(trim(p.currency))
  into v_profile_currency
  from public.profiles p
  where p.id = new.user_id;

  if v_profile_currency is null then
    raise exception
      'Profile currency is not configured.';
  end if;

  if new.currency <> v_profile_currency then
    raise exception
      'Account currency must match profile currency (%).',
      v_profile_currency;
  end if;

  return new;
end;
$$;


drop trigger if exists trg_accounts_base_currency
on public.accounts;

create trigger trg_accounts_base_currency
before insert or update of currency, user_id
on public.accounts
for each row
execute function public.enforce_account_base_currency();


-- ============================================================
-- PREVENT BASE CURRENCY CHANGES AFTER LEDGER CREATION
-- ============================================================

create or replace function public.protect_profile_currency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.currency := upper(trim(new.currency));

  if new.currency is null
     or new.currency !~ '^[A-Z]{3}$' then
    raise exception
      'Profile currency must be a valid three-letter currency code.';
  end if;

  if tg_op = 'UPDATE'
     and new.currency is distinct from old.currency
     and exists (
       select 1
       from public.accounts a
       where a.user_id = new.id
     ) then
    raise exception
      'Profile currency cannot be changed after financial accounts exist.';
  end if;

  return new;
end;
$$;


drop trigger if exists trg_profiles_currency_guard
on public.profiles;

create trigger trg_profiles_currency_guard
before insert or update of currency
on public.profiles
for each row
execute function public.protect_profile_currency();


-- ============================================================
-- VALIDATE TRANSACTION ACCOUNT DATES AND ACTIVE STATE
-- ============================================================

create or replace function public.validate_transaction_account_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_opening_date date;
  v_is_active boolean;
begin
  if new.source_account_id is not null then
    select a.opening_date, a.is_active
    into v_opening_date, v_is_active
    from public.accounts a
    where a.id = new.source_account_id
      and a.user_id = new.user_id;

    if not found then
      raise exception
        'Source account does not belong to the user.';
    end if;

    if v_is_active = false then
      raise exception
        'Source account is archived. Reactivate it before using it in a transaction.';
    end if;

    if new.date < v_opening_date then
      raise exception
        'Transaction date cannot be earlier than source account opening date (%).',
        v_opening_date;
    end if;
  end if;

  if new.destination_account_id is not null then
    select a.opening_date, a.is_active
    into v_opening_date, v_is_active
    from public.accounts a
    where a.id = new.destination_account_id
      and a.user_id = new.user_id;

    if not found then
      raise exception
        'Destination account does not belong to the user.';
    end if;

    if v_is_active = false then
      raise exception
        'Destination account is archived. Reactivate it before using it in a transaction.';
    end if;

    if new.date < v_opening_date then
      raise exception
        'Transaction date cannot be earlier than destination account opening date (%).',
        v_opening_date;
    end if;
  end if;

  return new;
end;
$$;


drop trigger if exists trg_transactions_account_state
on public.transactions;

create trigger trg_transactions_account_state
before insert or update of
  user_id,
  date,
  source_account_id,
  destination_account_id
on public.transactions
for each row
execute function public.validate_transaction_account_state();


-- ============================================================
-- PROTECT ARCHIVED ACCOUNT LEDGER FROM TRANSACTION DELETES
-- ============================================================

create or replace function public.prevent_archived_account_transaction_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.source_account_id is not null
     and exists (
       select 1
       from public.accounts a
       where a.id = old.source_account_id
         and a.user_id = old.user_id
         and a.is_active = false
     ) then
    raise exception
      'Transactions belonging to an archived source account cannot be deleted. Reactivate the account first.';
  end if;

  if old.destination_account_id is not null
     and exists (
       select 1
       from public.accounts a
       where a.id = old.destination_account_id
         and a.user_id = old.user_id
         and a.is_active = false
     ) then
    raise exception
      'Transactions belonging to an archived destination account cannot be deleted. Reactivate the account first.';
  end if;

  return old;
end;
$$;


drop trigger if exists trg_transactions_archived_delete_guard
on public.transactions;

create trigger trg_transactions_archived_delete_guard
before delete
on public.transactions
for each row
execute function public.prevent_archived_account_transaction_delete();


-- ============================================================
-- VALIDATE ACCOUNT OPENING-DATE CHANGES AND ZERO-BALANCE ARCHIVE
-- ============================================================

create or replace function public.validate_account_update_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_effect numeric := 0;
  v_resulting_balance numeric := 0;
begin
  if tg_op = 'UPDATE'
     and new.opening_date is distinct from old.opening_date
     and exists (
       select 1
       from public.transactions t
       where t.user_id = new.user_id
         and (
           t.source_account_id = new.id
           or t.destination_account_id = new.id
         )
         and t.date < new.opening_date
     ) then
    raise exception
      'Account opening date cannot be later than an existing transaction date.';
  end if;

  if new.is_active = false then
    select coalesce(
      sum(
        case
          when t.destination_account_id = new.id
               and t.type in ('income', 'transfer')
            then t.amount
          else 0
        end
        +
        case
          when t.source_account_id = new.id
               and t.type in ('expense', 'transfer')
            then -t.amount
          else 0
        end
      ),
      0
    )
    into v_effect
    from public.transactions t
    where t.user_id = new.user_id
      and (
        t.source_account_id = new.id
        or t.destination_account_id = new.id
      )
      and t.date >= new.opening_date;

    v_resulting_balance :=
      round(
        coalesce(new.opening_balance, 0)
        + coalesce(v_effect, 0),
        2
      );

    if abs(v_resulting_balance) > 0.005 then
      raise exception
        'An account with a non-zero balance cannot be archived. Current balance: %. Transfer or adjust the balance to zero first.',
        v_resulting_balance;
    end if;
  end if;

  return new;
end;
$$;


drop trigger if exists trg_accounts_integrity_guard
on public.accounts;

create trigger trg_accounts_integrity_guard
before update of opening_balance, opening_date, is_active
on public.accounts
for each row
execute function public.validate_account_update_integrity();


-- ============================================================
-- ACCOUNT LIST + SQL BALANCE AGGREGATION
-- ============================================================

create or replace function public.get_accounts_with_balances(
  p_through_date date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with movements as (
    select
      t.destination_account_id as account_id,
      t.date,
      t.amount::numeric as effect
    from public.transactions t
    where t.user_id = auth.uid()
      and t.destination_account_id is not null
      and t.type in ('income', 'transfer')
      and t.date <= p_through_date

    union all

    select
      t.source_account_id as account_id,
      t.date,
      (-t.amount)::numeric as effect
    from public.transactions t
    where t.user_id = auth.uid()
      and t.source_account_id is not null
      and t.type in ('expense', 'transfer')
      and t.date <= p_through_date
  ),
  account_rows as (
    select
      a.*,
      (
        case
          when a.opening_date <= p_through_date
            then coalesce(a.opening_balance, 0)
          else 0
        end
        +
        coalesce(
          sum(m.effect)
            filter (
              where m.date >= a.opening_date
            ),
          0
        )
      )::numeric as current_balance
    from public.accounts a
    left join movements m
      on m.account_id = a.id
    where a.user_id = auth.uid()
    group by a.id
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(account_rows)
      order by account_rows.created_at
    ),
    '[]'::jsonb
  )
  from account_rows;
$$;

revoke all
on function public.get_accounts_with_balances(date)
from public;

grant execute
on function public.get_accounts_with_balances(date)
to authenticated;


-- ============================================================
-- DASHBOARD SQL AGGREGATION
-- ============================================================

create or replace function public.get_dashboard_summary(
  p_month text,
  p_balance_through date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_start date;
  v_next date;
  v_first_financial_date date;
  v_first_financial_month text;
  v_is_first_month boolean;

  v_opening_balance numeric := 0;
  v_current_balance numeric := 0;
  v_total_income numeric := 0;
  v_total_expenses numeric := 0;
  v_outstanding numeric := 0;
  v_budget_total numeric := 0;
  v_budget_spent numeric := 0;

  v_category_spending jsonb := '[]'::jsonb;
  v_recent_transactions jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Month must be in YYYY-MM format.';
  end if;

  v_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_next := (v_start + interval '1 month')::date;

  select min(a.opening_date)
  into v_first_financial_date
  from public.accounts a
  where a.user_id = v_user_id;

  v_first_financial_month :=
    case
      when v_first_financial_date is null then null
      else to_char(v_first_financial_date, 'YYYY-MM')
    end;

  v_is_first_month :=
    v_first_financial_month = p_month;

  if v_is_first_month then
    select coalesce(sum(a.opening_balance), 0)
    into v_opening_balance
    from public.accounts a
    where a.user_id = v_user_id
      and a.opening_date >= v_start
      and a.opening_date < v_next
      and a.opening_date <= p_balance_through;
  else
    select
      coalesce(
        sum(
          case
            when a.opening_date <= v_start
              then a.opening_balance
            else 0
          end
        ),
        0
      )
      +
      coalesce((
        select sum(
          case
            when t.type = 'income' then t.amount
            when t.type = 'expense' then -t.amount
            else 0
          end
        )
        from public.transactions t
        where t.user_id = v_user_id
          and t.date < v_start
      ), 0)
    into v_opening_balance
    from public.accounts a
    where a.user_id = v_user_id;
  end if;

  select
    coalesce(
      sum(
        case
          when a.opening_date <= p_balance_through
            then a.opening_balance
          else 0
        end
      ),
      0
    )
    +
    coalesce((
      select sum(
        case
          when t.type = 'income' then t.amount
          when t.type = 'expense' then -t.amount
          else 0
        end
      )
      from public.transactions t
      where t.user_id = v_user_id
        and t.date <= p_balance_through
    ), 0)
  into v_current_balance
  from public.accounts a
  where a.user_id = v_user_id;

  select coalesce(sum(t.amount), 0)
  into v_total_income
  from public.transactions t
  where t.user_id = v_user_id
    and t.type = 'income'
    and t.reimbursement_claim_id is null
    and t.date >= v_start
    and t.date < v_next
    and t.date <= p_balance_through;

  select coalesce(sum(t.amount), 0)
  into v_total_expenses
  from public.transactions t
  where t.user_id = v_user_id
    and t.type = 'expense'
    and coalesce(t.is_reimbursable, false) = false
    and t.date >= v_start
    and t.date < v_next
    and t.date <= p_balance_through;

  select coalesce(sum(c.amount), 0)
  into v_outstanding
  from public.reimbursement_claims c
  join public.transactions t
    on t.id = c.transaction_id
   and t.user_id = c.user_id
  where c.user_id = v_user_id
    and t.date <= p_balance_through
    and (
      c.reimbursed_at is null
      or c.reimbursed_at > p_balance_through
    );

  select coalesce(sum(b.amount), 0)
  into v_budget_total
  from public.budgets b
  where b.user_id = v_user_id
    and b.month = v_start;

  select coalesce(sum(t.amount), 0)
  into v_budget_spent
  from public.transactions t
  join public.budgets b
    on b.user_id = t.user_id
   and b.month = v_start
   and b.category_id = t.category_id
  where t.user_id = v_user_id
    and t.type = 'expense'
    and coalesce(t.is_reimbursable, false) = false
    and t.date >= v_start
    and t.date < v_next
    and t.date <= p_balance_through;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', x.name,
        'amount', x.amount
      )
      order by x.amount desc
    ),
    '[]'::jsonb
  )
  into v_category_spending
  from (
    select
      coalesce(c.name, 'Uncategorized') as name,
      sum(t.amount)::numeric as amount
    from public.transactions t
    left join public.categories c
      on c.id = t.category_id
     and c.user_id = t.user_id
    where t.user_id = v_user_id
      and t.type = 'expense'
      and coalesce(t.is_reimbursable, false) = false
      and t.date >= v_start
      and t.date < v_next
      and t.date <= p_balance_through
    group by coalesce(c.name, 'Uncategorized')
  ) x;

  select coalesce(
    jsonb_agg(
      x.payload
      order by x.date desc, x.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_transactions
  from (
    select
      t.date,
      t.created_at,
      to_jsonb(t)
      || jsonb_build_object(
        'category',
        case
          when c.id is null then null
          else jsonb_build_object(
            'name', c.name,
            'icon', c.icon
          )
        end
      ) as payload
    from public.transactions t
    left join public.categories c
      on c.id = t.category_id
     and c.user_id = t.user_id
    where t.user_id = v_user_id
      and t.date >= v_start
      and t.date < v_next
      and t.date <= p_balance_through
    order by t.date desc, t.created_at desc
    limit 6
  ) x;

  return jsonb_build_object(
    'month', p_month,
    'first_financial_month', v_first_financial_month,
    'opening_balance_source',
      case
        when v_is_first_month then 'manual'
        else 'carried_forward'
      end,
    'opening_balance', round(v_opening_balance, 2),
    'current_balance', round(v_current_balance, 2),
    'total_income', round(v_total_income, 2),
    'total_expenses', round(v_total_expenses, 2),
    'net_cash_flow', round(v_total_income - v_total_expenses, 2),
    'outstanding_reimbursements', round(v_outstanding, 2),
    'budget_status', jsonb_build_object(
      'total', round(v_budget_total, 2),
      'spent', round(v_budget_spent, 2),
      'remaining', round(v_budget_total - v_budget_spent, 2),
      'percentage',
        case
          when v_budget_total > 0
            then (v_budget_spent / v_budget_total) * 100
          else 0
        end
    ),
    'category_spending', v_category_spending,
    'recent_transactions', v_recent_transactions
  );
end;
$$;

revoke all
on function public.get_dashboard_summary(text, date)
from public;

grant execute
on function public.get_dashboard_summary(text, date)
to authenticated;


-- ============================================================
-- INDEXES FOR COMMON FILTERS AND AGGREGATES
-- ============================================================

create index if not exists idx_transactions_user_date_created
on public.transactions (
  user_id,
  date desc,
  created_at desc
);

create index if not exists idx_transactions_user_source_date
on public.transactions (
  user_id,
  source_account_id,
  date
)
where source_account_id is not null;

create index if not exists idx_transactions_user_destination_date
on public.transactions (
  user_id,
  destination_account_id,
  date
)
where destination_account_id is not null;

create index if not exists idx_transactions_user_category_date
on public.transactions (
  user_id,
  category_id,
  date
)
where type = 'expense';

create index if not exists idx_transactions_user_reimbursement_claim
on public.transactions (
  user_id,
  reimbursement_claim_id
)
where reimbursement_claim_id is not null;

create index if not exists idx_accounts_user_active
on public.accounts (
  user_id,
  is_active
);

create index if not exists idx_reimbursement_claims_user_transaction_status
on public.reimbursement_claims (
  user_id,
  transaction_id,
  status
);

create index if not exists idx_budgets_user_month_category
on public.budgets (
  user_id,
  month,
  category_id
);

commit;
