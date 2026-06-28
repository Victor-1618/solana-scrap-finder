import { TokenHolding, EmptyAccount, StakeAccountInfo } from '../store/useScannerStore';
import { analyzeToken } from './tokenIntelligence';

export type HealthGrade = 'excellent' | 'good' | 'needs_cleanup' | 'poor' | 'critical';

export interface WalletHealth {
  score: number;
  grade: HealthGrade;
  gradeLabel: string;
  color: string;
  issues: string[];
  strengths: string[];
}

function calculateGrade(score: number): { grade: HealthGrade; gradeLabel: string; color: string } {
  if (score >= 80) return { grade: 'excellent', gradeLabel: 'Excellent', color: 'text-emerald-400' };
  if (score >= 60) return { grade: 'good', gradeLabel: 'Good', color: 'text-solana-green' };
  if (score >= 40) return { grade: 'needs_cleanup', gradeLabel: 'Needs Cleanup', color: 'text-amber-400' };
  if (score >= 20) return { grade: 'poor', gradeLabel: 'Poor', color: 'text-orange-500' };
  return { grade: 'critical', gradeLabel: 'Critical', color: 'text-red-400' };
}

export function calculateHealthScore(
  solBalance: number,
  tokens: TokenHolding[],
  emptyAccounts: EmptyAccount[],
  deactivatedStakes: StakeAccountInfo[],
): WalletHealth {
  const issues: string[] = [];
  const strengths: string[] = [];

  let score = 100;

  const activeTokens = tokens.filter(t => t.amount > 0);
  const spamCount = tokens.filter(t => analyzeToken(t).category === 'spam' && t.amount > 0).length;
  const dustCount = tokens.filter(t => analyzeToken(t).category === 'dust' && t.amount > 0).length;

  if (emptyAccounts.length > 5) {
    const penalty = Math.min(emptyAccounts.length * 3, 25);
    score -= penalty;
    issues.push(`${emptyAccounts.length} empty token accounts wasting rent`);
  } else if (emptyAccounts.length > 0) {
    score -= emptyAccounts.length * 2;
    issues.push(`${emptyAccounts.length} empty token account${emptyAccounts.length > 1 ? 's' : ''}`);
  }

  if (spamCount > 0) {
    const penalty = Math.min(spamCount * 8, 30);
    score -= penalty;
    issues.push(`${spamCount} likely spam token${spamCount > 1 ? 's' : ''}`);
  }

  if (dustCount > 0) {
    const penalty = Math.min(dustCount * 3, 15);
    score -= penalty;
    issues.push(`${dustCount} dust token${dustCount > 1 ? 's' : ''}`);
  }

  if (deactivatedStakes.length > 0) {
    score -= Math.min(deactivatedStakes.length * 2, 10);
    issues.push(`${deactivatedStakes.length} deactivated stake${deactivatedStakes.length > 1 ? 's' : ''} with locked SOL`);
  }

  if (solBalance < 0.01) {
    score -= 10;
    issues.push('Low SOL balance — may not cover transaction fees');
  }

  if (activeTokens.length === 0 && emptyAccounts.length === 0 && deactivatedStakes.length === 0) {
    strengths.push('No accounts requiring cleanup');
  }

  if (solBalance >= 1) {
    strengths.push('Healthy SOL balance');
  }

  if (emptyAccounts.length === 0 && deactivatedStakes.length === 0) {
    strengths.push('No rent locked in idle accounts');
  }

  if (spamCount === 0 && dustCount === 0) {
    strengths.push('No spam or dust tokens detected');
  }

  score = Math.max(0, Math.min(100, score));

  const { grade, gradeLabel, color } = calculateGrade(score);

  return { score, grade, gradeLabel, color, issues, strengths };
}

export function getGradeColor(grade: HealthGrade): string {
  const map: Record<HealthGrade, string> = {
    excellent: 'bg-emerald-500',
    good: 'bg-solana-green',
    needs_cleanup: 'bg-amber-400',
    poor: 'bg-orange-500',
    critical: 'bg-red-400',
  };
  return map[grade];
}

export function getGradeBg(grade: HealthGrade): string {
  const map: Record<HealthGrade, string> = {
    excellent: 'bg-emerald-500/10 border-emerald-500/20',
    good: 'bg-solana-green/10 border-solana-green/20',
    needs_cleanup: 'bg-amber-500/10 border-amber-500/20',
    poor: 'bg-orange-500/10 border-orange-500/20',
    critical: 'bg-red-500/10 border-red-500/20',
  };
  return map[grade];
}
