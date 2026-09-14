// REVIEW TOOLING — not part of the site. Screenshots the built site under
// alternative skins by injecting CSS overrides at capture time, so a palette /
// display-type direction can be judged on the real page, with the real photos,
// in both locales, without touching production code.
//
//   node scripts/skin-preview.mjs [--out design/review/skins]
//
// Skins: `current` (no override — since 2026-09-09 that IS charcoal + gold +
// Cormorant, the skin Navid chose) and `paper`, which puts the page back to the
// Caucasus Light palette and Sora as a "before" reference. Persian never
// changes font (Vazirmatn, no tracking); it only takes the colours.
import { chromium } from 'playwright';
import { serveDist } from './serve.mjs';
import { mkdirSync } from 'node:fs';
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const OUT = arg('--out', 'design/review/skins');
mkdirSync(OUT, { recursive: true });

// ── WCAG contrast, so the preview is honest about legibility ────────────────
const lum = (hex) => { const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(2); };

const SKINS = {
  current: { tokens: null, band: null, bandInk: null },
  paper: {
    // The palette this site shipped until 2026-09-09, kept so the two can be
    // compared side by side. It is also exactly what @media print restores.
    tokens: { ground: '#F5F6F4', ink: '#26312B', accent: '#47705A', accentDeep: '#2F5140',
              body2: '#55625B', muted: '#6C766F', hairline: '#D5DAD6',
              bandText: '#C4CFC7', bandDim: '#9DB5A6' },
    band: '#26312B', bandInk: '#F5F6F4',
  },
};

const css = (skin) => {
  const t = SKINS[skin].tokens; if (!t) return '';
  return `:root { --c-ground:${t.ground}; --c-ink:${t.ink}; --c-accent:${t.accent}; --c-accent-deep:${t.accentDeep};
        --c-body2:${t.body2}; --c-muted:${t.muted}; --c-hairline:${t.hairline};
        --c-band-text:${t.bandText}; --c-band-dim:${t.bandDim};
        --c-band:${SKINS[skin].band}; --c-band-ink:${SKINS[skin].bandInk}; }
/* Put the Latin display type back to Sora, so this sheet is a true "before". */
html[lang="en"] h1, html[lang="en"] h2, html[lang="en"] blockquote, html[lang="en"] .motto {
  font-family: var(--f-sans) !important; font-style: normal !important; }
html[lang="en"] h1 { font-size: var(--t-display) !important; font-weight: 300 !important; }
html[lang="en"] h2 { font-size: var(--t-h2) !important; }
html[lang="en"] blockquote { font-size: var(--t-h3) !important; }
html[lang="en"] .motto { font-size: 19px !important; }`;
};

const { srv, url } = await serveDist();
try {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
  for (const skin of Object.keys(SKINS)) {
    const t = SKINS[skin].tokens;
    if (t) console.log(`${skin}: accent/ground ${ratio(t.accent, t.ground)}:1 · body2/ground ${ratio(t.body2, t.ground)}:1 · muted/ground ${ratio(t.muted, t.ground)}:1 · bandInk/band ${ratio(SKINS[skin].bandInk, SKINS[skin].band)}:1 · bandDim/band ${ratio(t.bandDim, SKINS[skin].band)}:1 · bandText/band ${ratio(t.bandText, SKINS[skin].band)}:1`);
    for (const [locale, path] of [['en', '/'], ['fa', '/fa/']]) {
      for (const width of [1440, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.goto(`${url}${path}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => {
          document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
        });
        if (css(skin)) await page.addStyleTag({ content: css(skin) });
        await page.evaluate(async () => { // wake lazy images (same trick as screenshot.mjs)
          const step = 600; const h = () => document.body.scrollHeight;
          for (let y = 0; y < h(); y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${skin}-${locale}-${width}.png`, fullPage: true });
        await page.close();
        console.log(`shot ${skin}-${locale}-${width}`);
      }
    }
  }
  await browser.close();
} finally { srv.close(); }
