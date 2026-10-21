import { urbanizationRate, cohortLifeExpectancy } from '../data/demography';
import { rollBirth } from './birth';
import { deriveCareer } from './career';
import { evaluateEnding } from './ending';
import { defaultFocusFor } from './focus';
import { CONTINUE_CHOICE_ID, Game } from './game';
import { createRng } from './rng';
import type { Birth, Stats } from './types';

/**
 * 同年对照组：和玩家同一年出生、但城乡与家境不同的另外三个人。
 * 他们的一生在后台用同一套引擎自动过完（抉择策略带一点随机和“随大流”
 * 倾向，三个人各不相同）。玩家进行中能看到他们活到哪了，
 * 结局出一张四人对照表——同一年生，命差多少，一眼看完。
 */
export interface PeerResult {
  birth: Birth;
  deathAge: number;
  deathYear: number;
  titleName: string;
  finalStats: Stats;
  caught: number;
  nearMiss: number;
  passedBy: number;
  bestYear: number;
  careerLine: string;
  topInterest: { label: string; level: number } | null;
  /** 逐年幸福（进行中状态条按年查） */
  yearly: { year: number; age: number; happiness: number }[];
}

const PEER_COUNT = 3;

function rollSameYearBirth(rng: ReturnType<typeof createRng>, year: number): Birth {
  for (let i = 0; i < 600; i++) {
    const b = rollBirth(rng);
    if (b.year === year) return b;
  }
  // 实在抽不到同年：拿最后一个改年份，并把随年份走的派生字段补正
  const b = rollBirth(rng);
  return {
    ...b,
    year,
    urbanizationRate: urbanizationRate(year),
    cohortLifeExpectancy: cohortLifeExpectancy(year, b.urban),
  };
}

function diversityScore(candidate: Birth, player: Birth, picked: readonly Birth[]): number {
  let score = 0;
  if (candidate.urban !== player.urban) score += 2;
  if (candidate.tier !== player.tier) score += 1;
  if (candidate.gender !== player.gender) score += 0.5;
  for (const p of picked) {
    if (candidate.urban !== p.urban) score += 0.8;
    if (candidate.tier !== p.tier) score += 0.5;
  }
  return score;
}

function playPeer(birth: Birth, seed: number): PeerResult {
  const game = Game.fromBirth(birth, seed);
  const policy = createRng((seed ^ 0x51ab3) >>> 0);
  game.start();
  let lastStage = game.snapshot.stage;
  let guard = 0;
  while (game.snapshot.phase !== 'dead' && guard++ < 800) {
    const snap = game.snapshot;
    if (snap.phase === 'awaitingChoice') {
      const pending = snap.pendingEvent!;
      const available = pending.choices.filter((c) => c.state === 'available');
      if (available.length === 0) {
        game.resolve(CONTINUE_CHOICE_ID);
        continue;
      }
      const defaultPick = available.find(
        (c) => pending.event.choices.find((d) => d.id === c.id)?.default === true,
      );
      const pick =
        defaultPick && policy.chance(0.65)
          ? defaultPick
          : available[policy.int(0, available.length - 1)]!;
      game.resolve(pick.id);
    } else {
      if (snap.stage !== lastStage) {
        lastStage = snap.stage;
        const def = defaultFocusFor(snap.stage);
        if (def) game.setFocus(def);
      } else if (snap.focusOptions.length > 0 && policy.chance(0.08)) {
        game.setFocus(snap.focusOptions[policy.int(0, snap.focusOptions.length - 1)]!.id);
      }
      game.tick();
    }
  }
  const snap = game.snapshot;
  const ending = evaluateEnding(snap);
  const agg = ending.aggregate;
  // 对照表里展示的是他一生主要在做的事（50 岁时的职业），不是人人一样的退休金
  const midCareer = deriveCareer(snap.flags, Math.min(50, snap.age), birth.urban);
  return {
    birth,
    deathAge: agg.deathAge,
    deathYear: birth.year + agg.deathAge,
    titleName: ending.title.name,
    finalStats: { ...snap.stats },
    caught: agg.caught,
    nearMiss: agg.nearMiss,
    passedBy: agg.passedBy,
    bestYear: agg.bestYear,
    careerLine: `职业：${midCareer.label}`,
    topInterest: agg.topInterest,
    yearly: snap.snapshots.map((y) => ({ year: y.year, age: y.age, happiness: y.happiness })),
  };
}

const cache = new Map<string, PeerResult[]>();

/** 生成（或取缓存的）对照组。同一种子同一出生永远同一组人。 */
export function simulatePeers(playerBirth: Birth, gameSeed: number): PeerResult[] {
  const key = `${gameSeed}:${playerBirth.year}:${playerBirth.name}:${playerBirth.month}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rng = createRng((gameSeed * 31 + 7919) >>> 0);
  const candidates: Birth[] = [];
  for (let i = 0; i < 24; i++) candidates.push(rollSameYearBirth(rng, playerBirth.year));

  const picked: Birth[] = [];
  const pool = [...candidates];
  while (picked.length < PEER_COUNT && pool.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      const s = diversityScore(c, playerBirth, picked) + rng.next() * 0.3;
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    });
    picked.push(pool.splice(bestIdx, 1)[0]!);
  }

  const peers = picked.map((birth, i) => playPeer(birth, (gameSeed ^ (0x9e37 + i * 131)) >>> 0));
  cache.set(key, peers);
  return peers;
}
