import { describe, expect, it } from 'vitest';
import { sceneForContext } from '../../src/data/props';
import { Game } from '../../src/engine/game';

/**
 * 家人列表的两个不变量。
 * 这两条都是"跑起来才看得见"的 bug：截图里才会发现 0 岁的婴儿坐在教室里、
 * 兄弟姐妹那一栏出现一个和主角同名的人。
 */
describe('家人', () => {
  it('家里没有同名的人（含主角自己）', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const game = new Game({ seed });
      game.start();
      const names = [game.snapshot.birth.name, ...game.snapshot.family.map((m) => m.name)];
      expect(new Set(names).size, `seed ${seed}: ${names.join('/')}`).toBe(names.length);
    }
  });

  it('学龄前的场景是"家"，不是教室', () => {
    // 场景由 sceneForContext 决定，这里直接查它在 0–5 岁的取值
    // （城市 → living，农村 → yard），避免以后再出现"婴儿坐教室"。
    for (let age = 0; age < 6; age++) {
      expect(sceneForContext({ age, urban: true, role: 'none' })).toBe('living');
      expect(sceneForContext({ age, urban: false, role: 'none' })).toBe('yard');
    }
    expect(sceneForContext({ age: 8, urban: true, role: 'none' })).toBe('classroom');
  });
});
