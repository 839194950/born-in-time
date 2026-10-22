import type { TitleDef } from '../engine/types';

/**
 * 12 个命型，按稀有度从高到低排列（数组顺序即优先级，命中多个取靠前的）。
 * 判语口径见规格 §10：只陈述际遇，不下价值判断。
 */
export const TITLES: readonly TitleDef[] = [
  {
    id: 'always_one_year_short',
    name: '每次都差一年的人',
    rarity: 12,
    test: (a) => a.nearMiss >= 5,
    blurb: (a) => `他${a.nearMiss}次站在门口，门都在他面前一步关上。`,
  },
  {
    id: 'caught_every_wave',
    name: '赶上每一次浪潮的人',
    rarity: 11,
    test: (a) => a.caught >= 4 && a.hitRate >= 0.7,
    blurb: () => '浪来的时候，他都在水里。',
  },
  {
    id: 'last_train',
    name: '最后一班车的人',
    rarity: 10,
    test: (a) => a.lastTrainHits >= 2 || (a.lastTrainHits >= 1 && a.caught >= 6),
    blurb: () => '门关之前，他挤了进去。',
  },
  {
    id: 'comeback',
    name: '逆袭的人',
    rarity: 9,
    test: (a) => a.birthTierRank <= 1 && a.finalWealth >= 66,
    blurb: () => '起点排在很后面，终点排在很前面。',
  },
  {
    id: 'high_start_low_end',
    name: '高开低走的人',
    rarity: 8,
    test: (a) => a.birthTierRank >= 3 && a.finalWealth < 52,
    blurb: () => '牌打得不差，只是他赶上的浪，一次比一次小。',
  },
  {
    id: 'young_success',
    name: '少年得志',
    rarity: 7,
    test: (a) => a.earlyHits >= 6 && a.earlyHits >= a.lateHits * 2 + 2,
    blurb: () => '他最好的那几年，来得很早。',
  },
  {
    id: 'late_bloomer',
    name: '大器晚成',
    rarity: 6,
    test: (a) => a.lateHits >= 2 && a.lateHits >= a.earlyHits,
    blurb: () => '他的运气来得晚，但到底来了。',
  },
  {
    id: 'restless',
    name: '折腾的人',
    rarity: 5,
    test: (a) => a.jobChanges + a.moves + a.startups >= 2 && a.wealthVariance >= 200,
    blurb: () => '他换过很多条路，每条都走了一段。',
  },
  {
    id: 'one_city',
    name: '守一座城的人',
    rarity: 4,
    // v1 要求 moves===0，但 migrant 把"打工"也算迁徙，几乎人手一次 → 0% 命中。
    // 现在 moves 只记真正迁出原籍（见 game.ts resolve 的 relocated），判据放宽到"换过至多一份工作"
    test: (a) => a.moves === 0 && a.jobChanges <= 1,
    blurb: () => '他一辈子没离开过那座城。',
  },
  {
    id: 'small_life',
    name: '过小日子的人',
    rarity: 3,
    test: (a) => a.hitRate >= 0.25 && a.hitRate <= 0.65 && a.happinessAvg >= 54 && a.familyFinal >= 55,
    blurb: () => '没什么大事发生，日子一天一天过下来了。',
  },
  {
    id: 'ten_years_more',
    name: '比同龄人多活十年的人',
    rarity: 2,
    // 阈值回到规格原文 +10。v1 曾把它降到 +1.5 迁就分布，结果既让称号名撒谎、又仍是 0%。
    // 正解是打开上尾（healthDecay 减半 + healthBand 回血 + longevityTail 最长 +8），
    // 让"常年养生"成为一种可经营的 build，+10 才既可达又稀有。
    test: (a) => a.deathAge >= a.cohortLifeExpectancy + 10,
    blurb: (a) => `同一年出生的人大多停在了${a.cohortLifeExpectancy}岁，他走到了${a.deathAge}岁。`,
  },
  {
    id: 'pushed_by_times',
    name: '被时代推着走的人',
    rarity: 1,
    test: () => true,
    blurb: () => '时代的浪往哪边推，他就往哪边走。',
  },
];
