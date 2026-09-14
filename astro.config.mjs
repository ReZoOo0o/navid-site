import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://navidfaramarznezhad.com',
  integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', fa: 'fa-IR' } } })],
  // Every script this site ships must be a FILE, never inlined into the HTML:
  // the origin serves `script-src 'self'` with no hashes and no 'unsafe-inline',
  // so an inlined bundle is refused by the browser and the feature it carries is
  // simply dead on the deployed site. Astro inlines any bundle under Vite's
  // assetsInlineLimit (4 kB by default), which is most of them — the contact
  // form's submit handler included, and a dead handler there means the form does
  // a native POST and lands the visitor on a page of raw JSON. Zero turns that
  // off. Measured on the live site 2026-09-14, four scripts refused.
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
