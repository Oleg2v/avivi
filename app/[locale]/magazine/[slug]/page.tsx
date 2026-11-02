import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/lib/dict';
import { href, isLocale, localeTag, locales, type Locale } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { articleArt } from '@/lib/magazine';
import { fmt } from '@/lib/fmt';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Icon } from '@/components/ui/Icon';
import s from '@/components/magazine/Magazine.module.css';
import ph from '@/components/ui/PageHead.module.css';

type Params = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  const slugs = getDict('en').magazine.articles.map((a) => a.slug);
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

async function load(params: Params['params']) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'he';
  const t = getDict(locale);
  const article = t.magazine.articles.find((a) => a.slug === slug);
  return { locale, t, article };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, article } = await load(params);
  if (!article) return {};
  return pageMeta(locale, `/magazine/${article.slug}`, article.title, article.dek);
}

export default async function ArticlePage({ params }: Params) {
  const { locale, t, article } = await load(params);
  if (!article) notFound();
  const m = t.magazine;
  const art = articleArt[article.slug];
  const date = new Intl.DateTimeFormat(localeTag[locale], { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <article className={`wrap ${s.article}`} style={{ paddingBlockStart: 'clamp(120px, 14vw, 200px)' }}>
      <nav aria-label="Breadcrumb" className={ph.crumbs}>
        <ol>
          <li>
            <Link href={href(locale, '/')}>{t.nav.home}</Link>
          </li>
          <li>
            <Link href={href(locale, '/magazine')}>{m.title}</Link>
          </li>
          <li>
            <span aria-current="page">{article.title}</span>
          </li>
        </ol>
      </nav>
      <header className={s.head}>
        <p className={s.meta}>
          <span className={s.cat}>{article.category}</span>
          <time dateTime={article.date}>{date.format(new Date(article.date))}</time>
          <span>{fmt(m.readTime, { n: article.minutes })}</span>
          <span className="example-tag">{m.demo}</span>
        </p>
        <h1 className={`lines ${s.aTitle}`}>
          <span className="line">
            <span>{article.title}</span>
          </span>
        </h1>
        <p className={s.aDek}>{article.dek}</p>
      </header>
      <PhotoSlot name={art?.image} alt={article.title} art={t.meta.renderNote} artLabel={t.meta.artDirection} renderLabel={t.meta.render} slotLabel={t.meta.photoSlot} ratio="16 / 9" priority sizes="(max-width: 1720px) 100vw, 1600px" />
      <div className={s.body}>
        {article.body.map((b, i) =>
          b.type === 'h' ? (
            <h2 key={i}>{b.text}</h2>
          ) : b.type === 'quote' ? (
            <blockquote key={i}>{b.text}</blockquote>
          ) : (
            <p key={i}>{b.text}</p>
          ),
        )}
      </div>
      <footer className={s.foot}>
        <div className={s.actions}>
          {art ? (
            <Link href={href(locale, art.tool.path)} className="btn" data-magnetic>
              {t.common[art.tool.key]}
              <Icon name="arrow" className="arrow" />
            </Link>
          ) : null}
          <Link href={href(locale, '/designer')} className="btn btn-ghost">
            {t.common.askDesigner}
          </Link>
        </div>
        <Link href={href(locale, '/magazine')} className="link-line t-small">
          {m.back}
        </Link>
      </footer>
    </article>
  );
}
