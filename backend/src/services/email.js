import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function validateSmtpConfiguration() {
  const {
    host,
    port,
    user,
    pass,
    from,
  } = config.smtp;

  if (!host) {
    throw new Error(
      'SMTP_HOST is missing in the backend .env file.',
    );
  }

  if (!port) {
    throw new Error(
      'SMTP_PORT is missing or invalid in the backend .env file.',
    );
  }

  if (!user) {
    throw new Error(
      'SMTP_USER is missing in the backend .env file.',
    );
  }

  if (!pass) {
    throw new Error(
      'SMTP_PASS is missing in the backend .env file.',
    );
  }

  if (!from) {
    throw new Error(
      'EMAIL_FROM is missing in the backend .env file.',
    );
  }
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  validateSmtpConfiguration();

  const {
    host,
    port,
    secure,
    user,
    pass,
  } = config.smtp;

  transporter = nodemailer.createTransport({
    host,
    port,

    secure:
      port === 465
        ? true
        : secure,

    auth: {
      user,
      pass,
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return transporter;
}

function createEmailError(error) {
  const providerMessage =
    error?.response ||
    error?.message ||
    'Unknown SMTP error';

  const wrapped = new Error(
    `Unable to send email through SMTP: ${providerMessage}`,
  );

  wrapped.status = 502;

  return wrapped;
}

export async function sendTransactionReminder({
  email,
  name,
}) {
  if (!email) {
    const error = new Error(
      'No destination email address was provided.',
    );

    error.status = 400;

    throw error;
  }

  const mailer = getTransporter();

  const safeName =
    name?.trim() || 'there';

  const safeHtmlName =
    escapeHtml(safeName);

  try {
    const result = await mailer.sendMail({
      from: config.smtp.from,
      to: email,

      subject:
        'Daily transaction reminder | PinkLedger',

      text:
        `Hi ${safeName}, this is your daily reminder to record today's transactions in PinkLedger. If you already entered them, you can ignore this email.`,

      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 560px;
            margin: auto;
            padding: 24px;
            color: #27272a;
          "
        >
          <div
            style="
              background: #fff1f7;
              border: 1px solid #fbcfe8;
              border-radius: 18px;
              padding: 24px;
            "
          >
            <div
              style="
                display: inline-block;
                background: #db2777;
                color: #ffffff;
                border-radius: 12px;
                padding: 8px 12px;
                font-weight: bold;
                margin-bottom: 18px;
              "
            >
              PinkLedger
            </div>

            <h2
              style="
                margin: 0 0 12px;
                color: #db2777;
              "
            >
              Daily transaction reminder
            </h2>

            <p>
              Hi ${safeHtmlName},
            </p>

            <p>
              This is your daily reminder
              to record today's income,
              expenses, or transfers in
              PinkLedger.
            </p>

            <p
              style="
                margin-bottom: 0;
                color: #71717a;
              "
            >
              If you already entered your
              transactions today, you can
              ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    return {
      messageId: result.messageId,
    };
  } catch (error) {
    console.error(
      'SMTP send error:',
      {
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
        response: error?.response,
      },
    );

    throw createEmailError(error);
  }
}