'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { href } from '@/lib/i18n';
import { readConsent, writeConsent } from '@/lib/consent';
import { loadAnalytics } from '@/lib/analytics';
import { useLocale } from '@/components/providers/LocaleContext';

/** Consent banner. Non-blocking, fixed, so it never shifts layout. */
export function CookieBanner() {
  const { t, locale } = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onConsent = () => {
      loadAnalytics();
      setShow(false);
    };
    window.addEventListener('avivi:consent', onConsent);
    let timer = 0;
    if (readConsent()) loadAnalytics();
    else timer = window.setTimeout(() => setShow(true), 1400);
    return () => {
      window.removeEventListener('avivi:consent', onConsent);
      window.clearTimeout(timer);
    };
  }, []);

  if (!show) return null;
  return (
    <div className="cookie-banner" role="region" aria-label={t.nav.cookies}>
      <p>
        {t.cookie.text}{' '}
        <Link href={href(locale, '/privacy')} className="link-line">
          {t.common.privacyLink}
        </Link>
      </p>
      <div className="cookie-actions">
        <button type="button" className="btn btn-small" onClick={() => writeConsent({ analytics: true, marketing: true })}>
          {t.cookie.accept}
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => writeConsent({ analytics: false, marketing: false })}>
          {t.cookie.necessary}
        </button>
        <Link href={href(locale, '/cookies')} className="link-line t-small">
          {t.cookie.settings}
        </Link>
      </div>
    </div>
  );
}
