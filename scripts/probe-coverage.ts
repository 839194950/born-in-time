import { Game, CONTINUE_CHOICE_ID } from '../src/engine/game';
import { evaluateEnding } from '../src/engine/ending';
import { rollBirth } from '../src/engine/birth';
import { createRng } from '../src/engine/rng';
import { ALL_EVENTS } from '../src/data/events';

interface RunRow {
  seed: number;
  birthYear: number;
  decisions: number;
  eventDecisions: number;
  caught: number;
  nearMiss: number;
  passedBy: number;
  deathAge: number;
  cohortLE: number;
  title: string;
  firedEra: string[];
  finalStats: Record<string, number>;
}

function play(seed: number, birthYear?: number): RunRow {
  let game: Game;
  if (birthYear === undefined) {
    game = new Game({ seed });
  } else {
    // 强制某一年出生：用同一 RNG 连续抽直到命中，保证其它维度仍随机
    let s = seed;
    let birth = rollBirth(createRng(s));
    let guard = 0;
    while (birth.year !== birthYear && guard++ < 4000) {
      s = (s * 1103515245 + 12345) >>> 0;
      birth = rollBirth(createRng(s));
    }
    game = new Game({ seed: s, birth });
  }
  game.start();
  let guard = 0;
  let eventDecisions = 0;
  while (game.snapshot.phase !== 'dead' && guard++ < 400) {
    const snap = game.snapshot;
    if (snap.phase === 'awaitingChoice') {
      const pending = snap.pendingEvent!;
      if (pending.kind === 'event') eventDecisions += 1;
      const pick = pending.choices.find((c) => c.state === 'available');
      game.resolve(pick ? pick.id : CONTINUE_CHOICE_ID);
    } else {
      game.tick();
    }
  }
  const snap = game.snapshot;
  const ending = evaluateEnding(snap);
  return {
    seed,
    birthYear: snap.birth.year,
    decisions: snap.counters.choices,
    eventDecisions,
    caught: ending.aggregate.caught,
    nearMiss: ending.aggregate.nearMiss,
    passedBy: ending.aggregate.passedBy,
    deathAge: ending.aggregate.deathAge,
    cohortLE: ending.aggregate.cohortLifeExpectancy,
    title: ending.title.name,
    firedEra: snap.ledger.map((e) => e.eventId),
    finalStats: snap.stats as unknown as Record<string, number>,
  };
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// ---------- 1) 总量分布（2000 局） ----------
const N = 2000;
const rows: RunRow[] = [];
for (let i = 0; i < N; i++) rows.push(play(i + 1));

const decisions = rows.map((r) => r.decisions).sort((a, b) => a - b);
const q = (p: number) => decisions[Math.floor(p * (decisions.length - 1))];

console.log('# 1. 一局抉择总量（%d 局）', N);
console.log(
  `  平均 ${mean(rows.map((r) => r.decisions)).toFixed(1)} / 中位 ${q(0.5)} / P10 ${q(0.1)} / P90 ${q(0.9)} / 最大 ${decisions[decisions.length - 1]}`,
);
console.log(`  其中"目录事件"抉择平均 ${mean(rows.map((r) => r.eventDecisions)).toFixed(1)} 个`);

const delta = rows.map((r) => r.deathAge - r.cohortLE);
console.log('\n# 2. 寿命与队列预期寿命之差');
console.log(`  平均 ${mean(delta).toFixed(2)} 年 / 最差 ${Math.min(...delta).toFixed(1)} / 最好 ${Math.max(...delta).toFixed(1)}`);
console.log(`  活得比同龄人长的比例：${pct(delta.filter((d) => d > 0).length / N)}`);
console.log(`  差 ≥ +2 年：${pct(delta.filter((d) => d >= 2).length / N)}；≥ +5 年：${pct(delta.filter((d) => d >= 5).length / N)}`);

// ---------- 2) 称号分布 ----------
const titleCount = new Map<string, number>();
for (const r of rows) titleCount.set(r.title, (titleCount.get(r.title) ?? 0) + 1);
console.log('\n# 3. 命型称号分布');
[...titleCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${pct(v / N).padStart(6)}  ${k}`));
const allTitles = 12;
console.log(`  实际出现 ${titleCount.size} / ${allTitles} 种`);

// ---------- 3) 五维终值分布 ----------
console.log('\n# 4. 五维终值（均值 / 贴顶贴底比例）');
for (const key of ['health', 'ability', 'wealth', 'family', 'happiness']) {
  const vals = rows.map((r) => r.finalStats[key]);
  const sat = vals.filter((v) => v >= 95 || v <= 5).length / N;
  console.log(`  ${key.padEnd(10)} 均值 ${mean(vals).toFixed(1).padStart(5)}  极值占比 ${pct(sat)}`);
}

// ---------- 4) 按出生年份看内容覆盖 ----------
console.log('\n# 5. 分出生年份内容覆盖（每年 30 局）');
const byYear = new Map<number, RunRow[]>();
for (let y = 1958; y <= 2005; y++) {
  const bucket: RunRow[] = [];
  for (let k = 0; k < 30; k++) bucket.push(play(90000 + y * 100 + k, y));
  byYear.set(y, bucket);
}
const summary: string[] = [];
for (const [y, bucket] of byYear) {
  const caught = mean(bucket.map((r) => r.caught));
  const near = mean(bucket.map((r) => r.nearMiss));
  const pass = mean(bucket.map((r) => r.passedBy));
  const dec = mean(bucket.map((r) => r.eventDecisions));
  summary.push(`${y}  赶上${caught.toFixed(1)}  差${near.toFixed(1)}  过${pass.toFixed(1)}  事件抉择${dec.toFixed(1)}`);
}
console.log(summary.join('\n'));

// ---------- 5) era 事件覆盖率 ----------
console.log('\n# 6. 时代事件（era）在 2000 局中的出场率');
const eraEvents = ALL_EVENTS.filter((e) => e.layer === 'era');
for (const ev of eraEvents) {
  const hit = rows.filter((r) => r.firedEra.includes(ev.id)).length;
  console.log(`  ${pct(hit / N).padStart(6)}  ${ev.id}  (${ev.title})`);
}
