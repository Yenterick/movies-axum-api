export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs}`;
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e4) return `${(value / 1e3).toFixed(0)}K`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function multiple(roi: number | null | undefined): string {
  if (roi === null || roi === undefined) return '—';
  // ROI is (revenue - budget) / budget, so the revenue multiple is roi + 1
  const x = roi + 1;
  return `${x >= 100 ? x.toFixed(0) : x.toFixed(1)}×`;
}

export function year(date: string | null | undefined): string {
  return date ? date.slice(0, 4) : '—';
}

export function rating(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(1);
}

/** Flag emoji from an ISO 3166-1 alpha-2 code. */
export function flag(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return '🏳️';
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** Deterministic gradient for posterless cards, so each title keeps its own colour. */
export function posterGradient(seed: number): string {
  const hue = (seed * 47) % 360;
  return `radial-gradient(120% 90% at 30% 15%, hsl(${hue} 70% 45% / .55), transparent 60%),
    radial-gradient(100% 80% at 90% 100%, hsl(${(hue + 60) % 360} 70% 35% / .5), transparent 55%),
    linear-gradient(160deg, hsl(${hue} 30% 14%), hsl(${(hue + 40) % 360} 35% 7%))`;
}

/** `english` is what gets stored: the API upserts spoken languages by code, overwriting the name. */
export const LANGUAGES: { code: string; name: string; english: string }[] = [
  { code: 'en', name: 'Inglés', english: 'English' }, { code: 'fr', name: 'Francés', english: 'Français' },
  { code: 'es', name: 'Español', english: 'Español' }, { code: 'de', name: 'Alemán', english: 'Deutsch' },
  { code: 'it', name: 'Italiano', english: 'Italiano' }, { code: 'ja', name: 'Japonés', english: '日本語' },
  { code: 'zh', name: 'Chino', english: '普通话' }, { code: 'cn', name: 'Cantonés', english: '广州话 / 廣州話' },
  { code: 'ko', name: 'Coreano', english: '한국어/조선말' }, { code: 'hi', name: 'Hindi', english: 'हिन्दी' },
  { code: 'ru', name: 'Ruso', english: 'Pусский' }, { code: 'pt', name: 'Portugués', english: 'Português' },
  { code: 'da', name: 'Danés', english: 'Dansk' }, { code: 'sv', name: 'Sueco', english: 'svenska' },
  { code: 'nl', name: 'Neerlandés', english: 'Nederlands' }, { code: 'fa', name: 'Persa', english: 'فارسی' },
  { code: 'he', name: 'Hebreo', english: 'עִבְרִית' }, { code: 'th', name: 'Tailandés', english: 'ภาษาไทย' },
];
