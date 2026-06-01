import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileVideo,
  Play,
  Square,
  RefreshCw,
  Sliders,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  HelpCircle,
  Eraser,
  UserCheck,
  UserX,
  UserMinus,
  Loader2,
  Tv
} from 'lucide-react';
import { VideoMessage, ForwardJobStatus } from '../types';

interface ForwardManagerProps {
  sessionString: string;
  apiId: string;
  apiHash: string;
  sourceChatId: string;
  targetChatId: string;
}

export default function ForwardManager({
  sessionString,
  apiId,
  apiHash,
  sourceChatId,
  targetChatId,
}: ForwardManagerProps) {
  // Parsing parameters for scans and configurations
  const [scanCount, setScanCount] = useState<number | 'all'>(500);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scannedVideos, setScannedVideos] = useState<VideoMessage[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());

  // Configuration preferences
  const [minDelay, setMinDelay] = useState<number>(0);
  const [maxDelay, setMaxDelay] = useState<number>(2);
  const [batchSize, setBatchSize] = useState<number>(25);
  const [dropAuthor, setDropAuthor] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'all' | 'round' | 'standard'>('all');
  const [captionSearch, setCaptionSearch] = useState<string>('');

  // Active bulk transfer Job parameters
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ForwardJobStatus | null>(null);
  const [polling, setPolling] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobStatus?.logs]);

  // Bulk scan function
  const handleScanMessages = async () => {
    if (!sourceChatId) return;
    setScanning(true);
    setScannedVideos([]);
    setSelectedVideoIds(new Set());
    
    try {
      const res = await fetch('/api/chats/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionString,
          apiId,
          apiHash,
          chatId: sourceChatId,
          scanCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan channel.');
      }

      setScannedVideos(data.messages || []);
      // Auto-select all by default for immediate convenience
      const allIds = new Set((data.messages || []).map((m: any) => m.id));
      setSelectedVideoIds(allIds);
    } catch (err: any) {
      alert(err.message || 'Error occurred while scanning logs.');
    } finally {
      setScanning(false);
    }
  };

  // Selection triggers
  const handleToggleSelectOne = (id: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = (filteredList: VideoMessage[]) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      filteredList.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const handleUnselectAllFiltered = (filteredList: VideoMessage[]) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      filteredList.forEach((m) => next.delete(m.id));
      return next;
    });
  };

  // Launch Forward Job
  const handleStartForwarding = async () => {
    if (selectedVideoIds.size === 0) {
      alert('Must select at least 1 video message to forward.');
      return;
    }

    const payload = {
      sessionString,
      apiId,
      apiHash,
      sourceChatId,
      targetChatId,
      messageIds: Array.from(selectedVideoIds),
      minDelay,
      maxDelay,
      dropAuthor,
      batchSize,
    };

    try {
      const res = await fetch('/api/forward/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate forwarding.');

      setActiveJobId(data.jobId);
      setPolling(true);
    } catch (err: any) {
      alert(err.message || 'Error occurred starting forwarding.');
    }
  };

  // Stop Abort Job
  const handleStopForwarding = async () => {
    if (!activeJobId) return;

    try {
      const res = await fetch('/api/forward/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJobId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to trigger abort.');
      }
    } catch (err: any) {
      alert(err.message || 'Error halting the transfer sequence.');
    }
  };

  // Fetch status polling loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (polling && activeJobId) {
      const poll = async () => {
        try {
          const res = await fetch(`/api/forward/status?jobId=${activeJobId}`);
          if (!res.ok) throw new Error('Job inactive or lost.');
          
          const data = await res.json();
          const state = data.jobState as ForwardJobStatus;
          setJobStatus(state);

          if (
            state.status === 'completed' ||
            state.status === 'stopped' ||
            state.status === 'failed'
          ) {
            setPolling(false);
          }
        } catch {
          setPolling(false);
        }
      };

      // Poll immediately and setup interval
      poll();
      timer = setInterval(poll, 1500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [polling, activeJobId]);

  // Filters computed lists
  const filteredVideos = scannedVideos.filter((video) => {
    const matchesSearch = !captionSearch || (video.text && video.text.toLowerCase().includes(captionSearch.toLowerCase()));
    const matchesFilterType =
      filterType === 'all' ||
      (filterType === 'round' && video.isRound) ||
      (filterType === 'standard' && !video.isRound);

    return matchesSearch && matchesFilterType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'idle':
        return <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 font-mono text-[10px]">Idle</span>;
      case 'running':
        return (
          <span className="px-2 py-0.5 rounded-md bg-sky-950/40 text-sky-400 border border-sky-900/50 flex items-center gap-1 font-mono text-[10px] animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-sky-400" /> Running
          </span>
        );
      case 'paused_flood':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-955/40 text-amber-400 border border-amber-900/40 flex items-center gap-1 font-mono text-[10px] animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" /> Wait Penalty
          </span>
        );
      case 'stopped':
        return <span className="px-2 py-0.5 rounded-md bg-rose-950/40 text-rose-300 border border-rose-900/40 font-mono text-[10px]">Stopped</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-900/50 font-mono text-[10px]">Completed</span>;
      case 'failed':
        return <span className="px-2 py-0.5 rounded-md bg-rose-950/40 text-rose-300 border border-rose-900/40 font-mono text-[10px]">Failed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono text-[10px]">{status}</span>;
    }
  };

  // Format sizing and timings
  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <div id="forward-manager-parent" className="space-y-6">
      {/* 1. SCANNERS & ADJUSTABLE PARAMETERS CORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scansion logic */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-sans font-semibold text-slate-200 text-sm tracking-wide uppercase flex items-center gap-2">
              <Tv className="w-4 h-4 text-slate-400" /> Channel Video Scanner
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Source Peer: {sourceChatId}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">History scan depth</label>
              <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg space-x-1">
                {([100, 500, 1500, 'all'] as const).map((num) => (
                  <button
                    key={num}
                    onClick={() => setScanCount(num)}
                    disabled={scanning}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                      scanCount === num
                        ? 'bg-sky-500/20 text-sky-450 border border-sky-550/20 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {num === 'all' ? 'All History' : `Last ${num}`}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">Deep limits retrieve more videos, with &quot;All History&quot; continuously scanning back until finished.</p>
            </div>

            <button
              onClick={handleScanMessages}
              disabled={scanning || !sourceChatId}
              className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-sky-500/10"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" /> Querying Telegram Logs...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Scan Source Chat History
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cooldown parameters and author handling */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-sans font-semibold text-slate-200 text-sm tracking-wide uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-slate-400" /> Anti-Flood & Velocity Options
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Random Cooldown Range</label>
                <span className="text-xs font-semibold font-mono text-sky-450 bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-850/40">
                  {minDelay}s - {maxDelay}s
                </span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex-1 space-y-1.5">
                  <span className="text-[10px] text-slate-500">Min Sleep</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={minDelay}
                    onChange={(e) => setMinDelay(Math.min(parseInt(e.target.value), maxDelay))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <span className="text-[10px] text-slate-500">Max Sleep</span>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Math.max(parseInt(e.target.value), minDelay))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Choose 0s delay for ultimate speed delivery (~15-50 videos per second depending on network).
              </p>
            </div>

            <div className="border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Fast-Forward Batch Size</label>
                <span className="text-xs font-semibold font-mono text-emerald-450 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-850/40">
                  {batchSize} msgs/call
                </span>
              </div>
              <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg space-x-1">
                {([1, 5, 25, 50, 100] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBatchSize(size)}
                    className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                      batchSize === size
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Forwarding multiple messages in a single instant Telegram API rpc call easily hits speeds of <strong className="text-emerald-400">10-50 videos per second</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 mt-2">
              <div>
                <p className="text-xs font-semibold text-slate-300">Drop Origin Credits</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Remove original creator citation &apos;Forwarded from...&apos;</p>
              </div>
              <input
                type="checkbox"
                checked={dropAuthor}
                onChange={(e) => setDropAuthor(e.target.checked)}
                className="w-4.5 h-4.5 accent-sky-500 cursor-pointer border-slate-800 rounded-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TRANSFER CONTROLS & MONITORING IF ACTIVE */}
      {jobStatus && (
        <div className="p-5 bg-slate-950 text-white rounded-2xl shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-sans text-sm font-semibold text-white tracking-widest uppercase">Forward Process Core</h3>
                  {getStatusBadge(jobStatus.status)}
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Active Job ID: {jobStatus.id}</p>
              </div>
            </div>

            {/* Cancel trigger */}
            {jobStatus.status === 'running' || jobStatus.status === 'paused_flood' ? (
              <button
                onClick={handleStopForwarding}
                className="self-center px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 tracking-wide transition-all uppercase cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Abort Transfer
              </button>
            ) : null}
          </div>

          {/* FLOOD COUNTDOWN ALERT */}
          {jobStatus.status === 'paused_flood' && (
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-amber-950/40 border border-amber-800 p-4 rounded-xl flex items-start gap-3.5 text-xs text-amber-200"
            >
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">Telegram FLOOD_WAIT Restriction Enforced</p>
                <p className="leading-relaxed text-amber-200/90">
                  Telegram triggered an account speed ban. No worries—the applet is managing the pause and will{' '}
                  <span className="font-bold underline">automatically resume</span> transfer in exactly{' '}
                  <span className="font-bold text-white font-mono text-sm bg-amber-900 px-1.5 py-0.5 rounded-sm">
                    {jobStatus.activeWaitSeconds}
                  </span>{' '}
                  seconds. Do not close this tab.
                </p>
              </div>
            </motion.div>
          )}

          {/* Progress gauge calculations */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span>Transfer Pipeline: {jobStatus.current} / {jobStatus.total} Elements processed</span>
              <span className="font-semibold">{Math.round((jobStatus.current / jobStatus.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
              <div
                style={{ width: `${(jobStatus.success / jobStatus.total) * 100}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
              />
              <div
                style={{ width: `${(jobStatus.failed / jobStatus.total) * 100}%` }}
                className="bg-rose-500 h-full transition-all duration-300"
              />
              <div
                style={{ width: `${(jobStatus.skipped / jobStatus.total) * 100}%` }}
                className="bg-amber-500 h-full transition-all duration-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center pt-2 text-xs font-mono">
              <div className="bg-slate-900/40 p-2 border border-slate-800 rounded-xl">
                <span className="block text-emerald-400 font-bold text-base">{jobStatus.success}</span>
                <span className="text-[9px] text-slate-400 block uppercase font-sans tracking-wide">Success</span>
              </div>
              <div className="bg-slate-900/40 p-2 border border-slate-800 rounded-xl">
                <span className="block text-rose-400 font-bold text-base">{jobStatus.failed}</span>
                <span className="text-[9px] text-slate-400 block uppercase font-sans tracking-wide">Failed / Skipped</span>
              </div>
              <div className="bg-slate-900/40 p-2 border border-slate-800 rounded-xl">
                <span className="block text-indigo-400 font-bold text-base">{jobStatus.total - jobStatus.current}</span>
                <span className="text-[9px] text-slate-400 block uppercase font-sans tracking-wide">Remaining</span>
              </div>
            </div>
          </div>

          {/* Core scroll log block */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-400" /> Internal Terminal Echo
            </span>
            <div
              id="terminal-log-scroller"
              className="bg-black/80 border border-slate-800 rounded-xl p-3.5 h-48 overflow-y-auto font-mono text-xs text-sky-300 space-y-1 h-36"
            >
              {jobStatus.logs && jobStatus.logs.length > 0 ? (
                jobStatus.logs.map((log, index) => <p key={index} className="leading-relaxed">{log}</p>)
              ) : (
                <p className="text-slate-500">Connecting channel pipelines...</p>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* 3. SCANNED VIDEO MESSAGES SELECTION AND ACTION PANELS */}
      {scannedVideos.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          {/* Section Toolbar header selectors */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div>
              <h3 className="font-sans text-sm font-semibold text-white tracking-wide uppercase">
                Filter and Process Scanned Media
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Found <span className="font-semibold text-slate-200">{filteredVideos.length} / {scannedVideos.length}</span> videos. Use search or quick-select values.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <input
                  type="text"
                  value={captionSearch}
                  onChange={(e) => setCaptionSearch(e.target.value)}
                  placeholder="Filter text snippet captions..."
                  className="w-full sm:w-56 pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-505"
                />
              </div>

              <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg shrink-0">
                {(['all', 'round', 'standard'] as const).map((vt) => (
                  <button
                    key={vt}
                    onClick={() => setFilterType(vt)}
                    className={`px-2.5 py-1 text-[11px] font-medium capitalize rounded-md transition-all cursor-pointer ${
                      filterType === vt
                        ? 'bg-sky-500/15 border border-sky-500/25 text-sky-400 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {vt === 'round' ? 'Round only' : vt === 'standard' ? 'Standard only' : 'All formats'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List selection tools */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => handleSelectAllFiltered(filteredVideos)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-[10px] text-slate-200 font-semibold rounded-md shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Select All filtered
              </button>
              <button
                onClick={() => handleUnselectAllFiltered(filteredVideos)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-[10px] text-slate-200 font-semibold rounded-md shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5 text-rose-400" /> Unselect All filtered
              </button>
            </div>

            <span className="text-xs font-semibold text-sky-400 bg-sky-950/40 border border-sky-800 px-3 py-1 rounded-full font-mono">
              Selected to Forward: {selectedVideoIds.size}
            </span>
          </div>

          {/* List layout list table */}
          <div className="divide-y divide-slate-850/60 max-h-[350px] overflow-y-auto">
            {filteredVideos.map((video) => {
              const checked = selectedVideoIds.has(video.id);
              const isJobRunningItem = jobStatus && jobStatus.itemsState[video.id];

              return (
                <div
                  key={video.id}
                  onClick={() => handleToggleSelectOne(video.id)}
                  className={`p-4 flex items-start gap-4 hover:bg-slate-955/40 cursor-pointer transition-all ${
                    checked ? 'bg-sky-500/5' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="w-4.5 h-4.5 accent-sky-500 top-0.5 shrink-0 cursor-pointer"
                  />

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-350 bg-slate-955 px-1.5 py-0.5 border border-slate-800 rounded-sm">
                        ID: {video.id}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatTimestamp(video.date)}
                      </span>

                      {video.isRound ? (
                        <span className="text-[9px] font-semibold tracking-wider font-sans uppercase bg-sky-950/65 border border-sky-900/60 text-sky-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" /> Round Note
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold tracking-wider font-sans uppercase bg-emerald-955/65 border border-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Standard MP4
                        </span>
                      )}

                      {video.duration ? (
                        <span className="text-[10px] text-slate-300 bg-slate-850 border border-slate-800 px-2 py-0.5 rounded-md font-mono font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" /> {formatDuration(video.duration)}
                        </span>
                      ) : null}

                      {video.size ? (
                        <span className="text-[10px] text-slate-500 font-mono font-medium">
                          {formatSize(video.size)}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 italic font-serif">
                      {video.text ? `"${video.text}"` : <span className="text-slate-550 font-sans not-italic">No caption metadata</span>}
                    </p>
                  </div>

                  {/* Individual job transition highlights (inside table list) */}
                  {isJobRunningItem && (
                    <div className="shrink-0">
                      {isJobRunningItem.status === 'success' && (
                        <span className="p-1 rounded-full bg-emerald-950/40 border border-emerald-900/35 text-emerald-300 flex items-center gap-1 text-[10px] pr-2.5 font-medium shadow-2xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Forwarded
                        </span>
                      )}
                      {isJobRunningItem.status === 'failed' && (
                        <span
                          title={isJobRunningItem.error}
                          className="p-1 rounded-full bg-rose-950/40 border border-rose-900/35 text-rose-300 flex items-center gap-1 text-[10px] pr-2.5 font-medium shadow-2xs"
                        >
                          <XCircle className="w-4 h-4 text-rose-400" /> Errored
                        </span>
                      )}
                      {isJobRunningItem.status === 'retrying' && (
                        <span
                          title={isJobRunningItem.error}
                          className="p-1 rounded-full bg-amber-955/40 border border-amber-900/35 text-amber-300 flex items-center gap-1 text-[10px] pr-2.5 font-medium shadow-2xs animate-pulse"
                        >
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Retrying
                        </span>
                      )}
                      {isJobRunningItem.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-md border border-slate-800 text-slate-400 text-[10px] font-medium font-mono bg-slate-950">
                          Queued
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Starting bulk forward card footer actions */}
          <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-center sm:text-left">
              <p className="text-xs font-semibold text-slate-300 font-sans">Ready to execute bulk transfer?</p>
              <p className="text-[11px] text-slate-500">
                You will be transferring <span className="font-bold font-mono text-sky-400 text-xs">{selectedVideoIds.size}</span> video items from source to target.
              </p>
            </div>

            <button
              onClick={handleStartForwarding}
              disabled={selectedVideoIds.size === 0 || polling}
              className="w-full sm:w-auto px-6 py-3.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 active:scale-98 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/15 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current text-white" /> Start Forwarding Selected Videos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
