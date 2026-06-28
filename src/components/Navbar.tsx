import React, { useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSettingsStore } from '../store/useSettingsStore';
import { Settings, ShieldAlert, X, Info } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { network, customRpc, setNetwork, setCustomRpc } = useSettingsStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [rpcInput, setRpcInput] = useState(customRpc);
  const [showWarningBanner, setShowWarningBanner] = useState(true);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomRpc(rpcInput);
    setIsSettingsOpen(false);
  };

  const handleResetRpc = () => {
    setRpcInput('');
    setCustomRpc('');
  };

  return (
    <header className="w-full z-40">
      {/* Persistent Safety Warning Banner */}
      {showWarningBanner && (
        <div className="bg-gradient-to-r from-red-950 via-red-900 to-amber-950 text-amber-200 border-b border-red-800 px-4 py-2 text-xs md:text-sm flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-relaxed">
              <strong>Security Warning:</strong> Never share your seed phrase or private keys with ANY tool or site. This recovery dashboard only requests read access for scanning; transaction signatures must be explicitly verified and approved in your wallet.
            </span>
          </div>
          <button 
            onClick={() => setShowWarningBanner(false)}
            className="text-amber-200/70 hover:text-amber-200 hover:bg-red-800/40 p-1 rounded transition-colors"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-solana-green to-solana-purple opacity-70 blur"></div>
            <div className="relative bg-solana-dark p-2 rounded-lg border border-solana-border">
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-solana-green to-solana-purple text-lg md:text-xl tracking-wider">
                SV
              </span>
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-extrabold text-lg tracking-tight">SolVault Scout</h1>
            <p className="text-[10px] text-solana-muted -mt-1 font-medium tracking-widest uppercase">Lost Funds Finder</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Network indicator tag */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-solana-card border border-solana-border text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${network === 'mainnet-beta' ? 'bg-solana-green' : 'bg-amber-400 animate-pulse'}`}></span>
            <span className="capitalize">{network === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}</span>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => {
              setRpcInput(customRpc);
              setIsSettingsOpen(true);
            }}
            className="p-2 rounded-full bg-solana-card border border-solana-border text-solana-text hover:border-slate-600 hover:text-white transition-all"
            title="RPC & Network Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Wallet Button */}
          <WalletMultiButton />
        </div>
      </div>

      {/* Settings Modal (using simple inline state) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-solana-card border border-solana-border rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-solana-text flex items-center gap-2">
                <Settings className="w-5 h-5 text-solana-purple" />
                Connection Settings
              </h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-solana-muted hover:text-white p-1 rounded-full hover:bg-solana-border transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Network Toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-solana-muted mb-2">
                  Solana Network
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNetwork('mainnet-beta')}
                    className={`py-2 px-4 rounded-xl border text-sm font-semibold transition-all ${
                      network === 'mainnet-beta'
                        ? 'bg-solana-purple/20 border-solana-purple text-solana-purple'
                        : 'border-solana-border text-solana-muted hover:border-slate-700'
                    }`}
                  >
                    Mainnet Beta
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetwork('devnet')}
                    className={`py-2 px-4 rounded-xl border text-sm font-semibold transition-all ${
                      network === 'devnet'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                        : 'border-solana-border text-solana-muted hover:border-slate-700'
                    }`}
                  >
                    Devnet
                  </button>
                </div>
              </div>

              {/* Custom RPC Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-solana-muted mb-2">
                  Custom RPC Endpoint
                </label>
                <input
                  type="url"
                  value={rpcInput}
                  onChange={(e) => setRpcInput(e.target.value)}
                  placeholder={network === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'}
                  className="w-full bg-solana-dark border border-solana-border rounded-xl px-4 py-2.5 text-sm text-solana-text placeholder-solana-muted/50 focus:outline-none focus:border-solana-purple transition-colors"
                />
                <p className="text-[11px] text-solana-muted mt-2 leading-relaxed flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 text-solana-purple shrink-0 mt-0.5" />
                  Recommended for scanning wallets with 100+ accounts. Public endpoints are subject to strict rate limits and may cause scans to fail.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleResetRpc}
                  className="flex-1 py-2 px-4 rounded-xl border border-solana-border text-sm font-semibold text-solana-muted hover:bg-solana-dark hover:text-white transition-all"
                >
                  Reset RPC
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-xl bg-solana-purple text-sm font-bold text-white hover:bg-opacity-90 shadow-md shadow-purple-950/50 hover:shadow-lg transition-all"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
