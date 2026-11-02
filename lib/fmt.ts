/** Replace {tokens} in a string. Safe for client and server. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** Locale-aware number formatting (Hebrew uses Western digits). */
export function num(value: number, locale: string, opts?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(locale, opts).format(value);
  } catch {
    return String(value);
  }
}

/** Short, human reference code, e.g. AV-7Q4K-2611. */
export function refCode(prefix = 'AV'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const rnd = typeof crypto !== 'undefined' && 'getRandomValues' in crypto ? crypto.getRandomValues(new Uint8Array(4)) : null;
  for (let i = 0; i < 4; i++) s += alphabet[(rnd ? rnd[i] : Math.floor(Math.random() * 256)) % alphabet.length];
  const d = new Date();
  return `${prefix}-${s}-${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
}
