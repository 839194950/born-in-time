import { describe, expect, it } from 'vitest';
import { rollBirth } from '../../src/engine/birth';
import { simulatePeers } from '../../src/engine/peers';
import { createRng } from '../../src/engine/rng';

describe('同年对照组', () => {
  const player = { ...rollBirth(createRng(3)), year: 1985 };

  it('生成 3 个同年出生的人，且至少一人与玩家城乡不同', () => {
    const peers = simulatePeers(player, 4242);
    expect(peers).toHaveLength(3);
    for (const p of peers) expect(p.birth.year).toBe(1985);
    expect(peers.some((p) => p.birth.urban !== player.urban)).toBe(true);
  });

  it('同一种子同一出生，结果完全一致（确定性）', () => {
    const a = simulatePeers(player, 777);
    const b = simulatePeers(player, 777);
    expect(a.map((p) => [p.birth.name, p.deathAge, p.titleName])).toEqual(
      b.map((p) => [p.birth.name, p.deathAge, p.titleName]),
    );
  });

  it('每个人的一生数据完整且合理', () => {
    const peers = simulatePeers(player, 1001);
    for (const p of peers) {
      expect(p.deathAge).toBeGreaterThanOrEqual(25);
      expect(p.deathAge).toBeLessThanOrEqual(115);
      expect(p.titleName.length).toBeGreaterThan(0);
      expect(p.yearly.length).toBe(p.deathAge);
      expect(p.bestYear - p.birth.year).toBeGreaterThanOrEqual(8);
      expect(p.finalStats.wealth).toBeGreaterThanOrEqual(0);
      expect(p.finalStats.wealth).toBeLessThanOrEqual(100);
    }
  });

  it('不同种子给出不同的对照组', () => {
    const a = simulatePeers(player, 1);
    const b = simulatePeers(player, 2);
    expect(a.map((p) => p.birth.name)).not.toEqual(b.map((p) => p.birth.name));
  });
});
