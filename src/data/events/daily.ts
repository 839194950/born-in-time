import type { ChoiceDef, Requirement } from '../../engine/types';

/**
 * 日常事件池：不绑年份、不绑年龄点，只给一个年龄段，靠随机抽取填满
 * 没有大事发生的年份。借的是 1in8b 那种“每年都有点什么”的密度感。
 * 数值都是小账（±1~3），大起大落仍然归时代与阶段事件管。
 */
export interface DailyEventDef {
  id: string;
  title: string;
  body: string;
  variants?: { urban?: string; rural?: string };
  ageRange: [number, number];
  conditions?: Requirement;
  choices: ChoiceDef[];
  source: string;
  /** 可重复发生的（两次间隔至少 6 年），如聚餐、夜宵、老歌 */
  repeatable?: boolean;
}

const SRC = '日常事件（经验设定，无特定史实出处）';

export const DAILY_EVENTS: readonly DailyEventDef[] = [
  {
    id: 'daily_found_money',
    title: '捡到钱',
    body: '放学路上，你在墙根底下看见一张折起来的五块钱。周围一个人都没有。',
    ageRange: [7, 12],
    choices: [
      { id: 'hand_in', label: '交给老师', effects: { family: 1, happiness: 1 }, outcome: '老师在班会上提了一句你的名字，你耳朵有点热。' },
      {
        id: 'keep', label: '自己留着', outcome: '你把钱攥了一路。',
        probability: [
          { p: 0.6, outcome: '买的零食分给了同桌，他说明天还你一块橡皮，一直没还。', effects: { happiness: 2 } },
          { p: 0.4, outcome: '钱在口袋里丢了。你心疼了好几天，也没敢跟家里说。', effects: { happiness: -2 } },
        ],
      },
    ],
    source: SRC,
  },
  {
    id: 'daily_stray_dog',
    title: '巷口的狗',
    body: '巷口来了一只没人要的狗，瘦，看见人就摇尾巴。你每天路过，它都在那儿等。',
    variants: { urban: '小区门口来了一只没人要的狗，瘦，看见人就摇尾巴。你每天放学路过，它都在那儿等。' },
    ageRange: [6, 14],
    choices: [
      { id: 'feed', label: '每天给它带点吃的', effects: { happiness: 2, family: 1 }, outcome: '它后来跟了你一路，能送到学校门口。有一天它没来，你找了它好久。' },
      { id: 'watch', label: '远远看着', effects: { happiness: 1 }, outcome: '你看它被楼下的奶奶收了，天天晒太阳，也算有个着落。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_first_fight',
    title: '打了一架',
    body: '有个高年级的堵你要零花钱，推了你一把。旁边围了一圈人。',
    ageRange: [8, 13],
    choices: [
      { id: 'fight_back', label: '打回去', effects: { health: -1, happiness: 1 }, outcome: '你挂了彩，他也没占到便宜。后来他见你绕着走。' },
      { id: 'tell', label: '告诉老师', effects: { ability: 1 }, outcome: '老师把他叫去了办公室。这事就这么过去了，你心里堵了几天。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_love_letter',
    title: '一封信',
    body: '课本里夹着一张叠得很整齐的纸，打开是一封写给你的信，字很认真，还有两个错别字。',
    ageRange: [14, 18],
    choices: [
      { id: 'keep_letter', label: '收起来，谁也不说', effects: { happiness: 2 }, outcome: '你把信压在书箱最底下，隔段时间就翻出来看一遍。' },
      { id: 'reply', label: '回一封', effects: { happiness: 2, family: -1 }, outcome: '你们传了小半年纸条。后来分了班，就慢慢断了。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_arcade',
    title: '游戏厅',
    body: '同学带你去了一次游戏厅，灯一闪一闪的，一块钱四个币。回去的路上他说，下次还来。',
    ageRange: [12, 18],
    choices: [
      { id: 'sometimes', label: '偶尔去', effects: { happiness: 2, ability: -1, wealth: -1 }, outcome: '你去得不多不少，成绩单下来的时候，心里有点虚。' },
      { id: 'never', label: '不去了', effects: { ability: 1, happiness: -1 }, outcome: '你在家写作业，窗外天黑得特别早。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_sports_day',
    title: '运动会',
    body: '运动会要凑人数，老师指着你说，你去跑那个没人报的项目。',
    ageRange: [11, 17],
    choices: [
      { id: 'run', label: '去跑', effects: { health: 2, happiness: 1 }, outcome: '你跑了个中间名次，最后五十米腿像灌了铅，班里同学喊得比你还使劲。' },
      { id: 'cheer', label: '在旁边加油', effects: { happiness: 1 }, outcome: '你负责看衣服和递水，也挺忙活。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_reunion_dinner',
    title: '老同学聚会',
    body: '老同学组了个局，群里消息刷了上百条。去吧，得随份子，还得听一晚上谁混得好。',
    ageRange: [23, 40],
    repeatable: true,
    choices: [
      { id: 'go', label: '去', effects: { happiness: 2, wealth: -1 }, outcome: '饭吃到一半大家开始说上学时候的事，那一会儿是真的开心。' },
      { id: 'skip', label: '推掉', effects: { wealth: 1, happiness: -1 }, outcome: '你在家刷着他们发的合影，照片里的人都笑得很用力。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_train_chat',
    title: '火车邻座',
    body: '对面的大叔打开了话匣子，从他年轻时候下海，讲到儿子在深圳买房。窗外的电线杆一根一根往后退。',
    ageRange: [18, 45],
    choices: [
      { id: 'chat', label: '陪他聊一路', effects: { happiness: 1, ability: 1 }, outcome: '下车的时候他说小伙子（姑娘）你不错。这句话你记了很多年。' },
      { id: 'sleep', label: '闭眼睡觉', effects: { health: 1 }, outcome: '你靠着车窗睡了一觉，醒来脖子疼，对面已经下车了。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_bad_food',
    title: '吃坏了肚子',
    body: '半夜肚子绞着疼，跑了四趟厕所，天快亮了才消停。',
    ageRange: [18, 55],
    repeatable: true,
    choices: [
      { id: 'hospital', label: '去医院挂水', effects: { health: 1, wealth: -1 }, outcome: '输液室里坐你旁边的大爷鼾声如雷，你跟着也睡着了。' },
      { id: 'tough', label: '扛一扛', effects: { health: -2, happiness: -1 }, outcome: '第二天顶着黑眼圈去上班，一天没吃下东西。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_scam_call',
    title: '一个电话',
    body: '电话里的人说你的账户涉嫌洗钱，让你把钱转到“安全账户”。他的普通话带着口音，但说得特别真。',
    ageRange: [26, 65],
    choices: [
      { id: 'hang', label: '挂掉，顺手举报', effects: { ability: 1, happiness: 1 }, outcome: '你挂了电话，后背出了一层汗——刚才有那么几秒，你差点就信了。' },
      {
        id: 'almost', label: '多听了几句', outcome: '你听他说了五分钟。',
        probability: [
          { p: 0.7, outcome: '说到转账那一步你反应过来，挂了。就差那么一点。', effects: { happiness: -1 } },
          { p: 0.3, outcome: '你转了一笔过去才回过神。报警、立案、在银行坐了一下午，钱还是没追回来。', effects: { wealth: -5, happiness: -3 } },
        ],
      },
    ],
    source: SRC,
  },
  {
    id: 'daily_help_move',
    title: '帮朋友搬家',
    body: '朋友搬家，电话打过来的时候你就知道躲不过去了。他家在六楼，没电梯。',
    ageRange: [20, 42],
    repeatable: true,
    choices: [
      { id: 'help', label: '去，撸起袖子', effects: { happiness: 2, health: -1, family: 1 }, outcome: '冰箱抬到四楼的时候两个人都没力气说话了。晚上他请你吃了烧烤，说以后你搬家他随叫随到。' },
      { id: 'excuse', label: '找个借口推了', effects: { happiness: -1 }, outcome: '你在家躺了一天，刷手机的时候总觉得哪儿不踏实。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_stray_cat',
    title: '一只猫',
    body: '下班路上，一只小猫跟了你两个路口，叫声细细的。走到楼下，它蹲在单元门口看你。',
    ageRange: [19, 45],
    choices: [
      { id: 'adopt', label: '抱回家', effects: { happiness: 2, wealth: -1 }, outcome: '你给它起名叫煤球。从此回家第一件事是给它开罐头。', setFlags: ['has_cat'] },
      { id: 'leave', label: '喂了它一顿，走了', effects: { happiness: 1 }, outcome: '第二天你特意绕过去看，它不在了。希望是被人抱走了吧。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_cat_ill',
    title: '煤球病了',
    body: '煤球这两天不吃不喝，趴在窝里没精神。它陪你好些年了，嘴边的毛都白了。',
    ageRange: [26, 60],
    conditions: { flags: ['has_cat'] },
    choices: [
      { id: 'vet', label: '带它去看医生', effects: { wealth: -1, happiness: 1 }, outcome: '打了几天针，它又能跳上窗台了。你松了口气。' },
      { id: 'wait', label: '再观察两天', effects: { happiness: -1 }, outcome: '它自己缓过来了，就是从那以后，你回家开门的声音都放轻。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_colleague_dinner',
    title: '同事饭局',
    body: '领导请客，包厢里烟雾缭绕。你杯子里的酒，是满上还是满上。',
    ageRange: [23, 55],
    repeatable: true,
    choices: [
      { id: 'drink', label: '陪好', effects: { happiness: 1, health: -1, ability: 1 }, outcome: '散场的时候领导拍你肩膀，说了句含糊的“好好干”。你回家吐了一回。' },
      { id: 'early', label: '找借口先走', effects: { health: 1, happiness: -1 }, outcome: '你到家还早，洗了个澡，看了会儿电视，心里有点没着落。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_parent_call',
    title: '家里的电话',
    body: '晚饭后电话响了，是家里打来的。先问吃了吗，再问冷不冷，最后说没事，就是想着给你打个电话。',
    ageRange: [24, 62],
    repeatable: true,
    choices: [
      { id: 'long', label: '多聊一会儿', effects: { family: 2, happiness: 1 }, outcome: '聊了四十多分钟，说到你小时候的糗事，两个人都笑。挂了电话你站了一会儿。' },
      { id: 'short', label: '说两句就挂了', effects: { family: -1 }, outcome: '你说忙，下次再聊。放下手机，屋里一下子特别安静。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_borrow_money',
    title: '老同学借钱',
    body: '多年没联系的老同学突然发来长长一段话，最后落到一句：能不能周转一下，就这个月。',
    ageRange: [27, 50],
    choices: [
      {
        id: 'lend', label: '借他', outcome: '钱转过去了，对方发来一串感谢的话。',
        probability: [
          { p: 0.55, outcome: '三个月后钱一分不少回来了，还多了句“请你吃饭”。这种朋友，没白交。', effects: { happiness: 2, family: 1 } },
          { p: 0.45, outcome: '从那以后他的头像就没再亮过。你不好意思催，就当买了个教训。', effects: { wealth: -3, happiness: -2 } },
        ],
      },
      { id: 'refuse', label: '婉拒', effects: { happiness: -1 }, outcome: '你编了个理由。发完那条消息，你们俩都明白是怎么回事。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_checkup_numbers',
    title: '体检单',
    body: '体检报告寄到了。好几项指标后面标着向上的箭头，医生在建议栏写了一行字：注意休息，加强锻炼。',
    ageRange: [34, 62],
    choices: [
      { id: 'care', label: '开始注意', effects: { health: 2 }, outcome: '你办了卡，戒了宵夜。坚持了小半年，裤腰松了一格。', setFlags: ['health_conscious'] },
      { id: 'ignore', label: '塞进抽屉', effects: { health: -1 }, outcome: '报告塞进抽屉最底下，跟去年的压在一起。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_umbrella',
    title: '一把伞',
    body: '雨下得突然，公交站底下有个没带伞的小姑娘，书包抱在怀里，一直往里缩。你的伞够大。',
    ageRange: [15, 55],
    choices: [
      { id: 'share', label: '送她一程', effects: { happiness: 2 }, outcome: '她到站的时候回头说了声谢谢，跑进雨里。你半边肩膀湿透了，心情倒不错。' },
      { id: 'alone', label: '自己走了', effects: {}, outcome: '你回到家换衣服的时候，想起她还在站底下等。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_lottery',
    title: '一张彩票',
    body: '路过彩票站，门口的牌子上写着奖池又创新高。排队的人不多。',
    ageRange: [20, 58],
    repeatable: true,
    choices: [
      {
        id: 'buy', label: '买一张', outcome: '你把彩票压在冰箱贴底下。',
        probability: [
          { p: 0.82, outcome: '开奖那天你对了三遍，一个数都不挨着。彩票揉了，扔了。', effects: { wealth: -1 } },
          { p: 0.18, outcome: '中了二十块。你拿这钱买了斤排骨，觉得这顿肉格外香。', effects: { happiness: 2 } },
        ],
      },
      { id: 'pass', label: '不买', effects: {}, outcome: '你路过的时候脚步都没停。回家路上想，这钱买俩包子多实在。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_plant',
    title: '一盆花',
    body: '花市收摊的时候，你顺手买了一盆快蔫的绿植，老板说回去浇浇水还能活。',
    ageRange: [25, 68],
    choices: [
      { id: 'tend', label: '认真养', effects: { happiness: 2 }, outcome: '它活过来了，还抽了新芽。你每天浇水的时候，顺便在阳台站一会儿，什么也不想。' },
      { id: 'neglect', label: '放在那儿随它', effects: {}, outcome: '它居然也活着，半死不活地绿了好几年，跟你挺像。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_old_neighbor',
    title: '老邻居的消息',
    body: '村里（小区）的老邻居托人带来话，说老院子要拆了，让你有空回去看看。院子里的那棵树还在。',
    ageRange: [30, 65],
    choices: [
      { id: 'back', label: '回去看一眼', effects: { family: 2, happiness: 1, wealth: -1 }, outcome: '你在院子里站了半天。树比记忆里粗了，也矮了——是你长高了，又老了。' },
      { id: 'nogo', label: '没回去', effects: { happiness: -1 }, outcome: '后来你在照片里看见那片地平了，盖起了楼。心里空了一下。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_kid_question',
    title: '孩子的问题',
    body: '孩子仰着头问你：人为什么要上学？你张了张嘴，发现这个问题比想象中难答。',
    ageRange: [27, 48],
    conditions: { flags: ['child_born'] },
    choices: [
      { id: 'serious', label: '认真想了想再答', effects: { family: 2, ability: 1 }, outcome: '你说了些自己都半信半疑的话。孩子似懂非懂地点头，你却想了很久。' },
      { id: 'brush', label: '大家都上，所以你也要上', effects: {}, outcome: '孩子“哦”了一声就跑去玩了。你坐在那儿，把这个问题在心里又过了一遍。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_spouse_tiff',
    title: '拌了句嘴',
    body: '为了一件想不起来起因的小事，两个人杠上了，晚饭吃得没滋没味。',
    ageRange: [24, 62],
    conditions: { flags: ['married'] },
    repeatable: true,
    choices: [
      { id: 'yield', label: '先低头', effects: { family: 2, happiness: 1 }, outcome: '你洗碗的时候哼了句歌，对方在身后把围裙给你系上了。日子就这么又过下去了。' },
      { id: 'cold', label: '冷战两天', effects: { family: -2, happiness: -1 }, outcome: '两天里话都绕着弯说。第三天早上，对方先给你倒了杯水。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_late_snack',
    title: '夜宵',
    body: '半夜十一点，肚子叫了。楼下烧烤摊的烟正往上飘，孜然味顺着窗缝进来。',
    ageRange: [19, 48],
    repeatable: true,
    choices: [
      { id: 'eat', label: '下楼吃', effects: { happiness: 2, health: -1, wealth: -1 }, outcome: '你坐在小马扎上，觉得这一天总算有个圆满的结尾。' },
      { id: 'hold', label: '忍住', effects: { health: 1 }, outcome: '你喝了杯热水。躺下的时候想，明天称体重，数字会感谢今晚的你。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_old_song',
    title: '一首老歌',
    body: '商场里、出租车上、或者谁的手机里，突然放起一首你年轻时候天天听的歌。前奏一响，你的脚步就慢下来了。',
    ageRange: [30, 75],
    repeatable: true,
    choices: [
      { id: 'listen', label: '听完再走', effects: { happiness: 2 }, outcome: '你站在原地听完了整首。想起那时候的自己，觉得又远又近。' },
      { id: 'hum', label: '哼着走了', effects: { happiness: 1 }, outcome: '你跟着哼了两句，调跑了，自己笑了笑。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_friend_hospital',
    title: '老朋友住院了',
    body: '听说老朋友住院了，不大不小的手术。你在群里回了句“多保重”，盯着屏幕看了半天。',
    ageRange: [45, 75],
    choices: [
      { id: 'visit', label: '去看看他', effects: { family: 2, happiness: 1, wealth: -1 }, outcome: '你在床边坐了一个小时，聊的都是年轻时候的事。走的时候他说，下次咱们出去喝。你们都知道，先养好再说。' },
      { id: 'message', label: '发个红包和消息', effects: {}, outcome: '你发了红包，配了句好好养病。发完心里总觉得差了点什么。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_morning_market',
    title: '赶早市',
    body: '天刚蒙蒙亮，早市已经支起来了。菜叶上带着水，卖豆腐的案子前排了三个人。',
    variants: { urban: '天刚蒙蒙亮，菜市场的卷帘门升起来一半。菜叶上带着水，卖豆腐的摊子前排了三个人。' },
    ageRange: [45, 78],
    repeatable: true,
    choices: [
      { id: 'stroll', label: '慢慢逛', effects: { happiness: 2, health: 1 }, outcome: '你拎着一兜子菜往回走，跟半条街的人都打了招呼。这种早上，让人觉得日子还很长。' },
      { id: 'quick', label: '买完就走', effects: {}, outcome: '你对着单子买齐，扭头就走，一分钟没多耽误。' },
    ],
    source: SRC,
  },
  {
    id: 'daily_old_photos',
    title: '翻老照片',
    body: '收拾屋子，翻出一本旧相册。照片里的人都年轻，你爹的头发还是黑的，你站在中间，缺颗牙。',
    ageRange: [48, 82],
    choices: [
      { id: 'show', label: '拿给孩子看', effects: { family: 2, happiness: 1 }, outcome: '你一张一张讲，这是谁，那是谁。孩子听着听着把手机放下了。' },
      { id: 'alone', label: '自己看了一下午', effects: { happiness: 1 }, outcome: '一下午就这么过去了。相册合上之前，你把一张有点卷边的展平了。' },
    ],
    source: SRC,
  },
];
