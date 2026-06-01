import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Users, Radio, Check, Circle, AlertCircle, HelpCircle } from 'lucide-react';
import { TelegramChat } from '../types';

interface GroupSelectorProps {
  chats: TelegramChat[];
  selectedSourceId: string | null;
  selectedTargetId: string | null;
  onSelectSource: (chat: TelegramChat) => void;
  onSelectTarget: (chat: TelegramChat) => void;
}

export default function GroupSelector({
  chats,
  selectedSourceId,
  selectedTargetId,
  onSelectSource,
  onSelectTarget,
}: GroupSelectorProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'groups' | 'channels'>('all');
  const [onlyWritable, setOnlyWritable] = useState<boolean>(false);
  const [onlyForwardable, setOnlyForwardable] = useState<boolean>(true);

  const filteredChats = chats.filter((chat) => {
    const matchesSearch =
      chat.title.toLowerCase().includes(search.toLowerCase()) ||
      (chat.username && chat.username.toLowerCase().includes(search.toLowerCase()));

    const matchesTab =
      tab === 'all' ||
      (tab === 'groups' && chat.isGroup) ||
      (tab === 'channels' && chat.isChannel);

    const matchesWritable = !onlyWritable || chat.canSend;
    const matchesForwardable = !onlyForwardable || !chat.noForwards;

    return matchesSearch && matchesTab && matchesWritable && matchesForwardable;
  });

  const getSourceChat = () => chats.find((c) => c.id === selectedSourceId);
  const getTargetChat = () => chats.find((c) => c.id === selectedTargetId);

  return (
    <div id="group-selector-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Selection Info / Sidebar */}
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="font-sans font-semibold text-slate-200 text-sm tracking-wide uppercase">Selected Folders</h3>

          {/* Source Select representation */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest block">Source Chat / Group</span>
            {selectedSourceId ? (
              <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl flex items-center gap-2.5">
                {getSourceChat()?.isChannel ? (
                  <Radio className="w-4.5 h-4.5 text-sky-400 shrink-0" />
                ) : (
                  <Users className="w-4.5 h-4.5 text-sky-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{getSourceChat()?.title}</p>
                  {getSourceChat()?.username && (
                    <p className="text-[10px] text-sky-400 truncate">@{getSourceChat()?.username}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-slate-800 rounded-xl text-center">
                <p className="text-xs text-slate-500">Choose a source chat group from list</p>
              </div>
            )}
          </div>

          {/* Target Select representation */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest block">Target Chat / Group</span>
            {selectedTargetId ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5">
                {getTargetChat()?.isChannel ? (
                  <Radio className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                ) : (
                  <Users className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{getTargetChat()?.title}</p>
                  {getTargetChat()?.username && (
                    <p className="text-[10px] text-emerald-400 truncate">@{getTargetChat()?.username}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-slate-800 rounded-xl text-center">
                <p className="text-xs text-slate-500">Choose a destination chat from list</p>
              </div>
            )}
          </div>

          {selectedSourceId && selectedTargetId && selectedSourceId === selectedTargetId && (
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs text-amber-300 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>Warning: Source and Target group are identical. Message forwarding loop will achieve nothing.</p>
            </div>
          )}
        </div>

        <div className="p-4 border border-slate-800 rounded-2xl flex items-start gap-3 bg-slate-900/60 shadow-md">
          <HelpCircle className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200 font-sans">Permissions Requirements:</p>
            <p>Ensure your Telegram account is a member or administrator with permissions to write/publish content inside the target chat group.</p>
          </div>
        </div>
      </div>

      {/* Select List */}
      <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[520px]">
        {/* List Header controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chat groups..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-all"
            />
          </div>

          <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg w-full sm:w-auto">
            {(['all', 'groups', 'channels'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium capitalize rounded-md transition-all cursor-pointer ${
                  tab === t
                    ? 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic sub-header for forwardable targets */}
        <div className="px-5 py-3 bg-slate-950/65 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyForwardable}
                onChange={(e) => setOnlyForwardable(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-950 border-slate-800 focus:ring-sky-500/50 cursor-pointer accent-sky-500"
              />
              <span className="text-[11px] text-slate-350 font-medium font-sans">
                Only show Forwardable Sources
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyWritable}
                onChange={(e) => setOnlyWritable(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-500 bg-slate-950 border-slate-800 focus:ring-emerald-500/50 cursor-pointer accent-emerald-500"
              />
              <span className="text-[11px] text-slate-350 font-medium font-sans">
                Only show Writable Targets (Can Post)
              </span>
            </label>
          </div>
          
          <span className="text-[10px] text-slate-550 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800/60">
            {filteredChats.length} chats matched
          </span>
        </div>

        {/* List scrollable section */}
        <div id="chats-list-scroll" className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
              const isSource = chat.id === selectedSourceId;
              const isTarget = chat.id === selectedTargetId;

              return (
                <div
                  key={chat.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-all hover:bg-slate-950/40 ${
                    isSource ? 'bg-sky-500/5' : isTarget ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${
                      isSource
                        ? 'border-sky-500/40 text-sky-400 bg-sky-500/10'
                        : isTarget
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                        : 'border-slate-800 text-slate-500 bg-slate-950'
                    }`}>
                      {chat.isChannel ? (
                        <Radio className="w-4 h-4" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-semibold text-slate-200 truncate max-w-[130px] sm:max-w-xs">{chat.title}</p>
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md border border-slate-800 bg-slate-950 text-slate-400 shrink-0">
                          {chat.isChannel ? 'Channel' : 'Group'}
                        </span>
                        {!chat.canSend && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md border border-rose-950/40 bg-rose-950/25 text-rose-400 shrink-0">
                            Read Only
                          </span>
                        )}
                        {chat.noForwards && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md border border-amber-950/40 bg-amber-950/25 text-amber-500 shrink-0">
                            Protected / No Forwards
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">ID: {chat.id}</span>
                        {chat.username && (
                          <span className="text-[10px] text-sky-400 truncate">@{chat.username}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions to toggle Source and Target selections */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => onSelectSource(chat)}
                      disabled={isTarget || chat.noForwards}
                      title={chat.noForwards ? "This group/channel has protected content. Telegram prevents forwarding messages from it." : ""}
                      className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border tracking-wide transition-all cursor-pointer ${
                        isSource
                          ? 'bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-500/10'
                          : chat.noForwards
                          ? 'bg-slate-900/50 border border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                          : 'bg-slate-950 border border-slate-800 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30 disabled:opacity-20'
                      }`}
                    >
                      {chat.noForwards ? 'No Forwards' : isSource ? 'Selected Source' : 'Set as Source'}
                    </button>
                    <button
                      onClick={() => onSelectTarget(chat)}
                      disabled={isSource || !chat.canSend}
                      title={!chat.canSend ? "You do not have write/posting permissions inside this chat" : ""}
                      className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border tracking-wide tracking-tight transition-all cursor-pointer ${
                        isTarget
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                          : !chat.canSend
                          ? 'bg-slate-900/50 border border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                          : 'bg-slate-950 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 disabled:opacity-20'
                      }`}
                    >
                      {!chat.canSend ? 'No Write Access' : isTarget ? 'Selected Target' : 'Set as Target'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-350 font-sans">No dialogues found</p>
              <p className="text-xs text-slate-500 mt-0.5">Adjust filter terms or verify connected account chats.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
