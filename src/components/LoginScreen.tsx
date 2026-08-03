import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, LogIn, Sparkles, Users } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<{ error?: string } | null>;
  onRegister: (name: string, email: string, password: string) => Promise<{ error?: string } | null>;
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

  useEffect(() => {
    if (mode === 'guest') {
      fetch('/api/auth/guests')
        .then((r) => r.json())
        .then((d) => setGuests(d.guests || []))
        .catch(() => setGuests([]));
    }
  }, [mode]);

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
        const result = await onRegister(name.trim(), email, password);
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
          {/* Mode tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
            {([
              ['login', 'Sign In'],
              ['register', 'Create Account'],
              ['guest', 'Guest'],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
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
        </div>
      </div>
    </div>
  );
};
