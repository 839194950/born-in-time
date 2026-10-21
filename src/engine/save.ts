import { CONTINUE_CHOICE_ID, Game } from './game';
import type { Birth, LedgerEntry, Stats, TimelineEntry, YearSnapshot } from './types';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'sfsq.current.v1';
export const RECORD_KEY = 'sfsq.records.v1';
export const MAX_RECORDS = 10;

export interface SaveV1 {
  v: 1;
  seed: number;
  birth: Birth;
  year: number;
  focusId: string;
  stats: Stats;
  flags: string[];
  ledger: LedgerEntry[];
  timeline: TimelineEntry[];
}

export interface PastRecord {
  id: string;
  createdAt: number;
  birth: Birth;
  titleName: string;
  headline: string;
  subtitle: string;
  ledger: LedgerEntry[];
  snapshots: YearSnapshot[];
  message?: string;
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function serializeGame(game: Game): SaveV1 {
  const s = game.snapshot;
  return {
    v: SAVE_VERSION,
    seed: game.seed,
    birth: s.birth,
    year: s.year,
    focusId: s.focusId,
    stats: s.stats,
    flags: s.flags,
    ledger: s.ledger,
    timeline: s.timeline,
  };
}

/**
 * 恢复用重放实现：同种子 + 同出生 → 同一条时间线。
 * 因此不序列化中间 RNG 状态，只存事实流水；数值对不上就说明存档不可信。
 */
export function restoreGame(save: SaveV1): Game {
  const game = new Game({ seed: save.seed, birth: save.birth });
  game.start();

  const recordedChoice = new Map<string, string>();
  for (const entry of save.ledger) {
    if (entry.choiceId) recordedChoice.set(entry.eventId, entry.choiceId);
  }

  let guard = 0;
  while (game.snapshot.year < save.year && guard++ < 400) {
    const snap = game.snapshot;
    if (snap.phase === 'dead') break;
    if (snap.phase === 'awaitingChoice') {
      const pending = snap.pendingEvent!;
      const recorded = recordedChoice.get(pending.event.id);
      const available = pending.choices.find((c) => c.state === 'available');
      game.resolve(recorded ?? (available ? available.id : CONTINUE_CHOICE_ID));
    } else {
      game.tick();
    }
  }

  // 存档那一刻正好停在弹窗上：事件已触发但还没选
  if (game.snapshot.phase === 'awaitingChoice') {
    const pending = game.snapshot.pendingEvent!;
    const recorded = recordedChoice.get(pending.event.id);
    if (recorded) game.resolve(recorded);
  }

  const stats = game.snapshot.stats;
  for (const key of Object.keys(save.stats) as (keyof Stats)[]) {
    if (Math.abs(stats[key] - save.stats[key]) > 1e-9) {
      throw new Error(`存档与重放结果不一致：${key}`);
    }
  }

  return game;
}

function isSaveV1(value: unknown): value is SaveV1 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<SaveV1>;
  return (
    v.v === SAVE_VERSION &&
    typeof v.seed === 'number' &&
    typeof v.year === 'number' &&
    typeof v.birth === 'object' &&
    v.birth !== null &&
    Array.isArray(v.ledger)
  );
}

export function saveCurrent(save: SaveV1): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function loadCurrent(): SaveV1 | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSaveV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasCurrent(): boolean {
  return loadCurrent() !== null;
}

export function clearCurrent(): void {
  const ls = storage();
  try {
    ls?.removeItem(SAVE_KEY);
  } catch {
    // 忽略：清不掉也不影响本局
  }
}

export function touchCurrent(game: Game): void {
  saveCurrent(serializeGame(game));
}

export function listRecords(): PastRecord[] {
  const ls = storage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(RECORD_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is PastRecord => typeof r === 'object' && r !== null && 'id' in r);
  } catch {
    return [];
  }
}

export function pushRecord(record: PastRecord): void {
  const ls = storage();
  if (!ls) return;
  try {
    const next = [record, ...listRecords()].slice(0, MAX_RECORDS);
    ls.setItem(RECORD_KEY, JSON.stringify(next));
  } catch {
    // 存不下就算了，本局照常看
  }
}
