import { createTactic, type Tactic } from '@footebas/domain';

export function defaultTactic(): Tactic {
  return createTactic({
    formation: '4-4-2',
    mentality: 'balanced',
    attackDirection: 'center',
    marking: 'heavy',
    buildUp: 'mixed',
    focus: 'balanced',
    press: 'medium',
    defensiveLine: 'normal',
    markingStyle: 'mixed',
  });
}
