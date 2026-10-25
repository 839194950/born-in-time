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
  /**
   * 存档那一刻的阶段。
   *
   * 只存年份不够：同一年里"事件弹窗还开着"和"已经选完"的数值是不一样的，
   * 重放到这一年时无法从年份推断出该不该补一次 resolve。缺了它，
   * 存档停在弹窗上就会被多结算一步（实测差 1 点亲情、3 点财富）。
   */
  phase?: 'playing' | 'awaitingChoice';
  /**
   * 存档时正开着的那个弹窗的事件 id。
   *
   * 同一年可能有多个弹窗（事件 → 反思 → 排队的事件）。只靠年份边界，
   * 重放会停在"当年第一个弹窗"上，而存档可能停在第二个——于是重放少走
   * 一步或多走一步，数值对不上。有了它才知道该补到哪一步为止。
   */
  pendingEventId?: string;
  focusId: string;
  stats: Stats;
  flags: string[];
  ledger: LedgerEntry[];
  timeline: TimelineEntry[];
  /** 抉择流水（含日常/反思，账本只记时代事件不够重放）。旧档没有此字段时为空。 */
  choiceLog?: { eventId: string; choiceId: string }[];
  /**
   * 重心变更流水。**没有它就无法重放**：重心每年参与结算，只存最终
   * `focusId` 而不存"哪一年换成什么"，中间年份会全部按默认值重算，
   * 结果与存档对不上、被判不可信而删档。
   * 旧档没有此字段——它们本来就带着这个缺陷，只能在加载时判 stale。
   */
  focusLog?: { year: number; focusId: string }[];
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
  // 权重也进指纹：priority 决定一条事件是"弹窗"还是"一行播报"，
  // 改一次权重，同一份事实流水重放出来的结局就完全不同。只喂 id 的话，
  // 这种改动会被判成"内容没变"，然后在重放结束的数值比对里才炸出来。
  for (const event of ALL_EVENTS) feed(`${event.id}@${event.priority ?? 3},`);
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
    phase: s.phase === 'dead' ? 'playing' : s.phase,
    pendingEventId: s.pendingEvent?.event.id,
    focusId: s.focusId,
    stats: s.stats,
    flags: s.flags,
    ledger: s.ledger,
    timeline: s.timeline,
    choiceLog: [...game.choiceLog],
    focusLog: [...game.focusLogReadonly],
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
  //
  // 只认 choiceLog。以前还把账本（ledger）的 choiceId 也塞进队列，于是同一个
  // 时代事件被入队两次——"队列里还有值"就变成了一件不可靠的事，重放时会
  // 替玩家把没选过的弹窗选掉（实测多算 1 点健康）。
  const recordedChoice = new Map<string, string[]>();
  const enqueue = (eventId: string, choiceId: string): void => {
    const q = recordedChoice.get(eventId) ?? [];
    q.push(choiceId);
    recordedChoice.set(eventId, q);
  };
  for (const entry of save.choiceLog ?? []) enqueue(entry.eventId, entry.choiceId);
  const takeRecorded = (eventId: string): string | undefined => recordedChoice.get(eventId)?.shift();

  // 重心流水：key 是"这次重心参与结算的年份"，所以要在 tick 之前按 `当年 + 1` 查。
  const focusByYear = new Map<number, string>();
  for (const entry of save.focusLog ?? []) focusByYear.set(entry.year, entry.focusId);
  const applyFocusFor = (effectiveYear: number): void => {
    const want = focusByYear.get(effectiveYear);
    if (want !== undefined && want !== game.snapshot.focusId) game.setFocus(want);
  };

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
      // 下一次 tick 会结算 `snap.year + 1`，用那一年生效的重心
      applyFocusFor(snap.year + 1);
      game.tick();
    }
  }

  // 存档停在这一年：把"界面上显示的重心"也还原成存档时的样子
  // （玩家可能在最后一年切换过，那一次要到下一年才结算，但 UI 上已经选中了）
  applyFocusFor(save.year + 1);

  // 收尾：把"存档当年剩下的弹窗"补到存档那一刻的状态。
  //
  // 必须用 while 而不是 if，原因有两层：
  // 1. 同一年可能有多个弹窗（事件 → 反思 → 排队的事件），补一个 phase 仍是 awaitingChoice；
  // 2. 存档可能停在"当年第二个弹窗"上，只按年份边界会停在第一个。
  // 所以补到「存档是 playing 且已经回到 playing」或「撞上存档记录的那个弹窗」为止。
  let replayGuard = 0;
  while (game.snapshot.phase === 'awaitingChoice' && replayGuard++ < 10) {
    const current = game.snapshot.pendingEvent!;
    const isTarget = save.phase !== 'playing' && current.event.id === save.pendingEventId;
    if (isTarget) break;
    const recorded = takeRecorded(current.event.id);
    if (!recorded) break;
    game.resolve(recorded);
  }

  const stats = game.snapshot.stats;
  for (const key of Object.keys(save.stats) as (keyof Stats)[]) {
    if (Math.abs(stats[key] - save.stats[key]) > 1e-9) {
      throw new Error(
        `存档与重放结果不一致：${key}（存档 ${save.stats[key]} / 重放 ${stats[key]}，第 ${save.year} 年）`,
      );
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
