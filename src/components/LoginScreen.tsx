import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowLeft, KeyRound, ShieldQuestion, User, Users, Lock } from 'lucide-react';
import { RECOVERY_QUESTIONS } from '../constants/recoveryQuestions';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<{ error?: string } | null>;
  onRegister: (name: string, email: string, password: string, recovery: { q1: string; a1: string; q2: string; a2: string }) => Promise<{ error?: string } | null>;
  onGuestLogin: (name: string) => Promise<{ error?: string } | null>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister, onGuestLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'guest'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState<{ id: string; name: string }[]>([]);

  // Recovery questions (registration + forgot-password)
  const [recoveryQ1, setRecoveryQ1] = useState(RECOVERY_QUESTIONS[0]);
  const [recoveryA1, setRecoveryA1] = useState('');
  const [recoveryQ2, setRecoveryQ2] = useState(RECOVERY_QUESTIONS[1]);
  const [recoveryA2, setRecoveryA2] = useState('');

  // Forgot-password: step 1 = email, step 2 = questions, step 3 = new password
  const [forgotActive, setForgotActive] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotQuestions, setForgotQuestions] = useState<{ q1: string; q2: string } | null>(null);
  const [forgotAnswer1, setForgotAnswer1] = useState('');
  const [forgotAnswer2, setForgotAnswer2] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotDone, setForgotDone] = useState('');

  useEffect(() => {
    if (mode === 'guest') {
      fetch('/api/auth/guests')
        .then((r) => r.json())
        .then((d) => setGuests(d.guests || []))
        .catch(() => setGuests([]));
    }
  }, [mode]);

  const startForgot = () => {
    setMode('login');
    setError('');
    setForgotActive(true);
    setForgotStep(1);
    setForgotDone('');
    setForgotQuestions(null);
    setForgotAnswer1('');
    setForgotAnswer2('');
    setNewPassword('');
    setEmail('');
  };

  const cancelForgot = () => {
    setForgotActive(false);
    setForgotStep(1);
    setError('');
    setForgotQuestions(null);
  };

  const checkForgotEmail = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not start password reset.'); return; }
      setForgotQuestions({ q1: data.q1, q2: data.q2 });
      setForgotStep(2);
    } finally {
      setBusy(false);
    }
  };

  const submitForgotAnswers = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answer1: forgotAnswer1, answer2: forgotAnswer2, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed.'); return; }
      setForgotDone('Password reset successfully — sign in with your new password.');
      setForgotStep(1);
      setPassword('');
      setForgotAnswer1('');
      setForgotAnswer2('');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        if (!email || !password) { setError('Enter your email and password.'); setBusy(false); return; }
        const result = await onLogin(email, password);
        if (result?.error) setError(result.error);
      } else if (mode === 'register') {
        if (!name.trim() || !email || !password) { setError('Fill in name, email, and password.'); setBusy(false); return; }
        if (recoveryA1.trim().length < 3 || recoveryA2.trim().length < 3) { setError('Recovery answers must be at least 3 characters.'); setBusy(false); return; }
        const result = await onRegister(name.trim(), email, password, {
          q1: recoveryQ1,
          a1: recoveryA1,
          q2: recoveryQ2,
          a2: recoveryA2,
        });
        if (result?.error) setError(result.error);
      } else {
        if (!name.trim()) { setError('Enter a guest name.'); setBusy(false); return; }
        const result = await onGuestLogin(name.trim());
        if (result?.error) setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const busyLabel = busy
    ? mode === 'login' ? 'Signing in...' : mode === 'register' ? 'Creating account...' : 'Signing in...'
    : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Continue as Guest';

  const renderQuestionSelect = (value: string, onChange: (v: string) => void, autoFocus?: boolean) => (
    <div className="form-group">
      <label className="form-label">Security question</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="form-input" autoFocus={autoFocus}>
        {RECOVERY_QUESTIONS.map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </select>
    </div>
  );

  return (
    <main className="login-page">
      {/* ═══════════ LEFT — BRANDING ═══════════ */}
      <section className="brand-panel">

        <div className="brand-content">
          <div className="brand-badge">
            <span className="badge-dot"></span>
            AI-POWERED CV TAILORING
          </div>

          <div className="logo-row">
            <div className="logo-icon">T</div>
            <div>
              <div className="brand-name">Tailor CV</div>
              <div className="created-by">
                CREATED BY
                <span className="signature">Atanu</span>
              </div>
            </div>
          </div>

          <h2 className="headline">
            Build a stronger CV.
            <span>Get noticed faster.</span>
          </h2>

          <p className="description">
            AI-powered CV tailoring designed to align your experience with the roles you want —
            helping you present your strongest professional story.
          </p>
        </div>

        <div className="brand-footer">© 2026 Tailor CV · Created by Atanu</div>
      </section>

      {/* ═══════════ RIGHT — LOGIN ═══════════ */}
      <section className="form-panel">
        <div className="form-container">

          {forgotDone ? (
            <div>
              <div className="form-header">
                <h1>Password reset</h1>
                <p className="success-note">{forgotDone}</p>
              </div>
              <button type="button" className="submit-button" onClick={cancelForgot}>
                Back to Sign In
              </button>
            </div>
          ) : forgotActive && forgotStep === 1 ? (
            <div>
              <div className="form-header">
                <h1>Reset your password</h1>
                <p>Enter your account email — we'll verify your identity with your security questions (everything stays local).</p>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Account email</label>
                <input id="forgot-email" className="form-input" type="email" autoComplete="email"
                  placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              {error && <div className="error-box">{error}</div>}
              <button type="button" className="submit-button" onClick={checkForgotEmail} disabled={busy || !email.trim()}>
                {busy ? <><span className="spinner"></span> Checking...</> : 'Continue'}
              </button>
              <button type="button" className="back-link" onClick={cancelForgot}>
                <ArrowLeft size={13} /> Back to Sign In
              </button>
            </div>
          ) : forgotActive && forgotStep === 2 ? (
            <div>
              <div className="form-header">
                <h1>Verify your identity</h1>
                <p>Answer your recovery questions and choose a new password.</p>
              </div>
              <div className="form-group">
                <label className="form-label">{forgotQuestions?.q1}</label>
                <input className="form-input" type="text" placeholder="Your answer" value={forgotAnswer1}
                  onChange={(e) => setForgotAnswer1(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{forgotQuestions?.q2}</label>
                <input className="form-input" type="text" placeholder="Your answer" value={forgotAnswer2}
                  onChange={(e) => setForgotAnswer2(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New password</label>
                <div className="input-wrapper">
                  <input id="new-password" className="form-input password-input" type="password" autoComplete="new-password"
                    placeholder="Min 6 characters" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} />
                </div>
              </div>
              {error && <div className="error-box">{error}</div>}
              <button type="button" className="submit-button" onClick={submitForgotAnswers}
                disabled={busy || !forgotAnswer1 || !forgotAnswer2 || newPassword.length < 6}>
                {busy ? <><span className="spinner"></span> Resetting...</> : 'Reset Password'}
              </button>
              <button type="button" className="back-link" onClick={() => { setForgotStep(1); setError(''); }}>
                <ArrowLeft size={13} /> Back
              </button>
            </div>
          ) : (
            <div>
              <div className="form-header">
                <h1>Welcome back</h1>
                <p>Sign in to continue to your Tailor CV workspace.</p>
              </div>

              {mode !== 'login' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-name">
                    {mode === 'guest' ? 'Guest name' : 'Your name'}
                  </label>
                  <div className="input-wrapper">
                    <span className="lead-icon"><User size={15} /></span>
                    <input id="auth-name" className="form-input lead-input" type="text" autoComplete="name"
                      placeholder={mode === 'guest' ? 'e.g. Guest 1' : 'Your full name'}
                      value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                  </div>
                </div>
              )}

              {mode !== 'guest' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-email">Email address</label>
                  <div className="input-wrapper">
                    <span className="lead-icon"><KeyRound size={15} /></span>
                    <input id="auth-email" className="form-input lead-input" type="email" autoComplete="email"
                      placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
              )}

              {mode !== 'guest' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-password">Password</label>
                  <div className="input-wrapper">
                    <span className="lead-icon"><Lock size={15} /></span>
                    <input id="auth-password" className="form-input lead-input password-input" type={showPass ? 'text' : 'password'}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submit()} />
                    <button type="button" className="password-toggle" aria-label={showPass ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPass((v) => !v)}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <>
                  {renderQuestionSelect(recoveryQ1, setRecoveryQ1)}
                  <div className="form-group">
                    <label className="form-label">Answer 1 (min 3 characters)</label>
                    <input className="form-input" type="text" value={recoveryA1} onChange={(e) => setRecoveryA1(e.target.value)} />
                  </div>
                  {renderQuestionSelect(recoveryQ2, setRecoveryQ2)}
                  <div className="form-group">
                    <label className="form-label">Answer 2 (min 3 characters)</label>
                    <input className="form-input" type="text" value={recoveryA2} onChange={(e) => setRecoveryA2(e.target.value)} />
                  </div>
                </>
              )}

              {mode === 'guest' && guests.length > 0 && (
                <div className="guest-list">
                  <div className="guest-list-title"><Users size={12} /> Existing guests — click to sign in</div>
                  <div className="guest-chips">
                    {guests.map((g) => (
                      <button key={g.id} type="button" disabled={busy} className="guest-chip"
                        onClick={async () => {
                          setBusy(true);
                          const result = await onGuestLogin(g.name);
                          setBusy(false);
                          if (result?.error) setError(result.error);
                        }}>
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-options">
                {mode === 'login' && (
                  <button type="button" className="text-link" onClick={startForgot}>Forgot password?</button>
                )}
              </div>

              {error && <div className="error-box">{error}</div>}

              <button type="button" className="submit-button" onClick={submit} disabled={busy}>
                {busy ? <><span className="spinner"></span> {busyLabel}</> : <>{busyLabel} <span className="btn-arrow">→</span></>}
              </button>

              <div className="register-text">
                {mode === 'login' ? (
                  <>Don't have an account? <button type="button" className="text-link" onClick={() => { setMode('register'); setError(''); }}>Create an account</button></>
                ) : mode === 'register' ? (
                  <>Already have an account? <button type="button" className="text-link" onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>
                ) : (
                  <>Want a full account? <button type="button" className="text-link" onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>
                )}
                {mode !== 'guest' && (
                  <>
                    {' '}· <button type="button" className="text-link" onClick={() => { setMode('guest'); setError(''); }}>Continue as guest</button>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="form-footer">© 2026 Tailor CV · Created by Atanu</div>
      </section>

      <style>{`
  .login-page { min-height: 100vh; display: grid; grid-template-columns: 1.05fr 1fr; background: var(--color-canvas, #F5F3FF); }
  .brand-panel { background: var(--color-brand, #6366F1); color: #fff; padding: 56px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .brand-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; background: rgba(255,255,255,.16); border-radius: 999px; padding: 7px 14px; width: fit-content; }
  .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #fff; }
  .brand-content { display: flex; flex-direction: column; height: 100%; }
  .brand-logo { display: flex; align-items: center; gap: 12px; margin-top: 34px; }
  .brand-logo .lg-tile { width: 46px; height: 46px; border-radius: 13px; background: rgba(255,255,255,.16); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
  .brand-logo b { font-size: 16px; font-weight: 800; letter-spacing: -.01em; }
  .brand-logo span { display: block; font-size: 9px; font-weight: 700; letter-spacing: .1em; opacity: .75; margin-top: 2px; }
  .brand-title { font-size: 34px; font-weight: 800; letter-spacing: -.03em; line-height: 1.15; margin-top: 56px; max-width: 420px; }
  .brand-sub { font-size: 14px; opacity: .85; margin-top: 12px; max-width: 430px; line-height: 1.6; }
  .brand-features { margin-top: 34px; display: flex; flex-direction: column; gap: 14px; }
  .feature-item { display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 600; opacity: .95; }
  .feature-item i { width: 30px; height: 30px; border-radius: 9px; background: rgba(255,255,255,.16); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
  .brand-footer { margin-top: auto; font-size: 11px; opacity: .7; }
  .form-panel { display: flex; align-items: center; justify-content: center; padding: 48px; background: var(--color-canvas, #F5F3FF); }
  .form-card { width: 100%; max-width: 380px; }
  .form-card h2 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--color-ink, #1E1B4B); }
  .form-card .form-sub { font-size: 13px; color: var(--color-muted, #475569); margin: 6px 0 26px; }
  .form-group { margin-bottom: 15px; }
  .form-label { display: block; font-size: 12px; font-weight: 700; color: var(--color-muted, #475569); margin-bottom: 7px; }
  .form-input { width: 100%; border: 1.5px solid var(--color-hairline2, #D8D5F0); border-radius: 10px; padding: 11px 14px; font-size: 13px; color: var(--color-ink, #1E1B4B); background: #fff; outline: none; transition: border-color .15s ease, box-shadow .15s ease; font-family: inherit; }
  .form-input:hover { border-color: var(--color-brand-line, #C7CBFB); }
  .form-input:focus { border-color: var(--color-brand, #6366F1); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
  .form-error { font-size: 12px; font-weight: 700; color: var(--color-danger, #DC2626); margin: 4px 0 10px; }
  .form-success { font-size: 12px; font-weight: 700; color: var(--color-cta, #10B981); margin: 4px 0 10px; }
  .btn-primary { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 800; color: #fff; border: none; cursor: pointer; background: var(--color-brand, #6366F1); transition: background .15s ease; font-family: inherit; }
  .btn-primary:hover { background: var(--color-brand-strong, #4F46E5); }
  .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
  .btn-ghost { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 700; color: var(--color-muted, #475569); border: 1.5px solid var(--color-hairline, #E4E2F5); background: #fff; cursor: pointer; transition: all .15s ease; font-family: inherit; }
  .btn-ghost:hover { border-color: var(--color-brand-line, #C7CBFB); color: var(--color-brand, #6366F1); background: var(--color-brand-soft, #EEF0FE); }
  .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--color-faint, #6B7280); font-size: 11px; font-weight: 700; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--color-hairline, #E4E2F5); }
  .link-btn { font-size: 12px; font-weight: 700; color: var(--color-brand, #6366F1); background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
  .link-btn:hover { text-decoration: underline; }
  .form-bottom { text-align: center; margin-top: 20px; font-size: 12.5px; color: var(--color-muted, #475569); }
  .guest-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .guest-chip { padding: 9px 12px; border-radius: 10px; border: 1.5px solid var(--color-hairline, #E4E2F5); background: #fff; font-size: 12px; font-weight: 600; color: var(--color-muted, #475569); cursor: pointer; transition: all .15s ease; font-family: inherit; }
  .guest-chip:hover { border-color: var(--color-brand-line, #C7CBFB); color: var(--color-brand, #6366F1); }
  .guest-new { grid-column: 1 / -1; font-size: 11.5px; font-weight: 700; color: var(--color-brand, #6366F1); background: var(--color-brand-soft, #EEF0FE); border: 1px dashed var(--color-brand-line, #C7CBFB); }
  @media (max-width: 1000px) { .login-page { grid-template-columns: 1fr; } .brand-panel { display: none; } }
`}</style>
    </main>
  );
};
