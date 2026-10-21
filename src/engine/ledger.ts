import type { LedgerEntry } from './types';

export interface LedgerSummary {
  caught: number;
  nearMiss: number;
  passedBy: number;
  total: number;
  hitRate: number;
  lastTrainHits: number;
  nearest: LedgerEntry | null;
}

/** 一个事件一生只记一次，重复触发不会污染账本 */
export function recordJudgement(ledger: readonly LedgerEntry[], entry: LedgerEntry): LedgerEntry[] {
  if (ledger.some((e) => e.eventId === entry.eventId)) return [...ledger];
  return [...ledger, entry];
}

export function summarizeLedger(ledger: readonly LedgerEntry[]): LedgerSummary {
  let caught = 0;
  let nearMiss = 0;
  let passedBy = 0;
  let lastTrainHits = 0;
  let nearest: LedgerEntry | null = null;

  for (const e of ledger) {
    if (e.verdict === 'caught') {
      caught++;
      if (e.lastTrain) lastTrainHits++;
    } else if (e.verdict === 'nearMiss') {
      nearMiss++;
      if (!nearest || e.gapMonths < nearest.gapMonths) nearest = e;
    } else {
      passedBy++;
    }
  }

  const total = ledger.length;
  return {
    caught,
    nearMiss,
    passedBy,
    total,
    hitRate: total === 0 ? 0 : caught / total,
    lastTrainHits,
    nearest,
  };
}
