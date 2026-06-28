import { create } from 'zustand';
import { PublicKey } from '@solana/web3.js';

function loadWatchAddresses(): string[] {
  try {
    const saved = localStorage.getItem('solvault_watch');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveWatchAddresses(addresses: string[]) {
  localStorage.setItem('solvault_watch', JSON.stringify(addresses));
}

interface SettingsState {
  network: 'mainnet-beta' | 'devnet';
  customRpc: string;
  watchAddresses: string[];
  setNetwork: (network: 'mainnet-beta' | 'devnet') => void;
  setCustomRpc: (rpc: string) => void;
  getRpcUrl: () => string;
  addWatchAddress: (address: string) => boolean;
  removeWatchAddress: (address: string) => void;
}

const DEFAULT_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

export const useSettingsStore = create<SettingsState>((set, get) => {
  // Load initial state from LocalStorage if available
  const savedNetwork = localStorage.getItem('solvault_network') as 'mainnet-beta' | 'devnet' | null;
  const savedRpc = localStorage.getItem('solvault_rpc') || '';

  return {
    network: savedNetwork || 'mainnet-beta',
    customRpc: savedRpc,
    watchAddresses: loadWatchAddresses(),
    setNetwork: (network) => {
      localStorage.setItem('solvault_network', network);
      set({ network });
    },
    setCustomRpc: (customRpc) => {
      localStorage.setItem('solvault_rpc', customRpc);
      set({ customRpc });
    },
    getRpcUrl: () => {
      const { network, customRpc } = get();
      let url = customRpc && customRpc.trim() !== '' ? customRpc.trim() : (network === 'mainnet-beta' ? DEFAULT_MAINNET_RPC : DEFAULT_DEVNET_RPC);
      if (import.meta.env.DEV && url.includes('getblock.io')) {
        url = window.location.origin + '/rpc-proxy';
      }
      return url;
    },
    addWatchAddress: (address) => {
      const { watchAddresses } = get();
      try {
        new PublicKey(address);
      } catch {
        return false;
      }
      if (watchAddresses.includes(address)) return false;
      const updated = [...watchAddresses, address];
      saveWatchAddresses(updated);
      set({ watchAddresses: updated });
      return true;
    },
    removeWatchAddress: (address) => {
      const { watchAddresses } = get();
      const updated = watchAddresses.filter(a => a !== address);
      saveWatchAddresses(updated);
      set({ watchAddresses: updated });
    },
  };
});
