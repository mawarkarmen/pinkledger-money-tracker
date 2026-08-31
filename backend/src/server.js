import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';

import {
  config,
} from './config.js';

import {
  requireAuth,
} from './middleware/auth.js';

import accountsRouter from './routes/accounts.js';
import categoriesRouter from './routes/categories.js';
import transactionsRouter from './routes/transactions.js';
import budgetsRouter from './routes/budgets.js';
import dashboardRouter from './routes/dashboard.js';
import remindersRouter from './routes/reminders.js';
import profileRouter from './routes/profile.js';


const app = express();


/*
 * ==========================================================
 * SECURITY
 * ==========================================================
 */
app.use(
  helmet(),
);


app.use(
  cors({
    origin:
      config.frontendUrl,

    credentials:
      true,

    exposedHeaders: [
      'X-Page',
      'X-Page-Size',
      'X-Total-Count',
      'X-Total-Pages',
    ],
  }),
);


app.use(
  express.json({
    limit:
      '200kb',
  }),
);


/*
 * ==========================================================
 * RATE LIMITING
 * ==========================================================
 */
if (
  config.nodeEnv ===
  'production'
) {
  const apiLimiter =
    rateLimit({
      windowMs:
        60_000,

      limit:
        config.rateLimitMax,

      standardHeaders:
        'draft-7',

      legacyHeaders:
        false,

      handler:
        (
          _req,
          res,
        ) => {
          res
            .status(429)
            .json({
              error:
                'Too many requests. Please wait a moment and try again.',
            });
        },
    });


  app.use(
    '/api',
    apiLimiter,
  );

} else {
  console.log(
    'API rate limiter disabled in development mode.',
  );
}


/*
 * ==========================================================
 * HEALTH CHECK
 * ==========================================================
 */
app.get(
  '/api/health',
  (
    _req,
    res,
  ) => {
    res.json({
      ok: true,
      service:
        'pinkledger-api',
      environment:
        config.nodeEnv,
    });
  },
);


/*
 * ==========================================================
 * API ROUTES
 * ==========================================================
 */
app.use(
  '/api/accounts',
  requireAuth,
  accountsRouter,
);


app.use(
  '/api/categories',
  requireAuth,
  categoriesRouter,
);


app.use(
  '/api/transactions',
  requireAuth,
  transactionsRouter,
);


app.use(
  '/api/budgets',
  requireAuth,
  budgetsRouter,
);


app.use(
  '/api/dashboard',
  requireAuth,
  dashboardRouter,
);


app.use(
  '/api/reminders',
  requireAuth,
  remindersRouter,
);


app.use(
  '/api/profile',
  requireAuth,
  profileRouter,
);


/*
 * ==========================================================
 * 404 HANDLER
 * ==========================================================
 */
app.use(
  '/api',
  (
    req,
    res,
  ) => {
    res
      .status(404)
      .json({
        error:
          `API route not found: ${req.method} ${req.originalUrl}`,
      });
  },
);


/*
 * ==========================================================
 * SAFE DATABASE / BUSINESS ERROR MAPPING
 * ==========================================================
 *
 * Database errors may contain table names, SQL fragments,
 * constraint names, or other implementation details.
 *
 * Only known business-rule messages are allowed through to
 * the browser. Unknown server errors are logged internally
 * and returned as a generic 500 response.
 */
function safeBusinessError(
  error,
) {
  const message =
    String(
      error?.message ||
      '',
    );


  const rules = [
    {
      match:
        'Account currency must match profile currency',
      status: 400,
    },
    {
      match:
        'Account currency must be a valid three-letter currency code.',
      status: 400,
    },
    {
      match:
        'Profile currency must be a valid three-letter currency code.',
      status: 400,
    },
    {
      match:
        'Profile currency cannot be changed after financial accounts exist.',
      status: 409,
    },
    {
      match:
        'Transaction date cannot be earlier than source account opening date',
      status: 400,
    },
    {
      match:
        'Transaction date cannot be earlier than destination account opening date',
      status: 400,
    },
    {
      match:
        'Account opening date cannot be later than an existing transaction date.',
      status: 400,
    },
    {
      match:
        'An account with a non-zero balance cannot be archived.',
      status: 409,
    },
    {
      match:
        'Source account is archived.',
      status: 409,
    },
    {
      match:
        'Destination account is archived.',
      status: 409,
    },
    {
      match:
        'Transactions belonging to an archived source account cannot be deleted.',
      status: 409,
    },
    {
      match:
        'Transactions belonging to an archived destination account cannot be deleted.',
      status: 409,
    },
    {
      match:
        'Month must be in YYYY-MM format.',
      status: 400,
    },
  ];


  const rule =
    rules.find(
      (item) =>
        message.includes(
          item.match,
        ),
    );


  if (!rule) {
    return null;
  }


  return {
    status:
      rule.status,

    message:
      message,
  };
}


/*
 * ==========================================================
 * CENTRAL ERROR HANDLER
 * ==========================================================
 */
app.use(
  (
    error,
    _req,
    res,
    _next,
  ) => {
    /*
     * Full technical error remains server-side only.
     */
    console.error(
      'PinkLedger API error:',
      error,
    );


    if (
      error instanceof
      ZodError
    ) {
      return res
        .status(400)
        .json({
          error:
            error.issues
              .map(
                (issue) =>
                  issue.message,
              )
              .join(' '),
        });
    }


    /*
     * Errors deliberately created by our application routes
     * may safely expose their messages when they are 4xx.
     */
    const explicitStatus =
      Number(
        error.status ||
        error.statusCode,
      );


    if (
      Number.isInteger(
        explicitStatus,
      ) &&
      explicitStatus >= 400 &&
      explicitStatus < 500
    ) {
      return res
        .status(
          explicitStatus,
        )
        .json({
          error:
            error.message ||
            'The request could not be completed.',
        });
    }


    /*
     * Direct PostgreSQL trigger/business-rule failures do not
     * always arrive with an HTTP status. Map only known safe
     * messages.
     */
    const businessError =
      safeBusinessError(
        error,
      );


    if (
      businessError
    ) {
      return res
        .status(
          businessError.status,
        )
        .json({
          error:
            businessError.message,
        });
    }


    /*
     * Never expose unknown database or server details.
     */
    return res
      .status(500)
      .json({
        error:
          'An unexpected server error occurred. Please try again.',
      });
  },
);


/*
 * ==========================================================
 * START EXPRESS
 * ==========================================================
 *
 * Scheduled reminders are handled separately by:
 *
 * npm run reminders:run
 */
app.listen(
  config.port,
  () => {
    console.log(
      `PinkLedger API running on http://localhost:${config.port}`,
    );
  },
);
