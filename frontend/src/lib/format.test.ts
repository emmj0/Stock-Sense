import { describe, test, expect } from 'vitest';
import { parseNum, parsePct, videoKey, outlookLabel } from './format';

describe('parseNum', () => {
  test('strips commas and parses', () => {
    expect(parseNum('1,867,934')).toBe(1867934);
    expect(parseNum('60.14')).toBeCloseTo(60.14);
  });
  test('falls back to 0 for empty/invalid', () => {
    expect(parseNum(undefined)).toBe(0);
    expect(parseNum('')).toBe(0);
    expect(parseNum('abc')).toBe(0);
  });
});

describe('parsePct', () => {
  test('strips % and sign handling', () => {
    expect(parsePct('1.95%')).toBeCloseTo(1.95);
    expect(parsePct('-2.50%')).toBeCloseTo(-2.5);
    expect(parsePct('+8.14%')).toBeCloseTo(8.14);
  });
  test('defaults to 0', () => {
    expect(parsePct(undefined)).toBe(0);
  });
});

describe('videoKey', () => {
  test('prefers youtubeId, then query, then title', () => {
    expect(videoKey({ youtubeId: 'abc123', query: 'q', title: 't' })).toBe('abc123');
    expect(videoKey({ query: 'some query', title: 't' })).toBe('some query');
    expect(videoKey({ title: 'only title' })).toBe('only title');
  });
});

describe('outlookLabel', () => {
  test('soft direction thresholds (no buy/sell/hold)', () => {
    expect(outlookLabel(3)).toBe('Could go up');
    expect(outlookLabel(-3)).toBe('Could go down');
    expect(outlookLabel(0.5)).toBe('Likely steady');
  });
});
