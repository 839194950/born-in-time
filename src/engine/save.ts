import { ALL_EVENTS } from '../data/events';
import { DAILY_EVENTS } from '../data/events/daily';
import { evaluateEnding } from './ending';
import { CONTINUE_CHOICE_ID, Game, type GameSnapshot } from './game';
import type { Birth, LedgerEntry, Stats, TimelineEntry, YearSnapshot } from './types';

/**
 * 2：RNG 拆成命名子流 + 节奏重排，重放语义已经变了，v1 存档无法续玩。
 * 升级时连同 KEY 一起换，旧档留在原 key 上不动（不删用户数据，只是不再读它）。
 */
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'sfsq.current.v2';
export const RECORD_KEY = 'sfsq.records.v1';
export const MAX_RECORDS = 10;

export interface SaveV1 {
  v: number;
  seed: number;
  birth: Birth;
  year: number;
  focusId: string;
  stats: Stats;
  flags: string[];
  ledger: LedgerEntry[];
  timeline: TimelineEntry[];
  /** 抉择流水（含日常/反思，账本只记时代事件不够重放）。旧档没有此字段时为空。 */
  choiceLog?: { eventId: string; choiceId: string }[];
  /** 事件目录指纹：内容一变就认不出这是同一套规则，存档只能作废。旧档没有此字段。 */
  ch?: string;
}

/**
 * 事件目录指纹（FNV-1a）。
 *
 * 为什么需要它：重放依赖"事件池的长度与顺序"——`pickDaily` 拿数组下标当骰子。
 * 往日常池里加一条，之后每次抽样的随机数就全错位。`SAVE_VERSION` 只认结构不认内容，
 * 所以必须另有一枚指纹，让"内容变过"这件事在加载时被明确识别，而不是重放时炸在
 * 某个数值比对里、再被 UI 静默吞掉。
 */
let hashCache: string | null = null;
export function catalogHash(): string {
  if (hashCache !== null) return hashCache;
  let h = 0x811c9dc5;
  const feed = (text: string): void => {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  feed(`v${SAVE_VERSION};`);
  for (const event of ALL_EVENTS) feed(`${event.id},`);
  // 日常池的顺序也是契约，单独打一段并按原顺序喂
  feed('|daily;');
  for (const daily of DAILY_EVENTS) feed(`${daily.id},`);
  hashCache = h.toString(16).padStart(8, '0');
  return hashCache;
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
    choiceLog: [...game.choiceLog],
    ch: catalogHash(),
  };
}

/**
 * 恢复用重放实现：同种子 + 同出生 → 同一条时间线。
 * 因此不序列化中间 RNG 状态，只存事实流水；数值对不上就说明存档不可信。
 */
export function restoreGame(save: SaveV1): Game {
  const game = new Game({ seed: save.seed, birth: save.birth });
  game.start();

  // 每个事件 id 对应一条选择队列：可重复的日常事件会出现多次，按顺序取。
  const recordedChoice = new Map<string, string[]>();
  const enqueue = (eventId: string, choiceId: string): void => {
    const q = recordedChoice.get(eventId) ?? [];
    q.push(choiceId);
    recordedChoice.set(eventId, q);
  };
  for (const entry of save.ledger) {
    if (entry.choiceId) enqueue(entry.eventId, entry.choiceId);
  }
  for (const entry of save.choiceLog ?? []) enqueue(entry.eventId, entry.choiceId);
  const takeRecorded = (eventId: string): string | undefined => recordedChoice.get(eventId)?.shift();

  let guard = 0;
  while (game.snapshot.year < save.year && guard++ < 400) {
    const snap = game.snapshot;
    if (snap.phase === 'dead') break;
    if (snap.phase === 'awaitingChoice') {
      const pending = snap.pendingEvent!;
      const recorded = takeRecorded(pending.event.id);
      const available = pending.choices.find((c) => c.state === 'available');
      game.resolve(recorded ?? (available ? available.id : CONTINUE_CHOICE_ID));
    } else {
      game.tick();
    }
  }

  // 存档那一刻正好停在弹窗上：事件已触发但还没选
  if (game.snapshot.phase === 'awaitingChoice') {
    const pending = game.snapshot.pendingEvent!;
    const recorded = takeRecorded(pending.event.id);
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

export type LoadStatus = 'ok' | 'empty' | 'stale' | 'corrupt';

/**
 * 三态加载：分得清"没有档"和"档不能用"。
 * 之前两者都返回 null，UI 只能静默什么都不做——用户看到"继续上一局"能点、点了没反应。
 */
export function loadCurrentStatus(): { status: LoadStatus; save: SaveV1 | null } {
  const ls = storage();
  if (!ls) return { status: 'empty', save: null };
  let raw: string | null = null;
  try {
    raw = ls.getItem(SAVE_KEY);
  } catch {
    return { status: 'empty', save: null };
  }
  if (!raw) return { status: 'empty', save: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', save: null };
  }
  if (!isSaveV1(parsed)) return { status: 'stale', save: null };
  // 内容指纹对不上 = 规则已经变了，重放必然错位。宁可明确作废，也不要静默错位。
  if (parsed.ch !== undefined && parsed.ch !== catalogHash()) return { status: 'stale', save: parsed };
  return { status: 'ok', save: parsed };
}

export function loadCurrent(): SaveV1 | null {
  const { status, save } = loadCurrentStatus();
  return status === 'ok' ? save : null;
}

export function hasCurrent(): boolean {
  return loadCurrent() !== null;
}

/** 有存档（含已失效的旧档）就该显示「继续上一局」——点下去才解释得清为什么不能续 */
export function hasResumable(): boolean {
  return loadCurrentStatus().status !== 'empty';
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

export function recordFromSnapshot(snapshot: GameSnapshot): PastRecord {
  const ending = evaluateEnding(snapshot);
  const now = Date.now();
  return {
    id: `${snapshot.birth.year}-${snapshot.death?.year ?? snapshot.year}-${now}`,
    createdAt: now,
    birth: snapshot.birth,
    titleName: ending.title.name,
    headline: ending.headline,
    subtitle: ending.subtitle,
    ledger: snapshot.ledger,
    snapshots: snapshot.snapshots,
  };
}

export function setLatestMessage(message: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    const list = listRecords();
    const first = list[0];
    if (!first) return;
    list[0] = { ...first, message };
    ls.setItem(RECORD_KEY, JSON.stringify(list));
  } catch {
    // 存不下就算了
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
