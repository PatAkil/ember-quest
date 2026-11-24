import type { Policy } from './model';

type PolicyChoices = Pick<Policy, 'stowOrEquip' | 'dropWhich' | 'upgradeTarget' | 'prepare'>;

export const DEFAULT_CHOICES: PolicyChoices = {
  stowOrEquip: () => 'EQUIP',
  dropWhich: (hero) => hero.pack.length,
  upgradeTarget: () => 0,
  prepare: () => undefined,
};
