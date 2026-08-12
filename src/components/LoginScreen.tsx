import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowLeft, KeyRound, ShieldQuestion, User, Users, Lock, Search, Sparkles, Inbox, ShieldCheck } from 'lucide-react';
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

          <div className="login-feats">
            <div className="feature-item"><Search size={15} /> Live jobs from 19 sources, scored against your CV</div>
            <div className="feature-item"><Sparkles size={15} /> One-click tailored CVs with verified keywords</div>
            <div className="feature-item"><Inbox size={15} /> Recruiters found &amp; cold-emailed from your own mailbox</div>
            <div className="feature-item"><ShieldCheck size={15} /> Your data stays on your machine — bring your own keys</div>
          </div>
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
  .login-page { min-height: 100vh; display: grid; grid-template-columns: 1.05fr 1fr; background: #F8FAFC; }
  .brand-panel { background: #FFFFFF; border-right: 1px solid #E2E8F0; padding: 48px 56px; display: flex; flex-direction: column; }
  .brand-content { display: flex; flex-direction: column; }
  .brand-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; border-radius: 999px; padding: 7px 14px; width: fit-content; }
  .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #2563EB; }
  .logo-row { display: flex; align-items: center; gap: 13px; margin-top: 34px; }
  .logo-icon { width: 46px; height: 46px; border-radius: 13px; background: #2563EB; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
  .brand-name { font-size: 17px; font-weight: 800; letter-spacing: -.01em; color: #0F172A; }
  .created-by { display: flex; align-items: baseline; gap: 7px; font-size: 9.5px; font-weight: 700; letter-spacing: .16em; color: #94A3B8; text-transform: uppercase; margin-top: 2px; }
  .signature { font-size: 21px; font-weight: 600; color: #0F172A; text-transform: none; letter-spacing: 0; font-family: "Snell Roundhand", "Brush Script MT", "Apple Chancery", cursive; }
  .headline { font-size: 32px; font-weight: 800; letter-spacing: -.03em; line-height: 1.15; color: #0F172A; margin-top: 56px; }
  .headline span { display: block; }
  .description { font-size: 14px; color: #64748B; margin-top: 14px; max-width: 420px; line-height: 1.65; }
  .login-feats { margin-top: 30px; display: flex; flex-direction: column; gap: 13px; }
  .feature-item { display: flex; align-items: center; gap: 11px; font-size: 13px; font-weight: 600; color: #475569; }
  .feature-item svg { width: 15px; height: 15px; color: #2563EB; flex-shrink: 0; }
  .brand-footer { margin-top: auto; font-size: 11px; color: #94A3B8; }
  .form-panel { display: flex; align-items: center; justify-content: center; padding: 48px; background: #F8FAFC; position: relative; }
  .form-container { width: 100%; max-width: 380px; }
  .form-header h1 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: #0F172A; }
  .form-header p { font-size: 13px; color: #64748B; margin: 6px 0 24px; line-height: 1.5; }
  .success-note { font-size: 12.5px; font-weight: 700; color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; }
  .form-group { margin-bottom: 15px; }
  .form-label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 7px; }
  .form-input { width: 100%; border: 1.5px solid #CBD5E1; border-radius: 10px; padding: 11px 14px; font-size: 13px; color: #0F172A; background: #fff; outline: none; transition: border-color .15s ease, box-shadow .15s ease; font-family: inherit; }
  .form-input:hover { border-color: #93C5FD; }
  .form-input:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
  .input-wrapper { position: relative; }
  .lead-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #94A3B8; display: flex; pointer-events: none; }
  .lead-input { padding-left: 38px; }
  .password-input { padding-right: 40px; }
  .password-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94A3B8; display: flex; padding: 4px; cursor: pointer; }
  .password-toggle:hover { color: #2563EB; }
  .submit-button { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 10px; font-size: 13.5px; font-weight: 800; color: #fff; border: none; cursor: pointer; background: #2563EB; transition: background .15s ease; font-family: inherit; }
  .submit-button:hover { background: #1D4ED8; }
  .submit-button:disabled { opacity: .6; cursor: not-allowed; }
  .btn-arrow { font-size: 14px; }
  .back-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; font-size: 12px; font-weight: 700; color: #64748B; background: none; border: none; cursor: pointer; font-family: inherit; }
  .back-link:hover { color: #2563EB; }
  .error-box { font-size: 12px; font-weight: 700; color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 10px 14px; margin: 4px 0 12px; }
  .form-options { display: flex; justify-content: flex-end; margin: 2px 0 16px; }
  .text-link { font-size: 12px; font-weight: 700; color: #2563EB; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
  .text-link:hover { text-decoration: underline; }
  .register-text { text-align: center; margin-top: 18px; font-size: 12.5px; color: #64748B; }
  .guest-list { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
  .guest-list-title { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 9px; }
  .guest-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .guest-chip { padding: 7px 13px; border-radius: 999px; border: 1.5px solid #E2E8F0; background: #fff; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: all .15s ease; font-family: inherit; }
  .guest-chip:hover { border-color: #BFDBFE; color: #2563EB; background: #EFF6FF; }
  .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: lgn-spin .8s linear infinite; display: inline-block; }
  @keyframes lgn-spin { to { transform: rotate(360deg); } }
  .form-footer { position: absolute; bottom: 20px; font-size: 11px; color: #94A3B8; }
  @media (max-width: 1000px) { .login-page { grid-template-columns: 1fr; } .brand-panel { display: none; } .form-panel { padding: 32px 20px; } }
`}</style>
    </main>
  );
};
