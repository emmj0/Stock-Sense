/** Parse a numeric string that may contain commas (e.g. "1,867,934") → number. */
export function parseNum(s?: string): number {
  return parseFloat((s || '0').replace(/,/g, '')) || 0;
}

/** Parse a percent/number string that may contain % or commas (e.g. "+1.95%") → number. */
export function parsePct(s?: string): number {
  return parseFloat((s || '0').replace(/[%,]/g, '')) || 0;
}

/** Stable key for a course video, used to track which videos a user has watched. */
export function videoKey(v: { youtubeId?: string; query?: string; title?: string }): string {
  return v.youtubeId || v.query || v.title || '';
}

/** Soft directional label for a predicted return (no hard buy/sell/hold). */
export function outlookLabel(ret: number): 'Could go up' | 'Could go down' | 'Likely steady' {
  if (ret > 1.5) return 'Could go up';
  if (ret < -1.5) return 'Could go down';
  return 'Likely steady';
}
