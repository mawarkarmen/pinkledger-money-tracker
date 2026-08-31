# PinkLedger Money Tracker

PinkLedger is a full-stack personal money tracking application.

Technology stack:

- Frontend: React + Vite
- Backend: Node.js + Express.js
- Database: PostgreSQL through Supabase
- Authentication: Supabase Auth
- Email: Nodemailer
- Scheduled reminder processing: standalone reminder worker executed by an external cron service

PinkLedger supports income, expenses, transfers, accounts, monthly category budgets, reimbursements, split expenses, dashboard summaries, CSV export, categories, authentication, and optional daily transaction reminder emails.

---

# 1. Features

## Authentication

- Email and password sign-up.
- Email and password sign-in.
- Supabase Auth.
- Private user profiles.
- Supabase Row Level Security.
- Starter categories are created automatically for new users.
- Reminder preferences are created automatically for new users.

---

## Accounts

Supported account types:

- Cash
- Bank
- E-wallet
- Savings
- Credit card
- Other

Each account contains:

- Account name
- Account type
- Opening balance
- Opening date
- Currency
- Active/archive status

Current account balance is calculated from:

```text
Opening Balance
+
Income
-
Expenses
+
Transfers In
-
Transfers Out
```

Account archiving preserves historical transaction data.

---

## Transactions

Supported transaction types:

- Income
- Expense
- Transfer

Transaction fields include:

- Date
- Description
- Category
- Source account
- Destination account
- Amount
- Notes

Features include:

- Create transaction
- Edit transaction
- Delete transaction
- Search transactions
- Filter by month
- Filter by transaction type
- Filter by account
- CSV export

Transfers do not count as income or expenses.

---

## Reimbursements

Expenses can optionally be marked as reimbursable.

PinkLedger supports:

- One reimbursable expense
- Multiple reimbursement claims for one expense
- Different people reimbursing portions of an expense
- Pending reimbursement status
- Reimbursed status
- Reimbursement receipt transaction
- Outstanding reimbursement calculations

Each reimbursement claim stores:

- Person name
- Amount
- Status
- Reimbursement date

The database validates that reimbursement claims cannot exceed the original reimbursable expense.

---

## Split Expenses

One real-world payment can be split into multiple transaction rows.

Related rows share the same:

```text
transaction_group_id
```

This allows one payment to be divided between:

- Different expense categories
- Personal and reimbursable portions
- Multiple reimbursement claims

---

## Budgets

Monthly budgets are attached to expense categories.

Budget features include:

- Monthly budget amount
- Actual spending
- Remaining budget
- Usage percentage
- Category-based budget tracking

Saving the same category and month updates the existing budget instead of creating a duplicate.

---

## Dashboard

The dashboard provides:

- Opening Balance
- Current Balance
- Period Closing Balance
- Total Income
- Total Expenses
- Net Cash Flow
- Outstanding Reimbursements
- Budget Status
- Expense spending by category
- Recent transactions

---

## Daily Email Reminder

Users can:

- Enable or disable reminders
- Select a reminder time
- Select an IANA timezone
- Send a test email

Reminder delivery uses a standalone worker.

The worker:

1. Loads enabled reminder preferences.
2. Calculates the current date and time in each user's timezone.
3. Checks whether the configured reminder time has arrived.
4. Checks whether the user already recorded a transaction for that local day.
5. Sends an email only if no transaction exists.
6. Updates `last_sent_date` after successful handling.
7. Exits after completing one reminder scan.

The worker is designed to be launched by an external cron service.

---

# 2. Project Structure

```text
pinkledger_money_tracker/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   └── pages/
│   │
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── jobs/
│   │   │   └── runReminders.js
│   │   │
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── email.js
│   │   │   ├── reminderRecipient.js
│   │   │   └── reminderWorker.js
│   │   │
│   │   ├── utils/
│   │   ├── config.js
│   │   ├── server.js
│   │   └── supabase.js
│   │
│   ├── .env.example
│   └── package.json
│
├── supabase/
│   ├── schema.sql
│   │
│   └── migrations/
│       ├── 20260828_reimbursements.sql
│       ├── 20260828_multiple_reimbursements.sql
│       └── 20260828_split_expenses.sql
│
└── README.md
```

---

# 3. Prerequisites

Install:

- Node.js 20 or newer
- npm
- A Supabase project
- SMTP credentials supported by Nodemailer

You will also need:

- Supabase Project URL
- Supabase anon/public key
- Supabase service role key

---

# 4. Database Setup

This section is important.

The database consists of:

1. The base schema.
2. Reimbursement support migration.
3. Multiple reimbursement claims migration.
4. Split expense migration.

Running only `supabase/schema.sql` is not enough for the current application.

---

# 4.1 Fresh Supabase Project

For a completely new Supabase project, run the SQL files in the exact order below.

Do not change the order.

## Step 1

Open:

```text
Supabase Dashboard
→ SQL Editor
```

Run:

```text
supabase/schema.sql
```

in full.

Wait until it completes successfully.

---

## Step 2

Run:

```text
supabase/migrations/20260828_reimbursements.sql
```

in full.

This migration adds reimbursement-related fields to the `transactions` table, including:

```text
is_reimbursable
reimbursement_status
reimbursed_by
reimbursed_at
reimburses_transaction_id
```

It also adds reimbursement validation and database constraints.

---

## Step 3

After Step 2 succeeds, run:

```text
supabase/migrations/20260828_multiple_reimbursements.sql
```

in full.

This migration creates:

```text
reimbursement_claims
```

and adds:

```text
reimbursement_claim_id
```

to transactions.

It also adds:

- Reimbursement claim validation
- Reimbursement claim ownership rules
- Reimbursement receipt validation
- Row Level Security policies
- Database indexes
- Updated-at trigger

Do not run this migration before:

```text
20260828_reimbursements.sql
```

because it depends on reimbursement fields created by the previous migration.

---

## Step 4

After Step 3 succeeds, run:

```text
supabase/migrations/20260828_split_expenses.sql
```

in full.

This migration adds:

```text
transaction_group_id
```

to the `transactions` table.

It also creates the index used for grouped split transactions.

---

# 4.2 Required Migration Order

The complete order is:

```text
1. supabase/schema.sql

2. supabase/migrations/
   20260828_reimbursements.sql

3. supabase/migrations/
   20260828_multiple_reimbursements.sql

4. supabase/migrations/
   20260828_split_expenses.sql
```

Do not skip a migration.

Do not reverse the order.

---

# 4.3 Existing PinkLedger Database

If your Supabase database already contains application data, do not run `schema.sql` again as an upgrade procedure.

Instead, determine which migrations have already been applied.

Apply only the missing migrations, in this order:

```text
20260828_reimbursements.sql

20260828_multiple_reimbursements.sql

20260828_split_expenses.sql
```

Before modifying a production database, create a Supabase backup.

---

# 4.4 Verify Current Database Structure

After completing the migrations, open Supabase SQL Editor and run:

```sql
select
  column_name,
  data_type
from information_schema.columns
where
  table_schema = 'public'
  and table_name = 'transactions'
order by ordinal_position;
```

The `transactions` table should include at least:

```text
id
user_id
type
date
description
amount
category_id
source_account_id
destination_account_id
notes
created_at
updated_at

is_reimbursable
reimbursement_status
reimbursed_by
reimbursed_at
reimburses_transaction_id
reimbursement_claim_id
transaction_group_id
```

Then verify the reimbursement table:

```sql
select
  table_name
from information_schema.tables
where
  table_schema = 'public'
  and table_name = 'reimbursement_claims';
```

Expected result:

```text
reimbursement_claims
```

You can also verify its columns:

```sql
select
  column_name,
  data_type
from information_schema.columns
where
  table_schema = 'public'
  and table_name = 'reimbursement_claims'
order by ordinal_position;
```

Expected columns include:

```text
id
user_id
transaction_id
person_name
amount
status
reimbursed_at
created_at
updated_at
```

---

# 4.5 Row Level Security

The database enables Row Level Security for user-owned data.

RLS applies to:

```text
profiles
accounts
categories
transactions
budgets
reminder_preferences
reimbursement_claims
```

Users can access only records belonging to their own Supabase Auth user ID.

---

# 4.6 New User Initialization

The base schema creates the following database trigger:

```text
on_auth_user_created
```

When a new Supabase Auth user is created, PinkLedger automatically creates:

- Profile
- Reminder preference
- Starter income categories
- Starter expense categories

Starter categories include:

Income:

```text
Salary
Freelance
Other Income
```

Expenses:

```text
Food
Transportation
Shopping
Entertainment
Bills
Health
Other Expense
```

---

# 4.7 Supabase Authentication

In Supabase:

```text
Authentication
→ Providers
→ Email
```

Enable the Email provider.

Email confirmation can be enabled or disabled depending on your deployment requirements.

---

# 4.8 Supabase API Credentials

Copy the following values from your Supabase project:

```text
Project URL
Anon/Public Key
Service Role Key
```

Important:

The Service Role Key bypasses Row Level Security.

It must only exist on the backend.

Never place the service role key in:

```text
frontend/.env
```

Never expose it to browser JavaScript.

Never commit it to Git.

---

# 5. Backend Setup

From the project root:

```bash
cd backend
cp .env.example .env
npm install
```

Edit:

```text
backend/.env
```

Example:

```env
PORT=4000

FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false

SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

EMAIL_FROM="PinkLedger <no-reply@example.com>"
```

Start the backend:

```bash
npm run dev
```

The API runs by default at:

```text
http://localhost:4000/api
```

Health check:

```text
http://localhost:4000/api/health
```

---

# 6. Frontend Setup

Open another terminal.

Run:

```bash
cd frontend
cp .env.example .env
npm install
```

Edit:

```text
frontend/.env
```

Example:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co

VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

VITE_API_URL=http://localhost:4000/api
```

Start Vite:

```bash
npm run dev
```

The local frontend normally runs at:

```text
http://localhost:5173
```

---

# 7. First Use

Recommended workflow:

1. Create a PinkLedger account.
2. Confirm the email if Supabase email confirmation is enabled.
3. Sign in.
4. Create at least one financial account.
5. Enter its opening balance.
6. Enter its opening date.
7. Add income or expense transactions.
8. Add transfer transactions if required.
9. Create monthly budgets.
10. Open Dashboard.
11. Configure reminder preferences in Settings.
12. Test SMTP using Send Test.

---

# 8. Transaction Accounting Rules

## Income

```text
Destination Account += Amount

Total Income += Amount
```

---

## Expense

```text
Source Account -= Amount

Total Expenses += Amount
```

---

## Transfer

```text
Source Account -= Amount

Destination Account += Amount
```

Transfers do not affect:

```text
Total Income
Total Expenses
```

When combined across all accounts:

```text
Transfer Net Effect = 0
```

---

# 9. Opening Balance Logic

PinkLedger uses two different Opening Balance rules.

This behavior is intentional.

---

## First Financial Month

The first financial month is determined from the earliest account opening date.

Example:

```text
Account opening date:
2026-08-31

Manual opening balance:
Rp5,000,000
```

For August 2026:

```text
Opening Balance = Rp5,000,000
```

The value comes directly from the manual account opening balance entered by the user.

The Dashboard identifies this as:

```text
Manual opening balance
```

---

## Following Months

Beginning with the next month, Opening Balance is calculated using carried-forward accounting logic.

Example:

```text
August Opening Balance:
Rp5,000,000

August Expenses:
Rp1,000,000
```

August Closing Balance:

```text
Rp4,000,000
```

September Opening Balance:

```text
Rp4,000,000
```

The Dashboard identifies this as:

```text
Carried forward from previous activity
```

---

## Account Opened During a Later Month

Suppose:

```text
First financial month:
August 2026
```

A second account is opened:

```text
September 15, 2026
```

That account's manual opening balance does not become part of September's beginning-of-month Opening Balance.

It does affect:

```text
September Current Balance
September Period Closing Balance
```

Then it becomes part of the carried-forward Opening Balance for October.

---

# 10. Reimbursement Accounting

A reimbursable expense still reduces the account balance because the user actually paid the money.

Example:

```text
Hotel Expense:
Rp1,000,000
```

Account effect:

```text
- Rp1,000,000
```

If Rp1,000,000 is later reimbursed:

```text
+ Rp1,000,000
```

through a reimbursement receipt transaction.

Reimbursement receipts are distinguished from normal income.

They should not inflate normal income reporting.

---

# 11. Budget Logic

Budgets can only use expense categories.

Calculation:

```text
Remaining =
Budget Amount
-
Actual Spending
```

Usage:

```text
Usage Percentage =
Actual Spending
/
Budget Amount
×
100
```

Example:

```text
Food Budget:
Rp2,000,000

Food Spending:
Rp1,000,000
```

Result:

```text
Remaining:
Rp1,000,000

Usage:
50%
```

Reimbursable expenses are excluded from normal personal budget usage.

---

# 12. Reminder Worker

PinkLedger no longer depends on an in-process `node-cron` scheduler inside Express.

The reminder worker is independent from the API server.

Run one reminder scan manually with:

```bash
cd backend
npm run reminders:run
```

The worker:

```text
starts
↓
loads enabled reminder preferences
↓
checks each user's timezone
↓
checks reminder time
↓
checks today's transactions
↓
resolves recipient email
↓
sends reminder when required
↓
updates last_sent_date
↓
exits
```

---

# 13. Reminder Recipient Resolution

Both the Send Test endpoint and scheduled worker use the same recipient-resolution logic.

Priority:

```text
1. profiles.email

2. Supabase Auth email
```

If the profile does not contain an email address, PinkLedger falls back to the user's Supabase Auth email.

This prevents the situation where:

```text
Send Test works
```

but:

```text
Scheduled email fails
```

only because the profile row is incomplete.

---

# 14. Production Reminder Scheduling

Use an external cron provider to execute:

```bash
npm run reminders:run
```

at regular intervals.

Recommended frequency:

```text
Every 5 minutes
```

Cron expression:

```text
*/5 * * * *
```

The external scheduler starts the worker.

The worker itself decides whether each user is due for a reminder based on:

```text
enabled
reminder_time
timezone
last_sent_date
transactions entered today
```

This architecture means the Express API server does not need to stay alive just to maintain a JavaScript timer.

---

# 15. Security Notes

PinkLedger uses several layers of protection.

## Authentication

All private API routes require a valid Supabase bearer token.

---

## Row Level Security

RLS protects user-owned tables.

Users can access only their own data.

---

## Service Role Key

The Supabase service role key is used only by trusted backend operations.

It must never be exposed to the frontend.

---

## Database Validation

Database triggers verify:

- Transaction account ownership
- Transaction category ownership
- Budget category ownership
- Reimbursement ownership
- Reimbursement claim validity
- Reimbursement receipt validity

---

## Express Security

The backend uses:

- Helmet
- CORS
- Rate limiting
- JSON request size limits
- Zod request validation

---

## Environment Files

Never commit real:

```text
.env
```

files.

Never commit:

```text
SUPABASE_SERVICE_ROLE_KEY
SMTP_PASS
```

or other production secrets.

---

# 16. Currency Assumption

PinkLedger currently assumes one primary currency per user.

Account records contain a currency code, but the application does not currently perform foreign-exchange conversion.

For accurate combined balances, use the same currency across accounts.

Example:

```text
IDR + IDR
```

is valid for combined totals.

Directly combining:

```text
IDR + USD
```

is not financially meaningful without an FX conversion layer.

---

# 17. Development Commands

## Backend Development Server

```bash
cd backend
npm run dev
```

---

## Backend Production Server

```bash
cd backend
npm start
```

---

## Run Reminder Worker Manually

```bash
cd backend
npm run reminders:run
```

---

## Backend Syntax Check

```bash
cd backend
npm run check
```

---

## Frontend Development Server

```bash
cd frontend
npm run dev
```

---

## Frontend Production Build

```bash
cd frontend
npm run build
```

---

# 18. Recommended Database Setup Checklist

For a new Supabase project:

```text
[ ] Run supabase/schema.sql

[ ] Run 20260828_reimbursements.sql

[ ] Run 20260828_multiple_reimbursements.sql

[ ] Run 20260828_split_expenses.sql

[ ] Verify transactions columns

[ ] Verify reimbursement_claims table

[ ] Enable Supabase Email authentication

[ ] Copy Project URL

[ ] Copy Anon Key

[ ] Copy Service Role Key

[ ] Configure backend environment variables

[ ] Configure frontend environment variables
```

Do not start application testing until all four SQL files have completed successfully.

---

# 19. Current Database Tables

After all migrations, the application uses these primary tables:

```text
profiles

accounts

categories

transactions

budgets

reminder_preferences

reimbursement_claims
```

---

# 20. Production Improvements

Potential future improvements include:

- Database migration tracking
- Automated Supabase CLI migrations
- Database transaction/RPC handling for multi-step financial writes
- Recurring transactions
- Savings goals
- Receipt attachments
- Bank CSV import
- Account reconciliation
- Foreign exchange conversion
- Advanced reports
- PDF reports
- Password reset
- Automated testing
- Continuous integration
- Scheduled job monitoring
- Centralized email queue

---

# Important Limitation

The repository cannot contain real private credentials.

Before authentication, database access, email delivery, or scheduled reminders can work, you must provide your own:

```text
Supabase credentials
SMTP credentials
Production environment configuration
```

Keep all secrets outside the frontend and outside version control.