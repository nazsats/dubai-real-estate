export function aed(value: number, compact = true): string {
  if (compact) {
    if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
    if (value >= 1_000) return `AED ${(value / 1_000).toFixed(0)}K`;
  }
  return `AED ${Math.round(value).toLocaleString()}`;
}

export function num(value: number): string {
  return value.toLocaleString();
}
