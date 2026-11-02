import type { Metadata } from 'next';
import Image from 'next/image';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { Icon } from '@/components/ui/Icon';
import { ProForms } from '@/components/pro/ProForms';
import s from '@/components/pro/Pro.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/professionals', t.pro.title, t.pro.intro);
}

export default async function ProfessionalsPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const p = t.pro;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: p.title }]} title={p.title} intro={p.intro} />
      <div className="wrap">
        <dl className={s.facts}>
          {p.facts.map((f) => (
            <div key={f.label} className={s.fact}>
              <dt className={`${s.factValue} nums`}>{f.value}</dt>
              <dd className={s.factLabel}>{f.label}</dd>
            </div>
          ))}
        </dl>

        <section className={s.library} aria-labelledby="pro-lib">
          <div className={s.libHead}>
            <h2 id="pro-lib" className={s.libTitle}>
              {p.library.title}
            </h2>
            <p className="example-tag">{p.library.note}</p>
          </div>
          <ul className={s.items}>
            {p.library.items.map((it) => {
              const isImg = it.file.endsWith('.png');
              const ext = it.file.split('.').pop()!.toUpperCase();
              return (
                <li key={it.file} className={s.item}>
                  <a href={`/downloads/${it.file}`} download>
                    <span className={s.thumb}>
                      {isImg ? (
                        <Image src={`/downloads/${it.file}`} alt="" width={800} height={800} sizes="(max-width: 600px) 50vw, 220px" quality={75} />
                      ) : (
                        <span className={s.fileIcon} aria-hidden="true">
                          <Icon name="download" size={30} />
                          <span>{ext}</span>
                        </span>
                      )}
                    </span>
                    <span className={s.itemTitle}>{it.title}</span>
                    <span className={s.itemMeta}>
                      <span>{it.type}</span>
                      <span>
                        <Icon name="download" size={14} />
                        {p.library.download}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <ProForms locale={locale} t={p} common={t.common} />
      </div>
    </>
  );
}
