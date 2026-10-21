import type { EventDef } from '../../engine/types';

/**
 * 只播报、不互动的大事。Task 20 会补齐到 10 条。
 */
export const BROADCAST_EVENTS: EventDef[] = [
  {
    id: 'bc_asian_games_1990',
    layer: 'era',
    trigger: { type: 'year', year: 1990 },
    windowAge: [0, 100],
    broadcast: true,
    title: '北京亚运会',
    body: '这一年秋天，北京办了亚运会。很多人第一次在电视里看见吉祥物熊猫“盼盼”。',
    choices: [],
    ledgerWeight: 1,
    source: '1990 年 9 月 22 日至 10 月 7 日，第十一届亚洲运动会在北京举行',
  },
  {
    id: 'bc_hongkong_1997',
    layer: 'era',
    trigger: { type: 'year', year: 1997 },
    windowAge: [0, 100],
    broadcast: true,
    title: '香港回归',
    body: '这一年的 7 月 1 日，电视里直播了交接仪式。很多人家守到半夜。',
    choices: [],
    ledgerWeight: 1,
    source: '1997 年 7 月 1 日，中国政府对香港恢复行使主权',
  },
  {
    id: 'bc_olympics_2008',
    layer: 'era',
    trigger: { type: 'year', year: 2008 },
    windowAge: [0, 100],
    broadcast: true,
    title: '北京奥运会',
    body: '这一年的 8 月，街上到处是福娃。开幕式那晚，空调外机上都坐着人。',
    choices: [],
    ledgerWeight: 1,
    source: '2008 年 8 月 8 日至 24 日，第 29 届夏季奥林匹克运动会在北京举行',
  },
];
