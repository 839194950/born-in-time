import {
  BIRTH_YEARS,
  cohortLifeExpectancy,
  jobPool,
  onlyChildChance,
  tierWeights,
  urbanizationRate,
  yearWeight,
} from '../data/demography';
import { pickName } from '../data/names';
import { PROVINCES } from '../data/provinces';
import type { Rng } from './rng';
import type { Birth, Gender } from './types';

/** 一局的开局三件套：年份 → 城乡 → 家庭。顺序固定，换顺序会改变同种子的结果。 */
export function rollBirth(rng: Rng): Birth {
  const year = rng.weighted(BIRTH_YEARS.map((y) => ({ v: y, w: yearWeight(y) })));
  const urbanRate = urbanizationRate(year);
  const urban = rng.chance(urbanRate);
  const gender: Gender = rng.chance(0.5) ? 'male' : 'female';

  const pool = jobPool(year, urban).map((j) => ({ v: j.id, w: j.w }));
  const fatherJob = rng.weighted(pool);
  const motherJob = rng.weighted(pool);

  const tier = rng.weighted(tierWeights(year, urban).map((t) => ({ v: t.tier, w: t.w })));
  const only = rng.chance(onlyChildChance(year, urban));
  const siblings = only ? 0 : rng.int(1, 3);

  const province = rng.weighted(PROVINCES.map((p) => ({ v: p.name, w: p.w })));
  const name = pickName(rng, gender, year);
  const month = rng.int(1, 12);

  return {
    year,
    month,
    province,
    urban,
    gender,
    name,
    fatherJob,
    motherJob,
    tier,
    siblings,
    urbanizationRate: urbanRate,
    cohortLifeExpectancy: cohortLifeExpectancy(year, urban),
  };
}
