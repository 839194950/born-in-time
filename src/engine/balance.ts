import { evaluateEnding } from './ending';
import { CONTINUE_CHOICE_ID, Game } from './game';
import type { Stats } from './types';

export interface BatchRow {
  seed: number;
  choices: number;
  caught: number;
  nearMiss: number;
  passedBy: number;
  hitRate: number;
  earlyHits: number;
  lateHits: number;
  jobChanges: number;
  moves: number;
  lastTrainHits: number;
  titleId: string;
  titleName: string;
  deathAge: number;
  deathDelta: number;
  finalStats: Stats;
}

/**
 * 机器人策略。
 * - `first`：永远选第一个可用项（默认，代表"随大流"的玩家）
 * - `health`：每年把重心切到最养生的那项（代表"刻意为长寿经营"的玩家）
 *
 * 两条曲线一起看才有意义：某个称号在 first 上为 0、在 health 上可达，
 * 说明它是"可经营的 build"，而不是"随机抽奖"。
 */
export type BotStrategy = 'first' | 'health';

/** 用机器人跑完一局，用来观察数值与节奏 */
export function runOne(seed: number, strategy: BotStrategy = 'first'): BatchRow {
  const game = new Game({ seed });
  game.start();

  let guard = 0;
  while (game.snapshot.phase !== 'dead' && guard++ < 300) {
    const snap = game.snapshot;
    if (strategy === 'health' && snap.focusOptions.length > 0) {
      const best = snap.focusOptions.reduce((a, b) =>
        (b.effects.health ?? 0) > (a.effects.health ?? 0) ? b : a,
      );
      if (best && snap.focusId !== best.id) game.setFocus(best.id);
    }
    if (snap.phase === 'awaitingChoice') {
      const pick = snap.pendingEvent?.choices.find((c) => c.state === 'available');
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      game.tick();
    }
  }

  const snap = game.snapshot;
  const ending = evaluateEnding(snap);
  return {
    seed,
    choices: snap.counters.choices,
    caught: ending.aggregate.caught,
    nearMiss: ending.aggregate.nearMiss,
    passedBy: ending.aggregate.passedBy,
    hitRate: ending.aggregate.hitRate,
    earlyHits: ending.aggregate.earlyHits,
    lateHits: ending.aggregate.lateHits,
    jobChanges: ending.aggregate.jobChanges,
    moves: ending.aggregate.moves,
    lastTrainHits: ending.aggregate.lastTrainHits,
    titleId: ending.title.id,
    titleName: ending.title.name,
    deathAge: ending.aggregate.deathAge,
    deathDelta: ending.aggregate.deathAge - ending.aggregate.cohortLifeExpectancy,
    finalStats: snap.stats,
  };
}

export function runBatch(count: number, seed0 = 1, strategy: BotStrategy = 'first'): BatchRow[] {
  return Array.from({ length: count }, (_, i) => runOne(seed0 + i, strategy));
}

export interface BatchSummary {
  count: number;
  avgChoices: number;
  avgDeathAge: number;
  avgCaught: number;
  avgNearMiss: number;
  avgPassedBy: number;
  avgHitRate: number;
  avgEarlyHits: number;
  avgLateHits: number;
  avgJobChanges: number;
  avgMoves: number;
  avgDeathDelta: number;
  maxDeathDelta: number;
  lastTrainShare: number;
  titleShare: Record<string, number>;
  saturatedShare: number;
}

export function summarizeBatch(rows: readonly BatchRow[]): BatchSummary {
  const titleCount = new Map<string, number>();
  let choices = 0;
  let age = 0;
  let saturated = 0;
  let statCells = 0;
  let caught = 0;
  let nearMiss = 0;
  let passedBy = 0;
  let hitRate = 0;
  let earlyHits = 0;
  let lateHits = 0;
  let jobChanges = 0;
  let moves = 0;
  let deathDelta = 0;
  let maxDeathDelta = -99;
  let anyLastTrain = 0;
  let twoLastTrain = 0;

  for (const row of rows) {
    titleCount.set(row.titleName, (titleCount.get(row.titleName) ?? 0) + 1);
    choices += row.choices;
    age += row.deathAge;
    caught += row.caught;
    nearMiss += row.nearMiss;
    passedBy += row.passedBy;
    hitRate += row.hitRate;
    earlyHits += row.earlyHits;
    lateHits += row.lateHits;
    jobChanges += row.jobChanges;
    moves += row.moves;
    deathDelta += row.deathDelta;
    maxDeathDelta = Math.max(maxDeathDelta, row.deathDelta);
    if (row.lastTrainHits >= 1) anyLastTrain++;
    if (row.lastTrainHits >= 2) twoLastTrain++;
    for (const value of Object.values(row.finalStats)) {
      statCells++;
      if (value > 95 || value < 5) saturated++;
    }
  }

  const n = Math.max(1, rows.length);
  const titleShare: Record<string, number> = {};
  for (const [name, c] of titleCount) titleShare[name] = c / n;

  return {
    count: rows.length,
    avgChoices: choices / n,
    avgDeathAge: age / n,
    avgCaught: caught / n,
    avgNearMiss: nearMiss / n,
    avgPassedBy: passedBy / n,
    avgHitRate: hitRate / n,
    avgEarlyHits: earlyHits / n,
    avgLateHits: lateHits / n,
    avgJobChanges: jobChanges / n,
    avgMoves: moves / n,
    avgDeathDelta: deathDelta / n,
    maxDeathDelta,
    lastTrainShare: twoLastTrain / n,
    titleShare,
    saturatedShare: statCells === 0 ? 0 : saturated / statCells,
  };
}
