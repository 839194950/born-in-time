import { TIER_LABEL } from '../../data/labels';
import { evaluateEnding } from '../../engine/ending';
import type { GameSnapshot } from '../../engine/game';
import type { Birth, DeathInfo, Ending, LedgerEntry, YearSnapshot } from '../../engine/types';
import { eraOfYear } from './era';
import { shareUrl } from './share';

export interface EndingCardData {
  birth: Birth;
  ending: Ending;
  ledger: LedgerEntry[];
  snapshots: YearSnapshot[];
  death: DeathInfo;
  /** 这一局的种子：分享链接靠它复现同一局 */
  seed: number;
}

export function buildCardData(snapshot: GameSnapshot): EndingCardData | null {
  if (!snapshot.death) return null;
  return {
    birth: snapshot.birth,
    ending: evaluateEnding(snapshot),
    ledger: snapshot.ledger,
    snapshots: snapshot.snapshots,
    death: snapshot.death,
    seed: snapshot.seed,
  };
}

const PRONOUN = { male: '他', female: '她' } as const;

export function deathLines(snapshot: GameSnapshot): string[] {
  const { birth, death } = snapshot;
  if (!death) return [];
  const who = PRONOUN[birth.gender];
  const alive = snapshot.family.filter((m) => m.deathYear === undefined || m.deathYear > death.year);
  const names = alive.map((m) => m.name).slice(0, 4).join('、');
  return [
    `${birth.year}—${death.year}`,
    `${who}活了 ${death.daysLived} 天。`,
    alive.length > 0 ? `留下的人：${names}。` : '最后没有留下什么人。',
  ];
}

export function buildPlainText(data: EndingCardData): string {
  const { birth, ending, death, ledger, seed } = data;
  const a = ending.aggregate;
  const lines = [
    `${birth.year} · ${birth.province}${birth.urban ? '城市' : '农村'} · ${TIER_LABEL[birth.tier]}家庭`,
    '',
    ending.headline,
    `【${ending.title.name}】${ending.subtitle}`,
    '',
    `享年 ${a.deathAge} 岁　｜　赶上 ${a.caught} / 差一年 ${a.nearMiss} / 路过 ${a.passedBy}　｜　财富最高 前${Math.max(1, 100 - Math.round(a.bestWealth))}%　｜　最幸福的一年 ${a.bestYear}`,
    '',
    '—— 生逢其时',
    `想知道 ${birth.year + (birth.year % 2 === 0 ? 1 : -1)} 年生的人这一局是什么命？把链接发给他：`,
    shareUrl(seed),
  ];
  if (ledger.length === 0) lines.splice(4, 0, `（${death.year} 年离世，没有赶上什么大的浪潮。）`);
  return lines.join('\n');
}

/** 避头尾：这些字符不许出现在行首，超宽时并入上一行 */
const NO_LINE_START = '。，、；：？！）》」』】%…·.,;:?!)]}';
const NO_LINE_END = '（《「『【([{';

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4,
): string[] {
  const out: string[] = [];
  let current = '';
  for (const ch of text) {
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth && current.length > 0) {
      // 行首禁则：标点宁可溢出半字，也不要单独起行
      if (NO_LINE_START.includes(ch)) {
        current = next;
        continue;
      }
      // 行尾禁则：上一行以开引号结尾时，把最后一个字一起带下去
      if (NO_LINE_END.includes(current[current.length - 1] ?? '')) {
        const last = current[current.length - 1];
        out.push(current.slice(0, -1));
        current = last + ch;
      } else {
        out.push(current);
        current = ch;
      }
    } else {
      current = next;
    }
  }
  if (current.length > 0) out.push(current);
  // 超行时截断并给省略号——绝不允许出现"最后一个字单独成行"
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return out;
}

/** 幸福色阶：固定 5 档，避免"看起来都一个颜色" */

export interface CardQr {
  size: number;
  isDark: (x: number, y: number) => boolean;
}

const W = 1080;
const H = 1920;
const PAD = 92;
const CONTENT = W - PAD * 2;

/**
 * 竖版结局卡 1080×1920。
 *
 * 字号换算规则：画布字号 ≥ (1080 ÷ 最窄显示宽 284) × 12 ≈ 46px。
 * v1 这里是 22px，落到 390 的手机上是 7.2px —— 分享物在最重要的场景里是废的。
 */
export function renderEndingCard(
  ctx: CanvasRenderingContext2D,
  data: EndingCardData,
  scale = 1,
  qr?: CardQr | null,
): void {
  const { birth, ending, death, snapshots } = data;
  const a = ending.aggregate;

  // 与界面同源：结局卡按「出生年份的时代」取色（v4 三时代）——
  // 胶片时代生的人，卡是棕褐相册页；数字时代生的人，卡是冷白的，
  // 朱红只剩右上角那枚方印。三套色与界面 [data-era] 变量一一对应。
  const eraId = eraOfYear(birth.year).id;
  const INK = eraId === 'film' ? '#33261a' : eraId === 'digital' ? '#232c34' : '#2f2a24';
  const MUTED = eraId === 'film' ? '#7d6a4d' : eraId === 'digital' ? '#68737c' : '#8b7d63';
  const PAPER = eraId === 'film' ? '#eee0b8' : eraId === 'digital' ? '#f2f4f1' : '#f7f1de';
  const ACCENT = eraId === 'film' ? '#7e3324' : eraId === 'digital' ? '#2f4d6d' : '#b03a2e';
  const FRAME = eraId === 'film' ? '#b99e6d' : eraId === 'digital' ? '#aebbb0' : '#c9b586';
  const FRAME2 = eraId === 'film' ? '#cdb385' : eraId === 'digital' ? '#c9d2c6' : '#d9c9a1';
  const SEAL = '#a63b30';
  const SERIF = '"Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", Georgia, serif';
  const SANS = '"PingFang SC", "Microsoft YaHei", sans-serif';

  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  // 纸底 + 奖状式双框（外粗内细）
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = FRAME;
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.strokeStyle = FRAME2;
  ctx.lineWidth = 1;
  ctx.strokeRect(58, 58, W - 116, H - 116);

  // 品牌方印：右上角，略歪 8°，白字 2×2「生逢其时」
  ctx.save();
  ctx.translate(W - PAD - 52, 118);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.fillStyle = SEAL;
  ctx.fillRect(-52, -52, 104, 104);
  ctx.strokeStyle = 'rgba(253,246,227,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(-42, -42, 84, 84);
  ctx.fillStyle = '#fdf6e3';
  ctx.font = `700 38px ${SERIF}`;
  ctx.fillText('生', -36, -38);
  ctx.fillText('逢', 4, -38);
  ctx.fillText('其', -36, 6);
  ctx.fillText('时', 4, 6);
  ctx.restore();

  // ---- L1 开局三件套 ----
  ctx.fillStyle = MUTED;
  ctx.font = `32px ${SANS}`;
  ctx.fillText(
    `${birth.year} · ${birth.province}${birth.urban ? '城市' : '农村'} · ${TIER_LABEL[birth.tier]}家庭`,
    PAD,
    100,
  );

  // ---- L1 主标题（微信缩略图里唯一读得到的元素）----
  ctx.fillStyle = INK;
  ctx.font = `bold 88px ${SERIF}`;
  const headlineLines = wrapLines(ctx, ending.headline, CONTENT, 3);
  let y = 170;
  for (const line of headlineLines) {
    ctx.fillText(line, PAD, y);
    y += 108;
  }

  // ---- 称号：实心色块 + 白字，宽度随字数 ----
  y += 24;
  ctx.font = `600 56px ${SERIF}`;
  const badgeText = ending.title.name;
  const badgeW = Math.min(CONTENT, ctx.measureText(badgeText).width + 64);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD, y, badgeW, 88);
  ctx.fillStyle = '#fff';
  ctx.fillText(badgeText, PAD + 32, y + 14);

  // 副句
  ctx.fillStyle = MUTED;
  ctx.font = `38px ${SANS}`;
  let sy = y + 118;
  for (const line of wrapLines(ctx, ending.subtitle, CONTENT, 3)) {
    ctx.fillText(line, PAD, sy);
    sy += 52;
  }

  // ---- L2 数据带：2×2（值 76px，格宽够放「7 / 1 / 4」这种短值）----
  const gridY = Math.max(y + 40, 790);
  const cellH = 150;
  const cellW = (CONTENT - 40) / 2;
  const cellValues = [
    { label: '享年', value: `${a.deathAge} 岁` },
    { label: '窗口账（赶上/差/路过）', value: `${a.caught} / ${a.nearMiss} / ${a.passedBy}` },
    { label: '财富最高', value: `前 ${Math.max(1, 100 - Math.round(a.bestWealth))}%` },
    { label: '最幸福的一年', value: `${a.bestYear}` },
  ];
  cellValues.forEach((cell, i) => {
    const cx = PAD + (i % 2) * (cellW + 40);
    const cy = gridY + Math.floor(i / 2) * cellH;
    ctx.fillStyle = MUTED;
    ctx.font = `40px ${SANS}`;
    ctx.fillText(cell.label, cx, cy);
    ctx.fillStyle = INK;
    ctx.font = `bold 76px ${SANS}`;
    ctx.fillText(cell.value, cx, cy + 54);
  });

  // ---- L3 幸福折线（替代 v1 那面「看着都一个色」的格子墙）----
  const chartTop = gridY + 360;
  const chartBottom = chartTop + 230;
  const chartLeft = PAD;
  const chartRight = W - PAD;
  const chartW = chartRight - chartLeft;

  ctx.fillStyle = MUTED;
  ctx.font = `38px ${SANS}`;
  ctx.fillText('这一生的幸福曲线', chartLeft, chartTop - 62);


  // 纵轴按这一局的实际范围自适应：固定 20–90 的话，一生都在 40–60 之间浮动的人
  // 会画成一条直线，看不出起伏。这张卡只看自己那一条命，不需要跨局可比。
  const happinessValues = snapshots.map((s) => s.happiness);
  const rawLo = Math.min(...happinessValues);
  const rawHi = Math.max(...happinessValues);
  const pad = Math.max(6, (rawHi - rawLo) * 0.35);
  const lo = Math.max(0, rawLo - pad);
  const hi = Math.min(100, rawHi + pad);
  const span = Math.max(1, hi - lo);

  ctx.strokeStyle = '#e0d4bd';
  ctx.lineWidth = 2;
  for (const lv of [30, 50, 70].filter((v) => v > lo && v < hi)) {
    const yy = chartBottom - ((lv - lo) / span) * (chartBottom - chartTop);
    ctx.beginPath();
    ctx.moveTo(chartLeft, yy);
    ctx.lineTo(chartRight, yy);
    ctx.stroke();
  }

  const total = Math.max(2, snapshots.length);
  const px = (i: number): number => chartLeft + (i / (total - 1)) * chartW;

  const py = (h: number): number =>
    chartBottom - ((Math.max(lo, Math.min(hi, h)) - lo) / span) * (chartBottom - chartTop);

  ctx.beginPath();
  ctx.moveTo(px(0), chartBottom);
  snapshots.forEach((s, i) => ctx.lineTo(px(i), py(s.happiness)));
  ctx.lineTo(px(snapshots.length - 1), chartBottom);
  ctx.closePath();
  ctx.fillStyle = 'rgba(166, 59, 48, 0.10)';
  ctx.fill();

  ctx.beginPath();
  snapshots.forEach((s, i) => (i === 0 ? ctx.moveTo(px(i), py(s.happiness)) : ctx.lineTo(px(i), py(s.happiness))));
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 三个关键点：只画圆点，说明放在下面的图例里（避免标注互相压住）
  const best = snapshots.reduce((m, s) => (s.happiness > m.happiness ? s : m), snapshots[0]!);
  const worst = snapshots.reduce((m, s) => (s.happiness < m.happiness ? s : m), snapshots[0]!);
  const last = snapshots[snapshots.length - 1]!;
  const marks = [
    { s: best, label: `最幸福 ${best.year}`, color: ACCENT },
    { s: worst, label: `最低 ${worst.year}`, color: '#6b7a85' },
    { s: last, label: `${last.year}`, color: INK },
  ];
  for (const m of marks) {
    const idx = snapshots.indexOf(m.s);
    ctx.beginPath();
    ctx.arc(px(idx), py(m.s.happiness), 9, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
  }

  // 图例：一行排开，不用在图上挤
  ctx.font = `36px ${SANS}`;
  let lx = chartLeft;
  for (const m of marks) {
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(lx + 10, chartBottom + 46, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.fillText(m.label, lx + 28, chartBottom + 26);
    lx += 28 + ctx.measureText(m.label).width + 40;
  }

  // ---- L4 页脚：文案列 596 + 右下二维码（白板 246）----
  const footTop = 1500;
  const textColW = 596;
  ctx.strokeStyle = FRAME2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, footTop - 26);
  ctx.lineTo(W - PAD, footTop - 26);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = `600 38px ${SERIF}`;
  ctx.fillText(`生逢其时 · ${birth.year}—${death.year}`, PAD, footTop);

  ctx.fillStyle = MUTED;
  ctx.font = `38px ${SANS}`;
  const hook = `想知道 ${birth.year + (birth.year % 2 === 0 ? 1 : -1)} 年生的人是什么命？扫码抽他那一局。`;
  let hy = footTop + 58;
  for (const line of wrapLines(ctx, hook, textColW, 2)) {
    ctx.fillText(line, PAD, hy);
    hy += 50;
  }

  ctx.fillStyle = '#9a9284';
  ctx.font = `28px ${SANS}`;
  ctx.fillText(shareUrl(data.seed).replace(/^https?:\/\//, ''), PAD, footTop + 186);

  if (qr) {
    const boardSize = 246;
    const qx = W - PAD - boardSize;
    const qy = footTop + 40;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx, qy, boardSize, boardSize);

    // 模块尺寸必须取整数：小数会让每个模块溢出、把定位方块的边界糊掉（扫不出来）
    const mod = Math.max(2, Math.floor((boardSize - 24 * 2) / qr.size));
    const symbol = mod * qr.size;
    const ox = qx + Math.round((boardSize - symbol) / 2);
    const oy = qy + Math.round((boardSize - symbol) / 2);
    ctx.fillStyle = '#111111';
    for (let ry = 0; ry < qr.size; ry++) {
      for (let rx = 0; rx < qr.size; rx++) {
        if (!qr.isDark(rx, ry)) continue;
        ctx.fillRect(ox + rx * mod, oy + ry * mod, mod, mod);
      }
    }
  }

  ctx.restore();
}


