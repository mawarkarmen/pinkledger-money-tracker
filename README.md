<<<<<<< HEAD
# PinkLedger Money Tracker

PinkLedger is a full-stack personal money tracking starter application built with the requested stack:

- Frontend: React + Vite
- Backend: Node.js + Express.js
- Database and authentication: Supabase
- Email: Nodemailer
- Scheduler: node-cron

The interface uses a pink-and-white visual system with responsive layouts and subtle animations. It supports income, expenses, transfers, accounts, monthly category budgets, dashboard summaries, CSV export, categories, authentication, and optional daily transaction reminder emails.

## 1. Features

### Authentication
- Email/password sign-up and sign-in with Supabase Auth.
- A private profile, account set, transaction history, categories, budgets, and reminder preference per user.
- Supabase Row Level Security policies isolate each user's data.

### Transactions
- Transaction types: Income, Expense, Transfer.
- Fields: date, description, category, source account, destination account, amount, notes.
- Dynamic form fields based on transaction type.
- Edit and delete transactions.
- Search and filters by month, type, and account.
- CSV export.
- Transfers do not count as income or expenses.

### Accounts
- Cash, bank, e-wallet, savings, credit card, and other account types.
- Opening balance and opening date.
- Current balance calculated from opening balance plus transaction history.
- Account archiving preserves historical data.

### Budgets
- Monthly budgets by expense category.
- Actual spending, remaining budget, utilization percentage, and status labels.
- Upsert behavior means saving the same category and month updates its budget.

### Dashboard
- Opening Balance.
- Current Balance for the current month, or Period Closing Balance for historical months.
- Total Income.
- Total Expenses.
- Net Cash Flow.
- Budget Status.
- Expense-by-category visualization.
- Recent transactions.

### Daily email reminder
- User can enable or disable reminders.
- User chooses local reminder time and IANA timezone.
- Backend checks every five minutes.
- After the selected reminder time, it checks whether the user already has a transaction dated for that local day.
- If at least one transaction exists, no email is sent.
- If no transaction exists, one email reminder is sent and the date is marked handled to prevent duplicates.
- A "Send test" button is available in Settings.

## 2. Project structure

```text
pinkledger_money_tracker/
  frontend/
    src/
      components/
      context/
      lib/
      pages/
  backend/
    src/
      middleware/
      routes/
      services/
      utils/
  supabase/
    schema.sql
  README.md
```

## 3. Prerequisites

Install:

- Node.js 20 or newer recommended.
- npm.
- A Supabase project.
- SMTP credentials for an email provider supported by Nodemailer.

## 4. Supabase setup

1. Create a new Supabase project.
2. Open SQL Editor in Supabase.
3. Run `supabase/schema.sql` in full.
4. In Supabase Authentication settings, enable Email provider.
5. Copy these values from the Supabase project settings:
   - Project URL.
   - Anon/public key.
   - Service role key.

Important: the service role key belongs only in the backend `.env`. Never put it in the Vite frontend or commit it to Git.

The SQL schema creates Row Level Security policies for all user-owned tables. It also creates a trigger that initializes a profile, reminder preference, and starter categories when a new Supabase Auth user is created.

## 5. Backend setup

From the project root:

```bash
cd backend
cp .env.example .env
npm install
```

Edit `backend/.env`:

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

DISABLE_REMINDER_CRON=false
```

Start the backend:

```bash
npm run dev
```

The API will run at `http://localhost:4000/api` by default.

## 6. Frontend setup

Open a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
```

Edit `frontend/.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_API_URL=http://localhost:4000/api
```

Start Vite:

```bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## 7. First-use workflow

1. Create an account on the PinkLedger sign-up screen.
2. If Supabase email confirmation is enabled, confirm the email and sign in.
3. Create at least one financial account, for example Main Bank.
4. Add income, expense, or transfer transactions.
5. Add monthly category budgets.
6. Open Dashboard and select a reporting month.
7. Open Settings to enable the daily email reminder.
8. Use Send test to verify SMTP configuration.

## 8. Transaction accounting rules

Income:

```text
Destination account balance += amount
Total Income += amount
```

Expense:

```text
Source account balance -= amount
Total Expenses += amount
```

Transfer:

```text
Source account balance -= amount
Destination account balance += amount
Total Income unchanged
Total Expenses unchanged
```

Combined balance:

```text
Opening balances + income - expenses
```

Transfers cancel out when calculating the combined balance across all accounts.

## 9. Opening balance logic

Each account has an opening balance and opening date.

For a selected month, the dashboard opening balance is the sum of qualifying account opening balances plus all income and expense effects before the first day of the selected month. Accounts opened after the selected month starts are not included in that month's opening balance.

## 10. Budget logic

Budgets are attached only to expense categories.

```text
Remaining = Budget - Actual spending in that category
Usage % = Actual spending / Budget * 100
```

Suggested UI statuses used by the frontend:

- Below 70%: On track.
- 70% to 89%: Approaching limit.
- 90% to 99%: Near limit.
- 100% or more: Over budget.

Dashboard Budget Status counts spending only for categories that have a budget in the selected month.

## 11. Reminder scheduler and deployment

The reminder scheduler runs inside the Express server process using `node-cron`. For production, deploy the backend to an environment that keeps a Node process running continuously, such as a VM or an always-on application service.

If the backend is deployed to a serverless platform that sleeps or only runs on requests, the in-process cron scheduler will not be reliable. In that situation, move the scheduled invocation to the hosting platform's cron facility or another scheduler and call equivalent reminder logic.

Only the backend receives SMTP credentials and the Supabase service role key.

## 12. Security notes

- Supabase RLS is enabled for profiles, accounts, categories, transactions, budgets, and reminder preferences.
- API requests require a Supabase bearer token.
- User-facing database operations use a Supabase client carrying that user's JWT, so RLS remains active.
- The service role key is used only by backend administrative operations such as the reminder scheduler.
- Transaction and budget triggers verify referenced accounts and categories belong to the same user.
- Express includes Helmet and rate limiting.
- Request bodies are validated with Zod.
- Email HTML escapes the user's display name before insertion.
- Never commit real `.env` files or SMTP credentials.

For a public production deployment, also configure HTTPS, production CORS origins, log monitoring, database backups, and an SMTP provider with appropriate domain authentication.

## 13. Currency assumption

This starter is designed around one primary currency per user. Account rows contain a currency code for display, but the application does not perform foreign-exchange conversion. For accurate combined balances, use the same currency across accounts unless FX conversion is implemented later.

## 14. Production enhancements worth adding later

Potential Phase 2 work:

- Recurring transactions.
- Savings goals.
- Receipt attachments.
- Import from CSV or bank exports.
- Account reconciliation.
- Multiple-currency conversion with dated FX rates.
- Advanced reports and downloadable PDF reports.
- Password reset and richer account-management screens.
- Automated tests and CI/CD.
- Centralized job queue for large-scale email delivery.

## 15. Development commands

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Production frontend build:

```bash
cd frontend
npm run build
```

Production backend:

```bash
cd backend
npm start
```

## Important limitation

The source code is complete as an application starter, but it cannot contain your private Supabase keys or SMTP credentials. You must provide those values in local or deployment environment variables before authentication, database access, and email delivery can function.
=======
# pinkledger-money-tracker
A personal finance tracking application built with React, Express, Supabase, and Nodemailer.
>>>>>>> 538143b78fad2fdeeba001921a70f59cdcef6137
