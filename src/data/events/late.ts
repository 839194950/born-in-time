import type { EventDef } from '../../engine/types';

/**
 * 晚年（2016–2036）：给 60 岁以后补内容。
 *
 * 为什么单独一个文件：这是全游戏唯一一段"没有任何抉择"的人生。复查实测
 * 60–70 岁的时代事件密度是 0.0，所有玩家退休之后到死都在看播报。
 * 而这十年恰恰是"时代"最具体地落在一个人身上的时候——扫码、报销、上门推销、
 * 助餐点。不是宏大叙事，是每天要过的日子。
 *
 * 写法约定：
 * - 政策只写"落到你身上的那一面"（排队、填表、子女代办），不解释制度本身
 * - 2026 年以后的每一条都必须带"推演"二字（有测试锁着）
 */
export const LATE_EVENTS: EventDef[] = [
  {
    id: 'era_cross_region_medical_2016',
    layer: 'era',
    trigger: { type: 'year', year: 2016 },
    windowAge: [56, 72],
    title: '报销要跑回老家',
    body: '你在子女所在的城市住院。出院结账时，窗口说异地结算得先备案，没备案的只能回老家报。',
    choices: [
      {
        id: 'let_child_run',
        label: '让子女跑手续',
        effects: { family: 2, happiness: 1 },
        outcome: '女儿请了半天假，跑了两趟，第三趟才把材料补齐。',
      },
      {
        id: 'go_home_self',
        label: '自己坐车回老家办',
        effects: { health: -2, wealth: 1, family: -1 },
        outcome: '你坐了六个小时的车。窗口的人说，其实手机上可以先备案。',
      },
      {
        id: 'pay_first',
        label: '先自费，回去再说',
        effects: { wealth: -3, happiness: -2 },
        outcome: '单子塞在包里，回去之后一直没去报。',
        default: true,
      },
    ],
    ledgerWeight: 0,
    source: '2016 年起跨省异地就医住院费用直接结算开始推行；需先办理异地就医备案',
  },
  {
    id: 'era_health_code_2020',
    layer: 'era',
    trigger: { type: 'year', year: 2020 },
    windowAge: [55, 78],
    title: '扫码才能进',
    body: '菜场门口立了一块牌子，要扫码才能进。你在门口站了一会儿，后面的人开始绕着你走。',
    choices: [
      {
        id: 'let_child_teach',
        label: '让子女教',
        effects: { family: 2, ability: 2 },
        outcome: '孩子教了四遍。你把步骤抄在纸上，压在门禁卡下面。',
      },
      {
        id: 'paper_certificate',
        label: '去社区开纸质证明',
        effects: { ability: 1, happiness: -1, family: 1 },
        outcome: '社区给了一张盖了章的纸。有的地方认，有的地方不认。',
      },
      {
        id: 'go_out_less',
        label: '干脆少出门',
        effects: { health: -2, happiness: -2 },
        outcome: '你一个月没去菜场。菜是邻居帮忙带的。',
        default: true,
      },
    ],
    ledgerWeight: 0,
    source: '2020 年 2 月起多地推行健康码通行；同期各地为无智能手机人群提供纸质健康证明等替代方式',
  },
  {
    id: 'era_elder_fraud_2021',
    layer: 'era',
    trigger: { type: 'year', year: 2021 },
    windowAge: [58, 78],
    title: '上门来的人',
    body: '有人上门，说是有个养老项目，年化十二个点，还送鸡蛋。他们叫你“叔叔”，叫得很顺口。',
    choices: [
      {
        id: 'invest_a_bit',
        label: '投一点试试',
        effects: { wealth: -4, happiness: -1 },
        outcome: '你把单子收在抽屉最里层，谁也没告诉。',
        probability: [
          { p: 0.15, outcome: '半年里，利息真的按月到账。你又追加了一笔。', effects: { wealth: 3 } },
          {
            p: 0.85,
            outcome: '第三个月，公司搬空了。门口贴着一张纸，上面只有一个电话号码。',
            effects: { wealth: -6, happiness: -4, family: -2 },
          },
        ],
      },
      {
        id: 'ask_child',
        label: '先问问子女',
        effects: { family: 2, happiness: 1 },
        outcome: '孩子当天就过来了，把宣传单拍了照，说要报警。',
        default: true,
      },
      {
        id: 'refuse_directly',
        label: '直接拒绝',
        effects: { happiness: 1, ability: 1 },
        outcome: '你把门关上。后来听说楼上老张投了八万。',
      },
    ],
    ledgerWeight: 0,
    source: '2021 年起全国开展打击整治养老诈骗专项行动；民政部、公安部历年通报的养老领域非法集资案例',
  },
  {
    id: 'era_private_pension_2022',
    layer: 'era',
    trigger: { type: 'year', year: 2022 },
    windowAge: [50, 72],
    title: '开户送五十块',
    body: '银行的人在小区门口摆了张桌子，说开个养老金账户送五十块购物卡。每年最多存一万二，退休才能取。',
    choices: [
      {
        id: 'open_and_fill',
        label: '开了，每年存满',
        effects: { wealth: 3, happiness: 1 },
        outcome: '你每年年底都记着那笔钱。账户里的数字涨得比存款快一点。',
      },
      {
        id: 'open_only',
        label: '开了，但不存',
        effects: { wealth: 1, happiness: 1 },
        outcome: '五十块购物卡当天就用了。账户一直空着，每年收到一条提醒短信。',
        default: true,
      },
      {
        id: 'decline',
        label: '不办',
        effects: { happiness: -1, ability: 1 },
        outcome: '你算了一下，觉得划不来。三年后利率降了，你又想起这件事。',
      },
    ],
    ledgerWeight: 0,
    source: '2022 年 4 月国务院办公厅《关于推动个人养老金发展的意见》；同年 11 月启动实施，每年缴费上限 12000 元',
  },
  {
    id: 'era_community_canteen_2028',
    layer: 'era',
    trigger: { type: 'year', year: 2028 },
    // 55 起：1970–1974 出生的人在 52→66 岁之间原本没有内容。
    // 这条是 ledgerWeight 0 的生活切面，放宽窗口不会像经济类事件那样把
    // lateHits 顶起来（试过放宽股灾/P2P/延迟退休，大器晚成直接涨到 24%）。
    windowAge: [54, 80],
    title: '楼下的食堂（推演）',
    body: '（推演）小区里开了一个助餐点，一荤两素十二块，六十五岁以上九块。中午排队，排的都是熟人。',
    choices: [
      {
        id: 'go_daily',
        label: '天天去',
        effects: { happiness: 2, family: 1, wealth: -1 },
        outcome: '你固定坐靠窗那桌，四个人。谁没来，大家就问一句。',
      },
      {
        id: 'go_sometimes',
        label: '偶尔去',
        effects: { happiness: 1, health: 1 },
        outcome: '一周去两三次。剩下的日子自己下点面。',
        default: true,
      },
      {
        id: 'cook_self',
        label: '还是自己做饭',
        effects: { health: -1, family: -1, wealth: 1 },
        outcome: '你自己买菜做饭。菜场离家两站路，来回走四十分钟。',
      },
    ],
    ledgerWeight: 0,
    source: '（推演）依据民政部近年推行的社区老年助餐服务网络建设方向外推',
  },
  {
    id: 'era_ai_care_2036',
    layer: 'era',
    trigger: { type: 'year', year: 2036 },
    // 下界 65→61：1972–1975 出生的人在 60–80 岁之间原本一条都没有（他们的
    // 六十岁是 2032 年以后，正好卡在现有推演事件的窗口外面）。
    windowAge: [61, 82],
    title: '会说话的床头柜（推演）',
    body: '（推演）社区给独居老人装了一台设备，会提醒吃药，也会在你摔倒时打电话。它每晚问你一遍“今天怎么样”。',
    choices: [
      {
        id: 'talk_to_it',
        label: '用着，也跟它说话',
        effects: { happiness: 2, family: -1 },
        outcome: '你开始跟它讲白天的事。它每次都答“听起来不错”。',
      },
      {
        id: 'use_quietly',
        label: '用，但不怎么理它',
        effects: { health: 2, happiness: -1 },
        outcome: '它提醒你就吃药，不提醒就不吃。你从来没跟它说过话。',
        default: true,
      },
      {
        id: 'remove_it',
        label: '让人拆了',
        effects: { family: 2, health: -2 },
        outcome: '你让物业拆了。晚上起夜的时候，屋里静得能听见水管的声音。',
      },
    ],
    ledgerWeight: 0,
    source: '（推演）依据近年智慧养老、独居老人紧急呼叫设备的推广方向外推',
  },
];
