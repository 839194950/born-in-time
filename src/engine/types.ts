/** 生年范围：1958–2005。规格原文是 1977–2002，2026-10 按用户要求放宽，见 docs/实现偏离规格清单.md */
export const YEAR_FROM = 1958;
export const YEAR_TO = 2005;
export const STAT_MIN = 0;
export const STAT_MAX = 100;

export type StatKey = 'health' | 'ability' | 'wealth' | 'family' | 'happiness';
export type Stats = Record<StatKey, number>;
export const STAT_KEYS: readonly StatKey[] = ['health', 'ability', 'wealth', 'family', 'happiness'];

export type Gender = 'male' | 'female';
export type Urban = 'urban' | 'rural';
export type Tier = 'destitute' | 'poor' | 'normal' | 'wellOff' | 'rich';
export const TIER_ORDER: readonly Tier[] = ['destitute', 'poor', 'normal', 'wellOff', 'rich'];

/** 赶上 / 差一年 / 路过 */
export type Verdict = 'caught' | 'nearMiss' | 'passedBy';

export type Layer = 'era' | 'stage' | 'conditional';

export type Stage = 'infant' | 'child' | 'student' | 'work' | 'midlife' | 'elder';

export type JobId =
  | 'farmer'
  | 'worker'
  | 'teacher'
  | 'cadre'
  | 'soldier'
  | 'shopclerk'
  | 'selfEmployed'
  | 'townshipWorker'
  | 'merchant'
  | 'entrepreneur'
  | 'migrant'
  | 'officeWorker'
  | 'programmer';

export type OutfitId =
  | 'school'
  | 'farm'
  | 'factory'
  | 'armycoat'
  | 'suit'
  | 'whitecoat'
  | 'casual'
  | 'pajamas';

export type FamilyRole = 'self' | 'father' | 'mother' | 'spouse' | 'child' | 'sibling';

export interface Birth {
  year: number;
  /** 1–12，窗口判定用它算出“差 N 个月” */
  month: number;
  province: string;
  urban: boolean;
  gender: Gender;
  name: string;
  fatherJob: JobId;
  motherJob: JobId;
  tier: Tier;
  siblings: number;
  /** 出生当年城镇化率，0–1 */
  urbanizationRate: number;
  cohortLifeExpectancy: number;
}

export interface Requirement {
  statMin?: Partial<Stats>;
  statMax?: Partial<Stats>;
  flags?: string[];
  notFlags?: string[];
  tierIn?: Tier[];
  urban?: boolean;
}

/** 选项的时代开关：解锁年 / 取消年，以及置灰时说的话 */
export interface OptionGate {
  unlockYear?: number;
  removeYear?: number;
  unlockText?: string;
  removedText?: string;
}

export interface WeightedOutcome {
  p: number;
  outcome: string;
  effects?: Partial<Stats>;
  setFlags?: string[];
}

export interface ChoiceDef {
  id: string;
  label: string;
  requires?: Requirement;
  lockedText?: string;
  effects?: Partial<Stats>;
  outcome: string;
  setFlags?: string[];
  clearFlags?: string[];
  gate?: OptionGate;
  probability?: WeightedOutcome[];
  /** 随大流项，用于“被时代推着走的人”判定 */
  default?: boolean;
  lastTrain?: boolean;
}

export type EventTrigger = { type: 'year'; year: number } | { type: 'age'; age: number };

export interface EventDef {
  id: string;
  layer: Layer;
  trigger: EventTrigger;
  windowAge: [number, number];
  edgeYears?: number;
  secondWindowAge?: [number, number];
  conditions?: Requirement;
  title: string;
  body: string;
  variants?: { urban?: string; rural?: string };
  choices: ChoiceDef[];
  ledgerWeight: number;
  source: string;
  lastTrain?: boolean;
  broadcast?: boolean;
}

export interface WindowJudgement {
  verdict: Verdict;
  /** 事件发生当年的周岁（整年） */
  age: number;
  ageMonths: number;
  /** 距最近窗口边界的月数，赶上时为 0 */
  gapMonths: number;
}

export interface LedgerEntry {
  eventId: string;
  title: string;
  year: number;
  age: number;
  verdict: Verdict;
  gapMonths: number;
  weight: number;
  lastTrain: boolean;
  choiceId?: string;
  choiceLabel?: string;
}

export interface YearSnapshot {
  year: number;
  age: number;
  happiness: number;
  stats: Stats;
}

export type TimelineKind = 'event' | 'broadcast' | 'milestone';

export interface TimelineEntry {
  year: number;
  age: number;
  kind: TimelineKind;
  text: string;
}

export interface FamilyMember {
  role: FamilyRole;
  name: string;
  birthYear: number;
  deathYear?: number;
}

export interface DeathInfo {
  year: number;
  age: number;
  daysLived: number;
}

/** 四轴：陪伴–工作 / 根–风 / 平静–浪潮 / 今天–明天 */
export type AxisKey = 'companion' | 'work' | 'root' | 'wind' | 'calm' | 'wave' | 'now' | 'future';
export type AxisDelta = Partial<Record<AxisKey, number>>;

export interface FocusOption {
  id: string;
  label: string;
  effects: Partial<Stats>;
  axes: AxisDelta;
}

export interface EndingAggregate {
  deathAge: number;
  cohortLifeExpectancy: number;
  /** 0–4：赤贫 / 贫困 / 普通 / 小康 / 富裕 */
  birthTierRank: number;
  finalWealth: number;
  bestWealth: number;
  happinessAvg: number;
  familyFinal: number;
  caught: number;
  nearMiss: number;
  passedBy: number;
  hitRate: number;
  lastTrainHits: number;
  earlyHits: number;
  lateHits: number;
  jobChanges: number;
  moves: number;
  startups: number;
  wealthVariance: number;
  defaultChoiceRatio: number;
  migrated: boolean;
  bestYear: number;
}

export interface TitleDef {
  id: string;
  name: string;
  /** 12 = 最稀有，1 = 兜底 */
  rarity: number;
  test: (a: EndingAggregate) => boolean;
  blurb: (a: EndingAggregate) => string;
}

export interface Ending {
  title: TitleDef;
  headline: string;
  subtitle: string;
  aggregate: EndingAggregate;
}
