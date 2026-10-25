import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ALL_EVENTS } from '../src/data/events';
import type { EventDef } from '../src/engine/types';

const OUT = resolve(process.cwd(), 'docs/史实核对表.md');

function when(ev: EventDef): string {
  return ev.trigger.type === 'year' ? `${ev.trigger.year} 年` : `${ev.trigger.age} 岁`;
}

function windowOf(ev: EventDef): string {
  if (ev.broadcast) return '—';
  const [min, max] = ev.windowAge;
  return min === max ? `${min} 岁` : `${min}–${max} 岁`;
}

function layerName(ev: EventDef): string {
  if (ev.broadcast) return '播报';
  if (ev.layer === 'era') return '时代窗口';
  if (ev.layer === 'conditional') return '条件专属';
  return '人生阶段';
}

/* ------------------------------------------------------------------ *
 * 核对档案：2026-10-22 逐条上网核对。
 *
 * 三档状态，含义严格区分，不许混用：
 *   ok    —— 年份/日期/数字已对到权威来源，附链接
 *   mech  —— 机制类条目，不含可错的量化断言，只核对"这件事真实存在"
 *   proj  —— 2026 年后的推演，正文已标"（推演）"，不与史实混算
 * ------------------------------------------------------------------ */

type Verdict = { s: 'ok'; u: string } | { s: 'mech' } | { s: 'proj' };

const STATS_PRICE = 'https://www.stats.gov.cn/sj/ndsj/2001c/i0901c.htm';
const STATS_HOUSE09 = 'https://www.stats.gov.cn/sj/zxfb/202303/t20230301_1919178.html';
const MOE_YWJY = 'https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/s3581/moe_2669/moe_2921/tnull_51639.html';
const MOE_1999 = 'https://www.moe.gov.cn/jyb_sjzl/sjzl_fztjgb/tnull_841.html';
const MOE_BINGGUI = 'https://www.moe.gov.cn/jyb_xxgk/gk_gbgg/moe_0/moe_7/moe_445/tnull_5941.html';
const MOE_2022GRAD = 'https://www.moe.gov.cn/fbh/live/2021/53931/mtbd/202112/t20211229_591290.html';
const SPORT_VOLLEY = 'https://www.sport.gov.cn/n20001280/n20067662/n20067613/c23736876/content.html';
const SPORT_XU = 'https://www.sport.gov.cn/n20001280/n20067662/n20067613/c23431105/content.html';
const SPORT70 = 'https://www.xinhuanet.com/politics/2019-09/27/c_1125045839.htm';
const YAYUN = 'https://yayun.cctv.com/introduction/history/history_11.shtml';
const GMW_CW = 'https://m.gmw.cn/baijia/2018-10/19/31778721.html';
const PEOPLE_GRAIN = 'https://www.people.com.cn/n/2013/1224/c348425-23931336.html';
const GOV_INTERNET = 'https://www.gov.cn/zhengce/2010-06/08/content_2615774.htm';
const CE_STOCK = 'https://finance.ce.cn/rolling/201512/27/t20151227_7878497.shtml';
const CNFIN_BTC21 = 'https://www.cnfin.com/yw-lb/detail/20211230/3499764_1.html';
const CCTV_BTC24 = 'https://jingji.cctv.com/2024/12/05/ARTI5mQhwVE510Bc11EaR2is241205.shtml';
const CNR_BTC13 = 'https://www.cnr.cn/jingji/gundong/201312/t20131208_514344289.shtml';
const CNR_KAOYAN = 'https://www.cnr.cn/jy/sy/sytjB/20231220/t20231220_526528227.shtml';
const GOV_YUER = 'https://www.gov.cn/zhengce/202507/content_7034133.htm';
const GOV_XUEQIAN = 'https://www.gov.cn/zhengce/content/202508/content_7035305.htm';
const GOV_RETIRE = 'https://www.gov.cn/yaowen/liebiao/202409/content_6974294.htm';
const CCTV_MORTGAGE = 'https://news.cctv.cn/2024/09/30/ARTIyesq4duQUPGmx9nfc6TM240930.shtml';
const GUOKAO = 'https://www.cnhubei.com/content/2024-12/01/content_18701857.html';
const SD_BUB = 'https://hrss.shandong.gov.cn/articles/ch06547/202012/0f723ddb-72fc-4f06-8da9-29e487e9af7c.shtml';
const CNNIC12 = 'https://www.cnnic.cn/n4/2022/0401/c154-4784.html';
const CE_P2P = 'https://finance.ce.cn/hlwjr/201810/14/t20181014_30510570.shtml';
const QST_XIAHAI = 'https://www.qstheory.cn/dukan/qs/2017-03/31/c_1120706998.htm';
const CNR_WECHAT = 'https://www.cnr.cn/jingji/gundong/201402/t20140207_514797086.shtml';
const JIEMIAN_2017 = 'https://www.jiemian.com/article/1631533.html';
const CNR_SZ5 = 'https://m.cnr.cn/news/20211015/t20211015_525634362.html';
const EXPO = 'https://www.xinhuanet.com/politics/2019-11/20/c_1125255561.htm';
const WINTER = 'http://keywords.china.org.cn/2024-08/20/content_117376667.html';
const P5G = 'https://m.people.cn/n4/0/2019/0606/c203-12795485_2.html';
const WTO = 'https://www.news.cn/politics/2019-11/08/c_1125209019.htm';
const HKMO = 'http://www.npc.gov.cn/npc/c12434/dzlfxzgcl70nlflc/202108/t20210824_313187.html';

const VERIFIED: Record<string, Verdict> = {
  // —— 时代窗口：有具体日期/数字，逐一核到官方来源 ——
  era_gaokao_restored_1977: { s: 'ok', u: 'https://www.moe.gov.cn/jyb_sjzl/sjzl_zcfg/zcfg_jyfl/202110/t20211029_575949.html' },
  era_compulsory_education_1986: { s: 'ok', u: MOE_YWJY },
  era_price_reform_1988: { s: 'ok', u: STATS_PRICE },
  era_migrant_wave_1989: { s: 'ok', u: QST_XIAHAI },
  era_stock_market_1990: { s: 'ok', u: 'https://www.sse.com.cn/aboutus/sser/' },
  era_grain_coupon_1993: { s: 'ok', u: PEOPLE_GRAIN },
  era_job_assignment_1996: { s: 'ok', u: SD_BUB },
  era_tuition_1997: { s: 'ok', u: MOE_BINGGUI },
  era_housing_reform_1998: { s: 'ok', u: 'https://www.gov.cn/zhengce/content/2008-03/28/content_4869.htm' },
  era_layoff_1998: { s: 'ok', u: 'https://www.gov.cn/zhengce/content/2008-03/28/content_4963.htm' },
  era_gaokao_expansion_1999: { s: 'ok', u: MOE_1999 },
  era_wto_2001: { s: 'ok', u: WTO },
  era_internet_2003: { s: 'ok', u: CNNIC12 },
  era_financial_crisis_2008: { s: 'ok', u: 'https://www.stats.gov.cn/sj/tjgb/ndtjgb/qgndtjgb/202302/t20230206_1901953.html' },
  era_house_price_2009: { s: 'ok', u: STATS_HOUSE09 },
  era_crypto_2013: { s: 'ok', u: CNR_BTC13 },
  era_mobile_pay_2014: { s: 'ok', u: CNR_WECHAT },
  era_stock_crash_2015: { s: 'ok', u: CE_STOCK },
  era_two_child_2016: { s: 'ok', u: 'https://www.gov.cn/zhengce/2015-10/29/content_5022860.htm' },
  era_tier1_house_2017: { s: 'ok', u: JIEMIAN_2017 },
  era_p2p_2018: { s: 'ok', u: CE_P2P },
  era_crypto_enter_2020: { s: 'ok', u: CNFIN_BTC21 },
  era_crypto_crash_2022: { s: 'ok', u: 'https://www.cnfin.com/yw-lb/detail/20220619/3641764_1.html' },
  era_ai_wave_2023: { s: 'ok', u: 'https://www.caict.ac.cn/kxyj/qwfb/bps/' },
  era_cloud_graduation_2022: { s: 'ok', u: MOE_2022GRAD },
  era_postgrad_craze_2023: { s: 'ok', u: CNR_KAOYAN },
  era_civil_service_2024: { s: 'ok', u: GUOKAO },
  era_mortgage_cut_2024: { s: 'ok', u: CCTV_MORTGAGE },
  era_child_subsidy_2025: { s: 'ok', u: GOV_YUER },
  era_delay_retirement_2025: { s: 'ok', u: GOV_RETIRE },
  era_ai_displace_2025: { s: 'mech' },
  // 推演条目
  era_first_home_loss_2028: { s: 'proj' },
  era_aging_2030: { s: 'proj' },
  era_pension_reform_2030: { s: 'proj' },
  era_ai_child_school_2032: { s: 'proj' },
  era_carbon_2035: { s: 'proj' },
  era_longevity_2040: { s: 'proj' },
  era_ai_society_2045: { s: 'proj' },

  // —— 播报：日期级事实，全部核到官方/权威媒体 ——
  // 1958–1976（2026-10-24 补）
  bc_commune_1958: { s: 'ok', u: 'http://m.people.cn/n4/2016/0829/c2771-7480391.html' },
  era_ration_1960: { s: 'ok', u: 'https://www.gov.cn/gongbao/content/1955/content_1622055.htm' },
  bc_canteen_end_1961: { s: 'mech' },
  bc_learn_from_leifeng_1963: { s: 'ok', u: 'https://www.people.com.cn/GB/shizheng/252/8932/8934/20030305/935342.html' },
  bc_school_stop_1966: { s: 'mech' },
  era_sibling_xiaxiang_1968: { s: 'ok', u: 'http://cpc.people.com.cn/BIG5/64162/64165/74856/75006/5194420.html' },
  bc_satellite_1970: { s: 'ok', u: 'http://dangshi.people.com.cn/n1/2021/0909/c436975-32222801.html' },
  era_recommend_college_1970: { s: 'ok', u: 'https://www.pku.edu.cn/detail/911.html' },
  bc_tangshan_1976: { s: 'ok', u: 'https://www.hbdzj.gov.cn/hbdzj/webpage/view.jsp?id=2019082011301918910915' },
  bc_volleyball_1981: { s: 'ok', u: SPORT_VOLLEY },
  bc_cctv_gala_1983: { s: 'ok', u: GMW_CW },
  bc_olympic_gold_1984: { s: 'ok', u: SPORT_XU },
  bc_asian_games_1990: { s: 'ok', u: YAYUN },
  bc_internet_1994: { s: 'ok', u: GOV_INTERNET },
  bc_hongkong_1997: { s: 'ok', u: HKMO },
  bc_macau_1999: { s: 'ok', u: HKMO },
  bc_olympic_bid_2001: { s: 'ok', u: SPORT70 },
  bc_sars_2003: { s: 'ok', u: 'https://www.gov.cn/zhengce/2003-05/09/content_2615754.htm' },
  bc_shenzhou_2003: { s: 'ok', u: CNR_SZ5 },
  bc_olympics_2008: { s: 'ok', u: SPORT70 },
  bc_expo_2010: { s: 'ok', u: EXPO },
  bc_5g_2019: { s: 'ok', u: P5G },
  bc_covid_2020: { s: 'mech' },
  bc_btc_69000_2021: { s: 'ok', u: CNFIN_BTC21 },
  bc_winter_olympics_2022: { s: 'ok', u: WINTER },

  // —— 条件专属 ——
  cond_parent_xiahai_1992: { s: 'ok', u: QST_XIAHAI },
  cond_parent_house_1997: { s: 'ok', u: 'https://www.gov.cn/zhengce/content/2008-03/28/content_4869.htm' },
  cond_layoff_family: { s: 'ok', u: 'https://www.gov.cn/zhengce/content/2008-03/28/content_4963.htm' },
  cond_btc_crisis_2019: { s: 'ok', u: 'https://www.cnfin.com/yw-lb/detail/20220619/3641764_1.html' },
  cond_btc_peak_2020: { s: 'ok', u: CNFIN_BTC21 },
  cond_edtech_2021: { s: 'ok', u: 'https://www.gov.cn/zhengce/2021-07/24/content_5627132.htm' },
  cond_btc_2024: { s: 'ok', u: CCTV_BTC24 },
  cond_demolition: { s: 'mech' },
  cond_land_expropriation: { s: 'mech' },
  cond_gig_worker: { s: 'mech' },
  cond_influencer: { s: 'mech' },
  cond_left_behind: { s: 'mech' },

  // —— 人生阶段：机制类，只核"这件事真实存在"，不含可错的数字 ——
  stage_child_birth: { s: 'mech' },
  stage_first_home: { s: 'mech' },
  stage_first_job: { s: 'mech' },
  stage_gaokao: { s: 'mech' },
  stage_graduation: { s: 'mech' },
  stage_grandchild: { s: 'mech' },
  stage_job_hop: { s: 'mech' },
  stage_kids_education: { s: 'mech' },
  stage_major_choice: { s: 'mech' },
  stage_marriage: { s: 'mech' },
  stage_old_friends: { s: 'mech' },
  stage_own_illness: { s: 'mech' },
  stage_parents_care: { s: 'mech' },
  stage_parents_illness: { s: 'mech' },
  stage_primary_years: { s: 'mech' },
  stage_retire: { s: 'mech' },
  stage_school_entry: { s: 'mech' },
  stage_second_home: { s: 'mech' },
  stage_siblings_split: { s: 'mech' },
  stage_spouse_change: { s: 'mech' },
  stage_startup: { s: 'mech' },
  stage_third_home: { s: 'mech' },
  stage_will: { s: 'mech' },
  stage_zhongkao: { s: 'mech' },
};

function statusCell(v: Verdict | undefined): { link: string; status: string } {
  if (!v) return { link: '—', status: '**待核**' };
  if (v.s === 'ok') return { link: v.u, status: '✓ 已核' };
  if (v.s === 'proj') return { link: '—', status: '推演（正文已标）' };
  return { link: '—', status: '✓ 已核（机制）' };
}

const missing: string[] = [];
const rows = [...ALL_EVENTS]
  .sort((a, b) => {
    const ay = a.trigger.type === 'year' ? a.trigger.year : 0;
    const by = b.trigger.type === 'year' ? b.trigger.year : 0;
    return ay - by || a.id.localeCompare(b.id);
  })
  .map((ev) => {
    const v = VERIFIED[ev.id];
    if (!v) missing.push(ev.id);
    const { link, status } = statusCell(v);
    return `| \`${ev.id}\` | ${layerName(ev)} | ${when(ev)} | ${windowOf(ev)} | ${ev.title} | ${ev.source} | ${link} | ${status} |`;
  })
  .join('\n');

const okCount = Object.values(VERIFIED).filter((v) => v.s === 'ok').length;
const mechCount = Object.values(VERIFIED).filter((v) => v.s === 'mech').length;
const projCount = Object.values(VERIFIED).filter((v) => v.s === 'proj').length;

const content = `# 史实核对表

> 规格 §10 要求：史实年份与政策节点逐条核对，宁可少写，不可记错。
> 本表由 \`npm run fact-table\` 从 \`src/data/events/\` 自动生成；核对结论固化在 \`scripts/gen-fact-table.ts\` 的 \`VERIFIED\` 表里，
> 重新生成不会丢。共 ${ALL_EVENTS.length} 条：附链接的硬事实 **${okCount}** 条、机制类 **${mechCount}** 条、推演 **${projCount}** 条。

## 状态怎么读

- **✓ 已核**——年份、日期、数字已对上官方或权威媒体来源，链接在第 7 列。改动这些条目的数字之前，先点开链接重看一遍。
- **✓ 已核（机制）**——这类条目只说"这件事在人生里会发生"，不含可错的量化断言（拆迁、灵活就业、留守儿童等）。核的是机制成立，不是某个统计值。
- **推演（正文已标）**——2026 年之后，基于既有趋势的外推，正文一律以"（推演）"开头，不得当成既成事实引用。

## 核对中查出来的问题（2026-10-22，均已修正）

| 条目 | 原来写的 | 实际 | 依据 |
|---|---|---|---|
| \`era_tier1_house_2017\` | 「一线房价再上一层」，暗示 2017 年一线还在暴涨 | 2017 年 3·17 新政后，15 个热点城市房价环比**首次全面停涨**，深圳同比转负。已改为「一线的门关上了」 | 界面新闻转国家统计局 70 城数据 |
| \`era_stock_crash_2015\` | 「几周里跌去了大半」 | 6 月 12 日 5178.19 点 → 8 月 26 日 2850.71 点，**两个多月、最大跌幅 44.95%**。已改为「两个多月里跌去了四成多」 | 中国经济网复盘 |
| \`era_crypto_2013\` | 「从几十美元涨到一千二，又跌回四百」 | 2013 年 10 月底已 200–300 美元；12 月 4 日高点约 1240，随后跌到 640 上下。已改为「从两百多美元涨到一千二，一个月后又跌回六百」 | 央广网、中国新闻网 |
| \`era_mobile_pay_2014\` | 「到了年底，街边的摊子开始贴二维码」 | 2014 年 3 月央行曾暂停二维码支付，大规模铺开在 2016 之后。已改为「有些店里开始贴二维码」 | 中国网财经 2014 第三方支付大事记 |

两处「出处」字段也顺手校准了：\`cond_btc_crisis_2019\` 的 2019 年区间应为 3400–13800 美元（原写 3000–13000）。

## 核对表

| 事件 id | 层级 | 时间 | 黄金窗口 | 说法 | 出处 | 链接 | 状态 |
|---|---|---|---|---|---|---|---|
${rows}

## 已确认的口径

- 出生年份范围 **1958–2005**（规格原文 1977–2002，2026-10-21 按用户要求扩宽，见 docs/实现偏离规格清单.md）。
- 城镇化率取《中国统计年鉴》逐年精确值（2000 年那道跳升是第五次全国人口普查口径调整）。
- 本表只反映"事件存在"，不代表窗口年龄与规格一致——差异同样看偏离清单。
- 队列预期寿命：1977 年城镇约 70、农村约 66；2002 年城镇约 78、农村约 72。
- 2026 年以后的条目一律标注"推演"，不得写成既成事实。
- 所有条目不得出现价值判断、血腥描写与自伤内容。
- **新增事件时**：先在 \`VERIFIED\` 里补一条，再跑 \`npm run fact-table\`。没补的会显示"待核"，这是有意的提醒。
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, content, 'utf8');
console.log(`wrote ${OUT} (${ALL_EVENTS.length} rows: ok ${okCount} / mech ${mechCount} / proj ${projCount})`);
if (missing.length > 0) console.warn(`未建档 ${missing.length} 条：${missing.join(', ')}`);
