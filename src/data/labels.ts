import type { Gender, JobId, Tier } from '../engine/types';

export const JOB_LABEL: Record<JobId, string> = {
  farmer: '农民',
  worker: '工人',
  teacher: '教师',
  cadre: '干部',
  soldier: '军人',
  shopclerk: '供销社/商店职员',
  selfEmployed: '个体户',
  townshipWorker: '乡镇企业职工',
  merchant: '经商者',
  entrepreneur: '企业主',
  migrant: '外来务工者',
  officeWorker: '公司职员',
  programmer: '程序员',
};

export const TIER_LABEL: Record<Tier, string> = {
  destitute: '赤贫',
  poor: '贫困',
  normal: '普通',
  wellOff: '小康',
  rich: '富裕',
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: '男',
  female: '女',
};
