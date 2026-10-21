export interface StillDef {
  id: string;
  title: string;
  line: string;
  eventIds: readonly string[];
}

/**
 * 六个定格时刻。全屏展示两秒，不占美术预算 —— 用场景底 + 排版做出停顿感。
 */
export const STILLS: readonly StillDef[] = [
  {
    id: 'gaokao',
    title: '放榜',
    line: '名字印在红纸上，贴在传达室的玻璃窗后面。',
    eventIds: ['stage_gaokao', 'era_gaokao_expansion_1999'],
  },
  {
    id: 'wedding',
    title: '婚礼',
    line: '院子里摆了十几桌，鞭炮放完，地上全是红纸。',
    eventIds: ['stage_marriage'],
  },
  {
    id: 'birth',
    title: '孩子出生',
    line: '凌晨四点，走廊的灯一直亮着。',
    eventIds: ['stage_child_birth'],
  },
  {
    id: 'home',
    title: '买房',
    line: '钥匙串上多了一把，很沉。',
    eventIds: [
      'stage_first_home',
      'stage_second_home',
      'stage_third_home',
      'era_housing_reform_1998',
      'era_house_price_2009',
      'era_tier1_house_2017',
    ],
  },
  {
    id: 'retire',
    title: '退休',
    line: '工牌交上去那天，保安说了声“慢走”。',
    eventIds: ['stage_retire', 'era_delay_retirement_2025'],
  },
  {
    id: 'last',
    title: '最后的时刻',
    line: '屋里很安静，窗帘没有拉严。',
    eventIds: [],
  },
];

export function stillForEvent(eventId: string): StillDef | null {
  return STILLS.find((s) => s.eventIds.includes(eventId)) ?? null;
}
