import { describe, expect, it } from 'vitest';
import { STILLS, stillForEvent } from '../../src/data/stills';

describe('定格时刻', () => {
  it('六个定格齐全', () => {
    expect(STILLS).toHaveLength(6);
    expect(new Set(STILLS.map((s) => s.id)).size).toBe(6);
  });

  it('关键事件能映射到定格', () => {
    expect(stillForEvent('stage_gaokao')?.id).toBe('gaokao');
    expect(stillForEvent('stage_marriage')?.id).toBe('wedding');
    expect(stillForEvent('stage_retire')?.id).toBe('retire');
    expect(stillForEvent('era_housing_reform_1998')?.id).toBe('home');
  });

  it('普通事件不触发定格', () => {
    expect(stillForEvent('stage_job_hop')).toBeNull();
  });

  it('除“最后的时刻”外，每个定格都至少挂一个事件', () => {
    for (const s of STILLS) {
      if (s.id === 'last') continue;
      expect(s.eventIds.length).toBeGreaterThan(0);
    }
  });
});
