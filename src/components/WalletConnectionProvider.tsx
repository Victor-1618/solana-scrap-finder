import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CloverWalletAdapter,
  CoinbaseWalletAdapter,
  MathWalletAdapter,
  NightlyWalletAdapter,
  TorusWalletAdapter,
  TrustWalletAdapter,
  WalletConnectWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { useSettingsStore } from '../store/useSettingsStore';

export const WalletConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const network = useSettingsStore((s) => s.network);
  const customRpc = useSettingsStore((s) => s.customRpc);
  const getRpcUrl = useSettingsStore((s) => s.getRpcUrl);

  // Recompute endpoint whenever network or customRpc updates
  const endpoint = useMemo(() => getRpcUrl(), [network, customRpc, getRpcUrl]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CloverWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new MathWalletAdapter(),
      new NightlyWalletAdapter(),
      new TorusWalletAdapter(),
      new TrustWalletAdapter(),
      new WalletConnectWalletAdapter({ network, options: { relayUrl: 'wss://relay.walletconnect.org' } }),
      new LedgerWalletAdapter(),
    ],
    [network],
  );

  const ConnectionProviderCast = ConnectionProvider as any;
  const WalletProviderCast = WalletProvider as any;
  const WalletModalProviderCast = WalletModalProvider as any;

  return (
    <ConnectionProviderCast endpoint={endpoint}>
      <WalletProviderCast wallets={wallets} autoConnect>
        <WalletModalProviderCast>{children}</WalletModalProviderCast>
      </WalletProviderCast>
    </ConnectionProviderCast>
  );
};
