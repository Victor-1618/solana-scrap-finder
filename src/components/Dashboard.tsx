import React, { useState, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useScannerStore } from '../store/useScannerStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSolanaScanner } from '../hooks/useSolanaScanner';
import { useReclaimRent } from '../hooks/useReclaimRent';
import { analyzeToken, getTokensByCategory } from '../services/tokenIntelligence';
import { calculateHealthScore, getGradeColor, getGradeBg } from '../services/healthScore';
import { detectProtocolPositions, scanAllProtocols, PROTOCOLS } from '../services/protocolScanner';
import { detectLockedPositions, scanRaydiumLpAccounts, getTotalLockedValue } from '../services/lockedPositions';
import { LockedLiquidityPanel } from './LockedLiquidityPanel';
import { 
  Coins, Landmark, AlertTriangle, RefreshCw, Download, 
  Search, ShieldAlert, BookOpen, Layers, CheckSquare, 
  Square, Info, ChevronRight, ExternalLink, X 
} from 'lucide-react';


export const Dashboard: React.FC = () => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { 
    solBalance, tokens, emptyAccounts, deactivatedStakes, 
    isScanning, scanError, hasScanned, lastReclaim 
  } = useScannerStore();
  const { scan } = useSolanaScanner();
  const { watchAddresses, addWatchAddress, removeWatchAddress } = useSettingsStore();
  const [activeWatchAddress, setActiveWatchAddress] = useState<string | null>(null);
  const [watchInput, setWatchInput] = useState('');
  const [watchError, setWatchError] = useState('');
  const [showWatchManager, setShowWatchManager] = useState(false);

  const activeAddress = useMemo(() => {
    if (activeWatchAddress) return activeWatchAddress;
    return publicKey?.toBase58() || null;
  }, [activeWatchAddress, publicKey]);

  const isViewOnly = activeWatchAddress !== null;
  const { reclaim, isReclaiming, reclaimLog, reclaimError } = useReclaimRent();

  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'reclaim' | 'locked' | 'advanced' | 'faq'>('overview');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState<'all' | 'verified' | 'unknown' | 'token2022' | 'high_potential' | 'active_holding' | 'dust' | 'spam'>('all');
  
  // Reclaim selection state
  const [selectedTokens, setSelectedTokens] = useState<Record<string, boolean>>({});
  const [selectedStakes, setSelectedStakes] = useState<Record<string, boolean>>({});
  const [cleanupMode, setCleanupMode] = useState<'safe' | 'aggressive'>('safe');
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [showReport, setShowReport] = useState(false);

  // Protocol scanner state
  const [protocolPositions, setProtocolPositions] = useState<ReturnType<typeof detectProtocolPositions>>([]);
  const [protocolScanning, setProtocolScanning] = useState(false);
  const [protocolAccounts, setProtocolAccounts] = useState<{ protocol: string; accounts: { pubkey: string; lamports: number }[] }[]>([]);

  // Locked positions state
  const [lockedPositions, setLockedPositions] = useState<ReturnType<typeof detectLockedPositions>>([]);
  const [raydiumScanning, setRaydiumScanning] = useState(false);

  // Auto-detect protocol positions when scan completes
  React.useEffect(() => {
    if (hasScanned && tokens.length > 0) {
      setProtocolPositions(detectProtocolPositions(tokens));
      setLockedPositions(detectLockedPositions(tokens));
    }
  }, [hasScanned, tokens]);

  // Advanced Recovery State
  const [advProgramId, setAdvProgramId] = useState('');
  const [advOffset, setAdvOffset] = useState('32');
  const [advLoading, setAdvLoading] = useState(false);
  const [advResults, setAdvResults] = useState<{ pubkey: string; lamports: number }[]>([]);
  const [advError, setAdvError] = useState<string | null>(null);

  // Category-based filter values for assets with balance > 0
  const tokenCategories = useMemo(() => {
    const cats: Record<string, string> = {};
    tokens.forEach(t => {
      if (t.amount > 0) {
        cats[t.accountAddress] = analyzeToken(t).category;
      }
    });
    return cats;
  }, [tokens]);

  // Asset scanning filtering logic
  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => {
      const matchesSearch = 
        t.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        t.symbol.toLowerCase().includes(assetSearch.toLowerCase()) ||
        t.mint.includes(assetSearch);
      
      if (!matchesSearch) return false;
      if (assetFilter === 'verified') return !t.isUnknown;
      if (assetFilter === 'unknown') return t.isUnknown;
      if (assetFilter === 'token2022') return t.isToken2022;
      if (assetFilter === 'high_potential' || assetFilter === 'active_holding' || assetFilter === 'dust' || assetFilter === 'spam') {
        return tokenCategories[t.accountAddress] === assetFilter;
      }
      return true;
    });
  }, [tokens, assetSearch, assetFilter, tokenCategories]);

  // Dust tokens for aggressive cleanup (unknown tokens with tiny balances)
  const dustTokens = useMemo(() => {
    return tokens.filter(t => t.isUnknown && t.amount > 0 && t.amount <= 0.001);
  }, [tokens]);

  // Smart auto-selection based on cleanup mode
  React.useEffect(() => {
    if (cleanupMode === 'safe') {
      const initialTokens: Record<string, boolean> = {};
      emptyAccounts.forEach(acc => { initialTokens[acc.accountAddress] = true; });
      setSelectedTokens(initialTokens);
      const initialStakes: Record<string, boolean> = {};
      deactivatedStakes.forEach(acc => { initialStakes[acc.pubkey] = true; });
      setSelectedStakes(initialStakes);
    } else {
      const initialTokens: Record<string, boolean> = {};
      emptyAccounts.forEach(acc => { initialTokens[acc.accountAddress] = true; });
      dustTokens.forEach(t => { initialTokens[t.accountAddress] = true; });
      setSelectedTokens(initialTokens);
      const initialStakes: Record<string, boolean> = {};
      deactivatedStakes.forEach(acc => { initialStakes[acc.pubkey] = true; });
      setSelectedStakes(initialStakes);
    }
  }, [cleanupMode, emptyAccounts, deactivatedStakes, dustTokens]);

  // Calculations
  const selectedTokenCount = Object.values(selectedTokens).filter(Boolean).length;
  const selectedStakeCount = Object.values(selectedStakes).filter(Boolean).length;
  
  const estimatedReclaimableSol = useMemo(() => {
    let sol = 0;
    emptyAccounts.forEach(acc => {
      if (selectedTokens[acc.accountAddress]) sol += acc.rentLocked;
    });
    tokens.forEach(t => {
      if (selectedTokens[t.accountAddress]) sol += t.rentLocked;
    });
    deactivatedStakes.forEach(acc => {
      if (selectedStakes[acc.pubkey]) sol += acc.rentLocked;
    });
    return sol;
  }, [selectedTokens, selectedStakes, emptyAccounts, deactivatedStakes, tokens]);

  // Preview details
  const previewAccounts = useMemo(() => {
    const empty = emptyAccounts.filter(acc => selectedTokens[acc.accountAddress]);
    const dust = tokens.filter(t => selectedTokens[t.accountAddress] && t.amount > 0);
    const stakes = deactivatedStakes.filter(acc => selectedStakes[acc.pubkey]);
    return { empty, dust, stakes };
  }, [selectedTokens, selectedStakes, emptyAccounts, deactivatedStakes, tokens]);

  // Health score
  const walletHealth = useMemo(() => {
    if (!hasScanned) return null;
    return calculateHealthScore(solBalance, tokens, emptyAccounts, deactivatedStakes);
  }, [solBalance, tokens, emptyAccounts, deactivatedStakes, hasScanned]);

  const totalRentLocked = useMemo(() => {
    return emptyAccounts.reduce((s, a) => s + a.rentLocked, 0) + deactivatedStakes.reduce((s, a) => s + a.rentLocked, 0);
  }, [emptyAccounts, deactivatedStakes]);

  // Portfolio breakdown for chart
  const portfolioChart = useMemo(() => {
    if (!hasScanned) return [];
    const items = [
      { label: 'SOL Balance', value: solBalance, color: 'bg-solana-green', pct: 0 },
      { label: 'Reclaimable Rent', value: totalRentLocked, color: 'bg-solana-purple', pct: 0 },
      { label: 'Token Rent Locked', value: tokens.reduce((s, t) => s + t.rentLocked, 0), color: 'bg-amber-400', pct: 0 },
    ];
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    items.forEach(i => i.pct = (i.value / total) * 100);
    return items;
  }, [solBalance, tokens, totalRentLocked, hasScanned]);

  // Export handlers
  const handleExportCSV = () => {
    if (tokens.length === 0) return;
    const headers = ['Mint', 'Account Address', 'Name', 'Symbol', 'Amount', 'Rent Locked (SOL)', 'Program'];
    const rows = tokens.map(t => [
      t.mint,
      t.accountAddress,
      t.name,
      t.symbol,
      t.amount,
      t.rentLocked,
      t.isToken2022 ? 'Token-2022' : 'Token Program'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `solvault_scan_${publicKey?.toBase58().slice(0,6)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (tokens.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tokens, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `solvault_scan_${publicKey?.toBase58().slice(0,6)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reclaim Execution Handler
  const handleReclaim = async () => {
    const emptyToReclaim = emptyAccounts.filter(acc => selectedTokens[acc.accountAddress]);
    const dustToReclaim = tokens.filter(t => selectedTokens[t.accountAddress] && t.amount > 0);
    const stakesToReclaim = deactivatedStakes.filter(acc => selectedStakes[acc.pubkey]);
    
    if (emptyToReclaim.length === 0 && dustToReclaim.length === 0 && stakesToReclaim.length === 0) return;

    setShowPreview(false);
    const result = await reclaim(emptyToReclaim.concat(dustToReclaim), stakesToReclaim);
    if (result.success) {
      setShowSuccess(true);
      setCleanupMode('safe');
      setTimeout(() => setShowSuccess(false), 8000);
    }
  };

  // Advanced Custom Program ID Scanner
  const handleProgramScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;
    setAdvLoading(true);
    setAdvError(null);
    setAdvResults([]);

    try {
      const progKey = new PublicKey(advProgramId.trim());
      const offsetVal = parseInt(advOffset, 10);
      
      if (isNaN(offsetVal) || offsetVal < 0) {
        throw new Error('Offset must be a valid positive number');
      }

      const accounts = await connection.getProgramAccounts(progKey, {
        filters: [
          {
            memcmp: {
              offset: offsetVal,
              bytes: publicKey.toBase58(),
            },
          },
        ],
      });

      const parsedResults = accounts.map(acc => ({
        pubkey: acc.pubkey.toBase58(),
        lamports: acc.account.lamports
      }));

      setAdvResults(parsedResults);
      if (parsedResults.length === 0) {
        setAdvError('No accounts matching your wallet authority found under this program.');
      }
    } catch (err: any) {
      setAdvError(err?.message || 'Failed to scan program accounts. Ensure Program ID is valid.');
    } finally {
      setAdvLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Wallet Connected Banner Summary */}
      <div className="glass-panel p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-solana-muted text-xs font-bold uppercase tracking-widest">Active Scan Target</p>
            {isViewOnly && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">View-Only</span>
            )}
            {publicKey && !isViewOnly && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-solana-green/10 text-solana-green border border-solana-green/20 font-bold uppercase">Connected</span>
            )}
          </div>
          <h2 className="font-extrabold text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-solana-green to-solana-purple truncate">
            {activeAddress || 'No wallet selected'}
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-solana-muted">
              Status: {hasScanned ? 'Scan Completed' : 'Pending Initial Scan'}
            </span>
            {/* Wallet Switcher */}
            {(publicKey || watchAddresses.length > 0) && (
              <div className="flex items-center gap-1.5">
                {publicKey && (
                  <button
                    onClick={() => setActiveWatchAddress(null)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                      !isViewOnly ? 'bg-solana-green/15 text-solana-green border border-solana-green/20' : 'text-solana-muted hover:text-white border border-transparent'
                    }`}
                  >
                    Connected
                  </button>
                )}
                {watchAddresses.map(addr => (
                  <button
                    key={addr}
                    onClick={() => setActiveWatchAddress(addr)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                      activeWatchAddress === addr ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-solana-muted hover:text-white border border-transparent'
                    }`}
                  >
                    {addr.slice(0, 4)}..{addr.slice(-4)}
                  </button>
                ))}
                <button
                  onClick={() => setShowWatchManager(true)}
                  className="px-2 py-1 rounded text-[10px] text-solana-purple font-bold hover:bg-solana-purple/10 transition-all"
                  title="Manage watch addresses"
                >
                  + Add
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => scan(isViewOnly ? new PublicKey(activeWatchAddress) : undefined)}
            disabled={isScanning || !activeAddress}
            className="flex items-center gap-2 py-3 px-6 rounded-full bg-gradient-to-r from-solana-purple to-indigo-700 text-white font-bold text-sm hover:opacity-95 shadow-md shadow-purple-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : hasScanned ? 'Rescan Wallet' : 'Start Diagnostic Scan'}
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {showSuccess && lastReclaim && (
        <div className="border border-solana-green/30 bg-solana-green/5 rounded-2xl p-5 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-2.5 bg-solana-green/15 text-solana-green rounded-xl border border-solana-green/20">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-extrabold text-base text-solana-green">Reclaim Successful!</h4>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
              <span><strong className="text-solana-text">{lastReclaim.reclaimedSol.toFixed(6)} SOL</strong> recovered</span>
              <span><strong className="text-solana-text">{lastReclaim.accountsClosed}</strong> token accounts closed</span>
              <span><strong className="text-solana-text">{lastReclaim.stakesWithdrawn}</strong> stakes withdrawn</span>
              <span><strong className="text-solana-text">{lastReclaim.txCount}</strong> transactions</span>
            </div>
            <div className="mt-2 text-xs text-solana-muted">
              Balance changed: <strong className="text-solana-text">{solBalance.toFixed(4)} SOL</strong> (was {(solBalance - lastReclaim.reclaimedSol).toFixed(4)} SOL)
            </div>
          </div>
          <button
            onClick={() => setShowSuccess(false)}
            className="text-solana-muted hover:text-white p-1 rounded-full hover:bg-solana-border/50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-solana-border overflow-x-auto gap-2 md:gap-4 no-scrollbar">
        {(['overview', 'assets', 'reclaim', 'locked', 'advanced', 'faq'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 text-sm font-extrabold border-b-2 whitespace-nowrap capitalize transition-all ${
              activeTab === tab
                ? 'border-solana-green text-solana-green'
                : 'border-transparent text-solana-muted hover:text-white hover:border-slate-700'
            }`}
          >
            {tab === 'reclaim' ? `Rent Recovery (${emptyAccounts.length + deactivatedStakes.length})` : tab === 'locked' ? `Locked (${lockedPositions.length})` : tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* OVERVIEW PANEL */}
        {activeTab === 'overview' && (
          <>
          <div className="grid md:grid-cols-4 gap-6">
            {/* Health Grade */}
            <div className="glass-panel p-6 flex flex-col justify-between h-44">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-solana-muted text-xs font-bold uppercase tracking-wider">Wallet Health</p>
                  {walletHealth ? (
                    <h3 className={`text-2xl font-black mt-2 ${walletHealth.color}`}>{walletHealth.gradeLabel}</h3>
                  ) : (
                    <h3 className="text-2xl font-black mt-2 text-solana-muted">--</h3>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl border ${walletHealth ? getGradeBg(walletHealth.grade) : 'bg-solana-card border-solana-border'}`}>
                  <ShieldAlert className={`w-5 h-5 ${walletHealth ? walletHealth.color : 'text-solana-muted'}`} />
                </div>
              </div>
              {walletHealth && (
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-solana-border overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${getGradeColor(walletHealth.grade)}`} style={{ width: `${walletHealth.score}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-solana-muted">
                    <span>{walletHealth.score}/100</span>
                    <span>{walletHealth.issues.length} issue{walletHealth.issues.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </div>

            {/* SOL Balance */}
            <div className="glass-panel p-6 flex flex-col justify-between h-44">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-solana-muted text-xs font-bold uppercase tracking-wider">SOL Balance</p>
                  <h3 className="text-3xl font-black mt-2">{hasScanned ? solBalance.toFixed(4) : '--'} SOL</h3>
                </div>
                <div className="p-2.5 bg-solana-green/10 text-solana-green rounded-xl border border-solana-green/20">
                  <Coins className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-solana-muted leading-relaxed">
                Active balance available for gas and general wallet transactions.
              </p>
            </div>

            {/* Token Holdings */}
            <div className="glass-panel p-6 flex flex-col justify-between h-44">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-solana-muted text-xs font-bold uppercase tracking-wider">Token Holdings</p>
                  <h3 className="text-3xl font-black mt-2">{hasScanned ? tokens.length : '--'}</h3>
                </div>
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs text-solana-muted leading-relaxed">
                Unique SPL token balances active in your wallet (including Token-2022).
              </p>
            </div>

            {/* Reclaimable Rent */}
            <div className="glass-panel p-6 flex flex-col justify-between h-44 relative overflow-hidden group">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-solana-green/5 rounded-full blur-xl group-hover:bg-solana-green/10 transition-all"></div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-solana-muted text-xs font-bold uppercase tracking-wider">Reclaimable Rent</p>
                  <h3 className="text-3xl font-black mt-2 text-solana-green">
                    {hasScanned ? totalRentLocked.toFixed(4) : '--'} SOL
                  </h3>
                </div>
                <div className="p-2.5 bg-solana-green/15 text-solana-green rounded-xl border border-solana-green/30">
                  <Landmark className="w-5 h-5" />
                </div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-solana-muted">
                  From {emptyAccounts.length} empty and {deactivatedStakes.length} deactivated stake accounts.
                </span>
                {hasScanned && (emptyAccounts.length > 0 || deactivatedStakes.length > 0) && (
                  <button 
                    onClick={() => setActiveTab('reclaim')}
                    className="text-xs text-solana-green font-bold flex items-center hover:underline"
                  >
                    Reclaim Now <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Portfolio Chart + Health Report */}
          {hasScanned && (
            <div className="grid md:grid-cols-5 gap-6">
              <div className="md:col-span-3 glass-panel p-6 space-y-4">
                <h4 className="font-extrabold text-sm flex items-center gap-2">
                  <Coins className="w-4 h-4 text-solana-green" />
                  Portfolio Breakdown
                </h4>
                <div className="space-y-3">
                  {portfolioChart.map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-solana-muted">{item.label}</span>
                        <span className="font-bold">{item.value.toFixed(4)} SOL <span className="text-solana-muted font-normal text-xs">({item.pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-solana-border overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${item.color}`} style={{ width: `${Math.max(item.pct, 0.5)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 glass-panel p-6 space-y-4 flex flex-col justify-center">
                <h4 className="font-extrabold text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-solana-purple" />
                  Wallet Health Report
                </h4>
                {walletHealth && (
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-1.5">
                      {walletHealth.strengths.map(s => (
                        <span key={s} className="text-[10px] px-2 py-1 rounded-full bg-solana-green/10 text-solana-green border border-solana-green/20">{s}</span>
                      ))}
                    </div>
                    {walletHealth.issues.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-amber-400 font-bold">Issues Found:</p>
                        <ul className="text-xs text-solana-muted space-y-1">
                          {walletHealth.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => setShowReport(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-solana-purple to-indigo-700 text-white font-bold text-sm hover:opacity-90 transition-all"
                    >
                      View Full Report
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Wallet Health Report Modal */}
        {showReport && walletHealth && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-solana-card border border-solana-border rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-solana-purple" />
                  Wallet Health Report
                </h3>
                <button 
                  onClick={() => setShowReport(false)}
                  className="text-solana-muted hover:text-white p-1 rounded-full hover:bg-solana-border transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Score */}
                <div className="text-center p-6 rounded-xl border" style={{ borderColor: 'var(--solana-border)' }}>
                  <div className={`text-5xl font-black ${walletHealth.color}`}>{walletHealth.score}</div>
                  <div className={`text-lg font-bold mt-1 ${walletHealth.color}`}>{walletHealth.gradeLabel}</div>
                  <div className="w-full h-2 rounded-full bg-solana-border overflow-hidden mt-3 max-w-xs mx-auto">
                    <div className={`h-full rounded-full ${getGradeColor(walletHealth.grade)}`} style={{ width: `${walletHealth.score}%` }}></div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-solana-dark/40 p-4 rounded-xl border border-solana-border text-center">
                    <div className="text-xl font-black">{solBalance.toFixed(4)}</div>
                    <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">SOL Balance</div>
                  </div>
                  <div className="bg-solana-dark/40 p-4 rounded-xl border border-solana-border text-center">
                    <div className="text-xl font-black">{tokens.length}</div>
                    <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">Tokens</div>
                  </div>
                  <div className="bg-solana-dark/40 p-4 rounded-xl border border-solana-border text-center">
                    <div className="text-xl font-black">{totalRentLocked.toFixed(4)}</div>
                    <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">Reclaimable SOL</div>
                  </div>
                  <div className="bg-solana-dark/40 p-4 rounded-xl border border-solana-border text-center">
                    <div className="text-xl font-black">{emptyAccounts.length + deactivatedStakes.length}</div>
                    <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">Accounts to Close</div>
                  </div>
                </div>

                {/* Strengths */}
                {walletHealth.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-solana-green mb-2">Strengths</h4>
                    <div className="space-y-1.5">
                      {walletHealth.strengths.map((s, i) => (
                        <div key={i} className="text-xs text-solana-muted bg-solana-green/5 border border-solana-green/10 px-3 py-2 rounded-lg flex items-center gap-2">
                          <CheckSquare className="w-3.5 h-3.5 text-solana-green shrink-0" />
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issues */}
                {walletHealth.issues.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">Issues to Address</h4>
                    <div className="space-y-1.5">
                      {walletHealth.issues.map((issue, i) => (
                        <div key={i} className="text-xs text-solana-muted bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-lg flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowReport(false); setActiveTab('reclaim'); }}
                    className="flex-1 py-3 px-4 rounded-xl bg-solana-green text-solana-dark font-extrabold text-sm hover:opacity-90 transition-all"
                  >
                    Go to Rent Recovery
                  </button>
                  <button
                    onClick={() => { setShowReport(false); setActiveTab('assets'); }}
                    className="flex-1 py-3 px-4 rounded-xl border border-solana-border text-sm font-bold text-solana-muted hover:bg-solana-dark transition-all"
                  >
                    View All Assets
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

            {/* Token Intelligence Breakdown */}
            {hasScanned && tokens.length > 0 && (
              <div className="col-span-full glass-panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-solana-purple" />
                    Token Intelligence Breakdown
                  </h4>
                  <button
                    onClick={() => setActiveTab('assets')}
                    className="text-xs text-solana-purple font-bold hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {([
                    { key: 'high_potential' as const, label: 'High Potential', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { key: 'active_holding' as const, label: 'Active Holdings', color: 'text-solana-green', bg: 'bg-solana-green/10 border-solana-green/20' },
                    { key: 'unknown' as const, label: 'Unknown', color: 'text-solana-muted', bg: 'bg-solana-card border-solana-border' },
                    { key: 'dust' as const, label: 'Dust / Spam', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                    { key: 'spam' as const, label: 'Likely Spam', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                  ]).map(cat => {
                    const count = getTokensByCategory(tokens)[cat.key].filter(t => t.amount > 0).length;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => { setAssetFilter(cat.key); setActiveTab('assets'); }}
                        className={`p-4 rounded-xl border ${cat.bg} text-center hover:scale-[1.02] transition-all cursor-pointer`}
                      >
                        <div className={`text-2xl font-black ${cat.color}`}>{count}</div>
                        <div className={`text-xs font-bold mt-1 ${cat.color}`}>{cat.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* If not scanned, prompt */}
            {!hasScanned && !isScanning && (
              <div className="col-span-full glass-panel p-8 text-center space-y-4">
                <Info className="w-12 h-12 text-solana-purple mx-auto opacity-70" />
                <h4 className="font-extrabold text-lg">Diagnostics Ready</h4>
                <p className="text-solana-muted text-sm max-w-lg mx-auto">
                  Click 'Start Diagnostic Scan' to fetch your wallet's balances, active token addresses, locked rent, and stake accounts on the blockchain.
                </p>
              </div>
            )}

            {isScanning && (
              <div className="col-span-full glass-panel p-12 text-center space-y-4">
                <RefreshCw className="w-12 h-12 text-solana-green animate-spin mx-auto" />
                <h4 className="font-extrabold text-lg">Scanning Blockchain Accounts...</h4>
                <p className="text-solana-muted text-sm max-w-sm mx-auto">
                  Querying token programs and stake configurations. This may take up to a minute depending on RPC load.
                </p>
              </div>
            )}

            {scanError && (
              <div className="col-span-full border border-red-500/30 bg-red-950/20 text-red-200 p-6 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold">Scan Incomplete</h4>
                  <p className="text-sm">{scanError}</p>
                  <p className="text-xs text-red-300/80 mt-2">
                    Tip: If you're hitting rate limits, you can add a custom RPC provider (such as Helius or QuickNode) via the settings icon on the top right.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ASSET SCANNER PANEL */}
        {activeTab === 'assets' && (
          <div className="glass-panel p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-solana-muted" />
                <input
                  type="text"
                  placeholder="Search token name or mint..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="w-full bg-solana-dark border border-solana-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-solana-green"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto py-1">
                <select
                  value={assetFilter}
                  onChange={(e) => setAssetFilter(e.target.value as any)}
                  className="bg-solana-dark border border-solana-border rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-solana-green"
                >
                  <option value="all">All Holdings</option>
                  <option value="verified">Verified Tokens</option>
                  <option value="unknown">Unknown / Spam</option>
                  <option value="token2022">Token-2022</option>
                  <option value="high_potential">High Potential</option>
                  <option value="active_holding">Active Holdings</option>
                  <option value="dust">Dust / Spam</option>
                  <option value="spam">Likely Spam</option>
                </select>

                <button
                  onClick={handleExportCSV}
                  disabled={tokens.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-solana-card border border-solana-border text-xs font-semibold hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  onClick={handleExportJSON}
                  disabled={tokens.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-solana-card border border-solana-border text-xs font-semibold hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  JSON
                </button>
              </div>
            </div>

            {/* Asset Table */}
            <div className="overflow-x-auto border border-solana-border rounded-xl">
              <table className="min-w-full divide-y divide-solana-border">
                <thead className="bg-solana-dark">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-solana-muted uppercase tracking-wider">Asset</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-solana-muted uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-solana-muted uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-solana-muted uppercase tracking-wider">Risk</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-solana-muted uppercase tracking-wider">Rent Locked</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-solana-muted uppercase tracking-wider">Mint Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-solana-border bg-solana-card/25">
                  {!hasScanned ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-solana-muted text-sm">
                        Please perform a wallet scan to view active token holdings.
                      </td>
                    </tr>
                  ) : filteredTokens.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-solana-muted text-sm">
                        No active token holdings found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTokens.map((token) => {
                      const intelligence = analyzeToken(token);
                      return (
                      <tr key={token.accountAddress} className="hover:bg-solana-card/60 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {token.logo ? (
                              <img src={token.logo} alt={token.symbol} className="w-7 h-7 rounded-full bg-solana-dark shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-solana-border flex items-center justify-center font-bold text-[9px] text-solana-muted shrink-0">
                                {token.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="font-extrabold text-sm flex items-center gap-1.5">
                                {token.symbol}
                              </div>
                              <div className="text-[11px] text-solana-muted">{token.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${intelligence.category === 'high_potential' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : intelligence.category === 'active_holding' ? 'bg-solana-green/10 border-solana-green/20 text-solana-green' : intelligence.category === 'dust' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : intelligence.category === 'spam' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-solana-card border-solana-border text-solana-muted'}`}>
                            {intelligence.categoryLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                          {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold border ${intelligence.riskColor}`}>
                            {intelligence.riskLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-solana-muted font-medium">
                          {token.rentLocked.toFixed(6)} SOL
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-solana-muted">
                          <a 
                            href={`https://solscan.io/token/${token.mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-solana-green hover:underline flex items-center gap-1"
                          >
                            {token.mint.slice(0, 6)}...{token.mint.slice(-6)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RENT RECOVERY PANEL */}
        {activeTab === 'reclaim' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Selection & Execution Log */}
            <div className="lg:col-span-2 space-y-6">
              {/* Token Accounts List */}
              <div className="glass-panel p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-lg flex items-center gap-2">
                    <Coins className="w-5 h-5 text-solana-green" />
                    Empty Token Accounts
                  </h3>
                  {hasScanned && emptyAccounts.length > 0 && (
                    <button
                      onClick={() => {
                        const allSelected = Object.keys(selectedTokens).length === emptyAccounts.length;
                        const newSelection: Record<string, boolean> = {};
                        if (!allSelected) {
                          emptyAccounts.forEach(acc => {
                            newSelection[acc.accountAddress] = true;
                          });
                        }
                        setSelectedTokens(newSelection);
                      }}
                      className="text-xs text-solana-green font-bold hover:underline"
                    >
                      {Object.keys(selectedTokens).length === emptyAccounts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {!hasScanned ? (
                    <p className="text-sm text-solana-muted text-center py-8">
                      Please scan your wallet to locate empty accounts.
                    </p>
                  ) : emptyAccounts.length === 0 ? (
                    <p className="text-sm text-solana-muted text-center py-8">
                      Excellent! No empty closeable token accounts found.
                    </p>
                  ) : (
                    emptyAccounts.map((acc) => (
                      <div 
                        key={acc.accountAddress}
                        onClick={() => setSelectedTokens(prev => ({
                          ...prev,
                          [acc.accountAddress]: !prev[acc.accountAddress]
                        }))}
                        className={`p-3.5 border rounded-xl flex items-center justify-between cursor-pointer hover:bg-solana-card/30 transition-all ${
                          selectedTokens[acc.accountAddress] 
                            ? 'border-solana-green bg-solana-green/5' 
                            : 'border-solana-border bg-solana-card/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {selectedTokens[acc.accountAddress] ? (
                            <CheckSquare className="w-5 h-5 text-solana-green shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-solana-muted shrink-0" />
                          )}
                          <div>
                            <div className="font-extrabold text-sm flex items-center gap-1.5">
                              {acc.symbol}
                              <span className="text-[10px] font-bold text-solana-muted uppercase px-1 border border-solana-border rounded">
                                {acc.isToken2022 ? 'Token-2022' : 'SPL'}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-solana-muted mt-0.5 truncate max-w-xs md:max-w-md">
                              Address: {acc.accountAddress}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm text-solana-green">+{acc.rentLocked.toFixed(6)} SOL</div>
                          <div className="text-[10px] text-solana-muted">Rent Reserve</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stake Accounts List */}
              <div className="glass-panel p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-lg flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-solana-purple" />
                    Deactivated Stake Accounts
                  </h3>
                  {hasScanned && deactivatedStakes.length > 0 && (
                    <button
                      onClick={() => {
                        const allSelected = Object.keys(selectedStakes).length === deactivatedStakes.length;
                        const newSelection: Record<string, boolean> = {};
                        if (!allSelected) {
                          deactivatedStakes.forEach(acc => {
                            newSelection[acc.pubkey] = true;
                          });
                        }
                        setSelectedStakes(newSelection);
                      }}
                      className="text-xs text-solana-purple font-bold hover:underline"
                    >
                      {Object.keys(selectedStakes).length === deactivatedStakes.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {!hasScanned ? (
                    <p className="text-sm text-solana-muted text-center py-8">
                      Please scan your wallet to locate stake accounts.
                    </p>
                  ) : deactivatedStakes.length === 0 ? (
                    <p className="text-sm text-solana-muted text-center py-8">
                      No deactivated stake accounts available for withdrawal.
                    </p>
                  ) : (
                    deactivatedStakes.map((acc) => (
                      <div 
                        key={acc.pubkey}
                        onClick={() => setSelectedStakes(prev => ({
                          ...prev,
                          [acc.pubkey]: !prev[acc.pubkey]
                        }))}
                        className={`p-3.5 border rounded-xl flex items-center justify-between cursor-pointer hover:bg-solana-card/30 transition-all ${
                          selectedStakes[acc.pubkey] 
                            ? 'border-solana-purple bg-solana-purple/5' 
                            : 'border-solana-border bg-solana-card/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {selectedStakes[acc.pubkey] ? (
                            <CheckSquare className="w-5 h-5 text-solana-purple shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-solana-muted shrink-0" />
                          )}
                          <div>
                            <div className="font-extrabold text-sm flex items-center gap-1.5">
                              Stake {acc.pubkey.slice(0, 6)}...{acc.pubkey.slice(-6)}
                              <span className="text-[10px] font-bold text-amber-500 uppercase px-1 border border-amber-500/20 bg-amber-500/10 rounded">
                                {acc.state}
                              </span>
                            </div>
                            <div className="text-[10px] text-solana-muted mt-0.5">
                              Delegated to Voter: {acc.voter.slice(0,6)}...{acc.voter.slice(-6)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm text-solana-purple">+{acc.rentLocked.toFixed(4)} SOL</div>
                          <div className="text-[10px] text-solana-muted">Withdrawal Amt</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Transaction Logs console display */}
              {(isReclaiming || reclaimLog.length > 1) && (
                <div className="bg-black/90 border border-solana-border rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-[200px] overflow-y-auto">
                  <div className="text-solana-green border-b border-solana-border pb-1 mb-2 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse"></span>
                    Terminal Log Output:
                  </div>
                  {reclaimLog.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log.startsWith('Error:') ? (
                        <span className="text-red-400">{log}</span>
                      ) : log.includes('confirmed successfully!') ? (
                        <span className="text-solana-green">{log}</span>
                      ) : (
                        log
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right sidebar - Smart Recommendations */}
            <div className="glass-panel p-6 space-y-5 h-fit">
              <h3 className="font-extrabold text-lg border-b border-solana-border pb-3">Smart Cleanup</h3>
              
              {/* Cleanup Mode Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCleanupMode('safe')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    cleanupMode === 'safe'
                      ? 'bg-solana-green/15 border-solana-green text-solana-green'
                      : 'border-solana-border text-solana-muted hover:border-slate-700'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5 inline mr-1" />
                  Safe Cleanup
                </button>
                <button
                  onClick={() => setCleanupMode('aggressive')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    cleanupMode === 'aggressive'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                      : 'border-solana-border text-solana-muted hover:border-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Aggressive
                </button>
              </div>

              {/* Mode Description */}
              <div className="text-xs leading-relaxed text-solana-muted bg-solana-dark/40 p-3 rounded-xl border border-solana-border">
                {cleanupMode === 'safe' ? (
                  <p><strong className="text-solana-green">Safe:</strong> Empty token accounts + deactivated stakes only. No tokens burned.</p>
                ) : (
                  <p><strong className="text-amber-400">Aggressive:</strong> Includes <span className="text-amber-400 font-bold">{dustTokens.length}</span> dust/spam tokens with tiny balances. <span className="text-red-400">These small balances will be burned.</span></p>
                )}
              </div>

              {/* Summary */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-solana-muted">Empty Token Accounts:</span>
                  <span className="font-bold">{selectedTokenCount - previewAccounts.dust.length} / {emptyAccounts.length}</span>
                </div>
                {cleanupMode === 'aggressive' && dustTokens.length > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Dust/Spam Tokens:
                    </span>
                    <span className="font-bold">{previewAccounts.dust.length} / {dustTokens.length}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-solana-muted">Deactivated Stakes:</span>
                  <span className="font-bold">{selectedStakeCount} / {deactivatedStakes.length}</span>
                </div>
                <hr className="border-solana-border" />
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-base">Estimated Recovery:</span>
                  <span className="text-2xl font-black text-solana-green">
                    {estimatedReclaimableSol.toFixed(6)} SOL
                  </span>
                </div>
              </div>

              {/* Preview Button */}
              <div className="pt-1">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={isReclaiming || estimatedReclaimableSol === 0 || isViewOnly}
                  className="w-full py-4 rounded-xl bg-solana-green text-solana-dark font-extrabold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-950/20 transition-all flex items-center justify-center gap-2"
                >
                  {isReclaiming ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Executing Batch Reclaim...
                    </>
                  ) : isViewOnly ? (
                    'View-Only — Reclaim Disabled'
                  ) : (
                    `Preview & Confirm Reclaim`
                  )}
                </button>
              </div>

              {reclaimError && (
                <div className="p-3.5 border border-red-500/20 bg-red-950/10 text-red-200 text-xs rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{reclaimError}</span>
                </div>
              )}

              <div className="text-[11px] text-solana-muted space-y-2 leading-relaxed bg-solana-dark/40 p-3 rounded-xl border border-solana-border">
                <p className="font-semibold flex items-center gap-1 text-solana-text">
                  <Info className="w-3.5 h-3.5 text-solana-green shrink-0" />
                  Rent Fee Guide
                </p>
                <p>
                  SOL is reclaimed by closing empty accounts and withdrawing idle stake reserve. Transaction network fee on Solana is negligible (~0.000005 SOL), meaning rent recovery yields are practically 99.9% net profit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* RECLAIM PREVIEW MODAL */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-solana-card border border-solana-border rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-solana-green" />
                  Reclaim Preview
                </h3>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="text-solana-muted hover:text-white p-1 rounded-full hover:bg-solana-border transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Empty Accounts */}
                {previewAccounts.empty.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-solana-green mb-2">
                      Empty Token Accounts ({previewAccounts.empty.length})
                    </h4>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {previewAccounts.empty.map(acc => (
                        <div key={acc.accountAddress} className="flex justify-between text-xs bg-solana-dark/40 px-3 py-2 rounded-lg border border-solana-border">
                          <span className="font-mono truncate mr-2">{acc.symbol || acc.mint.slice(0, 8)}</span>
                          <span className="text-solana-green font-bold shrink-0">+{acc.rentLocked.toFixed(6)} SOL</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dust Tokens (Aggressive only) */}
                {previewAccounts.dust.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Dust/Spam Tokens to Burn ({previewAccounts.dust.length})
                    </h4>
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-2">
                      <p className="text-xs text-amber-300 leading-relaxed">
                        These accounts have tiny token balances that will be <strong>permanently burned</strong> when closed.
                        This is safe for spam/dust tokens with no value, but confirm you don't need them.
                      </p>
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {previewAccounts.dust.map(t => (
                        <div key={t.accountAddress} className="flex justify-between text-xs bg-solana-dark/40 px-3 py-2 rounded-lg border border-amber-500/10">
                          <span className="truncate mr-2">
                            {t.symbol} ({t.amount.toPrecision(3)})
                          </span>
                          <span className="text-solana-green font-bold shrink-0">+{t.rentLocked.toFixed(6)} SOL</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stake Accounts */}
                {previewAccounts.stakes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-solana-purple mb-2">
                      Deactivated Stakes ({previewAccounts.stakes.length})
                    </h4>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {previewAccounts.stakes.map(acc => (
                        <div key={acc.pubkey} className="flex justify-between text-xs bg-solana-dark/40 px-3 py-2 rounded-lg border border-solana-border">
                          <span className="font-mono truncate mr-2">Stake {acc.pubkey.slice(0, 8)}</span>
                          <span className="text-solana-purple font-bold shrink-0">+{acc.rentLocked.toFixed(4)} SOL</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total & Balance After */}
                <hr className="border-solana-border" />
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Total SOL to Reclaim:</span>
                    <span className="text-2xl font-black text-solana-green">{estimatedReclaimableSol.toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between text-sm text-solana-muted">
                    <span>Current SOL Balance:</span>
                    <span>{solBalance.toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span>Estimated Balance After:</span>
                    <span className="text-solana-text">{(solBalance + estimatedReclaimableSol).toFixed(4)} SOL</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-5">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-solana-border text-sm font-bold text-solana-muted hover:bg-solana-dark transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReclaim}
                  className="flex-1 py-3 px-4 rounded-xl bg-solana-green text-solana-dark font-extrabold text-sm hover:opacity-90 shadow-lg shadow-green-950/20 transition-all flex items-center justify-center gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  Confirm & Sign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOCKED LIQUIDITY & YIELD PANEL */}
        {activeTab === 'locked' && (
          <LockedLiquidityPanel
            positions={lockedPositions}
            totalValue={getTotalLockedValue(lockedPositions)}
            protocolScanning={raydiumScanning}
            onScan={async () => {
              if (!publicKey) return;
              setRaydiumScanning(true);
              try {
                const lpAccounts = await scanRaydiumLpAccounts(connection, publicKey);
                if (lpAccounts.length > 0) {
                  const existing = detectLockedPositions(tokens);
                  setLockedPositions(existing);
                }
              } finally {
                setRaydiumScanning(false);
              }
            }}
            hasScanned={hasScanned}
            tokenCount={tokens.length}
          />
        )}

        {/* ADVANCED RECOVERY PANEL */}
        {activeTab === 'advanced' && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Custom PDA Scanner */}
            <div className="glass-panel p-6 space-y-6">
              <div>
                <h3 className="font-extrabold text-lg">Custom Program Account Scanner</h3>
                <p className="text-solana-muted text-xs leading-relaxed mt-1">
                  Query the ledger for accounts owned by a custom Program ID that have your wallet's public key specified as a key authority parameter.
                </p>
              </div>

              <form onSubmit={handleProgramScan} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-solana-muted mb-2">
                    Program ID (Pubkey)
                  </label>
                  <input
                    type="text"
                    required
                    value={advProgramId}
                    onChange={(e) => setAdvProgramId(e.target.value)}
                    placeholder="e.g. 6EF8rrecth7KcBnrtf4Jygbtc1q6qvG3Wq4N56OB5C3"
                    className="w-full bg-solana-dark border border-solana-border rounded-xl px-4 py-2.5 text-sm placeholder-solana-muted/40 focus:outline-none focus:border-solana-purple"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-solana-muted mb-2">
                    Authority Key Offset (Bytes)
                  </label>
                  <input
                    type="number"
                    required
                    value={advOffset}
                    onChange={(e) => setAdvOffset(e.target.value)}
                    placeholder="32"
                    min="0"
                    className="w-full bg-solana-dark border border-solana-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-solana-purple"
                  />
                  <p className="text-[10px] text-solana-muted mt-1 leading-relaxed">
                    Default 32 for common token/stake states. Anchor programs frequently use 8 (discriminator) + 32 = offset 40.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={advLoading || !publicKey}
                  className="w-full py-2.5 rounded-xl bg-solana-purple text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {advLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Scanning Program Ledger...
                    </>
                  ) : (
                    'Scan Program Accounts'
                  )}
                </button>
              </form>

              {/* Advanced Results */}
              {advResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-sm text-solana-green">Matches Discovered ({advResults.length})</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {advResults.map((res, i) => (
                      <div key={i} className="p-3 bg-solana-dark border border-solana-border rounded-lg flex justify-between items-center">
                        <div className="font-mono text-[11px] truncate max-w-xs">{res.pubkey}</div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs">{(res.lamports / 1000000000).toFixed(6)} SOL</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {advError && (
                <div className="p-3.5 border border-solana-border bg-solana-dark/45 text-solana-muted text-xs rounded-xl flex items-start gap-2">
                  <Info className="w-4 h-4 text-solana-purple shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{advError}</span>
                </div>
              )}
            </div>

            {/* Protocol Recovery Wizard */}
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-lg">Protocol Recovery Wizard</h3>
                  <p className="text-solana-muted text-xs leading-relaxed mt-1">
                    Detect positions across major Solana protocols and get guided recovery steps.
                  </p>
                </div>
                {publicKey && hasScanned && (
                  <button
                    onClick={async () => {
                      setProtocolScanning(true);
                      try {
                        const accts = await scanAllProtocols(connection, publicKey);
                        setProtocolAccounts(accts);
                      } finally {
                        setProtocolScanning(false);
                      }
                    }}
                    disabled={protocolScanning}
                    className="shrink-0 py-2 px-4 rounded-xl bg-solana-purple text-white font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {protocolScanning ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                    ) : (
                      <><Search className="w-3.5 h-3.5" /> Scan All Protocols</>
                    )}
                  </button>
                )}
              </div>

              {/* LST Detection */}
              {protocolPositions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-solana-green mb-2">Auto-Detected Positions</h4>
                  <div className="space-y-3">
                    {protocolPositions.map(pos => {
                      const proto = PROTOCOLS[pos.protocol];
                      const acctInfo = protocolAccounts.find(a => a.protocol === pos.protocol);
                      return (
                        <div key={pos.protocol} className="p-4 border border-solana-green/20 bg-solana-green/5 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <h5 className="font-bold text-sm flex items-center gap-2">
                              <CheckSquare className="w-4 h-4 text-solana-green" />
                              {proto.label}
                              <span className="text-[10px] font-normal text-solana-muted uppercase border border-solana-border px-1.5 py-0.5 rounded">{pos.type === 'lst' ? 'LST' : 'Account'}</span>
                            </h5>
                            <a href={pos.actionUrl} target="_blank" rel="noreferrer" className="text-solana-purple hover:underline text-xs flex items-center gap-0.5">
                              Open App <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-xs text-solana-muted">{pos.details}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-solana-text">{pos.label}</span>
                            <span className="text-xs text-solana-muted">Balance detected</span>
                          </div>
                          {acctInfo && acctInfo.accounts.length > 0 && (
                            <div className="text-xs text-solana-muted bg-solana-dark/40 px-3 py-2 rounded-lg">
                              {acctInfo.accounts.length} program account{acctInfo.accounts.length !== 1 ? 's' : ''} found
                            </div>
                          )}
                          <div className="text-xs text-solana-muted bg-solana-dark/40 p-3 rounded-lg border border-solana-border leading-relaxed">
                            <strong className="text-solana-text">Guide:</strong> {pos.guide}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No positions found */}
              {hasScanned && protocolPositions.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-solana-muted">No protocol positions detected in your current token holdings.</p>
                  <p className="text-xs text-solana-muted mt-1">Use "Scan All Protocols" to check for program accounts, or scan specific programs below.</p>
                </div>
              )}

              {/* Dropdown Guides */}
              <details className="group">
                <summary className="text-xs font-bold text-solana-muted cursor-pointer hover:text-white transition-colors select-none">
                  View All Protocol Guides
                </summary>
                <div className="mt-4 space-y-3">
                  {Object.entries(PROTOCOLS).map(([key, proto]) => (
                    <div key={key} className="p-3 border border-solana-border rounded-xl space-y-1.5 hover:bg-solana-card/30 transition-all">
                      <div className="flex justify-between items-center">
                        <h5 className="font-bold text-xs">{proto.label}</h5>
                        <a href={proto.url} target="_blank" rel="noreferrer" className="text-solana-purple hover:underline text-[10px] flex items-center gap-0.5">
                          Open <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <p className="text-[11px] text-solana-muted leading-relaxed">{proto.description}</p>
                      <p className="text-[10px] text-solana-muted leading-relaxed"><strong className="text-solana-text">How to recover:</strong> {proto.guide}</p>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}

        {/* TRUST & FAQ PANEL */}
        {activeTab === 'faq' && (
          <div className="glass-panel p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
            <h3 className="font-extrabold text-2xl text-center">Safety, Trust & FAQ</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="font-extrabold text-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-solana-purple" />
                  What is "Rent" on Solana?
                </h4>
                <p className="text-solana-muted text-sm leading-relaxed pl-7">
                  Accounts on Solana need to lock up a small, fixed amount of SOL to cover the cost of storing data on validators. This is called the "rent-exempt reserve". When you clear out a token balance to 0, the data storage is empty, but the rent is still locked. Closing the account deletes the record and releases the SOL back to you.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-solana-green" />
                  Is SolVault Scout safe to use?
                </h4>
                <div className="text-solana-muted text-sm leading-relaxed pl-7 space-y-2">
                  <p>
                    Yes. SolVault Scout is entirely **non-custodial** and client-side. This means:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>We never have access to, read, or request your private keys or seed phrase.</li>
                    <li>The application compiles standard CloseAccount transactions locally and sends them to your wallet extension (e.g. Phantom, Solflare).</li>
                    <li>You must explicitly review and sign each transaction inside your wallet. The wallet will show you exactly what accounts are being closed and where the SOL is going.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-base flex items-center gap-2">
                  <Info className="w-5 h-5 text-indigo-400" />
                  Are there any risks to closing token accounts?
                </h4>
                <p className="text-solana-muted text-sm leading-relaxed pl-7">
                  Once a token account is closed, it is deleted from the ledger. If you receive that token again in the future, your wallet will automatically create a new account for it (which will require locking a fresh 0.002 SOL fee). There is no risk of losing funds for closed empty accounts. However, do not close token accounts of active tokens you plan to hold or receive immediately to avoid recreating fees.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-solana-purple" />
                  What is Token-2022?
                </h4>
                <p className="text-solana-muted text-sm leading-relaxed pl-7">
                  Token-2022 is the new token standard on Solana that supports advanced extensions (like transfer fees, confidential transfers, interest-bearing tokens). SolVault Scout scans both standard SPL Token and Token-2022 accounts, ensuring you recover rent locked in both types of account.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-solana-border text-center text-xs text-solana-muted leading-relaxed">
              <p>SolVault Scout v1.0. Designed for the Solana ecosystem. Read-only scan. Safe & Secured.</p>
            </div>
          </div>
        )}

        {/* Watch Address Manager Modal */}
        {showWatchManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-solana-card border border-solana-border rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Search className="w-5 h-5 text-solana-purple" />
                  Watch Addresses
                </h3>
                <button 
                  onClick={() => { setShowWatchManager(false); setWatchInput(''); setWatchError(''); }}
                  className="text-solana-muted hover:text-white p-1 rounded-full hover:bg-solana-border transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-solana-muted mb-4 leading-relaxed">
                Add view-only wallet addresses to scan and monitor without connecting a wallet. Perfect for checking multiple wallets from one place.
              </p>

              <form onSubmit={(e) => {
                e.preventDefault();
                const result = addWatchAddress(watchInput.trim());
                if (!result) {
                  setWatchError('Invalid address or already added');
                } else {
                  setWatchInput('');
                  setWatchError('');
                }
              }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={watchInput}
                    onChange={(e) => { setWatchInput(e.target.value); setWatchError(''); }}
                    placeholder="Enter Solana address..."
                    className="flex-1 bg-solana-dark border border-solana-border rounded-xl px-4 py-2.5 text-sm text-solana-text placeholder-solana-muted/50 focus:outline-none focus:border-solana-purple"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-solana-purple text-white font-bold text-sm hover:opacity-90 transition-all"
                  >
                    Add
                  </button>
                </div>
                {watchError && <p className="text-xs text-red-400 mt-1.5">{watchError}</p>}
              </form>

              {watchAddresses.length > 0 && (
                <div className="mt-5 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-solana-muted">Saved Addresses ({watchAddresses.length})</h4>
                  {watchAddresses.map(addr => (
                    <div key={addr} className="flex items-center justify-between p-3 bg-solana-dark/40 border border-solana-border rounded-xl">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setActiveWatchAddress(addr); setShowWatchManager(false); }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            activeWatchAddress === addr ? 'bg-solana-purple border-solana-purple' : 'border-solana-border hover:border-solana-purple'
                          }`}
                        >
                          {activeWatchAddress === addr && <CheckSquare className="w-3 h-3 text-white" />}
                        </button>
                        <span className="font-mono text-xs text-solana-text">{addr.slice(0, 8)}...{addr.slice(-8)}</span>
                      </div>
                      <button
                        onClick={() => removeWatchAddress(addr)}
                        className="text-red-400 hover:text-red-300 text-xs font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {watchAddresses.length === 0 && (
                <p className="text-xs text-solana-muted text-center mt-5 py-4 border-t border-solana-border">
                  No watch addresses added yet. Paste a Solana address above to get started.
                </p>
              )}

              <button
                onClick={() => { setShowWatchManager(false); setWatchInput(''); setWatchError(''); }}
                className="w-full mt-5 py-2.5 rounded-xl border border-solana-border text-sm font-bold text-solana-muted hover:bg-solana-dark transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
