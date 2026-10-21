import { TITLES } from '../data/titles';
import type { GameSnapshot } from './game';
import { summarizeLedger } from './ledger';
import { gapText } from './window';
import { TIER_ORDER, type Ending, type EndingAggregate, type Gender, type LedgerEntry } from './types';

export function buildAggregate(s: GameSnapshot): EndingAggregate {
  const sum = summarizeLedger(s.ledger);
  const snaps = s.snapshots;

  const wealths = snaps.map((x) => x.stats.wealth);
  const wealthMean = wealths.length > 0 ? wealths.reduce((a, b) => a + b, 0) / wealths.length : s.stats.wealth;
  const wealthVariance =
    wealths.length > 0 ? wealths.reduce((a, b) => a + (b - wealthMean) ** 2, 0) / wealths.length : 0;

  const happinessAvg =
    snaps.length > 0 ? snaps.reduce((a, b) => a + b.happiness, 0) / snaps.length : s.stats.happiness;

  const best = snaps.reduce(
    (acc, x) => (x.happiness > acc.happiness ? x : acc),
    snaps[0] ?? { year: s.birth.year, age: 0, happiness: 0, stats: s.stats },
  );

  return {
    deathAge: s.death?.age ?? s.age,
    cohortLifeExpectancy: s.birth.cohortLifeExpectancy,
    birthTierRank: Math.max(0, TIER_ORDER.indexOf(s.birth.tier)),
    finalWealth: s.stats.wealth,
    bestWealth: Math.max(s.stats.wealth, ...wealths, 0),
    happinessAvg,
    familyFinal: s.stats.family,
    caught: sum.caught,
    nearMiss: sum.nearMiss,
    passedBy: sum.passedBy,
    hitRate: sum.hitRate,
    lastTrainHits: s.counters.lastTrainHits,
    earlyHits: s.ledger.filter((e) => e.verdict === 'caught' && e.age <= 35).length,
    lateHits: s.ledger.filter((e) => e.verdict === 'caught' && e.age >= 40).length,
    jobChanges: s.counters.jobChanges,
    moves: s.counters.moves,
    startups: s.counters.startups,
    wealthVariance,
    defaultChoiceRatio: s.counters.choices === 0 ? 0 : s.counters.defaultChoices / s.counters.choices,
    migrated: s.counters.moves > 0,
    bestYear: best.year,
  };
}

export function evaluateEnding(s: GameSnapshot): Ending {
  const aggregate = buildAggregate(s);
  const title = TITLES.find((t) => t.test(aggregate)) ?? TITLES[TITLES.length - 1]!;
  return {
    title,
    headline: pickHeadline(s.ledger, s.birth.gender),
    subtitle: pickSubtitle(s.ledger),
    aggregate,
  };
}

const PRONOUN: Record<Gender, string> = { male: '他', female: '她' };

/** 主标题：差一年型优先，评分 = 边缘接近度 × ledgerWeight */
export function pickHeadline(ledger: readonly LedgerEntry[], gender: Gender): string {
  const pronoun = PRONOUN[gender];

  const near = [...ledger]
    .filter((e) => e.verdict === 'nearMiss')
    .sort((a, b) => b.weight * 100 - b.gapMonths - (a.weight * 100 - a.gapMonths))[0];
  if (near) return `${pronoun}离${near.title}，只差了 ${gapText(near.gapMonths)}。`;

  const lastTrain = [...ledger]
    .filter((e) => e.lastTrain && e.verdict === 'caught')
    .sort((a, b) => b.weight - a.weight)[0];
  if (lastTrain) return `${pronoun}是最后一批赶上${lastTrain.title}的人。`;

  const caught = [...ledger].filter((e) => e.verdict === 'caught').sort((a, b) => b.weight - a.weight)[0];
  if (caught) return `${pronoun}赶上了${caught.title}。`;

  const passed = [...ledger].sort((a, b) => b.weight - a.weight)[0];
  if (passed) return `${pronoun}路过${passed.title}那年，${passed.age} 岁。`;

  return `${pronoun}这一生，没赶上什么大的浪。`;
}

export function pickSubtitle(ledger: readonly LedgerEntry[]): string {
  const caught = ledger.filter((e) => e.verdict === 'caught').map((e) => e.title);
  const missed = ledger.filter((e) => e.verdict !== 'caught').map((e) => e.title);
  const parts: string[] = [];
  if (caught.length > 0) parts.push(`赶上了${caught.slice(0, 2).join('和')}`);
  if (missed.length > 0) parts.push(`错过了${missed.slice(0, 2).join('和')}`);
  return parts.length > 0 ? `${parts.join('，')}。` : '这一生没什么大起大落。';
}
