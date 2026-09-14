// Asserts the font Chrome ACTUALLY used to render Persian text.
//
// Tonight's bug: the stack asked for `Vazirmatn`, but the package registers
// `Vazirmatn Variable`. The family was silently skipped, Persian fell through
// to a generic monospace, and every word lost its cursive joins. Every test
// passed. No accessibility or Lighthouse audit can see this — they are blind
// to shaping. The only deterministic check is to ask the renderer what it used.
//
// CDP's CSS.getPlatformFontsForNode reports the resolved font per node, so we
// can compare intent against reality instead of trusting the cascade.
import { chromium } from 'playwright';
import { serveDist } from './serve.mjs';

const EXPECT = /Vazirmatn/i;                 // what Persian must render in
const FORBID = /mono|courier|system|fallback/i;  // what "it broke" looks like

const { srv, url } = await serveDist();
let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); }
catch { browser = await chromium.launch(); }

const fails = [];
const page = await browser.newPage();
await page.goto(`${url}/fa/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const cdp = await page.context().newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument', { depth: -1 });

// Every element holding Persian characters, including SVG <text>. The caption
// strips (spec §6) are <figcaption>: nine Persian nodes on /fa/ that this check
// could not see until 2026-09-07, when the selector was widened to the rest of
// the text-bearing elements the site actually uses.
const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'h1,h2,h3,p,a,li,span,text,tspan,label,button,figcaption,blockquote,figure,td,th,dt,dd' });

let checked = 0;
for (const nodeId of nodeIds) {
  const { outerHTML } = await cdp.send('DOM.getOuterHTML', { nodeId }).catch(() => ({ outerHTML: '' }));
  if (!/[؀-ۿ]/.test(outerHTML)) continue;          // not Persian, skip
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }).catch(() => ({ fonts: [] }));
  if (!fonts.length) continue;
  checked++;
  // Judge by how many glyphs land on a non-Vazirmatn face, not by which face
  // happens to be largest. A container element owns a glyph or two of its own
  // — a bullet arrow, a separator — while its Persian sits in child nodes that
  // are measured on their own; picking the "biggest" face there reports the
  // arrow's font and fails correct markup. Persian that genuinely falls back
  // puts every one of its glyphs on the wrong face, so it still trips this.
  const total = fonts.reduce((n, f) => n + f.glyphCount, 0);
  const wrong = fonts.filter((f) => !EXPECT.test(f.familyName) || FORBID.test(f.familyName));
  const bad = wrong.reduce((n, f) => n + f.glyphCount, 0);
  if (bad >= 3 || (total >= 4 && bad / total > 0.5)) {
    const faces = wrong.map((f) => `${f.familyName}:${f.glyphCount}`).join(', ');
    fails.push(`${faces} of ${total} glyphs  ←  ${outerHTML.replace(/\s+/g, ' ').slice(0, 70)}`);
  }
}

// ── EN: the display serif actually resolved (spec 2026-09-09 §4) ─────────────
// The mirror image of the Persian bug this file was written for. The package
// registers 'Cormorant Garamond Variable'; a stack naming only 'Cormorant
// Garamond' resolves to nothing and Georgia quietly takes over — close enough
// in a screenshot to survive review, wrong in every letterform. Ask Chrome.
const DISPLAY = /Cormorant/i;
const woff2 = [];
const enPage = await browser.newPage();
enPage.on('response', (r) => { if (r.url().endsWith('.woff2')) woff2.push(r.url().split('/').pop()); });
await enPage.goto(`${url}/`, { waitUntil: 'networkidle' });
await enPage.evaluate(() => document.fonts.ready);
const enCdp = await enPage.context().newCDPSession(enPage);
await enCdp.send('DOM.enable');
await enCdp.send('CSS.enable');
const { root: enRoot } = await enCdp.send('DOM.getDocument', { depth: -1 });
const { nodeIds: enIds } = await enCdp.send('DOM.querySelectorAll', { nodeId: enRoot.nodeId, selector: 'h1,h2,blockquote,.motto' });
let enChecked = 0;
for (const nodeId of enIds) {
  const { fonts } = await enCdp.send('CSS.getPlatformFontsForNode', { nodeId }).catch(() => ({ fonts: [] }));
  if (!fonts.length) continue;
  enChecked++;
  const total = fonts.reduce((n, f) => n + f.glyphCount, 0);
  const wrong = fonts.filter((f) => !DISPLAY.test(f.familyName));
  const bad = wrong.reduce((n, f) => n + f.glyphCount, 0);
  if (bad / total > 0.5) {
    const { outerHTML } = await enCdp.send('DOM.getOuterHTML', { nodeId }).catch(() => ({ outerHTML: '' }));
    fails.push(`EN display: ${wrong.map((f) => `${f.familyName}:${f.glyphCount}`).join(', ')} of ${total} glyphs  ←  ${outerHTML.replace(/\s+/g, ' ').slice(0, 70)}`);
  }
}
// Positive control: an empty selector result must not read as success.
if (enChecked === 0) fails.push('EN display: no h1/h2/blockquote/.motto found on the English page');
// The motto is italic, and Cormorant's italic is a SEPARATE file
// (wght-italic.css). Without it the browser slants the upright face and calls
// the result italic — for a Garamond that is the wrong letterform, and no
// stylesheet assertion can see it. Ask the font set which faces really loaded.
const italicFaces = await enPage.evaluate(() => [...document.fonts]
  .filter((f) => /Cormorant/i.test(f.family) && f.style === 'italic' && f.status === 'loaded').length);
if (!italicFaces) fails.push('EN display: no LOADED italic Cormorant face — the motto is a synthesized oblique');
await enPage.close();

console.log(`checked ${checked} Persian-bearing nodes · ${enChecked} EN display nodes · italic faces loaded: ${italicFaces}`);
console.log(`EN fetched: ${woff2.join(', ') || 'no woff2'}`);
if (fails.length) {
  console.error(`\n✗ ${fails.length} node(s) rendered in the WRONG font:\n`);
  fails.slice(0, 12).forEach((f) => console.error('  ' + f));
  console.error('\nCursive joins break when Persian falls back, and the English display\ntype falls back to Georgia just as silently. Check the font-family stacks.');
} else {
  console.log('✓ all Persian renders in Vazirmatn — cursive joins intact');
  console.log('✓ EN h1/h2/blockquote/.motto render in Cormorant Garamond, italic included');
}
await browser.close();
srv.close();
process.exit(fails.length ? 1 : 0);
