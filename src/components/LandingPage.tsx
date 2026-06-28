import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Shield, Sparkles, Coins, Key, Landmark, HelpCircle } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-24">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-solana-purple/10 border border-solana-purple/20 text-xs font-semibold text-solana-purple mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>v1.0 Release - Open Source & Non-Custodial</span>
        </div>
        
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
          Reclaim Your{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-solana-green to-solana-purple">
            Lost Solana Funds
          </span>
        </h2>
        
        <p className="text-lg text-solana-muted leading-relaxed">
          Scan your wallet to discover forgotten tokens, reclaim locked SOL rent from empty accounts, and withdraw funds from deactivated stake accounts. 
        </p>

        <div className="pt-4 flex justify-center">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-solana-green to-solana-purple opacity-70 blur group-hover:opacity-100 transition duration-300"></div>
            <div className="relative">
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Token Scanner */}
        <div className="glass-panel p-8 flex flex-col space-y-4">
          <div className="p-3 bg-solana-green/10 text-solana-green rounded-xl w-fit border border-solana-green/20">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-xl">Asset Scanner</h3>
          <p className="text-solana-muted text-sm leading-relaxed">
            Performs a deep scan of both standard SPL Token and Token-2022 accounts owned by your wallet. Identifies hidden or unknown tokens and spam assets, showing full details like balances and mints.
          </p>
        </div>

        {/* Rent Reclaim */}
        <div className="glass-panel p-8 flex flex-col space-y-4">
          <div className="p-3 bg-solana-purple/10 text-solana-purple rounded-xl w-fit border border-solana-purple/20">
            <Landmark className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-xl">Rent Reclaimer</h3>
          <p className="text-solana-muted text-sm leading-relaxed">
            When you receive tokens, Solana locks a small SOL balance (~0.002 SOL) to pay for account storage rent. If the token balance reaches zero, this SOL remains locked. We locate and batch-close these empty accounts to refund you.
          </p>
        </div>

        {/* Advanced Recovery */}
        <div className="glass-panel p-8 flex flex-col space-y-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit border border-indigo-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-xl">Advanced Recovery</h3>
          <p className="text-solana-muted text-sm leading-relaxed">
            Scan deactivated stake accounts ready for immediate withdrawal, or search for program-linked accounts and custom Program IDs. Follow our wizard guides for Raydium LPs, Pump.fun, and staking contracts.
          </p>
        </div>
      </div>

      {/* Trust & Security / Rent Explanation Section */}
      <div className="grid md:grid-cols-2 gap-12 items-center bg-solana-card/40 border border-solana-border rounded-3xl p-8 md:p-12">
        <div className="space-y-6">
          <h3 className="text-2xl md:text-3xl font-black">How Rent Recovery Works</h3>
          <p className="text-solana-muted text-sm md:text-base leading-relaxed">
            Every account on Solana requires a balance of SOL to remain on the ledger. This is called **rent-exempt reserve**.
          </p>
          <ul className="space-y-3.5 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-solana-green/20 text-solana-green flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✓</span>
              <span>An empty token account locks up exactly <strong>0.002039 SOL</strong>.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-solana-green/20 text-solana-green flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✓</span>
              <span>If you bought a token, sold it, and now hold 0 tokens, your rent is still locked in the empty account.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-solana-green/20 text-solana-green flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✓</span>
              <span>Closing 10 empty token accounts reclaims over <strong>0.02 SOL</strong>, sent instantly to your wallet.</span>
            </li>
          </ul>
        </div>

        <div className="space-y-6 border-t md:border-t-0 md:border-l border-solana-border pt-8 md:pt-0 md:pl-12">
          <h3 className="text-2xl md:text-3xl font-black flex items-center gap-2">
            <Key className="w-6 h-6 text-solana-purple" />
            100% Non-Custodial
          </h3>
          <p className="text-solana-muted text-sm md:text-base leading-relaxed">
            SolVault Scout is built with security as our absolute priority.
          </p>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="p-2 bg-solana-purple/10 text-solana-purple rounded-lg shrink-0 h-fit">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Read-Only Scans</h4>
                <p className="text-solana-muted text-xs leading-relaxed mt-0.5">
                  Scanning only queries public blockchain data. We never ask for, require, or store private keys or seed phrases.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="p-2 bg-solana-green/10 text-solana-green rounded-lg shrink-0 h-fit">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Explicit Signatures Only</h4>
                <p className="text-solana-muted text-xs leading-relaxed mt-0.5">
                  Reclaiming SOL compiles standard instructions and sends them directly to your browser's wallet extension (e.g. Phantom). You review and sign each transaction securely inside your wallet.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
