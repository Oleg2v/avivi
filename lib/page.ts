import { getDict } from './dict';
import { isLocale, locales, type Locale } from './i18n';

export type LocaleParams = { params: Promise<{ locale: string }> };

export async function resolveLocale(params: LocaleParams['params']): Promise<{ locale: Locale; t: ReturnType<typeof getDict> }> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : 'he';
  return { locale: l, t: getDict(l) };
}

export function localeParams() {
  return locales.map((locale) => ({ locale }));
}
