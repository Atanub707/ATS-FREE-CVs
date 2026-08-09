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
        <div className="orb orb-one"></div>
        <div className="orb orb-two"></div>
        <div className="orb orb-three"></div>

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
        .login-page {
          --primary: #2563eb;
          --primary-dark: #1d4ed8;
          --text: #0f172a;
          --muted: #64748b;
          --border: #e2e8f0;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
          color: var(--text);
          background: #fff;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* ── LEFT ── */
        .brand-panel {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
          background:
            radial-gradient(circle at 20% 20%, rgba(59,130,246,.30), transparent 35%),
            radial-gradient(circle at 80% 80%, rgba(37,99,235,.22), transparent 35%),
            linear-gradient(145deg, #07142f 0%, #0b1f46 45%, #123b7a 100%);
        }
        .brand-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
          background-size: 45px 45px;
          -webkit-mask-image: linear-gradient(to bottom right, black, transparent 80%);
          mask-image: linear-gradient(to bottom right, black, transparent 80%);
        }
        .brand-content {
          position: relative;
          z-index: 5;
          width: min(520px, 100%);
          color: #fff;
          animation: lgn-brandEntrance 900ms cubic-bezier(.22,1,.36,1) both;
        }
        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 8px 13px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px;
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(12px);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .03em;
          color: rgba(255,255,255,.82);
          margin-bottom: 32px;
        }
        .badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 0 5px rgba(96,165,250,.12);
        }
        .logo-row { display: flex; align-items: center; gap: 17px; margin-bottom: 42px; }
        .logo-icon {
          width: 66px; height: 66px; display: grid; place-items: center;
          border-radius: 17px; background: var(--primary);
          box-shadow: 0 18px 45px rgba(37,99,235,.35);
          font-size: 30px; font-weight: 700; color: #fff;
        }
        .brand-name { font-size: 34px; line-height: 1; font-weight: 750; letter-spacing: -.045em; }
        .created-by {
          margin-top: 8px; display: flex; align-items: baseline; gap: 7px;
          color: #a8b8d3; font-size: 11px; font-weight: 600; letter-spacing: .18em;
        }
        .signature {
          font-family: 'Brush Script MT', 'Segoe Script', cursive;
          font-size: 25px; letter-spacing: 0; color: #fff;
        }
        .headline {
          max-width: 500px; font-size: clamp(42px, 4vw, 62px); line-height: 1.04;
          letter-spacing: -.055em; font-weight: 750; margin-bottom: 24px;
        }
        .headline span { color: #7db1ff; }
        .description {
          max-width: 470px; color: #b9c7dc; font-size: 16px; line-height: 1.75;
        }
        .brand-footer {
          position: absolute; left: 60px; bottom: 35px;
          color: rgba(255,255,255,.42); font-size: 12px; z-index: 5;
        }
        .orb { position: absolute; border-radius: 50%; filter: blur(1px); pointer-events: none; }
        .orb-one { width: 180px; height: 180px; right: -60px; top: 12%; background: rgba(59,130,246,.12); animation: lgn-floatOne 9s ease-in-out infinite; }
        .orb-two { width: 260px; height: 260px; left: -120px; bottom: -80px; background: rgba(96,165,250,.10); animation: lgn-floatTwo 11s ease-in-out infinite; }
        .orb-three { width: 70px; height: 70px; right: 18%; bottom: 17%; background: rgba(147,197,253,.10); animation: lgn-floatThree 7s ease-in-out infinite; }

        /* ── RIGHT ── */
        .form-panel {
          position: relative; display: flex; align-items: center; justify-content: center;
          padding: 48px; background: #ffffff;
        }
        .form-container {
          width: min(430px, 100%);
          animation: lgn-formEntrance 900ms 120ms cubic-bezier(.22,1,.36,1) both;
        }
        .form-header { margin-bottom: 36px; }
        .form-header h1 { font-size: 32px; line-height: 1.15; letter-spacing: -.04em; font-weight: 750; margin-bottom: 10px; }
        .form-header p { color: var(--muted); font-size: 14px; line-height: 1.6; }
        .success-note { color: #059669 !important; font-weight: 600; }
        .form-group { margin-bottom: 21px; }
        .form-label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 650; color: #334155; }
        .input-wrapper { position: relative; }
        .form-input {
          width: 100%; height: 50px; border: 1px solid var(--border); border-radius: 10px;
          background: #fff; padding: 0 15px; color: var(--text); font-size: 14px;
          font-family: inherit; outline: none;
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }
        .form-input::placeholder { color: #94a3b8; }
        .form-input:hover { border-color: #cbd5e1; }
        .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(37,99,235,.09); }
        .password-input { padding-right: 52px; }
        .lead-input { padding-left: 42px; }
        .lead-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #94a3b8; display: flex; pointer-events: none;
        }
        .password-toggle {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          border: 0; background: transparent; color: #64748b; cursor: pointer;
          padding: 6px; display: flex; border-radius: 7px; transition: color 160ms ease;
        }
        .password-toggle:hover { color: var(--primary); }
        .form-options { display: flex; justify-content: flex-end; margin-top: -5px; margin-bottom: 25px; }
        .text-link { border: 0; background: transparent; color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; padding: 2px 0; }
        .text-link:hover { color: var(--primary-dark); text-decoration: underline; }
        .submit-button {
          width: 100%; height: 51px; border: 0; border-radius: 10px;
          background: var(--primary); color: #fff; font-size: 14px; font-weight: 700;
          font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 9px;
          box-shadow: 0 8px 20px rgba(37,99,235,.18);
          transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }
        .submit-button:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 12px 25px rgba(37,99,235,.23); }
        .submit-button:active { transform: scale(.985); }
        .submit-button:disabled { opacity: .65; cursor: not-allowed; transform: none; }
        .btn-arrow { font-size: 16px; line-height: 1; }
        .register-text { text-align: center; margin-top: 31px; color: var(--muted); font-size: 13px; }
        .register-text .text-link { margin-left: 5px; }
        .form-footer { position: absolute; bottom: 27px; left: 0; right: 0; text-align: center; color: #94a3b8; font-size: 11px; }
        .back-link {
          display: flex; align-items: center; gap: 6px; margin: 18px auto 0;
          border: 0; background: transparent; color: var(--muted); font-size: 13px;
          font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .back-link:hover { color: var(--text); }
        .error-box {
          margin-bottom: 21px; font-size: 12.5px; font-weight: 500; color: #dc2626;
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 9px; padding: 10px 13px;
        }
        .guest-list { margin: -4px 0 18px; }
        .guest-list-title { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--muted); margin-bottom: 9px; }
        .guest-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .guest-chip {
          padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
          background: #f1f5f9; color: #334155; border: 1px solid var(--border); cursor: pointer; font-family: inherit;
          transition: background 160ms ease, border-color 160ms ease;
        }
        .guest-chip:hover { background: #e2e8f0; border-color: #cbd5e1; }
        .guest-chip:disabled { opacity: .5; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4);
          border-top-color: #fff; border-radius: 50%; animation: lgn-spin .7s linear infinite;
        }

        @keyframes lgn-brandEntrance { from { opacity: 0; transform: translateX(-25px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes lgn-formEntrance { from { opacity: 0; transform: translateX(25px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes lgn-floatOne { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(-25px,25px,0); } }
        @keyframes lgn-floatTwo { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(30px,-20px,0); } }
        @keyframes lgn-floatThree { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
        @keyframes lgn-spin { to { transform: rotate(360deg); } }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .login-page { grid-template-columns: 1fr; overflow: auto; }
          .brand-panel { min-height: 390px; padding: 45px 32px; align-items: flex-end; }
          .brand-footer { display: none; }
          .headline { font-size: 42px; }
          .form-panel { min-height: 610px; padding: 48px 32px 80px; }
          .form-footer { bottom: 22px; }
        }
        @media (max-width: 520px) {
          .brand-panel { min-height: 330px; padding: 32px 24px; }
          .logo-icon { width: 52px; height: 52px; font-size: 24px; }
          .brand-name { font-size: 27px; }
          .headline { font-size: 35px; }
          .description { font-size: 14px; }
          .form-panel { padding: 40px 22px 80px; }
          .form-header h1 { font-size: 28px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-page *, .login-page *::before, .login-page *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
};
