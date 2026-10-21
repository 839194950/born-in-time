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
    test: (a) => a.nearMiss >= 3,
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
    test: (a) => a.lastTrainHits >= 2,
    blurb: () => '门关之前，他挤了进去。',
  },
  {
    id: 'comeback',
    name: '逆袭的人',
    rarity: 9,
    test: (a) => a.birthTierRank <= 1 && a.finalWealth >= 80,
    blurb: () => '起点排在很后面，终点排在很前面。',
  },
  {
    id: 'high_start_low_end',
    name: '高开低走的人',
    rarity: 8,
    test: (a) => a.birthTierRank >= 3 && a.finalWealth < 50,
    blurb: () => '牌打得不差，只是他赶上的浪，一次比一次小。',
  },
  {
    id: 'young_success',
    name: '少年得志',
    rarity: 7,
    test: (a) => a.caught >= 3 && a.earlyHits / a.caught >= 0.75,
    blurb: () => '他最好的那几年，来得很早。',
  },
  {
    id: 'late_bloomer',
    name: '大器晚成',
    rarity: 6,
    test: (a) => a.caught >= 3 && a.lateHits / a.caught >= 0.75,
    blurb: () => '他的运气来得晚，但到底来了。',
  },
  {
    id: 'restless',
    name: '折腾的人',
    rarity: 5,
    test: (a) => a.jobChanges + a.moves + a.startups >= 4 && a.wealthVariance >= 200,
    blurb: () => '他换过很多条路，每条都走了一段。',
  },
  {
    id: 'one_city',
    name: '守一座城的人',
    rarity: 4,
    test: (a) => a.moves === 0 && a.jobChanges <= 1,
    blurb: () => '他一辈子没离开过那座城。',
  },
  {
    id: 'small_life',
    name: '过小日子的人',
    rarity: 3,
    test: (a) => a.hitRate >= 0.3 && a.hitRate <= 0.6 && a.happinessAvg >= 60 && a.familyFinal >= 65,
    blurb: () => '没什么大事发生，日子一天一天过下来了。',
  },
  {
    id: 'ten_years_more',
    name: '比同龄人多活十年的人',
    rarity: 2,
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
