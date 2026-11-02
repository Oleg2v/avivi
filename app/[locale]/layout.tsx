import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { dirOf, isLocale, locales, type Locale } from '@/lib/i18n';
import { getDict } from '@/lib/dict';
import { fontClasses } from '@/lib/fonts';
import { ClientShell } from '@/components/providers/ClientShell';
import { Footer } from '@/components/layout/Footer';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(isLocale(locale) ? locale : 'he');
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t.meta.titleSuffix, template: `%s · ${t.meta.titleSuffix}` },
    description: t.meta.description,
    applicationName: t.meta.siteName,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F0EA' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
};

/** Runs before first paint: marks JS as available and applies saved accessibility settings. */
const bootScript = `(function(){var d=document.documentElement;d.classList.remove('no-js');try{var p=JSON.parse(localStorage.getItem('avivi-a11y')||'{}');if(p.text)d.dataset.a11yText=p.text;if(p.contrast)d.dataset.a11yContrast='high';if(p.motion)d.dataset.a11yMotion='reduce';if(p.links)d.dataset.a11yLinks='underline';}catch(e){}})();`;

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = getDict(locale);
  const dir = dirOf(locale);
  const clientT = { nav: t.nav, common: t.common, a11y: t.a11y, cookie: t.cookie, designer: t.designer, meta: t.meta, notFound: t.notFound };

  return (
    <html lang={locale} dir={dir} className={`no-js ${fontClasses(locale)}`} suppressHydrationWarning>
      <head>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          {t.nav.skip}
        </a>
        <ClientShell locale={locale} dir={dir} t={clientT}>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer locale={locale} t={t} />
        </ClientShell>
      </body>
    </html>
  );
}
