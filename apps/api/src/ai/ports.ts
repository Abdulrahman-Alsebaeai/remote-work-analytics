import { ActivityCategory } from '@prisma/client';

export interface ClassificationInput { application?: string; windowTitle?: string; websiteTitle?: string; idleSeconds: number }
export interface ClassificationResult { category: ActivityCategory; confidence: number; productive: boolean; explanation: { matchedTerms: string[]; scores: Record<ActivityCategory, number> } }
export interface ActivityClassifier { readonly key: string; readonly version: string; classify(input: ClassificationInput): ClassificationResult }

export interface InsightInput {
  daily: Array<{ date: string; productivityScore: number; focusScore: number; activeSeconds: number; idleSeconds: number }>;
  categories: Array<{ category: ActivityCategory; seconds: number }>;
}
export interface InsightOutput { summary: Record<string, unknown>; insights: Array<Record<string, unknown>>; recommendations: Array<Record<string, unknown>> }
export interface InsightGenerator { generate(input: InsightInput): InsightOutput }

export const ACTIVITY_CLASSIFIER = Symbol('ACTIVITY_CLASSIFIER');
export const INSIGHT_GENERATOR = Symbol('INSIGHT_GENERATOR');
