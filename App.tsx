import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut,
  FolderSync,
  Video,
  ArrowRight,
  ArrowLeft,
  CircleCheck,
  Compass,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import TelegramAuth from './components/TelegramAuth';
import GroupSelector from './components/GroupSelector';
import ForwardManager from './components/ForwardManager';
import { TelegramUser, TelegramChat } from './types';

export default function App() {
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [apiId, setApiId] = useState<string>('');
  const [apiHash, setApiHash] = useState<string>('');

  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [loadingChats, setLoadingChats] = useState<boolean>(false);
  
  // Selection states
  const [selectedSource, setSelectedSource] = useState<TelegramChat | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TelegramChat | null>(null);

  // Active navigation stepping
  const [step, setStep] = useState<'groups' | 'forward'>('groups');

  const handleLoginSuccess = (sessionStr: string, activeUser: TelegramUser, activeApiId: string, activeApiHash: string) => {
    setSession(sessionStr);
    setUser(activeUser);
    setApiId(activeApiId);
    setApiHash(activeApiHash);
  };

  const handleLogout = () => {
    localStorage.removeItem('tg_session');
    localStorage.removeItem('tg_user');
    setSession(null);
    setUser(null);
    setChats([]);
    setSelectedSource(null);
    setSelectedTarget(null);
    setStep('groups');
  };

  // Fetch chats on login
  useEffect(() => {
    if (session && apiId && apiHash) {
      setLoadingChats(true);
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionString: session, apiId, apiHash }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.groups) {
            setChats(data.groups);
          }
        })
        .catch((err) => console.error('Eror fetching chats logs:', err))
        .finally(() => setLoadingChats(false));
    }
  }, [session, apiId, apiHash]);

  return (
    <div id="full-applet-canvas" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-all selection:bg-sky-500 selection:text-white">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500 rounded-xl shadow-lg shadow-sky-500/20 shrink-0 flex items-center justify-center">
              <FolderSync className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-white text-sm md:text-base tracking-tight">
                TeleForward <span className="text-sky-400 font-medium font-bold">Pro</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono hidden sm:block">Video Transfer Engines</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <div className="text-left hidden md:block">
                  <p className="text-[11px] font-bold text-slate-200 leading-none">
                    {user.firstName} {user.lastName || ''}
                  </p>
                  {user.username && (
                    <p className="text-[9px] text-sky-400 font-mono">@{user.username}</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900 rounded-xl shadow-2xs transition-all cursor-pointer"
                title="Disconnect Telegram Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:p-8 space-y-6">
        {!session ? (
          /* Locked State - Authorizer */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-12"
          >
            <TelegramAuth onLoginSuccess={handleLoginSuccess} />
          </motion.div>
        ) : (
          /* Active Logged-In Flow */
          <div className="space-y-6">
            {/* Stepper Wizard Indicator */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md max-w-2xl mx-auto flex items-center justify-center gap-4 text-xs font-semibold tracking-wide">
              <button
                onClick={() => setStep('groups')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  step === 'groups'
                    ? 'bg-sky-500/15 border border-sky-500/40 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-bold font-mono">
                  1
                </span>
                Map Channels
              </button>

              <ArrowRight className="w-4 h-4 text-slate-700" />

              <button
                onClick={() => {
                  if (selectedSource && selectedTarget) {
                    setStep('forward');
                  }
                }}
                disabled={!selectedSource || !selectedTarget}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${
                  step === 'forward'
                    ? 'bg-sky-500/15 border border-sky-500/40 text-sky-400'
                    : 'text-slate-500 disabled:opacity-30 disabled:hover:text-slate-500 hover:text-slate-200 cursor-pointer'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-bold font-mono">
                  2
                </span>
                Bulk Media Transfer
              </button>
            </div>

            {/* Stepping Actions */}
            <AnimatePresence mode="wait">
              {step === 'groups' ? (
                <motion.div
                  key="group-mapper"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  <div className="text-center md:text-left space-y-1">
                    <h2 className="font-sans text-xl font-bold tracking-tight text-white">Map Telegram Channels</h2>
                    <p className="text-xs text-slate-400">Pick the reference source group from which you want to retrieve video messages and match it to a target destination.</p>
                  </div>

                  {loadingChats ? (
                    <div className="py-24 text-center space-y-3">
                      <Compass className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">Retrieving chats from Secure Telegram APIs...</p>
                      <p className="text-xs text-slate-500">This connects directly via your authorized MTProto session.</p>
                    </div>
                  ) : (
                    <GroupSelector
                      chats={chats}
                      selectedSourceId={selectedSource?.id || null}
                      selectedTargetId={selectedTarget?.id || null}
                      onSelectSource={setSelectedSource}
                      onSelectTarget={setSelectedTarget}
                    />
                  )}

                  {/* Flow confirmation footer to advance */}
                  {selectedSource && selectedTarget && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg text-center flex flex-col sm:flex-row gap-4 items-center justify-between"
                    >
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <CircleCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <p className="text-xs font-semibold text-slate-200">Connection Mapping Verified</p>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Fowarding from <span className="font-bold underline text-sky-400 decoration-sky-400/30">{selectedSource.title}</span> to{' '}
                          <span className="font-bold underline text-emerald-400 decoration-emerald-400/30">{selectedTarget.title}</span>.
                        </p>
                      </div>

                      <button
                        onClick={() => setStep('forward')}
                        className="w-full sm:w-auto px-5 py-3 bg-sky-500 hover:bg-sky-400 active:scale-98 text-white rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                      >
                        Scan & Filter Media <ArrowRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="media-transfer-step"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  {/* Headline info with backward action */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <button
                      onClick={() => setStep('groups')}
                      className="px-3 py-2 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Group Selectors
                    </button>
                    
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold text-slate-200">
                        Transfer Pipeline: <span className="text-sky-400 font-bold">{selectedSource?.title}</span> →{' '}
                        <span className="text-emerald-400 font-bold">{selectedTarget?.title}</span>
                      </p>
                    </div>
                  </div>

                  {selectedSource && selectedTarget && (
                    <ForwardManager
                      sessionString={session}
                      apiId={apiId}
                      apiHash={apiHash}
                      sourceChatId={selectedSource.id}
                      targetChatId={selectedTarget.id}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Humble, quiet footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>© 2026 TeleForward Engine. Built for authorized multi-group video transfers with rate-limit protections.</p>
      </footer>
    </div>
  );
}
