import type { Locale } from '@/lib/i18n';

/** Typographic concept wordmark (not Avivi's registered logo). */
export function Wordmark({ locale }: { locale: Locale }) {
  if (locale === 'he') {
    return (
      <span className="wordmark" lang="he">
        <span className="wm-main">אביבי</span>{' '}
        <span className="wm-sub">מטבחים</span>
      </span>
    );
  }
  return (
    <span className="wordmark" lang="en">
      <span className="wm-main">Avivi</span>{' '}
      <span className="wm-sub">Kitchens</span>
    </span>
  );
}
