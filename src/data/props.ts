import type { OutfitRole } from '../ui/lib/pixel';

export type PropSlot = 'building' | 'vehicle' | 'street' | 'screen';

export interface PropPlacement {
  slot: PropSlot;
  id: string;
  label: string;
}

/**
 * 道具年代替代表：只存“什么时候换成什么”，绘制由 ui/lib/scene.ts 负责。
 * 来源：常见家庭用品普及时间（国家统计局耐用消费品百户拥有量）。
 */
const TIMELINE: readonly { slot: PropSlot; entries: readonly { from: number; id: string; label: string }[] }[] = [
  {
    slot: 'building',
    entries: [
      { from: 1977, id: 'earth', label: '土坯房' },
      { from: 1988, id: 'brick', label: '砖房' },
      { from: 1998, id: 'midrise', label: '多层楼' },
      { from: 2010, id: 'tower', label: '高楼' },
    ],
  },
  {
    slot: 'vehicle',
    entries: [
      { from: 1977, id: 'bike', label: '自行车' },
      { from: 1995, id: 'motor', label: '摩托车' },
      { from: 2008, id: 'car', label: '汽车' },
      { from: 2020, id: 'ev', label: '电动车' },
    ],
  },
  {
    slot: 'street',
    entries: [
      { from: 1977, id: 'dirt', label: '土路' },
      { from: 1993, id: 'asphalt', label: '柏油路' },
      { from: 2010, id: 'lamp', label: '路灯' },
    ],
  },
  {
    slot: 'screen',
    entries: [
      { from: 1985, id: 'tv-bw', label: '黑白电视' },
      { from: 1995, id: 'tv-color', label: '彩电' },
      { from: 2008, id: 'tv-lcd', label: '液晶电视' },
      { from: 2016, id: 'tv-flat', label: '挂墙大屏' },
    ],
  },
];

export function propsForYear(year: number): PropPlacement[] {
  const out: PropPlacement[] = [];
  for (const slot of TIMELINE) {
    let current: { id: string; label: string } | null = null;
    for (const entry of slot.entries) {
      if (year >= entry.from) current = entry;
    }
    if (current) out.push({ slot: slot.slot, id: current.id, label: current.label });
  }
  return out;
}

export type SceneId = 'yard' | 'classroom' | 'factory' | 'street' | 'rental' | 'living' | 'office' | 'late';

export const SCENES: readonly { id: SceneId; name: string; mode: 'outdoor' | 'indoor' }[] = [
  { id: 'yard', name: '农村小院', mode: 'outdoor' },
  { id: 'classroom', name: '教室', mode: 'indoor' },
  { id: 'factory', name: '工厂大院', mode: 'outdoor' },
  { id: 'street', name: '街道', mode: 'outdoor' },
  { id: 'rental', name: '出租屋', mode: 'indoor' },
  { id: 'living', name: '商品房客厅', mode: 'indoor' },
  { id: 'office', name: '办公室', mode: 'indoor' },
  { id: 'late', name: '晚年居所', mode: 'indoor' },
];

/** 按年龄、城乡与身份选一张场景，不做随机 */
export function sceneForContext(ctx: { age: number; urban: boolean; role: OutfitRole }): SceneId {
  if (ctx.age < 12) return ctx.urban ? 'classroom' : 'yard';
  if (ctx.age < 23) return 'classroom';
  if (ctx.role === 'worker') return 'factory';
  if (ctx.age < 32) return 'rental';
  if (ctx.age < 46) return ctx.urban ? 'living' : 'street';
  if (ctx.age < 60) return ctx.urban ? 'office' : 'street';
  return 'late';
}

/**
 * 场景色调随年份滑动：80 年代褪色胶片 → 90 年代微暖 → 2000 年代后干净明亮。
 */
export function toneFilter(year: number): string {
  const t = Math.min(1, Math.max(0, (year - 1977) / 33));
  const saturate = 0.75 + t * 0.35;
  const sepia = 0.28 * (1 - t);
  const contrast = 0.92 + t * 0.1;
  const brightness = 0.94 + t * 0.08;
  return `saturate(${saturate.toFixed(3)}) sepia(${sepia.toFixed(3)}) contrast(${contrast.toFixed(3)}) brightness(${brightness.toFixed(3)})`;
}
