import { describe, expect, it } from 'vitest';
import { elapsedSeconds, formatDuration } from './utils';

describe('session time helpers', () => {
  it('formats short and long sessions as a stable clock', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(-10)).toBe('00:00');
  });

  it('calculates elapsed seconds without allowing negative values', () => {
    const start = '2026-08-04T10:00:00.000Z';
    expect(elapsedSeconds(start, Date.parse('2026-08-04T10:02:05.000Z'))).toBe(125);
    expect(elapsedSeconds(start, Date.parse('2026-08-04T09:59:00.000Z'))).toBe(0);
    expect(elapsedSeconds(null, Date.now())).toBe(0);
  });
});
