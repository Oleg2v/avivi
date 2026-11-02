'use client';
import Link from 'next/link';
import type { Dict } from '@/content/en';
import { href, type Locale } from '@/lib/i18n';
import { designStore, useMyDesign } from '@/lib/store';
import { track } from '@/lib/analytics';
import { site } from '@/lib/site';
import { Icon } from '@/components/ui/Icon';
import { ProductGlyph } from './ProductGlyph';
import s from './Products.module.css';

export const productCategories: Record<keyof Dict['products']['categories'], string[]> = {
  surfaces: ['marble-white', 'marble-dark', 'travertine', 'stone-light'],
  walls: ['tiles-handmade', 'tiles-stack', 'slab-splash'],
  appliances: ['oven-column', 'induction-flush', 'fridge-integrated'],
  sinks: ['sink-steel', 'sink-ceramic', 'sink-granite'],
  accessories: ['organiser-oak', 'led-strip', 'waste-system'],
};

/** Complementary products: add to the visit brief, continue on the products site. */
export function Products({ locale, t, myDesignLabel, bookLabel }: { locale: Locale; t: Dict['products']; myDesignLabel: string; bookLabel: string }) {
  const design = useMyDesign();
  const items = t.items as Record<string, { name: string; note: string }>;
  return (
    <div className={s.wrap}>
      {(Object.keys(productCategories) as (keyof typeof productCategories)[]).map((cat, ci) => (
        <section key={cat} className={s.cat} aria-labelledby={`pc-${cat}`}>
          <h2 id={`pc-${cat}`} className={s.catTitle}>
            <span className="index-num">{String(ci + 1).padStart(2, '0')}</span>
            {t.categories[cat]}
          </h2>
          <ul className={s.grid}>
            {productCategories[cat].map((id) => {
              const on = design.products.includes(id);
              return (
                <li key={id} className={s.item} data-on={on ? '1' : undefined}>
                  <ProductGlyph id={id} className={s.glyph} />
                  <div className={s.text}>
                    <p className={s.name}>{items[id].name}</p>
                    <p className={s.note}>{items[id].note}</p>
                  </div>
                  <button
                    type="button"
                    className={s.add}
                    aria-pressed={on}
                    onClick={() => {
                      designStore.toggleProduct(id);
                      track('product_toggle', { id, on: !on });
                    }}
                  >
                    <Icon name={on ? 'check' : 'plus'} size={16} />
                    {on ? t.added : t.add}
                    <span className="visually-hidden">: {items[id].name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className={s.bar} data-show={design.products.length ? '1' : undefined} aria-live="polite">
        <p>
          <Icon name="bag" size={18} />
          <span>
            {t.added}: <strong className="nums">{design.products.length}</strong>
          </span>
        </p>
        <div className={s.barActions}>
          <Link href={href(locale, '/my-design')} className="link-line">
            {myDesignLabel}
          </Link>
          <Link href={href(locale, '/book')} className="btn btn-small">
            {bookLabel}
          </Link>
        </div>
      </div>

      <div className={s.site}>
        <a className="btn btn-ghost" href={site.productsUrl} target="_blank" rel="noopener noreferrer">
          {t.visit}
          <Icon name="external" size={16} />
        </a>
        <span className="example-tag">{t.note}</span>
      </div>
    </div>
  );
}
