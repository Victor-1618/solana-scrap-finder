import { Connection, PublicKey } from '@solana/web3.js';
import { TokenHolding } from '../store/useScannerStore';

// Known protocol program IDs
export const PROTOCOLS = {
  raydium: {
    label: 'Raydium',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    programs: [
      '675kPX9MHTjS2zt1qTB1DX4oZ4oYxRkaFgyqnQCzH', // AMM v4
      'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', // CP
      'CAMMCzo5YLJwqVGeF3H7E9UZ4V6iBxGdxkSCM8D3P7', // CLMM
    ],
    url: 'https://raydium.io',
    description: 'AMM DEX and liquidity provider. Check portfolio page for idle LP positions and unclaimed fees.',
    guide: 'Open Raydium → Click "Portfolio" → Review your LP positions and staking. Withdraw liquidity and claim any pending fees.',
  },
  marinade: {
    label: 'Marinade',
    icon: '',
    programs: ['MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'],
    url: 'https://marinade.finance',
    description: 'Liquid staking protocol. Stake SOL for mSOL or unstake existing mSOL positions.',
    guide: 'Go to Marinade → Click "Unstake" → Enter your mSOL amount → Receive SOL back (with a small fee).',
  },
  jito: {
    label: 'Jito',
    icon: '',
    programs: [],
    url: 'https://jito.network/staking',
    description: 'Liquid staking with MEV rewards. Exchange JitoSOL back for SOL.',
    guide: 'Visit Jito Staking → Connect wallet → Click "Unstake" → Convert JitoSOL to SOL.',
  },
  blazestake: {
    label: 'BlazeStake',
    icon: '',
    programs: ['bSo13v4Y3PqZ7JN7voCFH3QKWJkWNhrPLkrS8T7udAh'],
    url: 'https://stake.solblaze.org',
    description: 'Liquid staking protocol. bSOL accrues staking yield and can be redeemed for SOL.',
    guide: 'Go to SolBlaze → Connect wallet → Review your bSOL balance and unstake if desired.',
  },
  pumpfun: {
    label: 'Pump.fun',
    icon: '',
    programs: ['6EF8rrecthR9DkScj34s3A4HCrjWY3NBiCTNqEd5NtN'],
    url: 'https://pump.fun',
    description: 'Fair launch token platform. Check for creator fee rebates or unclaimed tokens.',
    guide: 'Open Pump.fun → Click your profile → Check "My Tokens" and "Creator Dashboard" for any unclaimed fees.',
  },
};

const LST_MINTS: Record<string, { label: string; protocol: keyof typeof PROTOCOLS }> = {
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { label: 'mSOL', protocol: 'marinade' },
  'jtojtQpaa3eRREa4FwkS1FZ3mHrUfPFi52ppTcPmPW': { label: 'JitoSOL', protocol: 'jito' },
  'bSo13v4Y3PqZ7JN7voCFH3QKWJkWNhrPLkrS8T7udAh': { label: 'bSOL', protocol: 'blazestake' },
};

export interface ProtocolPosition {
  protocol: keyof typeof PROTOCOLS;
  type: 'lst' | 'lp' | 'program_account';
  label: string;
  amount?: number;
  accountPubkey?: string;
  details: string;
  actionUrl: string;
  guide: string;
}

export function detectProtocolPositions(
  tokens: TokenHolding[],
): ProtocolPosition[] {
  const positions: ProtocolPosition[] = [];
  const seenProtocols = new Set<string>();

  tokens.forEach(t => {
    const lst = LST_MINTS[t.mint];
    if (lst && t.amount > 0) {
      const proto = PROTOCOLS[lst.protocol];
      if (!seenProtocols.has(lst.protocol)) {
        seenProtocols.add(lst.protocol);
        positions.push({
          protocol: lst.protocol,
          type: 'lst',
          label: `${t.symbol} (${t.amount.toFixed(4)})`,
          amount: t.amount,
          details: proto.description,
          actionUrl: proto.url,
          guide: proto.guide,
        });
      }
    }
  });

  return positions;
}

export async function scanProgramAccounts(
  connection: Connection,
  walletPubkey: PublicKey,
  programId: PublicKey,
): Promise<{ pubkey: string; lamports: number }[]> {
  try {
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        {
          memcmp: {
            offset: 32,
            bytes: walletPubkey.toBase58(),
          },
        },
      ],
    });
    return accounts.map(acc => ({
      pubkey: acc.pubkey.toBase58(),
      lamports: acc.account.lamports,
    }));
  } catch {
    return [];
  }
}

export async function scanAllProtocols(
  connection: Connection,
  walletPubkey: PublicKey,
): Promise<{ protocol: keyof typeof PROTOCOLS; accounts: { pubkey: string; lamports: number }[] }[]> {
  const results: { protocol: keyof typeof PROTOCOLS; accounts: { pubkey: string; lamports: number }[] }[] = [];

  for (const [key, proto] of Object.entries(PROTOCOLS)) {
    if (proto.programs.length === 0) continue;
    const allAccounts: { pubkey: string; lamports: number }[] = [];
    for (const programId of proto.programs) {
      const accounts = await scanProgramAccounts(connection, walletPubkey, new PublicKey(programId));
      allAccounts.push(...accounts);
    }
    if (allAccounts.length > 0) {
      results.push({ protocol: key as keyof typeof PROTOCOLS, accounts: allAccounts });
    }
  }

  return results;
}
