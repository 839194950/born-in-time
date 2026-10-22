import { ALL_EVENTS } from '../data/events';
import { DAILY_EVENTS, type DailyEventDef } from '../data/events/daily';
import { reflectionFor, type ReflectionDef } from '../data/reflections';
import { stillForEvent } from '../data/stills';
import { pickName } from '../data/names';
import { cohortLifeExpectancy } from '../data/demography';
import { rollBirth } from './birth';
import {
  MAX_DECISIONS_PER_YEAR,
  findDueBroadcasts,
  findDueEvents,
  matchesConditions,
  pickVariantText,
  type EventCtx,
} from './catalog';
import { defaultFocusFor, focusOptionById, focusOptionsFor, stageForAge } from './focus';
import { formatEffects } from './format';
import { recordJudgement } from './ledger';
import { evaluateChoice } from './options';
import { createRng, rngFor, type Rng } from './rng';
import {
  FOCUS_EFFECT_SCALE,
  STAT_TUNING,
  abilityDecay,
  adaptHappiness,
  applyEffects,
  applySoftEffects,
  familyDecay,
  healthBand,
  healthDecay,
  scaleEffects,
  initialStats,
  wealthGain,
} from './stats';
import { annualWealthDrift, careerLine, deriveCareer } from './career';
import { MORTGAGE_TERM_YEARS, deriveStates, type LifeState } from './states';
import { INTEREST_BY_FOCUS, INTEREST_XP_PER_YEAR, summarizeInterests, type InterestState } from './interests';
import { judgeWindow } from './window';
import { STAT_KEYS } from './types';
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
  /** event=目录事件；daily=日常小事；reflection=反思节点 */
  kind: 'event' | 'daily' | 'reflection';
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
  /** 本局种子（同年对照组按它派生，同一局永远同一组人） */
  seed: number;
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
  /** 职业状态 id 与展示行（月薪体感锚点），由 flags+年龄推导 */
  careerId: string;
  careerLine: string;
  /** 兴趣等级（按经验降序，只含已积累的） */
  interests: InterestState[];
  /** 今年各重心选项将实际生效的整数效果（余数结转后的预演值，与按钮展示一致） */
  focusDisplay: Record<string, Partial<Stats>>;
  /** 持续状态（房贷/慢病/持仓等），跨年一直挂在身上的东西 */
  states: LifeState[];
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
  /** 日常事件池（默认全量）；传空数组可关掉 */
  dailyEvents?: readonly DailyEventDef[];
  /** 反思节点开关（默认开） */
  reflections?: boolean;
}

const MAX_AGE = 120;
/** 一生最多插几件日常小事：小事是调味，不该占掉 42% 的抉择量 */
const MAX_DAILY_PER_LIFE = 4;

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
  private focusResidue: Partial<Stats> = {};
  private interestsXp: Record<string, number> = {};
  private firstPayNoted = false;
  private readonly dailyEvents: readonly DailyEventDef[];
  private readonly reflectionsOn: boolean;
  private dailyLastFired = new Map<string, number>();
  private flagYears = new Map<string, number>();
  private reflectionsFired = new Set<number>();
  private pendingQueue: { def: EventDef; kind: 'daily' | 'reflection' }[] = [];
  private choiceLogInternal: { eventId: string; choiceId: string }[] = [];
  private deathBase = 0;
  private started = false;
  /** 距上一次弹窗过了几年（日常小事只在长期空窗时补一件） */
  private yearsSinceModal = 0;
  private dailyFired = 0;
  /** 主动养生/锻炼、净健康为正的年数——决定长寿尾 */
  private healthyYears = 0;

  private version = 0;
  private cache: GameSnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(opts: GameOptions) {
    this.catalog = opts.catalog ?? ALL_EVENTS;
    this.dailyEvents = opts.dailyEvents ?? DAILY_EVENTS;
    this.reflectionsOn = opts.reflections ?? true;
    this.seedValue = opts.seed;
    this.rng = createRng(opts.seed);
    this.birth = opts.birth ?? rollBirth(this.rng);
    this.year = this.birth.year;
    this.stats = initialStats(this.birth);
    this.focusId = defaultFocusFor('infant');
  }

  static fromBirth(
    birth: Birth,
    seed: number,
    catalog?: readonly EventDef[],
    extra?: Pick<GameOptions, 'dailyEvents' | 'reflections'>,
  ): Game {
    return new Game({ seed, birth, catalog, ...extra });
  }

  getVersion(): number {
    return this.version;
  }

  /** 全部已做出的抉择流水（存档重放靠它复现日常/反思的选择） */
  get choiceLog(): readonly { eventId: string; choiceId: string }[] {
    return this.choiceLogInternal;
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

    // 年度子流：同一年内的所有随机都从这里取，和日常/事件/选择的流互不干扰
    const yearRng = rngFor(this.seedValue, 'tick', this.year);
    let stats = applyEffects(this.stats, {
      health: healthDecay(this.age),
      ability: abilityDecay(this.age),
      family: familyDecay(this.age),
    });
    const option = focusOptionById(this.stage, this.focusId);
    if (option) {
      // 整数化：0.4 折算的小数不直接展示也不直接生效，按年结转余数——
      // 今年四舍五入省下的部分攒到明年，长期总量仍等于 0.4 倍，按钮上
      // 看到的整数就是实际生效的整数（见 focusDisplay 的预演）。
      const raw = scaleEffects(option.effects, FOCUS_EFFECT_SCALE);
      let eff: Partial<Stats> = {};
      for (const key of STAT_KEYS) {
        const value = raw[key];
        if (value === undefined) continue;
        const total = value + (this.focusResidue[key] ?? 0);
        const applied = Math.round(total);
        this.focusResidue[key] = total - applied;
        if (applied !== 0) eff[key] = applied;
      }
      if (eff.wealth !== undefined) eff = { ...eff, wealth: wealthGain(stats, eff.wealth) };
      // 健康回血只在"这个岁数还养得回来"的范围内加成，且必须由玩家主动选
      if (eff.health !== undefined && eff.health > 0 && stats.health < healthBand(this.age)) {
        eff = { ...eff, health: eff.health * STAT_TUNING.healthRecoverBoost };
      }
      // 按选项声明的健康意图统计（2 = 运动/休息/留给自己的那档），
      // 不能看折算后的整数：2×0.4=0.8 会四舍五入成 1，永远够不到 2。
      if ((option.effects.health ?? 0) >= 2) this.healthyYears += 1;
      stats = applySoftEffects(stats, eff);
      for (const [axis, weight] of Object.entries(option.axes)) {
        this.axes[axis as AxisKey] += weight ?? 0;
      }
      const interest = INTEREST_BY_FOCUS[option.id];
      if (interest) {
        this.interestsXp[interest.id] = (this.interestsXp[interest.id] ?? 0) + INTEREST_XP_PER_YEAR;
      }
    }
    stats = adaptHappiness(stats);

    // 职业年度结算：财富百分位每年有根基地漂移，大起大落仍归事件管
    const career = deriveCareer(this.flags, this.age, this.birth.urban);
    if (career.working || career.retired) {
      const drift = annualWealthDrift(career, () => yearRng.next());
      if (drift !== 0) stats = applyEffects(stats, { wealth: drift });
      if (career.working && !this.firstPayNoted && this.age >= 18) {
        this.firstPayNoted = true;
        this.timeline.push({
          year: this.year, age: this.age, kind: 'milestone',
          text: `第一份工资：开始做${career.label}，工资发下来那天，把钱数了两遍。`,
        });
      } else if (career.working && this.age >= 26 && this.age <= 50 && yearRng.chance(0.07)) {
        this.timeline.push({
          year: this.year, age: this.age, kind: 'milestone',
          text: '工资涨了一档：不多，但晚饭加了个菜。',
        });
      }
    }

    // 家人离世（父母/配偶的 deathYear 在家人建立时就抽定，这里只做兑现）
    for (const member of this.family) {
      if (member.deathYear !== this.year) continue;
      if (member.role === 'father' || member.role === 'mother') {
        const rel = member.role === 'father' ? '父亲' : '母亲';
        this.timeline.push({
          year: this.year, age: this.age, kind: 'milestone',
          text: `${rel} ${member.name} 去世了，享年 ${this.year - member.birthYear} 岁。`,
        });
        stats = applyEffects(stats, { family: -5, happiness: -4 });
      } else if (member.role === 'spouse') {
        this.timeline.push({
          year: this.year, age: this.age, kind: 'milestone',
          text: `配偶 ${member.name} 先走了一步，享年 ${this.year - member.birthYear} 岁。`,
        });
        stats = applyEffects(stats, { family: -8, happiness: -6 });
      }
    }
    // 持续状态结算：慢病拖健康、花药钱；房贷满 20 年还清
    if (!this.flags.includes('chronic_illness') && this.age >= 45 && stats.health < 42 && yearRng.chance(0.08)) {
      this.flags.push('chronic_illness');
      this.timeline.push({
        year: this.year, age: this.age, kind: 'milestone',
        text: '体检报告出来了：慢性病。从今往后，药不能停，人也得学着保养。',
      });
      stats = applyEffects(stats, { health: -3, happiness: -2 });
    } else if (this.flags.includes('chronic_illness')) {
      stats = applyEffects(stats, { health: -0.3 });
      if (yearRng.chance(0.4)) stats = applyEffects(stats, { wealth: -1 });
    }
    const mortgageYear = this.flagYears.get('mortgage');
    if (
      mortgageYear !== undefined &&
      this.flags.includes('mortgage') &&
      !this.flags.includes('mortgage_paid') &&
      this.year - mortgageYear >= MORTGAGE_TERM_YEARS
    ) {
      this.flags.push('mortgage_paid');
      this.timeline.push({
        year: this.year, age: this.age, kind: 'milestone',
        text: '房贷，这个月还清了。那天晚上，睡了个整觉。',
      });
      stats = applyEffects(stats, { happiness: 3 });
    }
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
      // priority < 3：不打断玩家，只留一行播报。把"必须决策"和"一句话带过"分开。
      if ((ev.priority ?? 3) < 3) {
        this.firedIds.add(ev.id);
        this.timeline.push({
          year: this.year,
          age: this.age,
          kind: 'broadcast',
          text: `${ev.title}：${pickVariantText(ev, this.birth.urban)}`,
        });
        continue;
      }
      const pending = this.trigger(ev);
      if (pending) {
        decisions += 1;
        if (!triggered) triggered = pending;
        if (decisions >= MAX_DECISIONS_PER_YEAR) break;
      }
    }

    // 反思节点：到岁数必须停一次。今年已有大抉择，就排在抉择之后。
    if (this.reflectionsOn && !this.reflectionsFired.has(this.age)) {
      const reflection = reflectionFor(this.age);
      if (reflection) {
        this.reflectionsFired.add(this.age);
        const def = this.reflectionEventDef(reflection);
        if (!triggered) triggered = this.trigger(def, 'reflection');
        else if (this.pendingQueue.length === 0) this.pendingQueue.push({ def, kind: 'reflection' });
      }
    }

    // 日常小事：改成"空窗补偿"——连续 ≥3 年没有弹窗才补一件，一生上限 4 件。
    // v1 是"空白年 50% 一件"，结果日常占了 42% 的抉择量，招牌的时代窗口只剩 16%。
    if (triggered) this.yearsSinceModal = 0;
    else this.yearsSinceModal += 1;

    if (
      this.age >= 6 &&
      !triggered &&
      this.dailyFired < MAX_DAILY_PER_LIFE &&
      this.yearsSinceModal >= 3
    ) {
      const def = this.pickDaily(rngFor(this.seedValue, 'daily', this.year));
      if (def) {
        this.dailyFired += 1;
        this.yearsSinceModal = 0;
        triggered = this.trigger(def, 'daily');
      }
    }

    this.touch();
    return { year: this.year, age: this.age, broadcasts, triggered, died: false };
  }

  private dailyEventDef(d: DailyEventDef): EventDef {
    return {
      id: d.id,
      layer: 'conditional',
      trigger: { type: 'age', age: this.age },
      windowAge: [this.age, this.age],
      title: d.title,
      body: d.body,
      ...(d.variants ? { variants: d.variants } : {}),
      ...(d.conditions ? { conditions: d.conditions } : {}),
      choices: d.choices,
      ledgerWeight: 0,
      source: d.source,
    };
  }

  private reflectionEventDef(r: ReflectionDef): EventDef {
    const fact = r.fact({
      birthYear: this.birth.year,
      year: this.year,
      lifeExpectancy: this.birth.cohortLifeExpectancy,
    });
    return {
      id: `reflection_${r.age}`,
      layer: 'conditional',
      trigger: { type: 'age', age: r.age },
      windowAge: [r.age, r.age],
      title: r.title,
      body: `${fact}\n\n${r.question}`,
      choices: r.choices,
      ledgerWeight: 0,
      source: r.source,
    };
  }

  private pickDaily(rng: Rng): EventDef | null {
    const ctx = this.eventCtx();
    const candidates = this.dailyEvents.filter((d) => {
      if (this.age < d.ageRange[0] || this.age > d.ageRange[1]) return false;
      const last = this.dailyLastFired.get(d.id);
      if (last !== undefined && (!d.repeatable || this.year - last < 6)) return false;
      return matchesConditions(this.dailyEventDef(d), ctx);
    });
    if (candidates.length === 0) return null;
    const picked = candidates[rng.int(0, candidates.length - 1)]!;
    this.dailyLastFired.set(picked.id, this.year);
    return this.dailyEventDef(picked);
  }

  private popQueue(): PendingEvent | null {
    const next = this.pendingQueue.shift();
    if (!next) return null;
    return this.trigger(next.def, next.kind);
  }

  resolve(choiceId: string): TickResult {
    this.assertStarted();
    if (this.phase !== 'awaitingChoice' || !this.pending) throw new Error('当前没有待决的抉择');

    if (this.pending.choices.length === 0) {
      if (choiceId !== CONTINUE_CHOICE_ID) throw new Error(`没有这个选项：${choiceId}`);
      // 点掉一个「差一年」弹窗也是一条事实。不写进流水，重放时这一步会缺失，
      // 于是刷新后弹窗复活、当年第二件事被吞掉（实测 6.25% 的存档会静默错位）。
      this.choiceLogInternal.push({ eventId: this.pending.event.id, choiceId: CONTINUE_CHOICE_ID });
      this.timeline.push({
        year: this.year,
        age: this.age,
        kind: 'event',
        text: `${this.pending.event.title}：只差一点，没赶上。`,
      });
      this.pending = null;
      this.phase = 'playing';
      const next = this.popQueue();
      this.touch();
      return { year: this.year, age: this.age, broadcasts: [], triggered: next, died: false };
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
      const picked = rngFor(this.seedValue, 'choice', this.year).weighted(
        def.probability.map((p) => ({ v: p, w: p.p })),
      );
      outcome = picked.outcome;
      effects = mergeEffects(def.effects, picked.effects);
      setFlags.push(...(picked.setFlags ?? []));
    }

    if (effects) {
      // 事件效果只对"已经很靠前"的部分打折：拆迁/创业/比特币该跃升就跃升，
      // 但已经在前 30% 的人再加一大笔，收益要减半（规格 §4.3 的均值回归阻力）
      let applied = effects;
      if (effects.wealth !== undefined && effects.wealth > 0 && this.stats.wealth > 70) {
        applied = { ...effects, wealth: effects.wealth * 0.5 };
      }
      this.stats = applyEffects(this.stats, applied);
    }

    this.milestoneId = stillForEvent(event.id)?.id ?? null;

    const before = new Set(this.flags);
    for (const f of def.clearFlags ?? []) this.flags = this.flags.filter((x) => x !== f);
    for (const f of setFlags) if (!this.flags.includes(f)) this.flags.push(f);
    for (const f of setFlags) if (!this.flagYears.has(f)) this.flagYears.set(f, this.year);
    this.syncFamily(setFlags);

    this.choiceLogInternal.push({ eventId: event.id, choiceId });
    this.counters.choices += 1;
    if (def.default) this.counters.defaultChoices += 1;
    if (event.lastTrain && this.pending.judgement.verdict === 'caught') this.counters.lastTrainHits += 1;
    for (const f of setFlags) {
      if (before.has(f)) continue;
      // 只有真正迁出原籍才算「离开那座城」；南下打工不算，否则「守一座城」永远 0%
      if (f === 'relocated') this.counters.moves += 1;
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
    const queued = this.popQueue();
    this.touch();
    return { year: this.year, age: this.age, broadcasts: [], triggered: queued, died: false };
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
    // 长寿尾：常年主动养生的人可以真的多活几年，让「多活十年」成为可经营的 build
    const tail = Math.min(
      STAT_TUNING.longevityTailMax,
      this.healthyYears * STAT_TUNING.longevityTailPerYear,
    );
    return Math.min(MAX_AGE, Math.round(this.deathBase + shift + tail));
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

  private trigger(event: EventDef, kind: PendingEvent['kind'] = 'event'): PendingEvent | null {
    this.firedIds.add(event.id);

    const judgement = judgeWindow({
      birthYear: this.birth.year,
      birthMonth: this.birth.month,
      eventYear: this.year,
      windowAge: event.windowAge,
      edgeYears: event.edgeYears,
      secondWindowAge: event.secondWindowAge,
    });

    // 账本只记时代窗口；人生阶段事件没有"窗口"可比。
    // "路过"也不再无脑入账：只留权重高的、或确实擦边的，否则账本被 8 条路过灌满。
    const worthLedger =
      judgement.verdict !== 'passedBy' || event.ledgerWeight >= 4 || judgement.gapMonths <= 24;
    if (event.layer === 'era' && worthLedger) {
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

    this.pending = { event, judgement: { ...judgement, verdict }, text, choices, kind };
    this.phase = 'awaitingChoice';
    return this.pending;
  }

  private buildFamily(): FamilyMember[] {
    const fatherAge = this.rng.int(24, 32);
    const motherAge = fatherAge - this.rng.int(0, 4);
    const parentDeath = (birthYear: number): number =>
      Math.round(birthYear + cohortLifeExpectancy(birthYear, this.birth.urban) + this.rng.int(-5, 9));
    // 一家人一个姓：v1 每个成员各抽各的姓，于是出现"父亲姓罗、孩子姓邓"这种截图一放大就露馅的事。
    // 母亲保留自己的姓（本来就该不同姓），父亲与兄弟姐妹沿用主角的姓。
    const familySurname = Array.from(this.birth.name)[0] ?? '王';
    // 家里不能有两个同名的人：v1 直接从名字池随机取，会撞上主角自己的名字，
    // 于是"兄弟姐妹"那一栏出现一个和主角一模一样的人。改成同一个姓之后更容易撞，
    // 所以从父亲开始就要查重。
    const usedNames = new Set([this.birth.name]);
    const distinctName = (gender: 'male' | 'female', year: number, surname?: string): string => {
      let name = pickName(this.rng, gender, year, surname);
      for (let tries = 0; tries < 8 && usedNames.has(name); tries++) {
        name = pickName(this.rng, gender, year, surname);
      }
      usedNames.add(name);
      return name;
    };

    const members: FamilyMember[] = [
      {
        role: 'father',
        name: distinctName('male', this.birth.year - fatherAge, familySurname),
        birthYear: this.birth.year - fatherAge,
        deathYear: parentDeath(this.birth.year - fatherAge),
      },
      {
        role: 'mother',
        name: distinctName('female', this.birth.year - motherAge),
        birthYear: this.birth.year - motherAge,
        deathYear: parentDeath(this.birth.year - motherAge),
      },
    ];
    for (let i = 0; i < this.birth.siblings; i++) {
      const gap = 2 + i * 3;
      const gender = this.rng.chance(0.5) ? 'male' : 'female';
      members.push({
        role: 'sibling',
        name: distinctName(gender, this.birth.year - gap, familySurname),
        birthYear: this.birth.year - gap,
        deathYear: parentDeath(this.birth.year - gap) + this.rng.int(0, 10),
      });
    }
    return members;
  }

  private syncFamily(setFlags: readonly string[]): void {
    if (setFlags.includes('married') && !this.family.some((f) => f.role === 'spouse')) {
      const gender = this.birth.gender === 'male' ? 'female' : 'male';
      const age = this.rng.int(22, 30);
      const spouseBirthYear = this.year - age;
      const jobPool = this.birth.urban ? ['教师', '职员', '工人', '个体户', '护士'] : ['农民', '教师', '务工', '个体户'];
      this.family.push({
        role: 'spouse',
        name: pickName(this.rng, gender, spouseBirthYear),
        birthYear: spouseBirthYear,
        deathYear: Math.round(spouseBirthYear + cohortLifeExpectancy(spouseBirthYear, this.birth.urban) + this.rng.int(-4, 9)),
        job: jobPool[this.rng.int(0, jobPool.length - 1)],
      });
    }
    if (setFlags.includes('child_born') && !this.family.some((f) => f.role === 'child')) {
      const gender = this.rng.chance(0.5) ? 'male' : 'female';
      const surname = Array.from(this.birth.name)[0] ?? '王';
      this.family.push({
        role: 'child',
        name: pickName(this.rng, gender, this.year, surname),
        birthYear: this.year,
      });
    }
  }

  private buildSnapshot(): GameSnapshot {
    return {
      seed: this.seedValue,
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
      careerId: deriveCareer(this.flags, this.age, this.birth.urban).id,
      careerLine: careerLine(deriveCareer(this.flags, this.age, this.birth.urban), this.year, this.age),
      interests: summarizeInterests(this.interestsXp),
      focusDisplay: this.peekFocusDisplay(),
      states: deriveStates(this.flags, this.age),
    };
  }

  /** 预演今年每个重心选项将生效的整数效果（与 tick 的结转算法一致，不改状态） */
  private peekFocusDisplay(): Record<string, Partial<Stats>> {
    const out: Record<string, Partial<Stats>> = {};
    for (const option of focusOptionsFor(this.stage)) {
      const raw = scaleEffects(option.effects, FOCUS_EFFECT_SCALE);
      const eff: Partial<Stats> = {};
      for (const key of STAT_KEYS) {
        const value = raw[key];
        if (value === undefined) continue;
        const applied = Math.round(value + (this.focusResidue[key] ?? 0));
        if (applied !== 0) eff[key] = applied;
      }
      out[option.id] = eff;
    }
    return out;
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
