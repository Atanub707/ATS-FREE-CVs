import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, LogIn, Sparkles, Users, KeyRound, ArrowLeft, ShieldQuestion } from 'lucide-react';
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

  const inputCls =
    'w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900';
  const selectCls =
    'w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 appearance-none';

  const renderQuestionSelect = (value: string, onChange: (v: string) => void, icon: React.ReactNode, autoFocus?: boolean) => (
    <div className="relative">
      {icon}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} autoFocus={autoFocus}>
        {RECOVERY_QUESTIONS.map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ATS CV Tailor</h1>
          <p className="text-slate-400 text-sm mt-1">
            Sign in to your workspace — each account has its own CV, jobs, and match history.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          {forgotDone ? (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                {forgotDone}
              </div>
              <button
                onClick={cancelForgot}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : forgotActive && forgotStep === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Reset your password</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Enter your account email — we'll verify your identity with your security questions (no email service needed, everything stays local).
              </p>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Account email"
                  type="email"
                  className={inputCls}
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}
              <button
                onClick={checkForgotEmail}
                disabled={busy || !email.trim()}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{busy ? 'Checking…' : 'Continue'}</span>
              </button>
              <button
                onClick={cancelForgot}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : forgotActive && forgotStep === 2 ? (
            <div className="space-y-4">
              <button
                onClick={() => { setForgotStep(1); setError(''); }}
                className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                <ShieldQuestion className="w-4 h-4 text-blue-600" />
                <span>Answer your recovery questions</span>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">{forgotQuestions?.q1}</p>
                <input
                  value={forgotAnswer1}
                  onChange={(e) => setForgotAnswer1(e.target.value)}
                  placeholder="Your answer"
                  className={inputCls.replace('pl-10', 'pl-3')}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">{forgotQuestions?.q2}</p>
                <input
                  value={forgotAnswer2}
                  onChange={(e) => setForgotAnswer2(e.target.value)}
                  placeholder="Your answer"
                  className={inputCls.replace('pl-10', 'pl-3')}
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  type="password"
                  className={inputCls}
                />
              </div>
              {error && (
                <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}
              <button
                onClick={submitForgotAnswers}
                disabled={busy || !forgotAnswer1 || !forgotAnswer2 || newPassword.length < 6}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{busy ? 'Resetting…' : 'Reset Password'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
                {([
                  ['login', 'Sign In'],
                  ['register', 'Create Account'],
                  ['guest', 'Guest'],
                ] as const).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(''); setForgotStep(1); setForgotQuestions(null); }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {mode !== 'login' && (
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={mode === 'guest' ? 'Guest name (e.g. Guest 1)' : 'Your name'}
                      className={inputCls}
                      autoFocus
                    />
                  </div>
                )}

                {mode !== 'guest' && (
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      type="email"
                      className={inputCls}
                    />
                  </div>
                )}

                {mode !== 'guest' && (
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      type="password"
                      onKeyDown={(e) => e.key === 'Enter' && submit()}
                      className={inputCls}
                    />
                  </div>
                )}

                {mode === 'register' && (
                  <>
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Security questions — used to recover your password locally if you forget it
                      </p>
                      {renderQuestionSelect(recoveryQ1, setRecoveryQ1, <ShieldQuestion className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />)}
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          value={recoveryA1}
                          onChange={(e) => setRecoveryA1(e.target.value)}
                          placeholder="Answer 1 (min 3 characters)"
                          className={inputCls}
                        />
                      </div>
                      {renderQuestionSelect(recoveryQ2, setRecoveryQ2, <ShieldQuestion className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />)}
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          value={recoveryA2}
                          onChange={(e) => setRecoveryA2(e.target.value)}
                          placeholder="Answer 2 (min 3 characters)"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      onClick={startForgot}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                {mode === 'guest' && guests.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-500 mb-2">
                      <Users className="w-3 h-3" />
                      <span>Existing guests — click to sign in</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {guests.map((g) => (
                        <button
                          key={g.id}
                          onClick={async () => {
                            setBusy(true);
                            const result = await onGuestLogin(g.name);
                            setBusy(false);
                            if (result?.error) setError(result.error);
                          }}
                          disabled={busy}
                          className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={busy}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Continue as Guest'}
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center mt-6 leading-relaxed">
                All data stays on this machine — accounts, CVs, and jobs are stored locally in SQLite.
                Guest accounts are password-less workspaces.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
