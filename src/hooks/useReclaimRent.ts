import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction, StakeProgram } from '@solana/web3.js';
import { EmptyAccount, StakeAccountInfo, useScannerStore } from '../store/useScannerStore';
import { useSolanaScanner } from './useSolanaScanner';
import { useState, useCallback } from 'react';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

// Helper to construct CloseAccount instructions manually
function createCloseAccountInstruction(
  account: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  programId: PublicKey
): TransactionInstruction {
  const keys = [
    { pubkey: account, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ];
  
  // CloseAccount instruction code is 9 in both Token and Token-2022 programs
  const data = Buffer.from([9]);
  
  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
}

export const useReclaimRent = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { scan } = useSolanaScanner();
  const setLastReclaim = useScannerStore((s) => s.setLastReclaim);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [reclaimError, setReclaimError] = useState<string | null>(null);
  const [reclaimLog, setReclaimLog] = useState<string[]>([]);

  const reclaim = useCallback(async (
    tokenAccounts: EmptyAccount[],
    stakeAccounts: StakeAccountInfo[]
  ) => {
    if (!publicKey) {
      setReclaimError('Wallet not connected');
      return { success: false, txids: [] };
    }

    setIsReclaiming(true);
    setReclaimError(null);
    setReclaimLog(['Preparing reclaim transactions...']);

    const txids: string[] = [];
    const instructions: TransactionInstruction[] = [];

    // 1. Create close instructions for token accounts
    tokenAccounts.forEach((acc) => {
      const progId = acc.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      instructions.push(
        createCloseAccountInstruction(
          new PublicKey(acc.accountAddress),
          publicKey,
          publicKey,
          progId
        )
      );
    });

    // 2. Create withdraw instructions for deactivated stake accounts
    stakeAccounts.forEach((acc) => {
      instructions.push(
        StakeProgram.withdraw({
          stakePubkey: new PublicKey(acc.pubkey),
          authorizedPubkey: publicKey,
          toPubkey: publicKey,
          lamports: acc.lamports,
        }).instructions[0] // Withdraw is a single-instruction tx
      );
    });

    if (instructions.length === 0) {
      setIsReclaiming(false);
      setReclaimLog((prev) => [...prev, 'No accounts selected.']);
      return { success: true, txids: [] };
    }

    try {
      // Solana tx size limit is 1232 bytes.
      // We limit each transaction to a maximum of 10 close/withdraw instructions to stay well below the limit.
      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(instructions.length / BATCH_SIZE);

      setReclaimLog((prev) => [
        ...prev,
        `Found ${instructions.length} account(s). Split into ${totalBatches} transaction batch(es).`
      ]);

      for (let i = 0; i < totalBatches; i++) {
        const batchInstructions = instructions.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const transaction = new Transaction();
        batchInstructions.forEach((inst) => transaction.add(inst));

        setReclaimLog((prev) => [
          ...prev,
          `Prompting wallet signature for batch ${i + 1}/${totalBatches}...`
        ]);

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Send transaction through the wallet adapter
        const txid = await sendTransaction(transaction, connection, {
          preflightCommitment: 'confirmed'
        });

        setReclaimLog((prev) => [
          ...prev,
          `Batch ${i + 1} sent. Tx ID: ${txid.slice(0, 8)}...${txid.slice(-8)}. Confirming...`
        ]);

        // Confirm transaction
        await connection.confirmTransaction({
          signature: txid,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');

        txids.push(txid);
        setReclaimLog((prev) => [...prev, `Batch ${i + 1}/${totalBatches} confirmed successfully!`]);
      }

      setReclaimLog((prev) => [...prev, 'All transactions completed successfully! Refreshing wallet scanner...']);
      
      // Rescan wallet to update balance and lists
      await scan();
      setIsReclaiming(false);
      setLastReclaim({
        reclaimedSol: tokenAccounts.reduce((s, a) => s + a.rentLocked, 0) + stakeAccounts.reduce((s, a) => s + a.rentLocked, 0),
        accountsClosed: tokenAccounts.length,
        stakesWithdrawn: stakeAccounts.length,
        txCount: txids.length,
      });
      return { success: true, txids };

    } catch (err: any) {
      console.error('Reclaim error:', err);
      const errMsg = err?.message || 'Failed to execute reclaim transaction.';
      setReclaimError(errMsg);
      setReclaimLog((prev) => [...prev, `Error: ${errMsg}`]);
      setIsReclaiming(false);
      
      // Try to scan again in case some transactions went through
      try {
        await scan();
      } catch (_) {}

      return { success: false, txids };
    }
  }, [publicKey, connection, sendTransaction, scan]);

  return { reclaim, isReclaiming, reclaimError, reclaimLog };
};
