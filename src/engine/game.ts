import { ALL_EVENTS } from '../data/events';
import { stillForEvent } from '../data/stills';
import { pickName } from '../data/names';
import { rollBirth } from './birth';
import {
  MAX_DECISIONS_PER_YEAR,
  findDueBroadcasts,
  findDueEvents,
  pickVariantText,
  type EventCtx,
} from './catalog';
import { defaultFocusFor, focusOptionById, focusOptionsFor, stageForAge } from './focus';
import { formatEffects } from './format';
import { recordJudgement } from './ledger';
import { evaluateChoice } from './options';
import { createRng, type Rng } from './rng';
import {
  FOCUS_EFFECT_SCALE,
  STAT_TUNING,
  adaptHappiness,
  applyEffects,
  applySoftEffects,
  healthDecay,
  scaleEffects,
  initialStats,
  wealthGain,
} from './stats';
import { judgeWindow } from './window';
import type {
  AxisKey,
  Birth,
  DeathInfo,
  EventDef,
  FamilyMember,
  FocusOption,
  LedgerEntry,
  Stage,
  Stats,
  TimelineEntry,
  Verdict,
  WindowJudgement,
  YearSnapshot,
} from './types';

const EMPTY_AXES: Record<AxisKey, number> = {
  companion: 0,
  work: 0,
  root: 0,
  wind: 0,
  calm: 0,
  wave: 0,
  now: 0,
  future: 0,
};

export type Phase = 'playing' | 'awaitingChoice' | 'dead';

export interface ResolvedChoice {
  id: string;
  label: string;
  state: 'available' | 'locked';
  reason?: string;
  effectsText: string;
  /** 概率型选项不显示概率数值，只标注成败未定 */
  uncertain: boolean;
}

export interface PendingEvent {
  event: EventDef;
  judgement: WindowJudgement;
  text: string;
  choices: ResolvedChoice[];
}

export interface GameCounters {
  jobChanges: number;
  moves: number;
  startups: number;
  choices: number;
  defaultChoices: number;
  /** 赶上“最后一班车”的次数，含不进账本的条件专属事件 */
  lastTrainHits: number;
}

export interface GameSnapshot {
  phase: Phase;
  birth: Birth;
  year: number;
  age: number;
  stats: Stats;
  stage: Stage;
  focusId: string;
  focusOptions: readonly FocusOption[];
  family: FamilyMember[];
  pendingEvent: PendingEvent | null;
  timeline: TimelineEntry[];
  snapshots: YearSnapshot[];
  ledger: LedgerEntry[];
  flags: string[];
  counters: GameCounters;
  /** 人生纹理四轴（陪伴–工作 / 根–风 / 平静–浪潮 / 今天–明天）的累计值 */
  axes: Record<AxisKey, number>;
  /** 最近一次抉择触发的定格画面 id（六个之一），没有则为 null */
  milestoneId: string | null;
  death: DeathInfo | null;
}

export interface TickResult {
  year: number;
  age: number;
  broadcasts: string[];
  triggered: PendingEvent | null;
  died: boolean;
}

export interface GameOptions {
  seed: number;
  birth?: Birth;
  catalog?: readonly EventDef[];
}

const MAX_AGE = 120;

/** 差一年时没有选项，只有一个“继续”把弹窗关掉 */
export const CONTINUE_CHOICE_ID = '__continue__';

export class Game {
  private readonly catalog: readonly EventDef[];
  private readonly rng: Rng;
  private readonly seedValue: number;
  private readonly birth: Birth;

  private phase: Phase = 'playing';
  private year: number;
  private age = 0;
  private stats: Stats;
  private stage: Stage = 'infant';
  private focusId = '';
  private family: FamilyMember[] = [];
  private pending: PendingEvent | null = null;
  private timeline: TimelineEntry[] = [];
  private snapshots: YearSnapshot[] = [];
  private ledger: LedgerEntry[] = [];
  private flags: string[] = [];
  private death: DeathInfo | null = null;
  private counters: GameCounters = {
    jobChanges: 0,
    moves: 0,
    startups: 0,
    choices: 0,
    defaultChoices: 0,
    lastTrainHits: 0,
  };
  private axes: Record<AxisKey, number> = { ...EMPTY_AXES };
  private milestoneId: string | null = null;
  private firedIds = new Set<string>();
  private deathBase = 0;
  private started = false;

  private version = 0;
  private cache: GameSnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(opts: GameOptions) {
    this.catalog = opts.catalog ?? ALL_EVENTS;
    this.seedValue = opts.seed;
    this.rng = createRng(opts.seed);
    this.birth = opts.birth ?? rollBirth(this.rng);
    this.year = this.birth.year;
    this.stats = initialStats(this.birth);
    this.focusId = defaultFocusFor('infant');
  }

  static fromBirth(birth: Birth, seed: number, catalog?: readonly EventDef[]): Game {
    return new Game({ seed, birth, catalog });
  }

  getVersion(): number {
    return this.version;
  }

  /** 存档要靠它重放，所以种子必须随局保存 */
  get seed(): number {
    return this.seedValue;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get snapshot(): GameSnapshot {
    if (!this.cache) this.cache = this.buildSnapshot();
    return this.cache;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stage = stageForAge(this.age);
    if (this.birth.siblings === 0) this.flags.push('only_child');
    const parentJobs = [this.birth.fatherJob, this.birth.motherJob];
    if (parentJobs.some((j) => j === 'worker')) this.flags.push('worker_family');
    if (parentJobs.some((j) => j === 'farmer')) this.flags.push('farmer_family');
    if (!this.birth.urban && parentJobs.some((j) => j === 'migrant')) this.flags.push('migrant_parent');
    this.family = this.buildFamily();
    // 死亡基准只在开局抽一次；健康修正每年现算，所以把身体搞垮会真的少活几年
    this.deathBase = Math.round(
      this.birth.cohortLifeExpectancy + this.rng.next() * STAT_TUNING.deathNoiseYears * 2 - STAT_TUNING.deathNoiseYears,
    );
    this.touch();
  }

  setFocus(id: string): void {
    if (!focusOptionsFor(this.stage).some((o) => o.id === id)) return;
    this.focusId = id;
    this.touch();
  }

  tick(): TickResult {
    this.assertStarted();
    if (this.phase === 'dead') throw new Error('这一生已经结束了');
    if (this.phase === 'awaitingChoice') throw new Error('请先做出抉择');

    this.year += 1;
    this.age += 1;
    this.stage = stageForAge(this.age);
    if (!focusOptionsFor(this.stage).some((o) => o.id === this.focusId)) {
      this.focusId = defaultFocusFor(this.stage);
    }

    let stats = applyEffects(this.stats, { health: healthDecay(this.age) });
    const option = focusOptionById(this.stage, this.focusId);
    if (option) {
      const eff: Partial<Stats> = scaleEffects(option.effects, FOCUS_EFFECT_SCALE);
      if (eff.wealth !== undefined) eff.wealth = wealthGain(stats, eff.wealth);
      stats = applySoftEffects(stats, eff);
      for (const [axis, weight] of Object.entries(option.axes)) {
        this.axes[axis as AxisKey] += weight ?? 0;
      }
    }
    stats = adaptHappiness(stats);
    this.stats = stats;
    this.snapshots.push({ year: this.year, age: this.age, happiness: stats.happiness, stats: { ...stats } });

    if (this.age >= this.deathAge) {
      this.die();
      this.touch();
      return { year: this.year, age: this.age, broadcasts: [], triggered: null, died: true };
    }

    const ctx = this.eventCtx();
    const broadcasts: string[] = [];
    for (const b of findDueBroadcasts(ctx, this.catalog, this.firedIds)) {
      this.firedIds.add(b.id);
      const line = `${b.title}：${pickVariantText(b, this.birth.urban)}`;
      this.timeline.push({ year: this.year, age: this.age, kind: 'broadcast', text: line });
      broadcasts.push(line);
    }

    let triggered: PendingEvent | null = null;
    let decisions = 0;
    for (const ev of findDueEvents(ctx, this.catalog, this.firedIds)) {
      const pending = this.trigger(ev);
      if (pending) {
        decisions += 1;
        if (!triggered) triggered = pending;
        if (decisions >= MAX_DECISIONS_PER_YEAR) break;
      }
    }

    this.touch();
    return { year: this.year, age: this.age, broadcasts, triggered, died: false };
  }

  resolve(choiceId: string): TickResult {
    this.assertStarted();
    if (this.phase !== 'awaitingChoice' || !this.pending) throw new Error('当前没有待决的抉择');

    if (this.pending.choices.length === 0) {
      if (choiceId !== CONTINUE_CHOICE_ID) throw new Error(`没有这个选项：${choiceId}`);
      this.timeline.push({
        year: this.year,
        age: this.age,
        kind: 'event',
        text: `${this.pending.event.title}：只差一点，没赶上。`,
      });
      this.pending = null;
      this.phase = 'playing';
      this.touch();
      return { year: this.year, age: this.age, broadcasts: [], triggered: null, died: false };
    }

    const resolved = this.pending.choices.find((c) => c.id === choiceId);
    if (!resolved) throw new Error(`没有这个选项：${choiceId}`);
    if (resolved.state === 'locked') throw new Error('locked');

    const event = this.pending.event;
    const def = event.choices.find((c) => c.id === choiceId);
    if (!def) throw new Error(`没有这个选项：${choiceId}`);

    let effects: Partial<Stats> | undefined = def.effects;
    let outcome = def.outcome;
    const setFlags = [...(def.setFlags ?? [])];

    if (def.probability && def.probability.length > 0) {
      const picked = this.rng.weighted(def.probability.map((p) => ({ v: p, w: p.p })));
      outcome = picked.outcome;
      effects = mergeEffects(def.effects, picked.effects);
      setFlags.push(...(picked.setFlags ?? []));
    }

    if (effects) {
      const adjusted: Partial<Stats> = { ...effects };
      if (adjusted.wealth !== undefined) adjusted.wealth = wealthGain(this.stats, adjusted.wealth);
      this.stats = applyEffects(this.stats, adjusted);
    }

    this.milestoneId = stillForEvent(event.id)?.id ?? null;

    const before = new Set(this.flags);
    for (const f of def.clearFlags ?? []) this.flags = this.flags.filter((x) => x !== f);
    for (const f of setFlags) if (!this.flags.includes(f)) this.flags.push(f);
    this.syncFamily(setFlags);

    this.counters.choices += 1;
    if (def.default) this.counters.defaultChoices += 1;
    if (event.lastTrain && this.pending.judgement.verdict === 'caught') this.counters.lastTrainHits += 1;
    for (const f of setFlags) {
      if (before.has(f)) continue;
      if (f === 'migrant' || f === 'relocated') this.counters.moves += 1;
      if (f === 'self_employed') {
        this.counters.startups += 1;
        this.counters.jobChanges += 1;
      }
      if (f === 'stable_job' || f === 'vocational') this.counters.jobChanges += 1;
    }

    this.timeline.push({
      year: this.year,
      age: this.age,
      kind: 'event',
      text: `${event.title}：${def.label}。${outcome}`,
    });

    this.ledger = this.ledger.map((e) =>
      e.eventId === event.id ? { ...e, choiceId: def.id, choiceLabel: def.label } : e,
    );

    this.pending = null;
    this.phase = 'playing';
    this.touch();
    return { year: this.year, age: this.age, broadcasts: [], triggered: null, died: false };
  }

  /** 快转到下一个抉择（或死亡） */
  advanceToDecision(): TickResult[] {
    const out: TickResult[] = [];
    let guard = 0;
    while (this.phase === 'playing' && guard++ < MAX_AGE * 2) out.push(this.tick());
    return out;
  }

  private assertStarted(): void {
    if (!this.started) throw new Error('先调用 start()');
  }

  private get deathAge(): number {
    const shift = ((this.stats.health - 50) / 50) * STAT_TUNING.healthLifeMod;
    return Math.min(MAX_AGE, Math.round(this.deathBase + shift));
  }

  private die(): void {
    this.phase = 'dead';
    this.pending = null;
    const birthMs = Date.UTC(this.birth.year, this.birth.month - 1, 15);
    const deathMs = Date.UTC(this.year, 5, 15);
    this.death = {
      year: this.year,
      age: this.age,
      daysLived: Math.max(1, Math.round((deathMs - birthMs) / 86400000)),
    };
  }

  private eventCtx(): EventCtx {
    return {
      age: this.age,
      year: this.year,
      urban: this.birth.urban,
      tier: this.birth.tier,
      stats: this.stats,
      flags: this.flags,
    };
  }

  private trigger(event: EventDef): PendingEvent | null {
    this.firedIds.add(event.id);

    const judgement = judgeWindow({
      birthYear: this.birth.year,
      birthMonth: this.birth.month,
      eventYear: this.year,
      windowAge: event.windowAge,
      edgeYears: event.edgeYears,
      secondWindowAge: event.secondWindowAge,
    });

    // 账本只记时代窗口；人生阶段事件没有“窗口”可比
    if (event.layer === 'era') {
      this.ledger = recordJudgement(this.ledger, {
        eventId: event.id,
        title: event.title,
        year: this.year,
        age: this.age,
        verdict: judgement.verdict,
        gapMonths: judgement.gapMonths,
        weight: event.ledgerWeight,
        lastTrain: event.lastTrain === true,
      });
    }

    const text = pickVariantText(event, this.birth.urban);

    // 窗口判定只适用于时代事件（era）：它讲的就是“大事发生那年你几岁”。
    // 人生阶段事件（stage）是到了年龄必然发生在你身上的事——上学、中考、
    // 结婚、体检；条件专属（conditional）同理。两者的 windowAge 只是建议
    // 年龄标注，若拿去按月判定，出生月份在下半年的人会系统性地“差几个月”，
    // 每个阶段事件都被判成差一年、没有选项，一辈子只能点“继续过日子”。
    // （回归背景：1968 年 9 月出生的一局，24 个事件里 14 个被误判差一年。）
    const verdict = event.layer === 'era' ? judgement.verdict : 'caught';

    // 路过：只留一行背景播报，不打断玩家的时间
    if (verdict === 'passedBy') {
      this.timeline.push({
        year: this.year,
        age: this.age,
        kind: 'broadcast',
        text: `${event.title}：${text}`,
      });
      return null;
    }

    // 差一年：给文案不给选项 —— “看得见但够不着”本身就是叙事
    const choices: ResolvedChoice[] = (verdict === 'nearMiss' ? [] : event.choices).map((c) => {
      const r = evaluateChoice(c, {
        year: this.year,
        stats: this.stats,
        tier: this.birth.tier,
        flags: this.flags,
        urban: this.birth.urban,
      });
      return {
        id: c.id,
        label: c.label,
        state: r.state,
        ...(r.state === 'locked' ? { reason: r.reason } : {}),
        effectsText: formatEffects(c.effects),
        uncertain: (c.probability?.length ?? 0) > 0,
      };
    });

    this.pending = { event, judgement: { ...judgement, verdict }, text, choices };
    this.phase = 'awaitingChoice';
    return this.pending;
  }

  private buildFamily(): FamilyMember[] {
    const fatherAge = this.rng.int(24, 32);
    const motherAge = fatherAge - this.rng.int(0, 4);
    const members: FamilyMember[] = [
      {
        role: 'father',
        name: pickName(this.rng, 'male', this.birth.year - fatherAge),
        birthYear: this.birth.year - fatherAge,
      },
      {
        role: 'mother',
        name: pickName(this.rng, 'female', this.birth.year - motherAge),
        birthYear: this.birth.year - motherAge,
      },
    ];
    for (let i = 0; i < this.birth.siblings; i++) {
      const gap = 2 + i * 3;
      const gender = this.rng.chance(0.5) ? 'male' : 'female';
      members.push({
        role: 'sibling',
        name: pickName(this.rng, gender, this.birth.year - gap),
        birthYear: this.birth.year - gap,
      });
    }
    return members;
  }

  private syncFamily(setFlags: readonly string[]): void {
    if (setFlags.includes('married') && !this.family.some((f) => f.role === 'spouse')) {
      const gender = this.birth.gender === 'male' ? 'female' : 'male';
      const age = this.rng.int(22, 30);
      this.family.push({
        role: 'spouse',
        name: pickName(this.rng, gender, this.year - age),
        birthYear: this.year - age,
      });
    }
    if (setFlags.includes('child_born') && !this.family.some((f) => f.role === 'child')) {
      const gender = this.rng.chance(0.5) ? 'male' : 'female';
      this.family.push({
        role: 'child',
        name: pickName(this.rng, gender, this.year),
        birthYear: this.year,
      });
    }
  }

  private buildSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      birth: { ...this.birth },
      year: this.year,
      age: this.age,
      stats: { ...this.stats },
      stage: this.stage,
      focusId: this.focusId,
      focusOptions: focusOptionsFor(this.stage),
      family: this.family.map((f) => ({ ...f })),
      pendingEvent: this.pending,
      timeline: [...this.timeline],
      snapshots: this.snapshots.map((s) => ({ ...s, stats: { ...s.stats } })),
      ledger: this.ledger.map((e) => ({ ...e })),
      flags: [...this.flags],
      counters: { ...this.counters },
      axes: { ...this.axes },
      milestoneId: this.milestoneId,
      death: this.death ? { ...this.death } : null,
    };
  }

  private touch(): void {
    this.version += 1;
    this.cache = null;
    for (const listener of this.listeners) listener();
  }
}

function mergeEffects(a?: Partial<Stats>, b?: Partial<Stats>): Partial<Stats> | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: Partial<Stats> = { ...a };
  for (const key of Object.keys(b) as (keyof Stats)[]) {
    out[key] = (out[key] ?? 0) + (b[key] ?? 0);
  }
  return out;
}

export type { Verdict };
