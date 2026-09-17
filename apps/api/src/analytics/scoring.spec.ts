import { calculateDailyScore } from './scoring';

describe('calculateDailyScore', () => {
  it('calculates deterministic activity, focus, and deduplicated usage totals', () => {
    const result = calculateDailyScore([
      { duration: 10, idleSeconds: 0, keyboardActivity: 4, mouseActivity: 2, windowSwitches: 0, application: 'code.exe', website: 'Documentation' },
      { duration: 10, idleSeconds: 10, keyboardActivity: 1, mouseActivity: 1, windowSwitches: 1, application: 'code.exe' },
      { duration: 10, idleSeconds: 75, keyboardActivity: 0, mouseActivity: 0, windowSwitches: 0, application: 'code.exe' },
    ]);
    expect(result).toMatchObject({ trackedSeconds: 30, activeSeconds: 20, idleSeconds: 10, keyboardActivity: 5, mouseActivity: 3, windowSwitches: 1 });
    expect(result.applicationUsage).toEqual([{ name: 'code.exe', seconds: 20 }]);
    expect(result.websiteUsage).toEqual([{ name: 'Documentation', seconds: 10 }]);
    expect(result.productivityScore).toBeGreaterThanOrEqual(0); expect(result.productivityScore).toBeLessThanOrEqual(100);
    expect(result.focusScore).toBeGreaterThanOrEqual(0); expect(result.focusScore).toBeLessThanOrEqual(100);
  });

  it('returns stable zero scores without samples', () => {
    expect(calculateDailyScore([])).toMatchObject({ trackedSeconds: 0, activeSeconds: 0, idleSeconds: 0, productivityScore: 0, focusScore: 0 });
  });
});
