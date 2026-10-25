import type { Gender, TitleDef } from '../engine/types';

/** 判语里的第三人称。12 条判语全都以它开头，所以不能硬编码「他」。 */
const pronounOf = (gender: Gender): string => (gender === 'female' ? '她' : '他');

/**
 * 12 个命型，按稀有度从高到低排列（数组顺序即优先级，命中多个取靠前的）。
 * 判语口径见规格 §10：只陈述际遇，不下价值判断。
 */
export const TITLES: readonly TitleDef[] = [
  {
    id: 'always_one_year_short',
    name: '每次都差一年的人',
    rarity: 12,
    // 绝对阈值（nearMiss >= 5）在"带宽收到 2 年"之后已经不代表"每次"了：
    // 一生平均只有 2.4 次差一年，攒到 5 次只说明"年头够多"。
    // 换成比例判据——**你够得着的门里，四成以上都是差一点关上的**，
    // 这才是这句判词的本意。实测约 8%。
    test: (a) => {
      const windows = a.nearMiss + a.caught;
      return a.nearMiss >= 4 && windows > 0 && a.nearMiss / windows >= 0.4;
    },
    blurb: (a, g) => `${pronounOf(g)}${a.nearMiss} 次站在门口，门都在${pronounOf(g)}面前一步关上。`,
  },
  {
    id: 'caught_every_wave',
    name: '赶上每一次浪潮的人',
    rarity: 11,
    test: (a) => a.caught >= 4 && a.hitRate >= 0.7,
    blurb: (_a, g) => `浪来的时候，${pronounOf(g)}都在水里。`,
  },
  {
    id: 'last_train',
    name: '最后一班车的人',
    rarity: 10,
    test: (a) => a.lastTrainHits >= 2 || (a.lastTrainHits >= 1 && a.caught >= 6),
    blurb: (_a, g) => `门关之前，${pronounOf(g)}挤了进去。`,
  },
  {
    id: 'comeback',
    name: '逆袭的人',
    rarity: 9,
    test: (a) => a.birthTierRank <= 1 && a.finalWealth >= 66,
    blurb: (_a, g) => `起点排在很后面，终点排在很前面。这段路${pronounOf(g)}自己走完了。`,
  },
  {
    id: 'high_start_low_end',
    name: '高开低走的人',
    rarity: 8,
    // 原判据是 finalWealth < 52。但 wellOff/rich 出身的初始财富就有 83，
    // 跌到 52 以下几乎不可能（实测 0.2%）。阈值放宽到 60，让它回到"少见但存在"。
    test: (a) => a.birthTierRank >= 3 && a.finalWealth < 60,
    blurb: (_a, g) => `牌打得不差，只是${pronounOf(g)}赶上的浪，一次比一次小。`,
  },
  {
    id: 'young_success',
    name: '少年得志',
    rarity: 7,
    // 门槛 6 → 8。加完童年与中年内容之后 earlyHits 的中位数是 5、P75 是 6，
    // ">=6" 等于"比一半人多一点"——实测这条涨到 14.4%，比 rarity 9、10 的
    // 逆袭和末班车还常见。提到 8（约前 20%）之后才配得上 rarity 7。
    test: (a) => a.earlyHits >= 8 && a.earlyHits >= a.lateHits * 2 + 2,
    blurb: (_a, g) => `${pronounOf(g)}最好的那几年，来得很早。`,
  },
  {
    id: 'late_bloomer',
    name: '大器晚成',
    rarity: 6,
    // 原判据是 `lateHits >= 2 && lateHits >= earlyHits`。
    //
    // 2026-10-25 补了 40–58 岁那一带的时代内容之后（招不到人 / 四个小时 /
    // 优化 / 提前还款），中年人人都有几条 lateHits，这条判据直接涨到 23.5%，
    // 成了第二常见的称号。而它想说的是"运气来得晚"——那就得**比早年的多**，
    // 不是"跟早年一样多"。
    // 改成 `lateHits >= 3 && lateHits > earlyHits`：至少晚年赶上三回，
    // 而且比早年赶上的还多。实测 10.6%。
    // 3 → 5。lateHits 的中位数是 3、P75 是 4，"至少三回"筛不掉人（实测 9.1%，
    // 比 rarity 5 的「折腾」还常见）。提到 5（约前 10%）才配得上 rarity 6。
    test: (a) => a.lateHits >= 5 && a.lateHits > a.earlyHits,
    blurb: (_a, g) => `${pronounOf(g)}的运气来得晚，但到底来了。`,
  },
  {
    id: 'restless',
    name: '折腾的人',
    rarity: 5,
    // 门槛从 200 提到 350。
    //
    // 200 是个"看起来像个整数"的门槛，实际等于"比一半人稍微动一点"：
    // wealthVariance 的中位数就是 229（P75 302 / P90 430），
    // 所以 60% 的局都能过线。2026-10-25 加了 13 条童年事件之后
    // （童年本来就有攒钱、买铅笔盒、去北京这些财富起伏），
    // 这个称号直接涨到 34%，成了最常见的一个——而它 rarity 只有 5。
    // 提到 P75（350）之后，"折腾"才真的是大起大落，而不是"日子有一点波折"。
    test: (a) => a.jobChanges + a.moves + a.startups >= 2 && a.wealthVariance >= 350,
    blurb: (_a, g) => `${pronounOf(g)}换过很多条路，每条都走了一段。`,
  },
  {
    id: 'small_life',
    name: '过小日子的人',
    rarity: 4,
    // happiness 54→62、family 55→64。
    //
    // 原门槛几乎不筛人：幸福中位数 64、亲情中位数 68，于是"过小日子"占了 40%，
    // 成了全场最常见的一个，而它 rarity 只有 4。收紧到 P35 附近之后，
    // 让出来的份额落到 rarity 1 的兜底上——兜底本来就该是最常见的那一档
    // （"时代的浪往哪边推，你就往哪边走"才是大多数人的命）。
    test: (a) => a.hitRate >= 0.25 && a.hitRate <= 0.65 && a.happinessAvg >= 62 && a.familyFinal >= 64,
    blurb: () => '没什么大事发生，日子一天一天过下来了。',
  },
  {
    id: 'one_city',
    name: '守一座城的人',
    rarity: 3,
    // v1 要求 moves===0，但 migrant 把"打工"也算迁徙，几乎人手一次 → 0% 命中。
    // 现在 moves 只记真正迁出原籍（见 game.ts resolve 的 relocated）。
    // 判据保持"至多一份工作"：一生只干过一份工作、没离开过，本来就是多数人的
    // 真实写照（实测约 19%），所以它是**常见命型**——排到「过小日子」之后，
    // 只吃前者剩下的份额，不再冒充稀有。
    test: (a) => a.moves === 0 && a.jobChanges <= 1,
    blurb: (_a, g) => `${pronounOf(g)}一辈子没离开过那座城。`,
  },
  {
    id: 'ten_years_more',
    name: '比同龄人多活十年的人',
    rarity: 2,
    // 阈值回到规格原文 +10。v1 曾把它降到 +1.5 迁就分布，结果既让称号名撒谎、又仍是 0%。
    // 正解是打开上尾（healthDecay 减半 + healthBand 回血 + longevityTail 最长 +8），
    // 让"常年养生"成为一种可经营的 build，+10 才既可达又稀有。
    test: (a) => a.deathAge >= a.cohortLifeExpectancy + 10,
    blurb: (a, g) => `同一年出生的人大多停在了${a.cohortLifeExpectancy}岁，${pronounOf(g)}走到了${a.deathAge}岁。`,
  },
  {
    id: 'pushed_by_times',
    name: '被时代推着走的人',
    rarity: 1,
    test: () => true,
    blurb: (_a, g) => `时代的浪往哪边推，${pronounOf(g)}就往哪边走。`,
  },
];
