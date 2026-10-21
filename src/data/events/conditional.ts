import type { EventDef } from '../../engine/types';

/**
 * 条件专属事件。Task 22 会补齐到 7 条。
 */
export const CONDITIONAL_EVENTS: EventDef[] = [
  {
    id: 'cond_demolition',
    layer: 'conditional',
    trigger: { type: 'age', age: 38 },
    windowAge: [38, 38],
    conditions: { urban: true, flags: ['has_home'] },
    title: '拆迁',
    body: '你们那片被划进了改造范围。居委会门口贴了公告，量房的队伍排了半条街。',
    choices: [
      {
        id: 'take_cash',
        label: '拿补偿款',
        effects: { wealth: 22, happiness: 2 },
        outcome: '补偿款到账那天，你在银行柜台前站了很久。',
        setFlags: ['relocated'],
      },
      {
        id: 'take_house',
        label: '要安置房',
        effects: { wealth: 15, family: 2, happiness: 1 },
        outcome: '你选了两套安置房，一套自己住，一套留着。',
        setFlags: ['relocated'],
      },
    ],
    ledgerWeight: 4,
    source: '《国有土地上房屋征收与补偿条例》（2011 年国务院令第 590 号）及各地实施细则',
  },
];
