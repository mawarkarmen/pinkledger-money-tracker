-- PinkLedger Supabase schema
-- Run this entire file in Supabase SQL Editor for a new project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  currency char(3) not null default 'IDR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('cash','bank','ewallet','savings','credit_card','other')),
  opening_balance numeric(16,2) not null default 0,
  opening_date date not null default current_date,
  currency char(3) not null default 'IDR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('income','expense')),
  icon text not null default 'CircleDollarSign',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, type, name)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  date date not null,
  description text not null check (char_length(description) between 1 and 160),
  amount numeric(16,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete restrict,
  source_account_id uuid constraint transactions_source_account_id_fkey references public.accounts(id) on delete restrict,
  destination_account_id uuid constraint transactions_destination_account_id_fkey references public.accounts(id) on delete restrict,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_shape check (
    (type = 'income' and destination_account_id is not null and source_account_id is null and category_id is not null)
    or
    (type = 'expense' and source_account_id is not null and destination_account_id is null and category_id is not null)
    or
    (type = 'transfer' and source_account_id is not null and destination_account_id is not null and source_account_id <> destination_account_id and category_id is null)
  )
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category_id uuid not null references public.categories(id) on delete restrict,
  amount numeric(16,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month, category_id)
);

create table if not exists public.reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  reminder_time time not null default '20:00',
  timezone text not null default 'UTC',
  last_sent_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_user on public.accounts(user_id);
create index if not exists idx_categories_user_type on public.categories(user_id, type);
create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);
create index if not exists idx_transactions_source on public.transactions(source_account_id);
create index if not exists idx_transactions_destination on public.transactions(destination_account_id);
create index if not exists idx_budgets_user_month on public.budgets(user_id, month);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.reminder_preferences enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "accounts_owner_all" on public.accounts;
create policy "accounts_owner_all" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_owner_all" on public.categories;
create policy "categories_owner_all" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_owner_all" on public.transactions;
create policy "transactions_owner_all" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budgets_owner_all" on public.budgets;
create policy "budgets_owner_all" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminders_owner_all" on public.reminder_preferences;
create policy "reminders_owner_all" on public.reminder_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ensure referenced accounts and categories belong to the same user.
create or replace function public.validate_transaction_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'Category does not belong to the user.';
  end if;

  if new.source_account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.source_account_id and a.user_id = new.user_id
  ) then
    raise exception 'Source account does not belong to the user.';
  end if;

  if new.destination_account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.destination_account_id and a.user_id = new.user_id
  ) then
    raise exception 'Destination account does not belong to the user.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_transaction_ownership on public.transactions;
create trigger trg_validate_transaction_ownership
before insert or update on public.transactions
for each row execute function public.validate_transaction_ownership();

create or replace function public.validate_budget_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.user_id = new.user_id and c.type = 'expense'
  ) then
    raise exception 'Budget category must be an expense category owned by the user.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_budget_ownership on public.budgets;
create trigger trg_validate_budget_ownership
before insert or update on public.budgets
for each row execute function public.validate_budget_ownership();

-- Automatic updated_at maintenance.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at before update on public.budgets
for each row execute function public.set_updated_at();

drop trigger if exists trg_reminder_preferences_updated_at on public.reminder_preferences;
create trigger trg_reminder_preferences_updated_at before update on public.reminder_preferences
for each row execute function public.set_updated_at();

-- Create a profile, reminder row, and starter categories for each new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  insert into public.reminder_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, type, icon)
  values
    (new.id, 'Salary', 'income', 'WalletCards'),
    (new.id, 'Freelance', 'income', 'BriefcaseBusiness'),
    (new.id, 'Other Income', 'income', 'CircleDollarSign'),
    (new.id, 'Food', 'expense', 'Utensils'),
    (new.id, 'Transportation', 'expense', 'Car'),
    (new.id, 'Shopping', 'expense', 'ShoppingBag'),
    (new.id, 'Entertainment', 'expense', 'Clapperboard'),
    (new.id, 'Bills', 'expense', 'ReceiptText'),
    (new.id, 'Health', 'expense', 'HeartPulse'),
    (new.id, 'Other Expense', 'expense', 'CircleDollarSign')
  on conflict (user_id, type, name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
