import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Key, Phone, Lock, Hash, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { AuthState, TelegramUser } from '../types';

interface TelegramAuthProps {
  onLoginSuccess: (sessionString: string, user: TelegramUser, apiId: string, apiHash: string) => void;
}

export default function TelegramAuth({ onLoginSuccess }: TelegramAuthProps) {
  const [auth, setAuth] = useState<AuthState>({
    apiId: localStorage.getItem('tg_api_id') || '',
    apiHash: localStorage.getItem('tg_api_hash') || '',
    phone: localStorage.getItem('tg_phone') || '',
    code: '',
    password: '',
    step: 'config',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);

  // Validate session on load if they already have one stored
  useEffect(() => {
    const savedSession = localStorage.getItem('tg_session');
    const savedApiId = localStorage.getItem('tg_api_id');
    const savedApiHash = localStorage.getItem('tg_api_hash');
    const savedUser = localStorage.getItem('tg_user');

    if (savedSession && savedApiId && savedApiHash && savedUser) {
      setLoading(true);
      fetch('/api/session/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionString: savedSession,
          apiId: savedApiId,
          apiHash: savedApiHash,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            onLoginSuccess(savedSession, JSON.parse(savedUser), savedApiId, savedApiHash);
          } else {
            localStorage.removeItem('tg_session');
            localStorage.removeItem('tg_user');
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [onLoginSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuth((prev) => ({ ...prev, [name]: value }));
  };

  const handleNextStep = () => {
    setError(null);
    if (auth.step === 'config') {
      if (!auth.apiId || !auth.apiHash) {
        setError('Please provide a valid API ID and API Hash.');
        return;
      }
      localStorage.setItem('tg_api_id', auth.apiId);
      localStorage.setItem('tg_api_hash', auth.apiHash);
      setAuth((prev) => ({ ...prev, step: 'phone' }));
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth.phone) {
      setError('Please provide your phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiId: auth.apiId,
          apiHash: auth.apiHash,
          phone: auth.phone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP code.');
      }

      localStorage.setItem('tg_phone', auth.phone);

      setAuth((prev) => ({
        ...prev,
        step: 'otp',
        loginToken: data.loginToken,
        phoneCodeHash: data.phoneCodeHash,
      }));
    } catch (err: any) {
      setError(err.message || 'An error occurred while connecting.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth.code) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginToken: auth.loginToken,
          phoneCodeHash: auth.phoneCodeHash,
          phoneCode: auth.code.trim(),
          password: auth.password?.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authenication failed.');
      }

      if (data.status === 'password_required') {
        setPasswordRequired(true);
        setError('Two-Factor Authentication (2FA) is enabled on your account. Please enter your cloud password.');
        return;
      }

      if (data.status === 'success' && data.sessionString) {
        localStorage.setItem('tg_session', data.sessionString);
        localStorage.setItem('tg_user', JSON.stringify(data.user));
        onLoginSuccess(data.sessionString, data.user, auth.apiId, auth.apiHash);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="tg-auth-container" className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl max-w-lg mx-auto overflow-hidden">
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-8 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/30">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h2 className="font-sans text-xl font-bold tracking-tight text-white">Connect Telegram Client</h2>
            <p className="text-xs text-slate-400">Authorize your account to enable secure media transfers</p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 mb-6 rounded-xl border flex items-start gap-3 text-sm ${
              passwordRequired
                ? 'bg-amber-500/10 border-amber-500/35 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/35 text-rose-300'
            }`}
          >
            {passwordRequired ? (
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{passwordRequired ? '2FA Password Required' : 'Authorization Alert'}</p>
              <p className="opacity-90">{error}</p>
            </div>
          </motion.div>
        )}

        {/* STEP 1: API Configuration */}
        {auth.step === 'config' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-200">How to get credentials:</span>
              <ol className="list-decimal pl-4 mt-1.5 space-y-1">
                <li>Visit <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-sky-400 font-semibold hover:underline">my.telegram.org</a> and log in with your phone number.</li>
                <li>Go to <strong>API development tools</strong>.</li>
                <li>Create an application (any name is fine) to retrieve your unique <strong>api_id</strong> and <strong>api_hash</strong>.</li>
              </ol>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">API ID</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    name="apiId"
                    value={auth.apiId}
                    onChange={handleChange}
                    placeholder="e.g., 2795821"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:bg-slate-950 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">API Hash</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    name="apiHash"
                    value={auth.apiHash}
                    onChange={handleChange}
                    placeholder="e.g., d842bb100c..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:bg-slate-950 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleNextStep}
              className="w-full mt-6 py-3 bg-sky-500 hover:bg-sky-400 active:scale-98 text-white rounded-xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-500/20"
            >
              Continue to Authentication <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* STEP 2: Phone Authentication */}
        {auth.step === 'phone' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                <p className="text-xs text-slate-500 mb-2">Include country code (e.g., <code>+15550199</code>)</p>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    name="phone"
                    value={auth.phone}
                    onChange={handleChange}
                    placeholder="+1 555 123 4567"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:bg-slate-950 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setAuth((p) => ({ ...p, step: 'config' }))}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-medium transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                    </>
                  ) : (
                    <>
                      Send OTP Code <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* STEP 3: OTP and 2FA Verification */}
        {auth.step === 'otp' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="mb-4 text-xs text-sky-300 bg-sky-950/40 border border-sky-800/60 p-3.5 rounded-xl">
              An OTP verification code was routed to your Telegram account for <strong>{auth.phone}</strong>.
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Telegram OTP Code</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    name="code"
                    value={auth.code}
                    onChange={handleChange}
                    placeholder="Enter code"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:bg-slate-900 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all font-mono tracking-widest text-center text-lg relative"
                  />
                </div>
              </div>

              {passwordRequired && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">2FA Cloud Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      name="password"
                      value={auth.password}
                      onChange={handleChange}
                      placeholder="Your 2-step verification password"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 transition-all font-mono"
                    />
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setPasswordRequired(false);
                    setAuth((p) => ({ ...p, step: 'phone', code: '', password: '' }));
                  }}
                  className="flex-1 py-3 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-medium transition-all"
                >
                  Change Phone
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Confirm & Sign In <CheckCircle2 className="w-4 h-4 text-sky-300" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
