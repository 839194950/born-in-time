import type { Rng } from '../engine/rng';
import type { Gender } from '../engine/types';

/** 常见姓氏，年代差异可忽略 */
export const SURNAMES: readonly string[] = [
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗',
  '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
];

interface NameEra {
  from: number;
  to: number;
  male: readonly string[];
  female: readonly string[];
}

/**
 * 年代风格名库。分段只为避免“1977 年生叫子涵”，不求真实姓名统计。
 * 来源：无（原创名库，按年代语感划分）。
 */
const ERA_NAMES: readonly NameEra[] = [
  {
    from: 1977,
    to: 1989,
    male: ['建国', '建军', '建华', '志强', '国强', '伟', '军', '勇', '涛', '磊', '鹏', '辉', '刚', '明', '杰', '峰', '亮', '波', '斌', '超', '卫东', '红兵'],
    female: ['丽', '娟', '敏', '静', '艳', '芳', '燕', '霞', '红', '梅', '兰', '玲', '莉', '慧', '琴', '秀英', '桂英', '玉兰', '春燕', '晓梅'],
  },
  {
    from: 1990,
    to: 1999,
    male: ['磊', '浩', '宇', '鑫', '涛', '俊', '杰', '鹏', '超', '阳', '晨', '博', '帅', '明', '亮', '一鸣'],
    female: ['静', '婷', '雪', '颖', '倩', '娜', '敏', '丽', '芳', '丹', '玲', '洁', '露', '欣', '悦', '梦瑶'],
  },
  {
    from: 2000,
    to: 2002,
    male: ['子轩', '浩然', '宇轩', '浩宇', '俊杰', '宇航', '天佑', '铭轩', '泽宇', '一诺'],
    female: ['欣怡', '子涵', '雨涵', '思彤', '佳怡', '梓涵', '诗涵', '可欣', '依诺', '语汐'],
  },
];

/** 早于第一段的年份（如父母出生年）归入第一段，避免 1953 年生的人叫“子轩” */
function eraFor(year: number): NameEra {
  for (const era of ERA_NAMES) if (year <= era.to) return era;
  return ERA_NAMES[ERA_NAMES.length - 1]!;
}

/** 该年代该性别的候选名，测试与调试用 */
export function givenNames(year: number, gender: Gender): readonly string[] {
  const era = eraFor(year);
  return gender === 'male' ? era.male : era.female;
}

export function pickName(rng: Rng, gender: Gender, year: number): string {
  return rng.pick(SURNAMES) + rng.pick(givenNames(year, gender));
}
