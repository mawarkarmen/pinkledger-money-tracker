import {
  useEffect,
  useState,
} from 'react';

import {
  BellRing,
  Mail,
  Save,
  Send,
} from 'lucide-react';

import { api } from '../lib/api';

export default function SettingsPage() {
  const browserTimezone =
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone || 'UTC';

  const [profile, setProfile] =
    useState({
      full_name: '',
      email: '',
      currency: 'IDR',
    });

  const [reminder, setReminder] =
    useState({
      enabled: false,
      reminder_time: '20:00',
      timezone: browserTimezone,
    });

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [
    savingReminder,
    setSavingReminder,
  ] = useState(false);

  const [
    sendingTest,
    setSendingTest,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [
        profileData,
        reminderData,
      ] = await Promise.all([
        api('/profile'),
        api('/reminders'),
      ]);

      setProfile({
        full_name:
          profileData.full_name || '',

        email:
          profileData.email || '',

        currency:
          profileData.currency || 'IDR',
      });

      setReminder({
        enabled: Boolean(
          reminderData.enabled,
        ),

        reminder_time: String(
          reminderData.reminder_time ||
            '20:00',
        ).slice(0, 5),

        timezone:
          !reminderData.timezone ||
          reminderData.timezone === 'UTC'
            ? browserTimezone
            : reminderData.timezone,
      });
    } catch (err) {
      setError(
        err.message ||
          'Unable to load settings.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile(
    event,
  ) {
    event.preventDefault();

    setSavingProfile(true);
    setError('');
    setMessage('');

    try {
      const data = await api(
        '/profile',
        {
          method: 'PUT',

          body: JSON.stringify({
            full_name:
              profile.full_name,

            currency:
              profile.currency,
          }),
        },
      );

      setProfile(data);

      setMessage(
        'Profile settings saved.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveReminder(
    event,
  ) {
    event.preventDefault();

    setSavingReminder(true);
    setError('');
    setMessage('');

    try {
      await api('/reminders', {
        method: 'PUT',

        body: JSON.stringify({
          enabled: reminder.enabled,

          reminder_time:
            reminder.reminder_time,

          timezone:
            reminder.timezone ||
            browserTimezone,
        }),
      });

      setMessage(
        'Reminder settings saved.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingReminder(false);
    }
  }

  async function sendTest() {
    if (sendingTest) return;

    setSendingTest(true);
    setError('');
    setMessage('');

    try {
      const result = await api(
        '/reminders/test',
        {
          method: 'POST',
        },
      );

      const destination =
        result?.sent_to
          ? ` to ${result.sent_to}`
          : '';

      setMessage(
        `Test reminder email sent${destination}.`,
      );
    } catch (err) {
      setError(
        err.message ||
          'Unable to send the test email.',
      );
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-panel">
        <div className="loader" />

        Loading settings...
      </div>
    );
  }

  return (
    <div className="page-stack animate-in">
      <div className="page-toolbar">
        <div>
          <h2>Preferences</h2>

          <p>
            Manage your profile,
            display currency, and daily
            transaction reminder.
          </p>
        </div>
      </div>

      {message && (
        <div className="alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      <section className="settings-grid">
        <form
          className="panel form-stack"
          onSubmit={saveProfile}
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Profile
              </span>

              <h3>
                Personal settings
              </h3>
            </div>

            <Save size={19} />
          </div>

          <label>
            <span>Name</span>

            <input
              value={
                profile.full_name || ''
              }
              onChange={(event) =>
                setProfile({
                  ...profile,

                  full_name:
                    event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>Email</span>

            <div className="input-with-icon">
              <Mail size={17} />

              <input
                value={
                  profile.email || ''
                }
                disabled
              />
            </div>
          </label>

          <label>
            <span>Currency</span>

            <input
              required
              maxLength="3"
              value={
                profile.currency || 'IDR'
              }
              onChange={(event) =>
                setProfile({
                  ...profile,

                  currency:
                    event.target.value
                      .toUpperCase(),
                })
              }
            />
          </label>

          <button
            type="submit"
            className="button primary"
            disabled={savingProfile}
          >
            {savingProfile
              ? 'Saving...'
              : 'Save profile'}
          </button>
        </form>

        <form
          className="panel form-stack"
          onSubmit={saveReminder}
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Email reminder
              </span>

              <h3>
                Daily transaction
                check-in
              </h3>
            </div>

            <BellRing size={19} />
          </div>

          <label className="toggle-row">
            <div>
              <strong>
                Enable daily reminder
              </strong>

              <span>
                Only sends when no
                transaction has been
                recorded for that local
                date.
              </span>
            </div>

            <input
              type="checkbox"
              checked={reminder.enabled}
              onChange={(event) =>
                setReminder({
                  ...reminder,

                  enabled:
                    event.target
                      .checked,
                })
              }
            />
          </label>

          <label>
            <span>Reminder time</span>

            <input
              type="time"
              value={
                reminder.reminder_time
              }
              onChange={(event) =>
                setReminder({
                  ...reminder,

                  reminder_time:
                    event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>Timezone</span>

            <input
              value={reminder.timezone}
              onChange={(event) =>
                setReminder({
                  ...reminder,

                  timezone:
                    event.target.value,
                })
              }
            />

            <small>
              Detected:{' '}
              {browserTimezone}
            </small>
          </label>

          <div className="form-actions spread">
            <button
              type="button"
              className="button secondary"
              onClick={sendTest}
              disabled={sendingTest}
            >
              <Send size={16} />

              {sendingTest
                ? 'Sending...'
                : 'Send test'}
            </button>

            <button
              type="submit"
              className="button primary"
              disabled={savingReminder}
            >
              {savingReminder
                ? 'Saving...'
                : 'Save reminder'}
            </button>
          </div>
        </form>
      </section>

      <article className="panel note-panel">
        <strong>
          How the reminder works
        </strong>

        <p>
          The backend scheduler checks
          enabled preferences every five
          minutes. After the selected
          local reminder time, it checks
          whether a transaction exists
          for the user's local date. If
          no transaction exists, one
          reminder email is sent for that
          date.
        </p>
      </article>
    </div>
  );
}