import type { Metadata } from 'next';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { site } from '@/lib/site';
import { PageHead } from '@/components/ui/PageHead';
import s from '@/components/app/App.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/app', t.app.title, t.app.intro);
}

export default async function AppPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const a = t.app;
  const nowIndex = 3; // example: production
  const store = (url: string, small: string, label: string) =>
    url ? (
      <a className={s.badge} href={url} target="_blank" rel="noopener noreferrer">
        <small>{small}</small>
        <span>{label}</span>
      </a>
    ) : (
      <span className={s.badge} aria-disabled="true" role="link">
        <small>{small}</small>
        <span>{label}</span>
      </span>
    );
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: a.title }]} title={a.title} intro={a.intro} />
      <div className={`wrap ${s.layout}`}>
        <figure className={s.stage}>
          <div className={s.phone} role="img" aria-label={`${a.stagesTitle}: ${a.stages.join(', ')}`}>
            <span className={s.notch} aria-hidden="true" />
            <div className={s.screen} aria-hidden="true">
              <div className={s.appBar}>
                <span>Avivi Smart &amp; Simple</span>
                <span className="nums">09:41</span>
              </div>
              <p className={s.appTitle}>{a.stagesTitle}</p>
              <ol className={s.track}>
                {a.stages.map((st, i) => (
                  <li key={st} data-state={i < nowIndex ? 'done' : i === nowIndex ? 'now' : 'next'}>
                    <span className={s.dot} />
                    <span>{st}</span>
                    {i === nowIndex ? <span className={s.now}>{a.stageNow}</span> : <span />}
                  </li>
                ))}
              </ol>
              <div className={s.card}>
                <span className={s.cardTitle}>{a.stages[nowIndex + 1]}</span>
                <span className="muted">{t.meta.exampleData}</span>
              </div>
            </div>
          </div>
          <figcaption className="example-tag">{a.screensNote}</figcaption>
        </figure>
        <div>
          <ul className={s.points}>
            {a.points.map((p) => (
              <li key={p.title}>
                <span className={s.pTitle}>{p.title}</span>
                <span className="muted">{p.text}</span>
              </li>
            ))}
          </ul>
          <div className={s.stores}>
            {store(site.appStoreUrl, 'App Store', a.appStore)}
            {store(site.playStoreUrl, 'Google Play', a.googlePlay)}
            {!site.appStoreUrl || !site.playStoreUrl ? <span className="example-tag">{a.storeNote}</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
