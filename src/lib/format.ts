export function money(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `$${value.toFixed(2)}`;
}

export function number(value?: number | null, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return value.toFixed(digits);
}

export function pct(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function signalTone(label: string): string {
  if (label.includes('多')) return 'text-bull bg-emerald-50 border-emerald-200';
  if (label.includes('空')) return 'text-bear bg-red-50 border-red-200';
  return 'text-amber bg-amber-50 border-amber-200';
}

export function directionCn(direction: string): string {
  if (direction === 'uptrend') return '上升通道';
  if (direction === 'downtrend') return '下降通道';
  return '横盘通道';
}
