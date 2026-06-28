// Static map for the most common Solana tokens to ensure instant local loading and fallback.
const WELL_KNOWN_TOKENS: Record<string, { symbol: string; name: string; logoURI?: string }> = {
  'So11111111111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    symbol: 'USDT',
    name: 'USDT',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
  },
  'DezXAZ8z7PnrnRJjz3wX4dxBS4Y8gHEmdMrLDZ9CYe95': {
    symbol: 'BONK',
    name: 'Bonk',
    logoURI: 'https://hbb.republicofbonk.com/logo.png'
  },
  'EKpQGSJtjMFqKZ9KQGWjh65KUdBvyM4wr1Xgw5kXJt35': {
    symbol: 'WIF',
    name: 'Dogwifhat',
    logoURI: 'https://bafkreihq55562w4wc7kw2ey27bctwky5w3o76d542242557w7n7yv2y2tq.ipfs.nftstorage.link/'
  },
  'HZ1J6yVT2ncscg7y7fqmJqy49LPN33b5gf7rDog41f8q': {
    symbol: 'WIF',
    name: 'Dogwifhat',
  },
  'JUPyiwrTYdJvUBjLEEvEpbb61g6f21FJ1Z4HCviqWGP': {
    symbol: 'JUP',
    name: 'Jupiter',
    logoURI: 'https://assets.coingecko.com/coins/images/34188/large/jup.png'
  },
  'HZndJg421k3k83S3E2333A11C2344A32521A11121111': {
    symbol: 'UNKNOWN',
    name: 'Unknown Spam Token',
  }
};

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

class TokenMetadataService {
  private cache: Map<string, { symbol: string; name: string; logoURI?: string }> = new Map();
  private isLoaded = false;
  private isLoading = false;

  constructor() {
    // Populate cache with well-known tokens
    Object.entries(WELL_KNOWN_TOKENS).forEach(([mint, data]) => {
      this.cache.set(mint, data);
    });
  }

  async loadJupiterList(): Promise<void> {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;
    try {
      // Fetch verified tokens from Jupiter API
      const response = await fetch('https://token.jup.ag/strict');
      if (response.ok) {
        const tokens: JupiterToken[] = await response.json();
        tokens.forEach((token) => {
          this.cache.set(token.address, {
            symbol: token.symbol,
            name: token.name,
            logoURI: token.logoURI,
          });
        });
        this.isLoaded = true;
      }
    } catch (e) {
      console.warn('Failed to load Jupiter token list, using local cache fallbacks:', e);
    } finally {
      this.isLoading = false;
    }
  }

  resolve(mint: string): { symbol: string; name: string; logoURI: string | null; isUnknown: boolean } {
    const cached = this.cache.get(mint);
    if (cached) {
      return {
        symbol: cached.symbol,
        name: cached.name,
        logoURI: cached.logoURI || null,
        isUnknown: cached.symbol === 'UNKNOWN' || mint === 'HZndJg421k3k83S3E2333A11C2344A32521A11121111' ? true : false,
      };
    }

    // Default return for unrecognized tokens
    return {
      symbol: `${mint.slice(0, 4)}...${mint.slice(-4)}`,
      name: 'Unknown Token',
      logoURI: null,
      isUnknown: true,
    };
  }
}

export const tokenMetadata = new TokenMetadataService();
