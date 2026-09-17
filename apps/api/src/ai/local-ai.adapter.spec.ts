import { StatisticalInsightGenerator, WeightedActivityClassifier } from './local-ai.adapter';

describe('WeightedActivityClassifier', () => {
  const classifier = new WeightedActivityClassifier();
  it('classifies work and exposes its matched evidence', () => { const result = classifier.classify({ application: 'Code.exe', windowTitle: 'GitHub project', idleSeconds: 0 }); expect(result.category).toBe('WORK'); expect(result.productive).toBe(true); expect(result.explanation.matchedTerms).toEqual(expect.arrayContaining(['code', 'github'])); expect(result.confidence).toBeGreaterThan(0); });
  it('always classifies long inactivity as idle', () => expect(classifier.classify({ application: 'Code.exe', idleSeconds: 60 })).toMatchObject({ category: 'IDLE', confidence: 1, productive: false }));
  it('uses OTHER when no feature is recognized', () => expect(classifier.classify({ application: 'custom.exe', idleSeconds: 0 }).category).toBe('OTHER'));
});

describe('StatisticalInsightGenerator', () => {
  it('detects declining trends and returns evidence-based recommendations', () => {
    const result = new StatisticalInsightGenerator().generate({ daily: [{ date: '2026-08-01', productivityScore: 90, focusScore: 80, activeSeconds: 100, idleSeconds: 10 }, { date: '2026-08-02', productivityScore: 70, focusScore: 60, activeSeconds: 80, idleSeconds: 30 }, { date: '2026-08-03', productivityScore: 50, focusScore: 40, activeSeconds: 50, idleSeconds: 50 }], categories: [{ category: 'IDLE', seconds: 50 }, { category: 'WORK', seconds: 100 }] });
    expect(result.summary).toMatchObject({ direction: 'DECLINING', slope: -20, analyzedDays: 3 });
    expect(result.recommendations).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'REDUCE_IDLE_TIME' }), expect.objectContaining({ code: 'REVIEW_DECLINING_TREND' })]));
  });
});
