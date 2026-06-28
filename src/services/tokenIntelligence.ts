import { TokenHolding } from '../store/useScannerStore';

export type TokenCategory = 'active_holding' | 'high_potential' | 'dust' | 'spam' | 'unknown';
export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface TokenIntelligence {
  category: TokenCategory;
  riskLevel: RiskLevel;
  riskLabel: string;
  categoryLabel: string;
  categoryColor: string;
  riskColor: string;
}

const KNOWN_HIGH_VALUE = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  'jtojtQpaa3eRREa4FwkS1FZ3mHrUfPFi52ppTcPmPW',
  'bSo13v4Y3PqZ7JN7voCFH3QKWJkWNhrPLkrS8T7udAh',
  '7dHbWXmci3dT8UFYWYZweBLXgyc7mQH9xrzF6pHfN8C',
]);

const SPAM_PATTERNS = [
  /^[A-Z0-9]{8,}$/,
  /^(gan|free|airdrop|claim|bonus|gift|prize|reward|token|test|demo)/i,
  /\.(com|io|net|org|xyz)$/i,
  /(solana|bonk|wif|jup|usdc|usdt).*(solana|bonk|wif|jup|usdc|usdt)/i,
];

function detectSpam(name: string, symbol: string): boolean {
  const text = `${symbol} ${name}`;
  return SPAM_PATTERNS.some(p => p.test(text));
}

export function analyzeToken(token: TokenHolding): TokenIntelligence {
  const isKnownHighValue = KNOWN_HIGH_VALUE.has(token.mint);

  if (isKnownHighValue && token.amount > 0) {
    return {
      category: 'high_potential',
      riskLevel: 1,
      riskLabel: 'Safe',
      categoryLabel: 'High Potential',
      categoryColor: 'text-emerald-400',
      riskColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    };
  }

  if (token.amount > 0 && !token.isUnknown) {
    if (token.amount <= 0.000001) {
      return {
        category: 'dust',
        riskLevel: 1,
        riskLabel: 'Safe',
        categoryLabel: 'Dust',
        categoryColor: 'text-amber-400',
        riskColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
      };
    }
    return {
      category: 'active_holding',
      riskLevel: 1,
      riskLabel: 'Safe',
      categoryLabel: 'Active Holding',
      categoryColor: 'text-solana-green',
      riskColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
    };
  }

  if (token.amount > 0 && token.isUnknown) {
    const isSpam = detectSpam(token.name, token.symbol);

    if (token.amount <= 0.001) {
      return {
        category: 'dust',
        riskLevel: isSpam ? 5 : 3,
        riskLabel: isSpam ? 'Critical' : 'Medium',
        categoryLabel: 'Dust / Spam',
        categoryColor: 'text-red-400',
        riskColor: isSpam
          ? 'bg-red-500/20 text-red-400 border-red-500/20'
          : 'bg-amber-500/20 text-amber-400 border-amber-500/20',
      };
    }

    if (isSpam) {
      return {
        category: 'spam',
        riskLevel: 5,
        riskLabel: 'Critical',
        categoryLabel: 'Likely Spam',
        categoryColor: 'text-red-400',
        riskColor: 'bg-red-500/20 text-red-400 border-red-500/20',
      };
    }

    if (token.amount >= 100) {
      return {
        category: 'unknown',
        riskLevel: 3,
        riskLabel: 'Medium',
        categoryLabel: 'Large Unknown',
        categoryColor: 'text-amber-400',
        riskColor: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
      };
    }

    return {
      category: 'unknown',
      riskLevel: 2,
      riskLabel: 'Low',
      categoryLabel: 'Unknown',
      categoryColor: 'text-solana-muted',
      riskColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    };
  }

  return {
    category: 'unknown',
    riskLevel: 3,
    riskLabel: 'Medium',
    categoryLabel: 'Unknown',
    categoryColor: 'text-solana-muted',
    riskColor: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
  };
}

export function getTokensByCategory(tokens: TokenHolding[]): Record<TokenCategory, TokenHolding[]> {
  const grouped: Record<TokenCategory, TokenHolding[]> = {
    active_holding: [],
    high_potential: [],
    dust: [],
    spam: [],
    unknown: [],
  };
  tokens.forEach(t => {
    const { category } = analyzeToken(t);
    grouped[category].push(t);
  });
  return grouped;
}
