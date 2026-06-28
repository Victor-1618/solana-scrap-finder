import { Connection, PublicKey } from '@solana/web3.js';
import { TokenHolding } from '../store/useScannerStore';

export interface LockedPosition {
  id: string;
  protocol: string;
  protocolUrl: string;
  type: 'lp' | 'lst' | 'yield' | 'vesting';
  typeLabel: string;
  label: string;
  symbol: string;
  amount: number;
  estimatedValueSol: number;
  lockStatus: 'liquid' | 'staked' | 'locked';
  lockStatusLabel: string;
  unlockHint: string;
  actionLabel: string;
  actionUrl: string;
  guide: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskLabel: string;
  detectionMethod: 'token' | 'program_account';
}

interface ProtocolDef {
  label: string;
  url: string;
  logo?: string;
}

const PROTOCOLS: Record<string, ProtocolDef> = {
  raydium: { label: 'Raydium', url: 'https://raydium.io' },
  orca: { label: 'Orca', url: 'https://www.orca.so' },
  meteora: { label: 'Meteora', url: 'https://meteora.ag' },
  marinade: { label: 'Marinade', url: 'https://marinade.finance' },
  jito: { label: 'Jito', url: 'https://jito.network/staking' },
  blazestake: { label: 'BlazeStake', url: 'https://stake.solblaze.org' },
  kamino: { label: 'Kamino', url: 'https://app.kamino.finance' },
  marginfi: { label: 'Marginfi', url: 'https://app.marginfi.com' },
  drift: { label: 'Drift', url: 'https://app.drift.trade' },
  solend: { label: 'Solend', url: 'https://solend.fi' },
  pumpfun: { label: 'Pump.fun', url: 'https://pump.fun' },
};

// Known LP / receipt token mints mapped to their protocols
const KNOWN_POSITION_MINTS: Record<string, {
  protocol: keyof typeof PROTOCOLS;
  type: LockedPosition['type'];
  symbolPrefix: string;
  label: string;
}> = {
  // LSTs
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { protocol: 'marinade', type: 'lst', symbolPrefix: 'mSOL', label: 'Marinade Staked SOL' },
  'jtojtQpaa3eRREa4FwkS1FZ3mHrUfPFi52ppTcPmPW': { protocol: 'jito', type: 'lst', symbolPrefix: 'JitoSOL', label: 'Jito Staked SOL' },
  'bSo13v4Y3PqZ7JN7voCFH3QKWJkWNhrPLkrS8T7udAh': { protocol: 'blazestake', type: 'lst', symbolPrefix: 'bSOL', label: 'BlazeStaked SOL' },

  // Kamino receipt tokens (examples)
  'KAMINO_fZ7GmKJ1KLq7XYZmz9sFs6gHuf32bYBy8q8J8C': { protocol: 'kamino', type: 'yield', symbolPrefix: 'kSOL', label: 'Kamino SOL Vault' },

  // Marginfi receipt tokens
  'ySo13v4Y3PqZ7JN7voCFH3QKWJkWNhrPLkrS8T7udAh': { protocol: 'marginfi', type: 'yield', symbolPrefix: 'ybSOL', label: 'Marginfi SOL Yield' },

  // Solend receipt tokens
  'sSo14v4Y3PqZ7JN7voCFH3QKWJkWNhrPLkrS8T7udAh': { protocol: 'solend', type: 'yield', symbolPrefix: 'sSOL', label: 'Solend SOL Deposit' },
};

const LP_SYMBOL_PATTERNS = [
  /^LP-/i,
  /^SLP-/i,
  /^RAY-/i,
  /-\w{3}-\w{3}$/i,
];

function matchesLpPattern(symbol: string, name: string): boolean {
  const text = `${symbol} ${name}`;
  return LP_SYMBOL_PATTERNS.some(p => p.test(text));
}

export function detectLockedPositions(tokens: TokenHolding[]): LockedPosition[] {
  const positions: LockedPosition[] = [];
  const seenKeys = new Set<string>();

  tokens.forEach(t => {
    if (t.amount <= 0) return;

    // Check known position mints (LSTs, yield tokens)
    const known = KNOWN_POSITION_MINTS[t.mint];
    if (known) {
      const key = `${known.protocol}-${t.mint}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const proto = PROTOCOLS[known.protocol];
        positions.push({
          id: key,
          protocol: proto.label,
          protocolUrl: proto.url,
          type: known.type,
          typeLabel: known.type === 'lst' ? 'Liquid Staking' : known.type === 'yield' ? 'Yield Vault' : 'LP',
          label: known.label,
          symbol: t.symbol,
          amount: t.amount,
          estimatedValueSol: 0,
          lockStatus: known.type === 'lst' ? 'staked' : 'liquid',
          lockStatusLabel: known.type === 'lst' ? 'Staked (redeemable)' : 'Deposited',
          unlockHint: known.type === 'lst' ? 'Can be unstaked anytime on the protocol website' : 'Withdraw from protocol dashboard',
          actionLabel: known.type === 'lst' ? 'Unstake on' : 'Manage on',
          actionUrl: proto.url,
          guide: known.type === 'lst'
            ? `Go to ${proto.label} → Connect wallet → Choose "Unstake" → Enter amount → Confirm. The SOL will be returned after a short unbonding period.`
            : `Visit ${proto.label} → Connect wallet → Navigate to your position → Withdraw or claim rewards.`,
          riskLevel: 'low',
          riskLabel: 'Low',
          detectionMethod: 'token',
        });
      }
    }

    // Check for LP tokens by symbol pattern
    if (matchesLpPattern(t.symbol, t.name) && !t.isUnknown) {
      const key = `lp-${t.mint}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        positions.push({
          id: key,
          protocol: 'Raydium',
          protocolUrl: 'https://raydium.io',
          type: 'lp',
          typeLabel: 'LP Token',
          label: `${t.symbol} LP Position`,
          symbol: t.symbol,
          amount: t.amount,
          estimatedValueSol: 0,
          lockStatus: 'liquid',
          lockStatusLabel: 'Liquid (removable)',
          unlockHint: 'LP tokens can be removed to reclaim underlying assets',
          actionLabel: 'Remove on',
          actionUrl: 'https://raydium.io',
          guide: 'Go to Raydium → Click "Liquidity" → Select your pool → Click "Remove Liquidity" → Confirm the transaction in your wallet.',
          riskLevel: 'medium',
          riskLabel: 'Medium',
          detectionMethod: 'token',
        });
      }
    }
  });

  return positions;
}

export async function scanRaydiumLpAccounts(
  connection: Connection,
  walletPubkey: PublicKey,
): Promise<{ pubkey: string; lamports: number }[]> {
  const raydiumPrograms = [
    '675kPX9MHTjS2zt1qTB1DX4oZ4oYxRkaFgyqnQCzH', // v4 AMM
    'CAMMCzo5YLJwqVGeF3H7E9UZ4V6iBxGdxkSCM8D3P7', // CLMM
  ];

  const results: { pubkey: string; lamports: number }[] = [];

  for (const programId of raydiumPrograms) {
    try {
      const accounts = await connection.getProgramAccounts(new PublicKey(programId), {
        filters: [
          { memcmp: { offset: 32, bytes: walletPubkey.toBase58() } },
        ],
      });
      accounts.forEach(a => {
        results.push({ pubkey: a.pubkey.toBase58(), lamports: a.account.lamports });
      });
    } catch {
      // continue
    }
  }

  return results;
}

export function getTotalLockedValue(positions: LockedPosition[]): number {
  return positions.reduce((s, p) => s + p.estimatedValueSol, 0);
}

export function getPositionsByProtocol(positions: LockedPosition[]): Record<string, LockedPosition[]> {
  const grouped: Record<string, LockedPosition[]> = {};
  positions.forEach(p => {
    if (!grouped[p.protocol]) grouped[p.protocol] = [];
    grouped[p.protocol].push(p);
  });
  return grouped;
}
