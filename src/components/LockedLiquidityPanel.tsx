import React from 'react';
import { LockedPosition } from '../services/lockedPositions';
import { RefreshCw, ExternalLink, AlertTriangle, Info, Layers, Coins, ChevronRight } from 'lucide-react';

interface Props {
  positions: LockedPosition[];
  totalValue: number;
  protocolScanning: boolean;
  onScan: () => void;
  hasScanned: boolean;
  tokenCount: number;
}

const TYPE_COLORS: Record<string, string> = {
  lp: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  lst: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  yield: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  vesting: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const STATUS_COLORS: Record<string, string> = {
  liquid: 'text-solana-green',
  staked: 'text-solana-purple',
  locked: 'text-amber-400',
};

export const LockedLiquidityPanel: React.FC<Props> = ({ positions, totalValue, protocolScanning, onScan, hasScanned, tokenCount }) => {
  const grouped = React.useMemo(() => {
    const map: Record<string, LockedPosition[]> = {};
    positions.forEach(p => {
      if (!map[p.protocol]) map[p.protocol] = [];
      map[p.protocol].push(p);
    });
    return map;
  }, [positions]);

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="glass-panel p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-solana-purple" />
              Locked Liquidity & Yield
            </h3>
            <p className="text-xs text-solana-muted mt-1">
              Positions detected from your token holdings and on-chain accounts. These represent value that may need action to unlock.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="text-right">
              <p className="text-xs text-solana-muted uppercase font-bold tracking-wider">Positions Found</p>
              <p className="text-2xl font-black">{positions.length}</p>
            </div>
            <button
              onClick={onScan}
              disabled={protocolScanning || !hasScanned}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-solana-purple to-indigo-700 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {protocolScanning ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Scan Protocols</>
              )}
            </button>
          </div>
        </div>

        {positions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-solana-dark/40 p-3 rounded-xl border border-solana-border text-center">
              <div className="text-lg font-black text-blue-400">{positions.filter(p => p.type === 'lp').length}</div>
              <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">LP Positions</div>
            </div>
            <div className="bg-solana-dark/40 p-3 rounded-xl border border-solana-border text-center">
              <div className="text-lg font-black text-emerald-400">{positions.filter(p => p.type === 'lst').length}</div>
              <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">Liquid Staking</div>
            </div>
            <div className="bg-solana-dark/40 p-3 rounded-xl border border-solana-border text-center">
              <div className="text-lg font-black text-purple-400">{positions.filter(p => p.type === 'yield').length}</div>
              <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">Yield Vaults</div>
            </div>
            <div className="bg-solana-dark/40 p-3 rounded-xl border border-solana-border text-center">
              <div className="text-lg font-black text-amber-400">{positions.filter(p => p.type === 'vesting').length}</div>
              <div className="text-[10px] text-solana-muted uppercase font-bold tracking-wider">Vesting</div>
            </div>
          </div>
        )}
      </div>

      {/* No results */}
      {hasScanned && positions.length === 0 && (
        <div className="glass-panel p-12 text-center space-y-3">
          <Coins className="w-12 h-12 text-solana-muted mx-auto opacity-40" />
          <h4 className="font-extrabold text-base">No Locked Positions Detected</h4>
          <p className="text-sm text-solana-muted max-w-md mx-auto">
            No LP tokens, staking derivatives, or yield positions were found in your wallet. If you expect to see something, try running "Scan Protocols" above.
          </p>
        </div>
      )}

      {!hasScanned && (
        <div className="glass-panel p-12 text-center space-y-3">
          <Info className="w-12 h-12 text-solana-purple mx-auto opacity-70" />
          <h4 className="font-extrabold text-base">Scan Your Wallet First</h4>
          <p className="text-sm text-solana-muted">
            Run a wallet scan from the Dashboard to detect token holdings, then check this tab for locked positions.
          </p>
        </div>
      )}

      {/* Position cards grouped by protocol */}
      {Object.entries(grouped).map(([protocol, protPositions]) => (
        <div key={protocol} className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-solana-border pb-3">
            <h4 className="font-extrabold text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-solana-purple" />
              {protocol}
              <span className="text-xs font-normal text-solana-muted">({protPositions.length})</span>
            </h4>
          </div>

          <div className="space-y-3">
            {protPositions.map(pos => (
              <div key={pos.id} className="p-4 border border-solana-border rounded-xl hover:bg-solana-card/30 transition-all space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${TYPE_COLORS[pos.type]}`}>
                      {pos.type === 'lp' ? 'LP' : pos.type === 'lst' ? 'ST' : pos.type === 'yield' ? 'YD' : 'VS'}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm truncate">{pos.label}</div>
                      <div className="text-[11px] text-solana-muted flex items-center gap-2 mt-0.5">
                        <span>{pos.symbol}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${TYPE_COLORS[pos.type]}`}>
                          {pos.typeLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">{pos.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                    <div className="text-[10px] text-solana-muted">tokens</div>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-solana-muted">Status</span>
                    <div className={`font-bold mt-0.5 ${STATUS_COLORS[pos.lockStatus]}`}>{pos.lockStatusLabel}</div>
                  </div>
                  <div>
                    <span className="text-solana-muted">Risk</span>
                    <div className={`mt-0.5`}>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${RISK_COLORS[pos.riskLevel]}`}>
                        {pos.riskLabel}
                      </span>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-solana-muted">Note</span>
                    <div className="mt-0.5 text-solana-text font-medium">{pos.unlockHint}</div>
                  </div>
                </div>

                {/* Guide and action */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3 bg-solana-dark/40 rounded-lg border border-solana-border">
                  <p className="text-[11px] text-solana-muted leading-relaxed flex-1">
                    <strong className="text-solana-text">Guide:</strong> {pos.guide}
                  </p>
                  <a
                    href={pos.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 py-2 px-4 rounded-lg bg-solana-purple text-white text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5"
                  >
                    {pos.actionLabel} {pos.protocol} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Educational footer */}
      {positions.length > 0 && (
        <div className="glass-panel p-5 space-y-3">
          <h4 className="font-extrabold text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-solana-green" />
            Important Safety Notes
          </h4>
          <div className="space-y-2 text-xs text-solana-muted leading-relaxed">
            <p className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              Removing liquidity from pools may incur impermanent loss if pool asset prices have changed significantly since deposit.
            </p>
            <p className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              Unstaking LSTs (mSOL, JitoSOL, bSOL) typically involves a small fee and may take 1-3 days to process depending on the protocol.
            </p>
            <p className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              Always verify the protocol website URL before connecting your wallet or signing any transaction.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
