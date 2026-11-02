'use client';
import { Icon } from '@/components/ui/Icon';
import s from './DesignerPage.module.css';

/** Example requests that go straight into the conversation on the same page. */
export function AskExamples({ items, label }: { items: string[]; label: string }) {
  return (
    <ul className={s.examples} aria-label={label}>
      {items.map((q) => (
        <li key={q}>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('avivi:designer-ask', { detail: { q } }));
              if (window.matchMedia('(max-width: 999px)').matches) document.getElementById('designer-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span>{q}</span>
            <Icon name="arrow" size={18} className="flip-rtl" />
          </button>
        </li>
      ))}
    </ul>
  );
}
