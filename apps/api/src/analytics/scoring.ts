export interface ActivitySample {
  duration: number;
  idleSeconds: number;
  keyboardActivity: number;
  mouseActivity: number;
  windowSwitches: number;
  application?: string;
  website?: string;
  idleDuration?: number;
  classification?: 'PRODUCTIVE' | 'UNPRODUCTIVE' | 'UNDEFINED';
}

export interface UsageItem { name: string; seconds: number }
export interface DailyScore {
  trackedSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
  productiveSeconds: number;
  unproductiveSeconds: number;
  undefinedSeconds: number;
  keyboardActivity: number;
  mouseActivity: number;
  windowSwitches: number;
  productivityScore: number;
  focusScore: number;
  applicationUsage: UsageItem[];
  websiteUsage: UsageItem[];
}

const boundedInteger = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : 0)));

export function calculateDailyScore(samples: ActivitySample[]): DailyScore {
  const applications = new Map<string, number>();
  const websites = new Map<string, number>();
  let trackedSeconds = 0; let idleSeconds = 0; let productiveSeconds = 0; let unproductiveSeconds = 0; let undefinedSeconds = 0; let keyboardActivity = 0; let mouseActivity = 0; let windowSwitches = 0;
  for (const sample of samples) {
    const duration = boundedInteger(sample.duration, 1, 300);
    const idle = sample.idleDuration === undefined ? (sample.idleSeconds >= 60 ? duration : 0) : boundedInteger(sample.idleDuration, 0, duration);
    trackedSeconds += duration; idleSeconds += idle;
    if (sample.classification === 'PRODUCTIVE') productiveSeconds += duration;
    else if (sample.classification === 'UNPRODUCTIVE') unproductiveSeconds += duration;
    else undefinedSeconds += duration;
    keyboardActivity += boundedInteger(sample.keyboardActivity, 0, 100_000);
    mouseActivity += boundedInteger(sample.mouseActivity, 0, 100_000);
    windowSwitches += boundedInteger(sample.windowSwitches, 0, 10_000);
    if (sample.application && sample.application !== 'unknown') applications.set(sample.application, (applications.get(sample.application) ?? 0) + duration - idle);
    if (sample.website && sample.website !== '[REDACTED]') websites.set(sample.website, (websites.get(sample.website) ?? 0) + duration - idle);
  }
  const activeSeconds = trackedSeconds - idleSeconds;
  const activeRatio = trackedSeconds ? activeSeconds / trackedSeconds : 0;
  const switchesPerActiveMinute = activeSeconds ? windowSwitches / (activeSeconds / 60) : 0;
  const continuity = activeSeconds ? Math.max(0, 1 - switchesPerActiveMinute / 12) : 0;
  const focusScore = boundedInteger((activeRatio * 0.7 + continuity * 0.3) * 100, 0, 100);
  const productivityScore = boundedInteger((activeRatio * 0.6 + focusScore / 100 * 0.4) * 100, 0, 100);
  const usage = (source: Map<string, number>) => [...source.entries()].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
  return { trackedSeconds, activeSeconds, idleSeconds, productiveSeconds, unproductiveSeconds, undefinedSeconds, keyboardActivity, mouseActivity, windowSwitches, productivityScore, focusScore, applicationUsage: usage(applications), websiteUsage: usage(websites) };
}
