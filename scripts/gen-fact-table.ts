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

const rows = [...ALL_EVENTS]
  .sort((a, b) => {
    const ay = a.trigger.type === 'year' ? a.trigger.year : 0;
    const by = b.trigger.type === 'year' ? b.trigger.year : 0;
    return ay - by || a.id.localeCompare(b.id);
  })
  .map((ev) => `| \`${ev.id}\` | ${layerName(ev)} | ${when(ev)} | ${windowOf(ev)} | ${ev.title} | ${ev.source} | 待核 |`)
  .join('\n');

const content = `# 史实核对表

> 规格 §10 要求：史实年份与政策节点逐条核对，宁可少写，不可记错。
> 本表由 \`npm run fact-table\` 从 \`src/data/events/\` 自动生成，核对后把“待核”改成“已核”，并在第二列补上链接。
> 共 ${ALL_EVENTS.length} 条。

| 事件 id | 层级 | 时间 | 黄金窗口 | 说法 | 出处（待补链接） | 状态 |
|---|---|---|---|---|---|---|
${rows}

## 已确认的口径

- 出生年份范围 1977–2002；城镇化率取《中国统计年鉴》逐年精确值（2000 年那道跳升是第五次全国人口普查口径调整）。
- 队列预期寿命：1977 年城镇约 70、农村约 66；2002 年城镇约 78、农村约 72。
- 2026 年以后的条目一律标注“推演”，不得写成既成事实。
- 所有条目不得出现价值判断、血腥描写与自伤内容。
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, content, 'utf8');
console.log(`wrote ${OUT} (${ALL_EVENTS.length} rows)`);
