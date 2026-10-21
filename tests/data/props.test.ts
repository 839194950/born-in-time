import { describe, expect, it } from 'vitest';
import { SCENES, propsForYear, sceneForContext, toneFilter } from '../../src/data/props';

const prop = (year: number, slot: string) => propsForYear(year).find((p) => p.slot === slot);

describe('道具年代替代表', () => {
  it('黑白电视 1985 年才有，2008 年换成液晶', () => {
    expect(prop(1980, 'screen')).toBeUndefined();
    expect(prop(1990, 'screen')?.id).toBe('tv-bw');
    expect(prop(2010, 'screen')?.id).toBe('tv-lcd');
  });

  it('交通与建筑随年代换代', () => {
    expect(prop(1980, 'vehicle')?.id).toBe('bike');
    expect(prop(2000, 'vehicle')?.id).toBe('motor');
    expect(prop(2022, 'vehicle')?.id).toBe('ev');
    expect(prop(1980, 'building')?.id).toBe('earth');
    expect(prop(2022, 'building')?.id).toBe('tower');
  });

  it('任何年份都不会缺建筑与交通', () => {
    for (let y = 1977; y <= 2060; y += 1) {
      expect(prop(y, 'building')).toBeDefined();
      expect(prop(y, 'vehicle')).toBeDefined();
    }
  });
});

describe('场景选择', () => {
  it('八张场景齐全', () => {
    expect(SCENES).toHaveLength(8);
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(8);
  });

  it('按年龄与城乡选景', () => {
    expect(sceneForContext({ age: 7, urban: false, role: 'none' })).toBe('yard');
    expect(sceneForContext({ age: 7, urban: true, role: 'none' })).toBe('classroom');
    expect(sceneForContext({ age: 30, urban: true, role: 'worker' })).toBe('factory');
    expect(sceneForContext({ age: 28, urban: false, role: 'none' })).toBe('rental');
    expect(sceneForContext({ age: 40, urban: true, role: 'office' })).toBe('living');
    expect(sceneForContext({ age: 75, urban: false, role: 'none' })).toBe('late');
  });
});

describe('年代色调', () => {
  it('80 年代褪色，2010 后干净', () => {
    expect(toneFilter(1985)).not.toBe(toneFilter(2015));
    expect(toneFilter(1977)).toContain('sepia(0.280)');
    expect(toneFilter(2020)).toContain('sepia(0.000)');
  });

  it('年份越界也不炸', () => {
    expect(toneFilter(1900)).toContain('saturate');
    expect(toneFilter(2200)).toContain('saturate');
  });
});
