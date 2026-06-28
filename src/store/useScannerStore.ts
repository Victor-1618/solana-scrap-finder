import { create } from 'zustand';

export interface TokenHolding {
  mint: string;
  accountAddress: string;
  amount: number;
  decimals: number;
  symbol: string;
  name: string;
  logo: string | null;
  isUnknown: boolean;
  isToken2022: boolean;
  rentLocked: number;
  isATA: boolean;
}

export interface EmptyAccount {
  mint: string;
  accountAddress: string;
  symbol: string;
  name: string;
  isToken2022: boolean;
  rentLocked: number;
  isATA: boolean;
}

export interface StakeAccountInfo {
  pubkey: string;
  lamports: number;
  state: 'active' | 'deactivated' | 'activating' | 'deactivating';
  delegatedAmount: number;
  voter: string;
  rentLocked: number;
}

export interface ReclaimSummary {
  reclaimedSol: number;
  accountsClosed: number;
  stakesWithdrawn: number;
  txCount: number;
}

interface ScannerState {
  solBalance: number;
  tokens: TokenHolding[];
  emptyAccounts: EmptyAccount[];
  deactivatedStakes: StakeAccountInfo[];
  isScanning: boolean;
  scanError: string | null;
  hasScanned: boolean;
  lastReclaim: ReclaimSummary | null;
  setScanning: (isScanning: boolean) => void;
  setError: (error: string | null) => void;
  setResults: (results: {
    solBalance: number;
    tokens: TokenHolding[];
    emptyAccounts: EmptyAccount[];
    deactivatedStakes: StakeAccountInfo[];
  }) => void;
  setLastReclaim: (summary: ReclaimSummary) => void;
  clearResults: () => void;
}

export const useScannerStore = create<ScannerState>((set) => ({
  solBalance: 0,
  tokens: [],
  emptyAccounts: [],
  deactivatedStakes: [],
  isScanning: false,
  scanError: null,
  hasScanned: false,
  lastReclaim: null,
  setScanning: (isScanning) => set({ isScanning, scanError: isScanning ? null : undefined }),
  setError: (scanError) => set({ scanError, isScanning: false }),
  setResults: (results) => set({
    solBalance: results.solBalance,
    tokens: results.tokens,
    emptyAccounts: results.emptyAccounts,
    deactivatedStakes: results.deactivatedStakes,
    isScanning: false,
    hasScanned: true,
  }),
  setLastReclaim: (lastReclaim) => set({ lastReclaim }),
  clearResults: () => set({
    solBalance: 0,
    tokens: [],
    emptyAccounts: [],
    deactivatedStakes: [],
    isScanning: false,
    scanError: null,
    hasScanned: false,
    lastReclaim: null,
  }),
}));
