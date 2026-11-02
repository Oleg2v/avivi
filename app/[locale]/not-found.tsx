'use client';
import Link from 'next/link';
import { href } from '@/lib/i18n';
import { useLocale } from '@/components/providers/LocaleContext';

export default function NotFound() {
  const { locale, t } = useLocale();
  return (
    <section className="wrap section" style={{ minHeight: '72vh', display: 'grid', alignContent: 'center', gap: 24, paddingTop: 140 }}>
      <p className="label muted">404</p>
      <h1 className="t-xl">{t.notFound.title}</h1>
      <p className="lead muted">{t.notFound.text}</p>
      <p>
        <Link className="btn" href={href(locale, '/')}>
          {t.notFound.home}
        </Link>
      </p>
    </section>
  );
}
