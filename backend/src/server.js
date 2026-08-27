import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';

import { config } from './config.js';

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

import {
  startReminderScheduler,
} from './services/reminderScheduler.js';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: '200kb',
  }),
);

/*
 * Rate limiting is useful in production,
 * but it should not interfere with local
 * development and debugging.
 */
if (config.nodeEnv === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 60_000,

    limit:
      config.rateLimitMax,

    standardHeaders: 'draft-7',

    legacyHeaders: false,

    handler: (_req, res) => {
      res.status(429).json({
        error:
          'Too many requests. Please wait a moment and try again.',
      });
    },
  });

  app.use('/api', apiLimiter);
} else {
  console.log(
    'API rate limiter disabled in development mode.',
  );
}

app.get(
  '/api/health',
  (_req, res) => {
    res.json({
      ok: true,
      service:
        'pinkledger-api',
      environment:
        config.nodeEnv,
    });
  },
);

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
 * 404 handler for unknown API routes.
 */
app.use(
  '/api',
  (req, res) => {
    res.status(404).json({
      error:
        `API route not found: ${req.method} ${req.originalUrl}`,
    });
  },
);

/*
 * Central error handler.
 */
app.use(
  (
    error,
    _req,
    res,
    _next,
  ) => {
    console.error(
      'PinkLedger API error:',
      error,
    );

    if (
      error instanceof ZodError
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

    const status =
      Number(
        error.status ||
          error.statusCode,
      ) || 500;

    return res
      .status(status)
      .json({
        error:
          error.message ||
          'Unexpected server error.',
      });
  },
);

app.listen(
  config.port,
  () => {
    console.log(
      `PinkLedger API running on http://localhost:${config.port}`,
    );

    startReminderScheduler();
  },
);