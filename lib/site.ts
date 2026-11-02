/**
 * Site-wide configuration. Anything not confirmed by Avivi is example data and
 * is labelled as such in the UI (see `example: true`).
 * Public values can be overridden with NEXT_PUBLIC_* environment variables.
 */
export const site = {
  name: { he: 'אביבי מטבחים', en: 'Avivi Kitchens', ru: 'Avivi Kitchens', fr: 'Avivi Kitchens' },
  domain: 'avivi.com',
  founded: 1969,
  // Example contact data (clearly marked "example" in the UI).
  phone: {
    display: process.env.NEXT_PUBLIC_PHONE_DISPLAY || '03-000-0000',
    tel: process.env.NEXT_PUBLIC_PHONE_TEL || '+97230000000',
    example: !process.env.NEXT_PUBLIC_PHONE_TEL,
  },
  servicePhone: {
    display: process.env.NEXT_PUBLIC_SERVICE_PHONE_DISPLAY || '03-000-0001',
    tel: process.env.NEXT_PUBLIC_SERVICE_PHONE_TEL || '+97230000001',
    example: !process.env.NEXT_PUBLIC_SERVICE_PHONE_TEL,
  },
  whatsapp: {
    number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '972500000000',
    example: !process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  },
  email: {
    sales: process.env.NEXT_PUBLIC_EMAIL_SALES || 'hello@example.com',
    service: process.env.NEXT_PUBLIC_EMAIL_SERVICE || 'service@example.com',
    pro: process.env.NEXT_PUBLIC_EMAIL_PRO || 'pro@example.com',
    example: !process.env.NEXT_PUBLIC_EMAIL_SALES,
  },
  // One canonical URL for the complementary products site (the current site links two variants).
  productsUrl: process.env.NEXT_PUBLIC_PRODUCTS_URL || 'https://www.avivi.com/',
  productsUrlExample: !process.env.NEXT_PUBLIC_PRODUCTS_URL,
  appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL || '',
  playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL || '',
} as const;

export function waLink(text: string): string {
  return `https://wa.me/${site.whatsapp.number}?text=${encodeURIComponent(text)}`;
}
