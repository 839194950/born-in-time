import type { EventDef } from '../../engine/types';

/**
 * 时代窗口事件（固定年份）。
 * 写作口径：主干通用 + 城乡变体只换 1–2 句；不按城乡各写一套。
 * Task 20 会补齐到 18 条。
 */
export const ERA_EVENTS: EventDef[] = [
  {
    id: 'era_gaokao_expansion_1999',
    layer: 'era',
    trigger: { type: 'year', year: 1999 },
    windowAge: [17, 19],
    title: '高校扩招',
    body: '这一年，普通高校招生计划比上年多出五十一万人。大学的门对一批原本够不着的人开了一条缝。',
    variants: {
      rural: '这一年，普通高校招生计划比上年多出五十一万人。对县中的学生来说，这是恢复高考以来最宽的一扇门。',
    },
    choices: [
      {
        id: 'apply',
        label: '报考本科',
        requires: { statMin: { ability: 45 } },
        lockedText: '成绩够不上本科线',
        effects: { ability: 6, wealth: -2, happiness: 3 },
        outcome: '你考上了。录取通知书是大队部送来的。',
        setFlags: ['college'],
      },
      {
        id: 'vocational',
        label: '读中专或技校',
        effects: { ability: 2, wealth: 1 },
        outcome: '你早早学了一门手艺，毕业就有单位要。',
        setFlags: ['vocational'],
      },
      {
        id: 'work',
        label: '不读了，出去挣钱',
        effects: { wealth: 3, ability: -2 },
        outcome: '你成了同龄人里最早拿工资的那一批。',
      },
    ],
    ledgerWeight: 5,
    source: '教育部 1999 年普通高等教育招生计划（扩招 51.3 万人）',
  },
  {
    id: 'era_housing_reform_1998',
    layer: 'era',
    trigger: { type: 'year', year: 1998 },
    windowAge: [22, 45],
    title: '房改：福利分房取消',
    body: '国务院发文停止住房实物分配，单位分房这条走了四十年的路，在这一年走到头。此后房子要自己买。',
    choices: [
      {
        id: 'last_bus',
        label: '想办法赶上单位最后一批分房',
        requires: { urban: true },
        lockedText: '你家不在分房的序列里',
        effects: { wealth: 12, family: 2 },
        outcome: '你赶上了末班车。钥匙拿到手那天，楼道里都是人。',
        setFlags: ['has_home'],
      },
      {
        id: 'save',
        label: '先攒钱，不着急',
        effects: { wealth: 2, happiness: -1 },
        outcome: '你把钱存进了银行，那时候利率还很高。',
      },
    ],
    ledgerWeight: 6,
    lastTrain: true,
    source: '国务院《关于进一步深化城镇住房制度改革加快住房建设的通知》（国发〔1998〕23 号）',
  },
  {
    id: 'era_layoff_1998',
    layer: 'era',
    trigger: { type: 'year', year: 1998 },
    windowAge: [23, 45],
    conditions: { urban: true, flags: ['worker_family'] },
    title: '下岗',
    body: '国企改革推进，厂里的通知贴在门口。有人拿了买断工龄的钱，有人等着再就业中心的消息。',
    choices: [
      {
        id: 'buyout',
        label: '买断工龄，自己找出路',
        effects: { wealth: -4, ability: 2, happiness: -3 },
        outcome: '你签了字。那天厂门口的梧桐树刚落叶。',
      },
      {
        id: 'stay',
        label: '留下来等安排',
        effects: { wealth: -6, family: 2, happiness: -2 },
        outcome: '你留在了名单里，工资一拖就是几个月。',
      },
      {
        id: 'start_business',
        label: '摆个摊，先干起来',
        requires: { statMin: { ability: 40 } },
        lockedText: '你还没想清楚能卖什么',
        effects: { wealth: 3, health: -2, happiness: 1 },
        outcome: '你在菜市场门口支起了第一个摊子。',
        setFlags: ['self_employed'],
      },
    ],
    ledgerWeight: 5,
    source: '1998 年国有企业下岗职工基本生活保障与再就业政策（劳动和社会保障部）',
  },
  {
    id: 'era_wto_2001',
    layer: 'era',
    trigger: { type: 'year', year: 2001 },
    windowAge: [18, 35],
    title: '加入 WTO',
    body: '中国正式加入世界贸易组织。沿海的厂子开始接外贸订单，招工启事贴到了内地县城的墙上。',
    variants: {
      urban: '中国正式加入世界贸易组织。写字楼里的外资公司开始扩招，会一门外语突然值钱了。',
    },
    choices: [
      {
        id: 'go_coast',
        label: '去沿海打工',
        effects: { wealth: 5, health: -2, family: -2 },
        outcome: '你坐了两天两夜的火车，进了一家做鞋的厂。',
        setFlags: ['migrant'],
      },
      {
        id: 'stay',
        label: '留在本地',
        effects: { family: 2, happiness: 1 },
        outcome: '你没走。后来你常想，如果那天上了车会怎样。',
      },
    ],
    ledgerWeight: 4,
    source: '世界贸易组织第四届部长级会议 2001 年 11 月 10 日通过中国入世决定',
  },
  {
    id: 'era_house_price_2009',
    layer: 'era',
    trigger: { type: 'year', year: 2009 },
    windowAge: [24, 40],
    title: '房价起飞',
    body: '这一年，很多城市的房价一年涨了三成。售楼处开始排队，中介的电话一天打三个。',
    variants: {
      rural: '这一年，县城和市里的房价一年涨了三成。村里人见面聊的第一句话，变成了“你家买了吗”。',
    },
    choices: [
      {
        id: 'buy',
        label: '贷款买房',
        requires: { tierIn: ['normal', 'wellOff', 'rich'] },
        lockedText: '首付还差一大截',
        effects: { wealth: 8, family: 2, happiness: -2 },
        outcome: '你签了三十年的贷款合同，月供占掉了工资的一半。',
        setFlags: ['has_home', 'mortgage'],
      },
      {
        id: 'wait',
        label: '再等等看',
        effects: { wealth: 1, happiness: 1 },
        outcome: '你决定再等等。这一等，就是很多年。',
      },
    ],
    ledgerWeight: 5,
    source: '国家统计局 2009 年全国 70 个大中城市房屋销售价格指数',
  },
  {
    id: 'era_mobile_pay_2013',
    layer: 'era',
    trigger: { type: 'year', year: 2013 },
    windowAge: [25, 55],
    title: '移动支付',
    body: '手机开始能付钱了。街边的摊子贴出一张二维码，钱包里的现金一年比一年薄。',
    choices: [
      {
        id: 'embrace',
        label: '把生意搬到网上',
        requires: { statMin: { ability: 45 } },
        lockedText: '你还没弄明白怎么弄',
        effects: { wealth: 6, ability: 3, health: -1 },
        outcome: '你的第一个网店开张了，第一单来自一个没听过的地方。',
        setFlags: ['online_business'],
      },
      {
        id: 'keep',
        label: '照旧做线下',
        effects: { wealth: -1, happiness: 1, family: 1 },
        outcome: '你还是守着那间铺子，老主顾都还在。',
      },
    ],
    ledgerWeight: 3,
    source: '中国互联网络信息中心（CNNIC）第 32 次《中国互联网络发展状况统计报告》，2013 年',
  },
];
