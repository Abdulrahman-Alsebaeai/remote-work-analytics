import { Injectable } from '@nestjs/common';
import { ActivityCategory } from '@prisma/client';
import { ActivityClassifier, ClassificationInput, ClassificationResult, InsightGenerator, InsightInput, InsightOutput } from './ports';

const categories: ActivityCategory[] = ['WORK', 'COMMUNICATION', 'BROWSING', 'ENTERTAINMENT', 'OTHER'];
const terms: Record<ActivityCategory, string[]> = {
  WORK: ['code', 'visual studio', 'github', 'gitlab', 'jira', 'excel', 'word', 'powerpoint', 'figma', 'documentation', 'docs', 'terminal', 'powershell'],
  COMMUNICATION: ['teams', 'slack', 'zoom', 'meet', 'outlook', 'mail', 'gmail', 'discord'],
  BROWSING: ['chrome', 'edge', 'firefox', 'brave', 'browser', 'search'],
  ENTERTAINMENT: ['youtube', 'netflix', 'spotify', 'steam', 'tiktok', 'instagram', 'facebook', 'game'],
  IDLE: [], OTHER: [],
};

@Injectable()
export class WeightedActivityClassifier implements ActivityClassifier {
  readonly key = 'weighted-activity-classifier'; readonly version = '1.0.0';
  classify(input: ClassificationInput): ClassificationResult {
    if (input.idleSeconds >= 60) return { category: 'IDLE', confidence: 1, productive: false, explanation: { matchedTerms: ['idle>=60s'], scores: { WORK: 0, COMMUNICATION: 0, BROWSING: 0, ENTERTAINMENT: 0, IDLE: 1, OTHER: 0 } } };
    const text = [input.application, input.windowTitle, input.websiteTitle].filter(Boolean).join(' ').toLocaleLowerCase();
    const scores = { WORK: 0.1, COMMUNICATION: 0.08, BROWSING: 0.06, ENTERTAINMENT: 0.04, IDLE: 0, OTHER: 0.2 } satisfies Record<ActivityCategory, number>;
    const matches = new Map<ActivityCategory, string[]>();
    for (const category of categories) for (const term of terms[category]) if (text.includes(term)) { scores[category] += term.includes(' ') ? 1.4 : 1; matches.set(category, [...(matches.get(category) ?? []), term]); }
    const category = categories.reduce((best, current) => scores[current] > scores[best] ? current : best, 'OTHER' as ActivityCategory);
    const exponentials = categories.map(value => Math.exp(scores[value])); const confidence = exponentials[categories.indexOf(category)] / exponentials.reduce((sum, value) => sum + value, 0);
    return { category, confidence: Number(confidence.toFixed(4)), productive: category === 'WORK' || category === 'COMMUNICATION', explanation: { matchedTerms: matches.get(category) ?? [], scores } };
  }
}

@Injectable()
export class StatisticalInsightGenerator implements InsightGenerator {
  generate(input: InsightInput): InsightOutput {
    const totalSeconds = input.categories.reduce((sum, row) => sum + row.seconds, 0); const byCategory = Object.fromEntries(input.categories.map(row => [row.category, row.seconds]));
    const slope = this.slope(input.daily.map(row => row.productivityScore)); const direction = slope > 1 ? 'IMPROVING' : slope < -1 ? 'DECLINING' : 'STABLE';
    const idleRatio = totalSeconds ? (byCategory.IDLE ?? 0) / totalSeconds : 0; const entertainmentRatio = totalSeconds ? (byCategory.ENTERTAINMENT ?? 0) / totalSeconds : 0;
    const insights: Array<Record<string, unknown>> = [{ code: 'PRODUCTIVITY_TREND', direction, slope: Number(slope.toFixed(2)), evidenceDays: input.daily.length }, { code: 'BEHAVIOR_DISTRIBUTION', categorySeconds: byCategory, totalSeconds }];
    const recommendations: Array<Record<string, unknown>> = [];
    if (idleRatio > 0.25) recommendations.push({ code: 'REDUCE_IDLE_TIME', severity: idleRatio > 0.4 ? 'HIGH' : 'MEDIUM', evidence: { idleRatio: Number(idleRatio.toFixed(3)) } });
    if (entertainmentRatio > 0.15) recommendations.push({ code: 'LIMIT_ENTERTAINMENT', severity: 'MEDIUM', evidence: { entertainmentRatio: Number(entertainmentRatio.toFixed(3)) } });
    if (direction === 'DECLINING') recommendations.push({ code: 'REVIEW_DECLINING_TREND', severity: 'HIGH', evidence: { slope: Number(slope.toFixed(2)) } });
    if (!recommendations.length && input.daily.length) recommendations.push({ code: 'MAINTAIN_CURRENT_PATTERN', severity: 'LOW', evidence: { direction } });
    return { summary: { direction, slope: Number(slope.toFixed(2)), totalSeconds, analyzedDays: input.daily.length }, insights, recommendations };
  }
  private slope(values: number[]) { if (values.length < 2) return 0; const meanX = (values.length - 1) / 2; const meanY = values.reduce((sum, value) => sum + value, 0) / values.length; const numerator = values.reduce((sum, value, index) => sum + (index - meanX) * (value - meanY), 0); const denominator = values.reduce((sum, _value, index) => sum + (index - meanX) ** 2, 0); return denominator ? numerator / denominator : 0; }
}
