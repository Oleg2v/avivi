'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { stripLocale } from '@/lib/i18n';
import { useLocale } from '@/components/providers/LocaleContext';
import { Icon } from '@/components/ui/Icon';

const DesignerPanel = dynamic(() => import('./DesignerPanel').then((m) => m.DesignerPanel), { ssr: false });

/** Floating entry to Avivi Designer on every page. The chat code loads only when opened. */
export function DesignerLauncher() {
  const { t } = useLocale();
  const pathname = stripLocale(usePathname() || '/');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setMounted(true);
      setOpen(true);
      const q = (e as CustomEvent<{ q?: string }>).detail?.q;
      if (q) window.setTimeout(() => window.dispatchEvent(new CustomEvent('avivi:designer-ask', { detail: { q } })), 350);
    };
    window.addEventListener('avivi:designer-open', onOpen);
    return () => window.removeEventListener('avivi:designer-open', onOpen);
  }, []);

  if (pathname.startsWith('/designer') || pathname.startsWith('/inbox')) return null;

  return (
    <>
      <button
        type="button"
        className="designer-launcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        data-magnetic
      >
        <span className="designer-launcher-dot" aria-hidden="true" />
        <span>{t.designer.launcher}</span>
        <Icon name="sparkle" size={18} />
      </button>
      {mounted ? <DesignerPanel open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Open the designer from anywhere, optionally with a first question. */
export function openDesigner(q?: string) {
  window.dispatchEvent(new CustomEvent('avivi:designer-open', { detail: { q } }));
}
