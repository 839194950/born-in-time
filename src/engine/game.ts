import { ALL_EVENTS } from '../data/events';
import { DAILY_EVENTS, type DailyEventDef } from '../data/events/daily';
import { reflectionFor, type ReflectionDef } from '../data/reflections';
import { stillForEvent } from '../data/stills';
import { pickName } from '../data/names';
import { cohortLifeExpectancy } from '../data/demography';
import { rollBirth } from './birth';
import {
  MAX_ERA_DECISIONS_PER_YEAR,
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
  SILENT_SETTLE_SCALE,
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

/**
 * 抉择的两条通道。
 *
 * 分开的理由：两条通道的"确定性"不一样。人生节点是到了岁数必然落在你身上的事
 * （上学、结婚、生孩子、体检），不该被一条权重更高的时代事件顶掉；时代事件则
 * 是"外面发生的事"，同一年有好几条时只弹最重的，其余写一行播报。
 *
 * 注意：这条通道划分管的是**排序和节奏**，不管总量。一生有多少次抉择，由内容
 * 密度（每条事件的窗口能覆盖多少个出生年份）决定，引擎不设全局上限。
 */
export type DecisionChannel = 'life' | 'era';

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
  /**
   * 重心变更流水：`{ year, focusId }`，`year` 是**这次重心开始参与结算的年份**。
   *
   * 为什么必须存：存档恢复靠"同种子 + 同事实流水重放"，而重心是每年结算的
   * 输入之一。v2 只把最终的 `focusId` 存进存档、重放时却从没用过它，
   * 于是玩家只要选过非默认重心，重放出来的数值就和存档对不上，
   * 被判定为"存档不可信"并删掉整局。重心本身就是一条事实，理应进流水。
   *
   * 为什么 year 记的是"下一年"：tick 是 `year += 1` 之后才用 focus 结算的，
   * 玩家在 2029 年界面上点的重心，实际参与的是 2030 年那次结算。
   * 若按"变更当年"记录，重放时会提前一年生效，数值照样对不上。
   */
  private focusLog: { year: number; focusId: string }[] = [];
  private interestsXp: Record<string, number> = {};
  private firstPayNoted = false;
  private readonly dailyEvents: readonly DailyEventDef[];
  private readonly reflectionsOn: boolean;
  private dailyLastFired = new Map<string, number>();
  private flagYears = new Map<string, number>();
  private reflectionsFired = new Set<number>();
  private pendingQueue: { def: EventDef; kind: PendingEvent['kind'] }[] = [];
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
    // 传入 birth 时也要把「抽出生」的随机流消耗掉。
    //
    // 否则同一种子会因为你"怎么进来的"而生成不同的人生：
    // `new Game({ seed })` 会先抽一次出生（消耗 N 个随机数），再抽家人；
    // 而 `new Game({ seed, birth })` 直接抽家人，于是父母、兄弟姐妹、
    // 死亡基准全部错位——同一个种子，两条命。存档重放走的正是后者。
    if (opts.birth) {
      rollBirth(this.rng);
      this.birth = opts.birth;
    } else {
      this.birth = rollBirth(this.rng);
    }
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

  /** 重心变更流水（存档重放靠它复现每年的年度重心） */
  get focusLogReadonly(): readonly { year: number; focusId: string }[] {
    return this.focusLog;
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
    // 出生当年也要过一遍播报。
    // tick() 是先 year += 1 再结算的，所以「出生那年」永远轮不到——
    // 1958 年出生的人看不到「人民公社」，1966 年出生的看不到「学校停课」，
    // 而这些恰好是那一代人最早的记忆。
    const bornCtx = this.eventCtx();
    for (const b of findDueBroadcasts(bornCtx, this.catalog, this.firedIds)) {
      this.firedIds.add(b.id);
      this.timeline.push({
        year: this.year,
        age: 0,
        kind: 'broadcast',
        text: `${b.title}：${pickVariantText(b, this.birth.urban)}`,
      });
    }
    this.touch();
  }

  setFocus(id: string): void {
    if (!focusOptionsFor(this.stage).some((o) => o.id === id)) return;
    if (this.focusId === id) return;
    this.focusId = id;
    if (this.started && this.phase !== 'dead') {
      // 生效年份 = 下一次结算的年份；同一年内反复切换只记最后一次
      const effectiveYear = this.year + 1;
      const last = this.focusLog[this.focusLog.length - 1];
      if (last && last.year === effectiveYear) last.focusId = id;
      else this.focusLog.push({ year: effectiveYear, focusId: id });
    }
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
    // 时代通道每年最多一条：多出来的降级为播报（文本不丢，只是不给选项）。
    // 人生通道没有这个上限——人生节点是"到了岁数必然发生"的事，绝不降级。
    let eraShown = 0;
    for (const ev of this.sortByChannel(findDueEvents(ctx, this.catalog, this.firedIds))) {
      // priority < 3：不打断玩家，只留一行播报。把"必须决策"和"一句话带过"分开。
      //
      // 但"降级为播报"不等于"这件事没发生"：人生阶段事件是到了岁数必然会落在
      // 你身上的事，只写一行字就把选项连同 effects / setFlags 一起扔掉，等于
      // 把 16 个节点的后果全部抹掉——实测「生孩子」不结算，77.9% 的玩家一辈子
      // 没有孩子；10 岁的「四年级」不结算 +3 能力，15 岁能力均值被压到 44.7，
      // 而「读高中」的门槛是 46。所以这里按 default 选项静默结算后果。
      //
      // 时代事件不走这条分支：它讲的是"大事发生那年你几岁"，降级就该只是一行
      // 背景音，不该凭默认项给玩家发属性。
      if ((ev.priority ?? 3) < 3) {
        this.firedIds.add(ev.id);
        if (ev.layer === 'stage') this.settleSilently(ev);
        this.timeline.push({
          year: this.year,
          age: this.age,
          kind: 'broadcast',
          text: `${ev.title}：${pickVariantText(ev, this.birth.urban)}`,
        });
        continue;
      }

      const channel = this.channelOf(ev);
      // 时代通道满了：写成一行播报，不占弹窗。1998 那种"房改 + 下岗"同年到期
      // 的年份，以前会连弹两个时代事件，节奏上像被灌了两段新闻。
      if (channel === 'era' && eraShown >= MAX_ERA_DECISIONS_PER_YEAR) {
        this.firedIds.add(ev.id);
        this.timeline.push({
          year: this.year,
          age: this.age,
          kind: 'broadcast',
          text: `${ev.title}：${pickVariantText(ev, this.birth.urban)}`,
        });
        continue;
      }

      // 一个 tick 只能产出一个 pending；后来的顺延到这次抉择之后再弹，而不是丢掉。
      //
      // 以前这里直接 `break`，于是同年撞车的第二个事件既不弹窗、也不留播报、
      // 下一岁也不会再触发（年龄触发器只匹配一次）。实测「结婚」因此丢 36%、
      // 「第一份工作」丢 26%，房改/老龄化等时代事件丢 54–63%，而且 36.9% 的
      // 玩家整局没见过"结婚"——人生线从源头断掉。
      // 顺延用的就是反思节点一直在用的 pendingQueue，不是新机制。
      const pending = this.trigger(ev, 'event', triggered !== null);
      if (!pending) continue;
      if (channel === 'era') eraShown += 1;
      if (triggered) this.pendingQueue.push({ def: ev, kind: 'event' });
      else triggered = pending;
    }

    // 反思节点：到岁数必须停一次。今年已有大抉择，就排在抉择之后。
    //
    // 以前这里是 `else if (pendingQueue.length === 0)`：队列里只要还压着东西，
    // 这个"到岁数必须停一次"的节点就被悄悄跳过。现在事件也会进队列（见上），
    // 所以改成无条件入队——宁可多停一次，也不要吞掉一个设计上必出的节点。
    if (this.reflectionsOn && !this.reflectionsFired.has(this.age)) {
      const reflection = reflectionFor(this.age);
      if (reflection) {
        this.reflectionsFired.add(this.age);
        const def = this.reflectionEventDef(reflection);
        if (!triggered) triggered = this.trigger(def, 'reflection');
        else this.pendingQueue.push({ def, kind: 'reflection' });
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
    // 「活了 X 天」必须和「享年 X 岁」对得上。
    // 以前死亡日期被硬编码成当年 6 月 15 日，于是 67 岁的人算出来的天数
    // 可能只对应 66 岁半——玩家乘一下 365 就会发现这两个数在互相打架。
    // 现在直接用年龄换算：一年按 365.2425 天，两个数字永远自洽。
    this.death = {
      year: this.year,
      age: this.age,
      daysLived: Math.max(1, Math.round(this.age * 365.2425)),
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

  /**
   * 触发一个事件：记流水、判窗口、算选项。
   *
   * `defer` 只算"这一步会发生什么"，不占用当前弹窗位——给 tick 里"今年名额
   * 已用完、需要顺延"的情况用。真正弹出时会再走一次这里，因为中间玩家可能
   * 已经做过一次抉择，选项的解锁状态要按最新的五维重算。
   */
  /**
   * 事件属于哪条通道。
   *
   * `life` = 落在你自己身上的人生节点，`era` = 外面发生的事。
   * `conditional` 按触发器分流：按年龄触发的是"落在你身上的事"（拆迁、征地、
   * 灵活就业），按年份触发的是"那年的大事"（双减、比特币）。
   */
  private channelOf(event: EventDef): DecisionChannel {
    if (event.layer === 'stage') return 'life';
    if (event.layer === 'era') return 'era';
    return event.trigger.type === 'age' ? 'life' : 'era';
  }

  /**
   * 人生节点排在时代事件前面。
   *
   * 同一年里，先讲你自己，再讲外面。`findDueEvents` 只按 ledgerWeight 排序，
   * 而 era 的权重普遍 4–6、stage 只有 2–4，于是人生节点永远排在时代事件后面
   * ——上一轮"结婚被房改挤掉"就是这个排序的产物。
   */
  private sortByChannel(events: readonly EventDef[]): EventDef[] {
    const rank = (ev: EventDef): number => (this.channelOf(ev) === 'life' ? 0 : 1);
    return [...events].sort(
      (a, b) => rank(a) - rank(b) || b.ledgerWeight - a.ledgerWeight || a.id.localeCompare(b.id),
    );
  }

  private trigger(event: EventDef, kind: PendingEvent['kind'] = 'event', defer = false): PendingEvent | null {
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
    //
    // `ledgerWeight === 0` 是"这件事不是时代窗口，别记进账本"的显式标记，
    // 用于童年记忆和晚年日常（2008 年奥运会、2020 年扫码进菜场）。
    // 它们当然也是"时代"，但要是记进账本，`hitRate` 和 `earlyHits` 会被它们
    // 顶起来——实测加完 19 条新内容后 caught 从 8.0 跳到 9.3，
    // 「少年得志」「赶上每一次浪潮」直接失衡，而这两个称号讲的是
    // 恢复高考、房改、入世那种"决定了一辈子走向"的窗口。
    const worthLedger =
      judgement.verdict !== 'passedBy' || event.ledgerWeight >= 4 || judgement.gapMonths <= 24;
    if (event.layer === 'era' && event.ledgerWeight > 0 && worthLedger) {
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

    const pending: PendingEvent = { event, judgement: { ...judgement, verdict }, text, choices, kind };
    if (defer) return pending;
    this.pending = pending;
    this.phase = 'awaitingChoice';
    return this.pending;
  }

  /**
   * 播报级的人生阶段事件：按 default 选项把后果结算掉。
   *
   * `default: true` 在数据里本来就是"没人特意去选、但日子会往这边走"的那一项，
   * 正好用来承接"这件事发生了，只是没让玩家停下来拍板"。
   *
   * 概率型选项不掷骰子，取第一个分支：播报级事件不该再消耗随机流，
   * 否则同一个种子会因为某条事件是否降级而整条时间线错位。
   */
  private settleSilently(event: EventDef): void {
    const def = event.choices.find((c) => c.default) ?? event.choices[0];
    if (!def) return;
    let effects = def.effects;
    const setFlags = [...(def.setFlags ?? [])];
    if (def.probability && def.probability.length > 0) {
      const first = def.probability[0]!;
      effects = mergeEffects(def.effects, first.effects);
      setFlags.push(...(first.setFlags ?? []));
    }
    if (effects) {
      // 软边结算：播报级事件是慢慢渗进来的日常，不是一次拍板，
      // 所以走 applySoftEffects（越接近上下限越推不动），而不是硬加减。
      this.stats = applySoftEffects(this.stats, scaleEffects(effects, SILENT_SETTLE_SCALE));
    }
    const before = new Set(this.flags);
    for (const f of def.clearFlags ?? []) this.flags = this.flags.filter((x) => x !== f);
    for (const f of setFlags) if (!this.flags.includes(f)) this.flags.push(f);
    for (const f of setFlags) if (!this.flagYears.has(f)) this.flagYears.set(f, this.year);
    // 婚姻/孩子这类 flag 会真的改变家庭结构，必须走同一条路，
    // 否则「生孩子」结算了 child_born 却没有孩子出现在家人栏里。
    this.syncFamily(setFlags);
    for (const f of setFlags) {
      if (before.has(f)) continue;
      if (f === 'relocated') this.counters.moves += 1;
      if (f === 'self_employed') {
        this.counters.startups += 1;
        this.counters.jobChanges += 1;
      }
      if (f === 'stable_job' || f === 'vocational') this.counters.jobChanges += 1;
    }
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
