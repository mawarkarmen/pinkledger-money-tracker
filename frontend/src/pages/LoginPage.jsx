import { useState } from 'react';
import { CheckCircle2, Sparkles, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: authError } = await signIn(form.email, form.password);
        if (authError) throw authError;
      } else {
        const { data, error: authError } = await signUp(form.email, form.password, form.fullName);
        if (authError) throw authError;
        if (!data.session) {
          setMessage('Account created. Check your email to confirm the account, then sign in.');
          setMode('login');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand auth-brand">
          <div className="brand-mark">P</div>
          <div><strong>PinkLedger</strong><span>Money tracker</span></div>
        </div>
        <div className="auth-copy">
          <span className="pill"><Sparkles size={15} /> Simple personal finance</span>
          <h1>Know where your money goes, every day.</h1>
          <p>Track income, expenses, transfers, accounts, and monthly budgets from one calm dashboard.</p>
          <ul>
            <li><CheckCircle2 size={18} /> Monthly financial summaries</li>
            <li><CheckCircle2 size={18} /> Category-based budget tracking</li>
            <li><CheckCircle2 size={18} /> Optional daily email reminders</li>
          </ul>
        </div>
        <div className="auth-orbit"><WalletCards size={44} /></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">Welcome</span>
          <h2>{mode === 'login' ? 'Sign in to PinkLedger' : 'Create your account'}</h2>
          <p>{mode === 'login' ? 'Continue managing your personal finances.' : 'Start with a private workspace for your money.'}</p>

          <form className="form-stack" onSubmit={submit}>
            {mode === 'signup' ? (
              <label>
                <span>Full name</span>
                <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Your name" />
              </label>
            ) : null}
            <label>
              <span>Email</span>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </label>
            <label>
              <span>Password</span>
              <input required minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" />
            </label>
            {error ? <div className="alert error">{error}</div> : null}
            {message ? <div className="alert success">{message}</div> : null}
            <button className="button primary wide" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>

          <button className="text-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </div>
      </section>
    </main>
  );
}
