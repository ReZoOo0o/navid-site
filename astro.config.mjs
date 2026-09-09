import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rezooo0o.github.io',
  base: '/navid-site',
  integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', fa: 'fa-IR' } } })],
  vite: { plugins: [tailwindcss()] },
});
