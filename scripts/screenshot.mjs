// Full-page screenshots of EN + FA for design review → design/review/
import { chromium } from 'playwright';
import { serveDist } from './serve.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('design/review', { recursive: true });
const { srv, url } = await serveDist();
try {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); }
  catch { browser = await chromium.launch(); }
  for (const [name, path, width] of [['en-full', '/', 1440], ['fa-full', '/fa/', 1440], ['en-mobile', '/', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${url}${path}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
    // Story photos ship `loading="lazy"` (by design — only the hero is eager).
    // Playwright's fullPage screenshot resizes the CDP viewport without ever
    // scrolling the page, so the browser's native lazy-load never fires for
    // anything below the fold and those images capture as blank. Scroll
    // through in steps first so every lazy image has actually entered the
    // viewport at least once — a review-tooling fix only, no production code
    // touched (task 8, 2026-08-31).
    await page.evaluate(async () => {
      const step = 600;
      const h = () => document.body.scrollHeight;
      for (let y = 0; y < h(); y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `design/review/${name}.png`, fullPage: true });
    await page.close();
    console.log(`shot ${name}`);
  }
  await browser.close();
} finally { srv.close(); }
