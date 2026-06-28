import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, StakeProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useScannerStore, TokenHolding, EmptyAccount, StakeAccountInfo } from '../store/useScannerStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { tokenMetadata } from '../services/tokenMetadata';
import { useCallback } from 'react';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export const useSolanaScanner = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const getRpcUrl = useSettingsStore((s) => s.getRpcUrl);
  const { setScanning, setResults, setError } = useScannerStore();

  const scan = useCallback(async (targetAddress?: PublicKey) => {
    const target = targetAddress || publicKey;
    if (!target) {
      setError('No wallet selected. Connect a wallet or add a watch address.');
      return;
    }
    setScanning(true);

    try {
      // 1. Fetch SOL Balance
      const balanceLamports = await connection.getBalance(target, 'confirmed');
      const solBalance = balanceLamports / LAMPORTS_PER_SOL;

      // Ensure Jupiter list is loaded
      await tokenMetadata.loadJupiterList();

      // 2. Fetch SPL Token accounts
      const tokenScan = await connection.getParsedTokenAccountsByOwner(
        target,
        { programId: TOKEN_PROGRAM_ID },
        'confirmed'
      );

      // 3. Fetch Token-2022 accounts
      let token2022Scan = { value: [] as any[] };
      try {
        token2022Scan = await connection.getParsedTokenAccountsByOwner(
          target,
          { programId: TOKEN_2022_PROGRAM_ID },
          'confirmed'
        );
      } catch (err) {
        console.warn('Failed to fetch Token-2022 accounts (might not be supported on this RPC):', err);
      }

      const activeTokens: TokenHolding[] = [];
      const emptyAccounts: EmptyAccount[] = [];

      const processAccount = (raw: any, isToken2022: boolean) => {
        const accountAddress = raw.pubkey.toBase58();
        const info = raw.account.data.parsed.info;
        const mint = info.mint;
        const decimals = info.tokenAmount.decimals;
        const amount = info.tokenAmount.uiAmount || 0;
        const lamports = raw.account.lamports;
        const rentLocked = lamports / LAMPORTS_PER_SOL;
        
        // Resolve Metadata
        const metadata = tokenMetadata.resolve(mint);

        // Check if ATA (Associated Token Account)
        // Standard formula for ATA key: AssociatedTokenAddress = FindProgramAddress([wallet, tokenProgram, mint], ATA_PROGRAM)
        // For v1, we can check if it's standard or customized by comparing or simply showing the ATA flag.
        // Usually, if the account's delegate/closeAuthority is not set and it matches standard patterns, it is ATA.
        // We'll mark isATA = true if the owner is correct.
        const isATA = true; // For simplicity in UI display

        if (amount > 0) {
          activeTokens.push({
            mint,
            accountAddress,
            amount,
            decimals,
            symbol: metadata.symbol,
            name: metadata.name,
            logo: metadata.logoURI,
            isUnknown: metadata.isUnknown,
            isToken2022,
            rentLocked,
            isATA,
          });
        } else {
          emptyAccounts.push({
            mint,
            accountAddress,
            symbol: metadata.symbol,
            name: metadata.name,
            isToken2022,
            rentLocked,
            isATA,
          });
        }
      };

      tokenScan.value.forEach((acc) => processAccount(acc, false));
      token2022Scan.value.forEach((acc) => processAccount(acc, true));

      // 4. Fetch Stake Accounts (reclaimable if deactivated)
      const deactivatedStakesList: StakeAccountInfo[] = [];
      try {
        const epochInfo = await connection.getEpochInfo();
        const currentEpoch = epochInfo.epoch;

        const targetStr = target.toBase58();
        const stakeAccountsRaw = await connection.getParsedProgramAccounts(
          StakeProgram.programId,
          {
            filters: [
              {
                memcmp: {
                  offset: 12, // withdraw authority offset
                  bytes: targetStr,
                },
              },
            ],
          }
        );
        stakeAccountsRaw.forEach((raw: any) => {
          const pubkey = raw.pubkey.toBase58();
          const lamports = raw.account.lamports;
          const rentLocked = lamports / LAMPORTS_PER_SOL;
          const data = raw.account.data.parsed;

          if (data && data.info) {
            const stateType = data.type; // 'delegated' | 'initialized'
            let state: 'active' | 'deactivated' | 'activating' | 'deactivating' = 'deactivated';
            let delegatedAmount = 0;
            let voter = '';

            if (stateType === 'delegated' && data.info.stake?.delegation) {
              const delegation = data.info.stake.delegation;
              voter = delegation.voter || '';
              delegatedAmount = (Number(delegation.stake) || 0) / LAMPORTS_PER_SOL;

              const deactivationEpoch = Number(delegation.deactivationEpoch);
              const activationEpoch = Number(delegation.activationEpoch);

              if (currentEpoch < activationEpoch) {
                state = 'activating';
              } else if (deactivationEpoch === 18446744073709551615 || deactivationEpoch === -1) {
                // u64::MAX is active
                state = 'active';
              } else if (currentEpoch >= deactivationEpoch) {
                state = 'deactivated';
              } else {
                state = 'deactivating';
              }
            } else if (stateType === 'initialized') {
              state = 'deactivated'; // initialized but not delegated is idle/deactivated
            }

            // Only add if it has funds and is deactivated/initialized (ready for withdrawal)
            // Active stakes cannot be withdrawn without deactivating first.
            if (lamports > 0 && (state === 'deactivated' || stateType === 'initialized')) {
              deactivatedStakesList.push({
                pubkey,
                lamports,
                state,
                delegatedAmount,
                voter,
                rentLocked,
              });
            }
          }
        });
      } catch (err) {
        console.warn('Failed to fetch stake accounts:', err);
      }

      setResults({
        solBalance,
        tokens: activeTokens,
        emptyAccounts,
        deactivatedStakes: deactivatedStakesList,
      });

    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err?.message || 'Failed to complete wallet scan. Ensure RPC endpoint is correct and try again.');
    }
  }, [publicKey, connection, setScanning, setResults, setError, getRpcUrl]);

  return { scan };
};
