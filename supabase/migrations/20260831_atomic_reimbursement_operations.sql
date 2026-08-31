begin;

-- ============================================================
-- PinkLedger
-- Atomic transaction + reimbursement operations
-- ============================================================
--
-- Run AFTER:
--
-- 20260828_reimbursements.sql
-- 20260828_multiple_reimbursements.sql
-- 20260828_split_expenses.sql
--
-- All multi-step reimbursement writes are moved into
-- PostgreSQL functions.
--
-- If any statement inside an RPC fails, PostgreSQL rolls
-- back the complete operation.
-- ============================================================


-- ============================================================
-- VALIDATE REIMBURSEMENT PEOPLE
-- ============================================================

create or replace function
public.validate_reimbursement_people_payload(
  p_people jsonb,
  p_expected_amount numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_people jsonb :=
    coalesce(
      p_people,
      '[]'::jsonb
    );

  v_count integer;

  v_total numeric(16, 2);
begin

  if
    jsonb_typeof(
      v_people
    ) <> 'array'
  then
    raise exception
      'Reimbursement people must be an array.';
  end if;


  v_count :=
    jsonb_array_length(
      v_people
    );


  if
    v_count < 1
  then
    raise exception
      'Add at least one person who will reimburse this expense.';
  end if;


  if
    v_count > 20
  then
    raise exception
      'A maximum of 20 reimbursement people is allowed.';
  end if;


  if exists (
    select 1

    from
      jsonb_array_elements(
        v_people
      ) as item

    where
      nullif(
        trim(
          item ->> 'person_name'
        ),
        ''
      ) is null

      or

      length(
        trim(
          item ->> 'person_name'
        )
      ) > 80
  )
  then
    raise exception
      'Each reimbursement person must have a valid name.';
  end if;


  if exists (
    select 1

    from
      jsonb_array_elements(
        v_people
      ) as item

    where
      (
        item ->> 'amount'
      ) is null

      or

      (
        item ->> 'amount'
      )::numeric <= 0
  )
  then
    raise exception
      'Each reimbursement amount must be greater than zero.';
  end if;


  select
    coalesce(
      sum(
        (
          item ->> 'amount'
        )::numeric
      ),
      0
    )

  into
    v_total

  from
    jsonb_array_elements(
      v_people
    ) as item;


  if
    abs(
      v_total -
      p_expected_amount
    ) > 0.005
  then
    raise exception
      'The reimbursement amounts must equal the reimbursable portion.';
  end if;

end;
$$;


-- ============================================================
-- CREATE NORMAL TRANSACTION ATOMICALLY
-- ============================================================

create or replace function
public.create_transaction_atomic(
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare

  v_user_id uuid :=
    auth.uid();


  v_transaction
    public.transactions%rowtype;


  v_type text;

  v_date date;

  v_description text;

  v_amount
    numeric(16, 2);


  v_category_id uuid;

  v_source_account_id uuid;

  v_destination_account_id uuid;


  v_notes text;


  v_is_reimbursable
    boolean;


  v_people jsonb;


  v_claims jsonb :=
    '[]'::jsonb;

begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required.';
  end if;


  v_type :=
    p_payload ->> 'type';


  v_date :=
    (
      p_payload ->> 'date'
    )::date;


  v_description :=
    trim(
      p_payload ->> 'description'
    );


  v_amount :=
    (
      p_payload ->> 'amount'
    )::numeric;


  v_category_id :=
    nullif(
      p_payload ->> 'category_id',
      ''
    )::uuid;


  v_source_account_id :=
    nullif(
      p_payload ->> 'source_account_id',
      ''
    )::uuid;


  v_destination_account_id :=
    nullif(
      p_payload ->> 'destination_account_id',
      ''
    )::uuid;


  v_notes :=
    nullif(
      trim(
        p_payload ->> 'notes'
      ),
      ''
    );


  v_is_reimbursable :=
    coalesce(
      (
        p_payload
          ->> 'is_reimbursable'
      )::boolean,
      false
    );


  v_people :=
    coalesce(
      p_payload
        -> 'reimbursement_people',

      '[]'::jsonb
    );


  if
    v_type not in (
      'income',
      'expense',
      'transfer'
    )
  then
    raise exception
      'Invalid transaction type.';
  end if;


  if
    v_amount <= 0
  then
    raise exception
      'Transaction amount must be greater than zero.';
  end if;


  if
    v_is_reimbursable
    and
    v_type <> 'expense'
  then
    raise exception
      'Only expenses can be reimbursable.';
  end if;


  if
    v_is_reimbursable
  then

    perform
      public
        .validate_reimbursement_people_payload(
          v_people,
          v_amount
        );

  elsif
    jsonb_typeof(
      v_people
    ) = 'array'

    and

    jsonb_array_length(
      v_people
    ) > 0
  then

    raise exception
      'Reimbursement people are only allowed for reimbursable expenses.';

  end if;


  insert into
    public.transactions
  (
    user_id,

    type,

    date,

    description,

    amount,

    category_id,

    source_account_id,

    destination_account_id,

    notes,

    is_reimbursable,

    reimbursement_status,

    reimbursed_by,

    reimbursed_at,

    reimburses_transaction_id,

    reimbursement_claim_id,

    transaction_group_id
  )

  values
  (
    v_user_id,

    v_type,

    v_date,

    v_description,

    v_amount,

    case
      when
        v_type = 'transfer'
      then
        null

      else
        v_category_id
    end,

    case
      when
        v_type = 'income'
      then
        null

      else
        v_source_account_id
    end,

    case
      when
        v_type = 'expense'
      then
        null

      else
        v_destination_account_id
    end,

    v_notes,

    v_is_reimbursable,

    case
      when
        v_is_reimbursable
      then
        'pending'

      else
        'none'
    end,

    null,

    null,

    null,

    null,

    null
  )

  returning *
  into
    v_transaction;


  if
    v_is_reimbursable
  then

    insert into
      public.reimbursement_claims
    (
      user_id,

      transaction_id,

      person_name,

      amount,

      status,

      reimbursed_at
    )

    select
      v_user_id,

      v_transaction.id,

      trim(
        item ->> 'person_name'
      ),

      (
        item ->> 'amount'
      )::numeric,

      'pending',

      null

    from
      jsonb_array_elements(
        v_people
      ) as item;


    select
      coalesce(
        jsonb_agg(
          to_jsonb(c)

          order by
            c.created_at,
            c.id
        ),

        '[]'::jsonb
      )

    into
      v_claims

    from
      public.reimbursement_claims c

    where
      c.transaction_id =
        v_transaction.id

      and

      c.user_id =
        v_user_id;

  end if;


  return
    to_jsonb(
      v_transaction
    )

    ||

    jsonb_build_object(
      'reimbursements',
      v_claims
    );

end;
$$;


-- ============================================================
-- CREATE SPLIT EXPENSE ATOMICALLY
-- ============================================================

create or replace function
public.create_split_expense_atomic(
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare

  v_user_id uuid :=
    auth.uid();


  v_date date;

  v_description text;


  v_total_amount
    numeric(16, 2);


  v_personal_amount
    numeric(16, 2);


  v_reimbursable_amount
    numeric(16, 2);


  v_category_id uuid;

  v_source_account_id uuid;


  v_notes text;


  v_people jsonb;


  v_group_id uuid :=
    gen_random_uuid();


  v_reimbursable_transaction_id
    uuid;


  v_transactions jsonb :=
    '[]'::jsonb;


  v_claims jsonb :=
    '[]'::jsonb;

begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required.';
  end if;


  v_date :=
    (
      p_payload ->> 'date'
    )::date;


  v_description :=
    trim(
      p_payload ->> 'description'
    );


  v_total_amount :=
    (
      p_payload
        ->> 'total_amount'
    )::numeric;


  v_personal_amount :=
    (
      p_payload
        ->> 'personal_amount'
    )::numeric;


  v_category_id :=
    nullif(
      p_payload ->> 'category_id',
      ''
    )::uuid;


  v_source_account_id :=
    nullif(
      p_payload
        ->> 'source_account_id',

      ''
    )::uuid;


  v_notes :=
    nullif(
      trim(
        p_payload ->> 'notes'
      ),

      ''
    );


  v_people :=
    coalesce(
      p_payload
        -> 'reimbursement_people',

      '[]'::jsonb
    );


  if
    v_total_amount <= 0
  then
    raise exception
      'Total amount must be greater than zero.';
  end if;


  if
    v_personal_amount <= 0
  then
    raise exception
      'Personal amount must be greater than zero.';
  end if;


  if
    v_personal_amount >=
    v_total_amount
  then
    raise exception
      'Your portion must be smaller than the total payment.';
  end if;


  v_reimbursable_amount :=
    round(
      v_total_amount -
      v_personal_amount,

      2
    );


  perform
    public
      .validate_reimbursement_people_payload(
        v_people,

        v_reimbursable_amount
      );


  /*
   * Both rows are inserted by ONE SQL statement.
   */
  insert into
    public.transactions
  (
    user_id,

    type,

    date,

    description,

    amount,

    category_id,

    source_account_id,

    destination_account_id,

    notes,

    is_reimbursable,

    reimbursement_status,

    reimbursed_by,

    reimbursed_at,

    reimburses_transaction_id,

    reimbursement_claim_id,

    transaction_group_id
  )

  values

  (
    v_user_id,

    'expense',

    v_date,

    v_description,

    v_personal_amount,

    v_category_id,

    v_source_account_id,

    null,

    v_notes,

    false,

    'none',

    null,

    null,

    null,

    null,

    v_group_id
  ),

  (
    v_user_id,

    'expense',

    v_date,

    v_description,

    v_reimbursable_amount,

    v_category_id,

    v_source_account_id,

    null,

    v_notes,

    true,

    'pending',

    null,

    null,

    null,

    null,

    v_group_id
  );


  select
    t.id

  into
    v_reimbursable_transaction_id

  from
    public.transactions t

  where
    t.user_id =
      v_user_id

    and

    t.transaction_group_id =
      v_group_id

    and

    t.is_reimbursable =
      true

  limit 1;


  if
    v_reimbursable_transaction_id
    is null
  then
    raise exception
      'Unable to create the reimbursable split transaction.';
  end if;


  insert into
    public.reimbursement_claims
  (
    user_id,

    transaction_id,

    person_name,

    amount,

    status,

    reimbursed_at
  )

  select
    v_user_id,

    v_reimbursable_transaction_id,

    trim(
      item ->> 'person_name'
    ),

    (
      item ->> 'amount'
    )::numeric,

    'pending',

    null

  from
    jsonb_array_elements(
      v_people
    ) as item;


  select
    coalesce(
      jsonb_agg(
        to_jsonb(t)

        order by
          t.created_at,
          t.id
      ),

      '[]'::jsonb
    )

  into
    v_transactions

  from
    public.transactions t

  where
    t.user_id =
      v_user_id

    and

    t.transaction_group_id =
      v_group_id;


  select
    coalesce(
      jsonb_agg(
        to_jsonb(c)

        order by
          c.created_at,
          c.id
      ),

      '[]'::jsonb
    )

  into
    v_claims

  from
    public.reimbursement_claims c

  where
    c.user_id =
      v_user_id

    and

    c.transaction_id =
      v_reimbursable_transaction_id;


  return
    jsonb_build_object(

      'group_id',
      v_group_id,

      'total_amount',
      v_total_amount,

      'personal_amount',
      v_personal_amount,

      'reimbursable_amount',
      v_reimbursable_amount,

      'transactions',
      v_transactions,

      'reimbursements',
      v_claims
    );

end;
$$;


-- ============================================================
-- UPDATE TRANSACTION ATOMICALLY
-- ============================================================

create or replace function
public.update_transaction_atomic(
  p_transaction_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare

  v_user_id uuid :=
    auth.uid();


  v_current
    public.transactions%rowtype;


  v_updated
    public.transactions%rowtype;


  v_type text;

  v_date date;

  v_description text;

  v_amount
    numeric(16, 2);


  v_category_id uuid;

  v_source_account_id uuid;

  v_destination_account_id uuid;


  v_notes text;


  v_is_reimbursable
    boolean;


  v_people jsonb;


  v_claims jsonb :=
    '[]'::jsonb;

begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required.';
  end if;


  /*
   * Lock transaction row.
   *
   * This prevents a reimbursement operation from changing
   * the same expense while it is being edited.
   */
  select
    t.*

  into
    v_current

  from
    public.transactions t

  where
    t.id =
      p_transaction_id

    and

    t.user_id =
      v_user_id

  for update;


  if
    not found
  then
    raise exception
      'Transaction not found.';
  end if;


  if
    v_current
      .reimbursement_claim_id
    is not null
  then
    raise exception
      'Reimbursement receipts cannot be edited directly.';
  end if;


  if
    v_current
      .transaction_group_id
    is not null
  then
    raise exception
      'Split expense components cannot be edited individually. Delete the split and create it again.';
  end if;


  if exists (
    select 1

    from
      public.reimbursement_claims c

    where
      c.transaction_id =
        p_transaction_id

      and

      c.user_id =
        v_user_id

      and

      c.status =
        'reimbursed'
  )
  then
    raise exception
      'This expense cannot be edited because one or more people have already reimbursed it.';
  end if;


  v_type :=
    p_payload ->> 'type';


  v_date :=
    (
      p_payload ->> 'date'
    )::date;


  v_description :=
    trim(
      p_payload ->> 'description'
    );


  v_amount :=
    (
      p_payload ->> 'amount'
    )::numeric;


  v_category_id :=
    nullif(
      p_payload ->> 'category_id',
      ''
    )::uuid;


  v_source_account_id :=
    nullif(
      p_payload ->> 'source_account_id',
      ''
    )::uuid;


  v_destination_account_id :=
    nullif(
      p_payload ->> 'destination_account_id',
      ''
    )::uuid;


  v_notes :=
    nullif(
      trim(
        p_payload ->> 'notes'
      ),

      ''
    );


  v_is_reimbursable :=
    coalesce(
      (
        p_payload
          ->> 'is_reimbursable'
      )::boolean,

      false
    );


  v_people :=
    coalesce(
      p_payload
        -> 'reimbursement_people',

      '[]'::jsonb
    );


  if
    v_type not in (
      'income',
      'expense',
      'transfer'
    )
  then
    raise exception
      'Invalid transaction type.';
  end if;


  if
    v_amount <= 0
  then
    raise exception
      'Transaction amount must be greater than zero.';
  end if;


  if
    v_is_reimbursable
    and
    v_type <> 'expense'
  then
    raise exception
      'Only expenses can be reimbursable.';
  end if;


  if
    v_is_reimbursable
  then

    perform
      public
        .validate_reimbursement_people_payload(
          v_people,

          v_amount
        );

  elsif
    jsonb_typeof(
      v_people
    ) = 'array'

    and

    jsonb_array_length(
      v_people
    ) > 0
  then

    raise exception
      'Reimbursement people are only allowed for reimbursable expenses.';

  end if;


  /*
   * Update original transaction.
   */
  update
    public.transactions

  set
    type =
      v_type,

    date =
      v_date,

    description =
      v_description,

    amount =
      v_amount,

    category_id =
      case

        when
          v_type =
          'transfer'
        then
          null

        else
          v_category_id

      end,

    source_account_id =
      case

        when
          v_type =
          'income'
        then
          null

        else
          v_source_account_id

      end,

    destination_account_id =
      case

        when
          v_type =
          'expense'
        then
          null

        else
          v_destination_account_id

      end,

    notes =
      v_notes,

    is_reimbursable =
      v_is_reimbursable,

    reimbursement_status =
      case

        when
          v_is_reimbursable
        then
          'pending'

        else
          'none'

      end,

    reimbursed_by =
      null,

    reimbursed_at =
      null,

    reimburses_transaction_id =
      null,

    reimbursement_claim_id =
      null,

    transaction_group_id =
      null

  where
    id =
      p_transaction_id

    and

    user_id =
      v_user_id

  returning *
  into
    v_updated;


  /*
   * Remove old claims.
   *
   * This and the transaction update are in the SAME database
   * transaction.
   *
   * If claim recreation fails below, this delete and the
   * transaction update both roll back.
   */
  delete from
    public.reimbursement_claims

  where
    transaction_id =
      p_transaction_id

    and

    user_id =
      v_user_id;


  if
    v_is_reimbursable
  then

    insert into
      public.reimbursement_claims
    (
      user_id,

      transaction_id,

      person_name,

      amount,

      status,

      reimbursed_at
    )

    select
      v_user_id,

      p_transaction_id,

      trim(
        item ->> 'person_name'
      ),

      (
        item ->> 'amount'
      )::numeric,

      'pending',

      null

    from
      jsonb_array_elements(
        v_people
      ) as item;


    select
      coalesce(

        jsonb_agg(
          to_jsonb(c)

          order by
            c.created_at,
            c.id
        ),

        '[]'::jsonb
      )

    into
      v_claims

    from
      public.reimbursement_claims c

    where
      c.transaction_id =
        p_transaction_id

      and

      c.user_id =
        v_user_id;

  end if;


  return
    to_jsonb(
      v_updated
    )

    ||

    jsonb_build_object(
      'reimbursements',
      v_claims
    );

end;
$$;


-- ============================================================
-- RECORD REIMBURSEMENT ATOMICALLY
-- ============================================================

create or replace function
public.reimburse_claim_atomic(
  p_transaction_id uuid,
  p_claim_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare

  v_user_id uuid :=
    auth.uid();


  v_original
    public.transactions%rowtype;


  v_claim
    public.reimbursement_claims%rowtype;


  v_receipt
    public.transactions%rowtype;


  v_destination_account_id
    uuid;


  v_reimbursement_date
    date;


  v_claim_count
    integer;


  v_remaining_count
    integer;


  v_latest_reimbursed_date
    date;

begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required.';
  end if;


  v_destination_account_id :=
    nullif(
      p_payload
        ->> 'destination_account_id',

      ''
    )::uuid;


  v_reimbursement_date :=
    (
      p_payload ->> 'date'
    )::date;


  /*
   * Lock the parent expense first.
   *
   * All reimbursement requests for the same original expense
   * must acquire this lock.
   *
   * This serializes concurrent reimbursement operations.
   */
  select
    t.*

  into
    v_original

  from
    public.transactions t

  where
    t.id =
      p_transaction_id

    and

    t.user_id =
      v_user_id

  for update;


  if
    not found

    or

    v_original.type <>
      'expense'

    or

    v_original.is_reimbursable <>
      true
  then
    raise exception
      'The reimbursable expense was not found.';
  end if;


  /*
   * Lock claim as well.
   *
   * Two simultaneous requests cannot reimburse the same
   * claim successfully.
   */
  select
    c.*

  into
    v_claim

  from
    public.reimbursement_claims c

  where
    c.id =
      p_claim_id

    and

    c.transaction_id =
      v_original.id

    and

    c.user_id =
      v_user_id

  for update;


  if
    not found
  then
    raise exception
      'Reimbursement claim not found.';
  end if;


  if
    v_claim.status =
      'reimbursed'
  then
    raise exception
      '% has already reimbursed this amount.',
      v_claim.person_name;
  end if;


  if
    v_reimbursement_date <
    v_original.date
  then
    raise exception
      'Reimbursement date cannot be earlier than the expense date.';
  end if;


  if not exists (
    select 1

    from
      public.accounts a

    where
      a.id =
        v_destination_account_id

      and

      a.user_id =
        v_user_id
  )
  then
    raise exception
      'Destination account was not found.';
  end if;


  /*
   * STEP 1
   *
   * Create reimbursement receipt.
   */
  insert into
    public.transactions
  (
    user_id,

    type,

    date,

    description,

    amount,

    category_id,

    source_account_id,

    destination_account_id,

    notes,

    is_reimbursable,

    reimbursement_status,

    reimbursed_by,

    reimbursed_at,

    reimburses_transaction_id,

    reimbursement_claim_id,

    transaction_group_id
  )

  values
  (
    v_user_id,

    'income',

    v_reimbursement_date,

    'Reimbursement from '
      ||
      v_claim.person_name
      ||
      ': '
      ||
      v_original.description,

    v_claim.amount,

    null,

    null,

    v_destination_account_id,

    'Repayment from '
      ||
      v_claim.person_name,

    false,

    'none',

    null,

    null,

    v_original.id,

    v_claim.id,

    null
  )

  returning *
  into
    v_receipt;


  /*
   * STEP 2
   *
   * Update reimbursement claim.
   */
  update
    public.reimbursement_claims

  set
    status =
      'reimbursed',

    reimbursed_at =
      v_reimbursement_date

  where
    id =
      v_claim.id

    and

    user_id =
      v_user_id;


  /*
   * STEP 3
   *
   * Determine whether all claims belonging to the original
   * expense have now been reimbursed.
   */
  select

    count(*),

    count(*)
      filter (
        where
          c.status <>
          'reimbursed'
      ),

    max(
      c.reimbursed_at
    )

  into

    v_claim_count,

    v_remaining_count,

    v_latest_reimbursed_date

  from
    public.reimbursement_claims c

  where
    c.transaction_id =
      v_original.id

    and

    c.user_id =
      v_user_id;


  /*
   * STEP 4
   *
   * Update original expense.
   */
  update
    public.transactions

  set
    reimbursement_status =
      case

        when
          v_claim_count > 0

          and

          v_remaining_count = 0

        then
          'reimbursed'

        else
          'pending'

      end,

    reimbursed_at =
      case

        when
          v_claim_count > 0

          and

          v_remaining_count = 0

        then
          v_latest_reimbursed_date

        else
          null

      end

  where
    id =
      v_original.id

    and

    user_id =
      v_user_id;


  /*
   * If STEP 1, STEP 2, STEP 3, or STEP 4 fails, the entire
   * function call rolls back.
   */
  return
    jsonb_build_object(

      'ok',
      true,

      'person',
      v_claim.person_name,

      'amount',
      v_claim.amount,

      'reimbursement',
      to_jsonb(
        v_receipt
      )
    );

end;
$$;


-- ============================================================
-- RPC PERMISSIONS
-- ============================================================

revoke all
on function
  public.validate_reimbursement_people_payload(
    jsonb,
    numeric
  )
from public;


revoke all
on function
  public.create_transaction_atomic(
    jsonb
  )
from public;


revoke all
on function
  public.create_split_expense_atomic(
    jsonb
  )
from public;


revoke all
on function
  public.update_transaction_atomic(
    uuid,
    jsonb
  )
from public;


revoke all
on function
  public.reimburse_claim_atomic(
    uuid,
    uuid,
    jsonb
  )
from public;


grant execute
on function
  public.validate_reimbursement_people_payload(
    jsonb,
    numeric
  )
to authenticated;


grant execute
on function
  public.create_transaction_atomic(
    jsonb
  )
to authenticated;


grant execute
on function
  public.create_split_expense_atomic(
    jsonb
  )
to authenticated;


grant execute
on function
  public.update_transaction_atomic(
    uuid,
    jsonb
  )
to authenticated;


grant execute
on function
  public.reimburse_claim_atomic(
    uuid,
    uuid,
    jsonb
  )
to authenticated;


commit;