import { TIER_LABEL } from '../../data/labels';
import { evaluateEnding } from '../../engine/ending';
import type { GameSnapshot } from '../../engine/game';
import type { Birth, DeathInfo, Ending, LedgerEntry, YearSnapshot } from '../../engine/types';

export interface EndingCardData {
  birth: Birth;
  ending: Ending;
  ledger: LedgerEntry[];
  snapshots: YearSnapshot[];
  death: DeathInfo;
}

export function buildCardData(snapshot: GameSnapshot): EndingCardData | null {
  if (!snapshot.death) return null;
  return {
    birth: snapshot.birth,
    ending: evaluateEnding(snapshot),
    ledger: snapshot.ledger,
    snapshots: snapshot.snapshots,
    death: snapshot.death,
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
  const { birth, ending, death, ledger } = data;
  const a = ending.aggregate;
  const lines = [
    `${birth.year} · ${birth.province}${birth.urban ? '城市' : '农村'} · ${TIER_LABEL[birth.tier]}家庭`,
    '',
    ending.headline,
    `【${ending.title.name}】${ending.subtitle}`,
    '',
    `享年 ${a.deathAge} 岁　｜　赶上 ${a.caught} / 差一年 ${a.nearMiss} / 路过 ${a.passedBy}　｜　财富最高 ${Math.round(a.bestWealth)}　｜　最幸福的一年 ${a.bestYear}`,
    '',
    '—— 生逢其时',
    `想知道 ${birth.year + (birth.year % 2 === 0 ? 1 : -1)} 年生的人这一局是什么命？把链接发给他。`,
  ];
  if (ledger.length === 0) lines.splice(4, 0, `（${death.year} 年离世，没有赶上什么大的浪潮。）`);
  return lines.join('\n');
}

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
      out.push(current);
      current = ch;
      if (out.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current.length > 0) out.push(current);
  return out.slice(0, maxLines);
}

function happinessColor(h: number): string {
  const t = Math.max(0, Math.min(1, h / 100));
  return `hsl(${24 + t * 16}, ${28 + t * 34}%, ${16 + t * 42}%)`;
}

/** 竖版结局卡，1080×1920。scale 用于高分屏（先 scale 再按逻辑尺寸画） */
export function renderEndingCard(
  ctx: CanvasRenderingContext2D,
  data: EndingCardData,
  scale = 1,
): void {
  const W = 1080;
  const H = 1920;
  const { birth, ending, death, snapshots } = data;
  const a = ending.aggregate;

  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#1b1a17';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3a352c';
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, W - 88, H - 88);

  const left = 92;
  const contentWidth = W - left * 2;

  // 1. 开局三件套
  ctx.fillStyle = '#8b8477';
  ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(
    `${birth.year} · ${birth.province}${birth.urban ? '城市' : '农村'} · ${TIER_LABEL[birth.tier]}家庭`,
    left,
    120,
  );

  // 2. 主标题
  ctx.fillStyle = '#f4efe4';
  ctx.font = 'bold 58px "PingFang SC", "Microsoft YaHei", sans-serif';
  const headlineLines = wrapLines(ctx, ending.headline, contentWidth, 4);
  let y = 210;
  for (const line of headlineLines) {
    ctx.fillText(line, left, y);
    y += 78;
  }

  // 3. 称号印章 + 副句
  y += 30;
  const badgeW = 250;
  const badgeH = 82;
  ctx.strokeStyle = '#b23a2f';
  ctx.lineWidth = 3;
  ctx.strokeRect(left, y, badgeW, badgeH);
  ctx.fillStyle = '#b23a2f';
  ctx.font = 'bold 34px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(ending.title.name.slice(0, 7), left + 18, y + 24);

  ctx.fillStyle = '#a8a08f';
  ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
  const subtitleLines = wrapLines(ctx, ending.subtitle, contentWidth - 10, 3);
  let sy = y + badgeH + 26;
  for (const line of subtitleLines) {
    ctx.fillText(line, left, sy);
    sy += 40;
  }

  // 4. 数据带
  const stripY = Math.max(sy + 30, 780);
  ctx.strokeStyle = '#3a352c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, stripY);
  ctx.lineTo(W - left, stripY);
  ctx.stroke();

  const cells = [
    { label: '享年', value: `${a.deathAge}` },
    { label: '赶上/差一年/路过', value: `${a.caught} · ${a.nearMiss} · ${a.passedBy}` },
    { label: '财富最高', value: `${Math.round(a.bestWealth)}` },
    { label: '最幸福的一年', value: `${a.bestYear}` },
  ];
  const cellW = contentWidth / cells.length;
  cells.forEach((cell, i) => {
    const cx = left + cellW * i;
    ctx.fillStyle = '#8b8477';
    ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(cell.label, cx, stripY + 30);
    ctx.fillStyle = '#f4efe4';
    ctx.font = 'bold 40px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(cell.value, cx, stripY + 66);
  });

  // 5. 人生地图
  const mapY = stripY + 190;
  ctx.fillStyle = '#8b8477';
  ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('一生一年一格，越亮越幸福', left, mapY);

  const perRow = 22;
  const gap = 5;
  const cell = Math.floor((contentWidth - gap * (perRow - 1)) / perRow);
  snapshots.forEach((s, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    ctx.fillStyle = happinessColor(s.happiness);
    ctx.fillRect(left + col * (cell + gap), mapY + 44 + row * (cell + gap), cell, cell);
  });

  // 6. 页脚
  ctx.fillStyle = '#6b6558';
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(`生逢其时 · ${birth.year}—${death.year}`, left, H - 190);
  ctx.fillStyle = '#8b8477';
  ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
  const hook = `想知道 ${birth.year + (birth.year % 2 === 0 ? 1 : -1)} 年生的人这一局是什么命？把链接发给他。`;
  wrapLines(ctx, hook, contentWidth, 2).forEach((line, i) => {
    ctx.fillText(line, left, H - 150 + i * 32);
  });

  ctx.restore();
}
