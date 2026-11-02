import 'server-only';
import { en, type Dict } from '@/content/en';
import { he } from '@/content/he';
import { ru } from '@/content/ru';
import { fr } from '@/content/fr';
import type { Locale } from './i18n';

const dicts: Record<Locale, Dict> = { he, en, ru, fr };

/** Server-only: full dictionary for a locale. Pass only the needed slices to client components. */
export function getDict(locale: Locale): Dict {
  return dicts[locale];
}

export type { Dict };
