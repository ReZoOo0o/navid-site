// Renders the EN page to dist/navid-media-kit.pdf using the SYSTEM Chrome
// (playwright channel:'chrome' — no browser download; CDN unreachable here).
import { chromium } from 'playwright';
import { serveDist } from './serve.mjs';
import { statSync } from 'node:fs';
const { srv, url } = await serveDist();
try {
  // System Chrome locally (playwright's CDN is unreachable from this network);
  // bundled chromium on CI where `playwright install` has run.
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); }
  catch { browser = await chromium.launch(); }
  const page = await browser.newPage();
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  await page.pdf({ path: 'dist/navid-media-kit.pdf', format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
  await browser.close();
  const kb = Math.round(statSync('dist/navid-media-kit.pdf').size / 1024);
  console.log(`PDF ok — dist/navid-media-kit.pdf (${kb} KB)`);
} finally { srv.close(); }
