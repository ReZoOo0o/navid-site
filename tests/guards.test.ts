import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { loadFacts } from '../src/lib/content';
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
const distTextFiles = () => walk('dist').filter((f) => /\.(html|css|js)$/.test(f));
const textOf = () => distTextFiles().map((f) => readFileSync(f, 'utf8')).join('\n');
// ── palette helpers ─────────────────────────────────────────────────────────
// The WCAG maths is COPIED from scripts/skin-preview.mjs:19-20, not imported:
// that file is review tooling and must never become a test dependency.
const cssSrc = readFileSync('src/styles/global.css', 'utf8');
const lum = (hex: string) => hex.replace('#', '').match(/../g)!
  .map((h) => parseInt(h, 16) / 255)
  .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  .reduce((n, v, i) => n + [0.2126, 0.7152, 0.0722][i] * v, 0);
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// The SCREEN palette: the first definition in the file, which is :root.
const token = (name: string) => {
  const m = cssSrc.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`token --${name} is not defined in global.css`);
  return m[1];
};
// The PRINT palette: the same tokens redefined inside @media print, which must
// stay AFTER :root in the file for `token` above to keep reading the screen one.
// Anchored on the block OPENING brace, not the bare words: the :root comment
// in global.css mentions "@media print" in prose, and slicing on that bare
// substring started the "print block" INSIDE :root — so printToken() silently
// returned the SCREEN palette and every print assertion below measured the
// site instead of the PDF. Caught by the GREEN run, 2026-09-09.
const PRINT_AT = () => cssSrc.indexOf('@media print {');
const printBlock = () => cssSrc.slice(PRINT_AT());
// The BUILT stylesheet, not the source: color-scheme has to survive Tailwind
// and the minifier to reach the print renderer, and it is the built file the
// PDF is rendered from.
const builtCss = () => {
  // Must match the stylesheet that DECLARES the tokens, not one that merely
  // says var(--c-ground): the scoped StoryFrames/PhotoSwipe chunk references
  // it too, and which of the two content-hashed files a directory walk yields
  // first is luck. It sorted the right way at base / and the wrong way at
  // base /navid-site, where this guard read PhotoSwipe's CSS (2026-09-09).
  const hits = walk('dist').filter((f) => /\.css$/.test(f))
    .map((f) => readFileSync(f, 'utf8')).filter((t) => /--c-ground:\s*#/.test(t));
  if (!hits.length) throw new Error('no built stylesheet declares the colour tokens');
  if (hits.length > 1) throw new Error(`${hits.length} built stylesheets declare --c-ground; expected exactly one`);
  return hits[0];
};
// Our print block in the built file is the one that reopens :root; the OTHER
// @media print there is Tailwind's own print: utility block.
// It is the WHOLE at-rule, matched by counting braces, not the first :root{…}
// inside it: Lightning CSS splits our single print :root into three rules —
// a plain :root of the hex tokens with a var() fallback for the color-mix, an
// @supports :root carrying the real color-mix, and a bare :root for
// color-scheme. A first-:root regex saw only the first and reported
// color-scheme:light missing (2026-09-09).
const printAtRule = () => {
  const css = builtCss();
  const at = css.search(/@media print\s*\{\s*:root/);
  if (at < 0) throw new Error('the print :root block is not in the built stylesheet');
  const start = css.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return { at, body: css.slice(start + 1, i) };
  }
  throw new Error('unbalanced @media print block in the built stylesheet');
};
const builtPrintRoot = () => printAtRule().body;
// printAtRule() throws when the block is absent, so this can never degrade
// into slice(0, -1) — the WHOLE file minus one character — which would have
// let any print-only value satisfy a screen assertion.
const builtScreen = () => builtCss().slice(0, printAtRule().at);
const printToken = (name: string) => {
  const m = printBlock().match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`token --${name} is not restored inside @media print`);
  return m[1];
};
describe('safety guard', () => {
  // Encoded on purpose: a plaintext list here would be a map of what to look
  // for. Decoded at runtime, so the guard is exactly as strong as before.
  const FORBIDDEN = ['cnVzc2lh', '2LHZiNiz24zZhw==', 'aXRpbmVyYXJ5', 'bmV4dCBjb3VudHJ5', 'bmV4dCBsZWc=', 'dXBjb21pbmcgbGVn', 'd2lsbCByaWRl', 'ZGVwb3J0', 'aGFuZGN1ZmY=', 'YmVoemFk', 'V29tZW4gJiBMaWZl', '2LLZhiDZiCDYstmG2K/ar9uM'].map((b) => new RegExp(Buffer.from(b, 'base64').toString('utf8'), 'i'));   // pulled 2026-08-30 — see work.yaml
  it('matchers are live (positive control)', () => {
    const seeded = FORBIDDEN.map((rx) => rx.source).join(' ');
    FORBIDDEN.forEach((rx) => expect(rx.test(seeded), String(rx)).toBe(true));
  });
  it('corpus is non-trivial', () => { expect(textOf().length).toBeGreaterThan(10_000); });
  it('no forbidden strings in built output', () => {
    const t = textOf();
    FORBIDDEN.forEach((rx) => expect(t, String(rx)).not.toMatch(rx));
  });
});
describe('repository integrity guard', () => {
  it('every content file is actually tracked in git', () => {
    // `.gitignore` carried a bare `data/`, which also matched src/data/ — so
    // facts, journey, offer, work and episodes were NEVER committed. The site
    // built and deployed fine because the public split copies the filesystem,
    // not the git tree. Discovered 2026-08-31.
    const tracked = execSync('git ls-files src/data/', { encoding: 'utf8' }).split('\n').filter(Boolean);
    const onDisk = readdirSync('src/data').filter((f) => f.endsWith('.yaml')).map((f) => `src/data/${f}`);
    onDisk.forEach((f) => expect(tracked, `${f} is not tracked in git`).toContain(f));
  });
});
describe('privacy guard', () => {
  const PRIVATE = ['X2NoYXRcXC50eHQ=', 'V2hhdHNBcHAgQ2hhdA==', 'XFxicGFzc3dvcmRcXGI=', 'OTktUFJJVkFURQ=='].map((b) => new RegExp(Buffer.from(b, 'base64').toString('utf8'), 'i'));
  it('no private-context string reaches dist CONTENT (M9)', () => {
    const t = textOf();
    PRIVATE.forEach((rx) => expect(t, String(rx)).not.toMatch(rx));
  });
  it('no chat-export artifacts among dist files', () => {
    expect(walk('dist').some((f) => new RegExp(Buffer.from('X2NoYXRcLnR4dHxXaGF0c0FwcA==', 'base64').toString('utf8'), 'i').test(f))).toBe(false);
  });
});
describe('link guard', () => {
  it('no bracket-placeholder in any href, encoded included (m1)', () => {
    expect(textOf()).not.toMatch(/href="[^"]*(\[|%5B)/i);
  });
  it('internal anchors resolve on both pages', () => {
    for (const page of ['dist/index.html', 'dist/fa/index.html']) {
      const t = readFileSync(page, 'utf8');
      const anchors = [...t.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
      expect(anchors.length).toBeGreaterThan(0);
      const ids = [...t.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      anchors.forEach((a) => expect(ids, `${page} #${a}`).toContain(a));
    }
  });
  it('external links limited to instagram', () => {
    const ext = [...textOf().matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    expect(ext.length).toBeGreaterThan(0);
    ext.forEach((u) => expect(u, u).toMatch(/^https:\/\/instagram\.com\//));
  });
});
describe('layout guard', () => {
  it('nothing hides itself with a big negative offset (RTL overflow)', () => {
    // `left:-9999px` is an LTR-only hiding trick. In the RTL page it added
    // 9,999px of scrollable width and pushed the content off the canvas.
    expect(textOf()).not.toMatch(/(left|right|margin-left|margin-right)\s*:\s*-\d{3,}px/i);
  });
});
describe('Persian shaping guard', () => {
  it('no mono-ish surface on the FA page omits a Persian face', () => {
    // .chip rendered Persian in Courier New because it used the Latin mono
    // stack. Any rule that can hold Persian must name a Persian family.
    const css = readFileSync('src/styles/global.css', 'utf8');
    const faRules = css.split('\n').filter((l) => /^\[lang="fa"\]/.test(l) && /font-family/.test(l));
    expect(faRules.length).toBeGreaterThan(0);
    faRules.forEach((r) => expect(r, r).toMatch(/Vazirmatn|--f-mono-fa|--f-fa/));
  });
});
describe('voice guard', () => {
  it('no pending quote reaches the page in any form', async () => {
    const { loadStory } = await import('../src/lib/content');
    const t = textOf();
    loadStory().quotes.filter((q) => q.pending).forEach((q) => {
      // Neither the words (there are none) nor the framing that would imply them.
      expect(t, `${q.id} context leaked`).not.toContain(q.context.en);
      expect(t, `${q.id} context leaked (fa)`).not.toContain(q.context.fa);
    });
  });
  it('every rendered quote has a real body', async () => {
    const { loadStory } = await import('../src/lib/content');
    loadStory().quotes.filter((q) => !q.pending).forEach((q) => {
      expect(q.body).not.toBeNull();
      expect(textOf()).toContain(q.body!.en.split(' ').slice(0, 5).join(' '));
    });
  });
});
describe('weight guard', () => {
  it('no image over 350KB', () => {
    const imgs = walk('dist').filter((f) => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((f) => expect(statSync(f).size, f).toBeLessThan(350 * 1024));
  });
  it('en html+css+js under 200KB', () => {
    // Held at 200KB. During the 2026-08-31 portrait restructure this was
    // briefly raised to 280KB on the assumption that three new chapters would
    // breach it — an assumption nobody measured. Measured afterwards: 61KB.
    // The cap was reverted. If it ever trips, raise it WITH a measurement in
    // the commit message, or cut content; never widen it on a guess.
    const files = walk('dist').filter((f) => /\.(html|css|js)$/.test(f) && !f.includes('/fa/'));
    expect(files.length).toBeGreaterThan(0);
    const total = files.reduce((n, f) => n + statSync(f).size, 0);
    expect(total).toBeLessThan(200 * 1024);
  });
  it('PhotoSwipe core is a lazy chunk, not in the initial script (spec §5)', () => {
    const js = walk('dist').filter((f) => /\.js$/.test(f));
    const src = (f: string) => readFileSync(f, 'utf8');
    const initial = js.filter((f) => /PhotoSwipeLightbox|pswp-link/.test(src(f)));
    const core = js.filter((f) => !/pswp-link/.test(src(f)) && /zoomLevels|Slide/.test(src(f)) && /pswp/.test(src(f)));
    expect(initial.length, 'lightbox shim shipped').toBeGreaterThan(0);
    expect(core.length, 'core is emitted as its own chunk').toBeGreaterThan(0);
    // the shim that runs on load must be small; the core may be bigger but is fetched on first tap
    initial.forEach((f) => expect(statSync(f).size, f).toBeLessThan(40 * 1024));
  });
});
describe('palette guard', () => {
  it('the F-era palette and chrome are gone from the built site', () => {
    // Old media-kit colors and idioms must not survive the reskin.
    const banned = ['#F2C41D', '#ECEDEF', '#23262A', 'rec-dot', 'F2C41D'.toLowerCase()];
    for (const f of distTextFiles()) {
      const text = readFileSync(f, 'utf8');
      for (const b of banned) expect(text.toLowerCase(), `${f} still contains ${b}`).not.toContain(b.toLowerCase());
    }
  });
});
describe('contrast guard (WCAG 2.2 AA)', () => {
  it('the ratio is real (positive control)', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(ratio(token('c-ground'), token('c-ground'))).toBeCloseTo(1, 5);
  });
  it('the tokens under test are the SCREEN palette, not the print one', () => {
    // If this ever reads #F5F6F4, the print block has moved above :root and
    // every ratio below is measuring the PDF instead of the site.
    expect(token('c-ground')).toBe('#1D1D1C');
    expect(token('c-band')).toBe('#141413');
  });
  it('the frame caption strip clears 4.5:1 on the charcoal ground', () => {
    // 13px is below the 18.66px large-text threshold, so AA here is 4.5:1.
    const frames = readFileSync('src/components/StoryFrames.astro', 'utf8');
    expect(frames).toMatch(/background: var\(--c-ground\); color: var\(--c-body2\)/);
    expect(ratio(token('c-body2'), token('c-ground'))).toBeGreaterThanOrEqual(4.5);  // 8.00
  });
  it('--c-muted clears 4.5:1 on screen now — and the strip still does not move back', () => {
    // Rewritten 2026-09-09, not deleted (spec §6). On the paper palette
    // --c-muted was #6C766F at 4.34:1 and that failure is exactly why the
    // caption strip moved to --c-body2 on 2026-09-07. On skin B it is #8E897F
    // at 4.85:1 and passes. The strip stays on --c-body2 regardless: 8.00:1 on
    // screen, and the PRINT palette still puts --c-muted at 4.34:1 on paper.
    expect(ratio(token('c-muted'), token('c-ground'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(printToken('c-muted'), printToken('c-ground'))).toBeLessThan(4.5);
  });
  it('every text token clears 4.5:1 on the page ground', () => {
    // ink 13.69 · accent 7.50 · accent-deep 9.77 · body2 8.00 · muted 4.85
    ['c-ink', 'c-accent', 'c-accent-deep', 'c-body2', 'c-muted'].forEach((n) =>
      expect(ratio(token(n), token('c-ground')), n).toBeGreaterThanOrEqual(4.5));
  });
  it('every text token clears 4.5:1 on the band', () => {
    // band-ink 14.96 · band-text 11.07 (the typed text in .cf-input, and since
    // the final review the Clients "where" line too) · band-dim 8.19.
    // --c-muted (5.30) is kept in this list although nothing on a band paints
    // with it any more: it is the cheapest guard that a future band text
    // reaching for it is legible. It is NOT asserted on the PRINTED band,
    // where it is 2.86 — which is exactly why the where-line moved off it.
    ['c-band-ink', 'c-band-text', 'c-band-dim', 'c-muted'].forEach((n) =>
      expect(ratio(token(n), token('c-band')), n).toBeGreaterThanOrEqual(4.5));
  });
  it('the input border is a visible boundary ON SCREEN (WCAG 1.4.11, 3:1)', () => {
    // SCREEN ONLY, and that is the point. 1.4.11 governs interactive UI
    // components; a form box printed on paper is not one — nobody focuses it,
    // and the media kit is a document. --c-hairline was 1.60 on the screen
    // band, under the bar (Task 3, finding b), so the inputs got their own
    // token: #8E897F here, 5.30:1.
    expect(ratio(token('c-input-border'), token('c-band'))).toBeGreaterThanOrEqual(3);  // 5.30
    // In PRINT the same token is deliberately quiet — see the print-palette
    // test below, which asserts it is DEFINED, not that it clears a ratio.
    // Briefly #D5DAD6 (9.53:1), which drew a bright box round every field in
    // the PDF where the paper era had a near-invisible one. That was a visible
    // change to the deliverable, not an accessibility win.
  });
  it('the contact submit button clears 4.5:1 in both palettes', () => {
    expect(ratio(token('c-ground'), token('c-accent'))).toBeGreaterThanOrEqual(4.5);            // 7.50 gold on charcoal
    expect(ratio(printToken('c-ground'), printToken('c-accent'))).toBeGreaterThanOrEqual(4.5);  // 5.19 green on paper
  });
  it('the printed band stays legible on paper', () => {
    // band-ink 12.44 · band-text 8.41 · band-dim 6.16 on the printed band.
    // band-text carries the Clients "where" line as of the final review: it
    // used to be --c-muted, which is 2.86:1 here and failed AA on paper at
    // 11px. Nothing renders --c-muted on a band now, so there is no longer an
    // unasserted pair hiding in this block.
    ['c-band-ink', 'c-band-text', 'c-band-dim'].forEach((n) =>
      expect(ratio(printToken(n), printToken('c-band')), n).toBeGreaterThanOrEqual(4.5));
    expect(ratio(printToken('c-body2'), printToken('c-ground'))).toBeGreaterThanOrEqual(4.5);   // 5.90
  });
});
describe('skin B — charcoal + gold (spec 2026-09-09)', () => {
  const band = (f: string) => readFileSync(`src/components/${f}.astro`, 'utf8');
  const BANDS = ['Sponsors', 'Clients', 'ContactForm'];
  it('the three bands read --c-band, and nothing inverts the page any more', () => {
    BANDS.forEach((f) => {
      expect(band(f), f).toMatch(/background: var\(--c-band\); color: var\(--c-band-ink\);/);
      expect(band(f), f).not.toContain('background: var(--c-ink)');
    });
  });
  it('no band component paints text with --c-ground (charcoal on charcoal)', () => {
    // --c-ground is the PAGE colour. On the band it is invisible. This is the
    // assertion that catches the gear-item <strong> elements, which carried
    // color: var(--c-ground) as their "bright" colour under the paper palette.
    BANDS.forEach((f) => expect(band(f), f).not.toMatch(/color: var\(--c-ground\)/));
  });
  it('the Clients "where" line is band text, not muted', () => {
    // At 11px it needs 4.5:1. --c-muted gave it 5.30 on screen but 2.86 on the
    // PRINTED band — an AA failure on the page sponsors are handed. --c-band-text
    // is 11.07 and 8.41. The cost is that the line loses its muted step and now
    // matches the description above it in colour.
    const clients = readFileSync('src/components/Clients.astro', 'utf8');
    expect(clients).toMatch(/tracking-\[0\.12em\]" style="color: var\(--c-band-text\);"/);
    expect(clients, 'the where line is still on --c-muted').not.toMatch(/color: var\(--c-muted\)/);
  });
  it('the built screen half really is a slice, not the whole file', () => {
    // Positive control on builtScreen(): a -1 search would have returned the
    // entire stylesheet minus one character, and every "screen" assertion
    // would have been satisfiable by a print-only value.
    expect(builtScreen().length).toBeLessThan(builtCss().length);
    expect(builtScreen()).not.toMatch(/color-scheme:\s*light/);
  });
  it('no raw hex survives in the band markup', () => {
    BANDS.forEach((f) => {
      // Markup only. ContactForm's <script> writes two status colours inline
      // as it renders a message (#FFB4A8 error, #9BE8B0 ok); both are light on
      // dark in BOTH palettes and are deliberately left alone. Sponsors and
      // Clients carry no <script>, so this reads their whole file.
      expect(band(f).split('<script>')[0], f).not.toMatch(/#[0-9A-Fa-f]{6}/);
    });
  });
  it('the submit button is gold on the page ground', () => {
    expect(cssSrc).toMatch(/\.cf-submit \{[\s\S]*?background: var\(--c-accent\); color: var\(--c-ground\);/);
    expect(cssSrc).not.toMatch(/\.cf-submit \{[\s\S]*?color: #FFFFFF/);
  });
  it('the masthead and 404 CTAs are the same gold primary as the submit button', () => {
    // They were background: var(--c-ink); color: var(--c-ground) — under the
    // paper palette a dark chip on a light page, correctly subordinate. The
    // skin B token flip inverted it into a cream slab at 13.69:1, the single
    // brightest object on the page, louder than the gold it points at, with a
    // 0px radius against the submit button's 2px (Task 3, finding 1). Same
    // action, same tokens: .cta-primary, pinned here to agree with .cf-submit.
    for (const f of ['src/components/Masthead.astro', 'src/pages/404.astro']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).toContain('cta-primary');
      expect(src, f).not.toMatch(/background: var\(--c-ink\); color: var\(--c-ground\)/);
      expect(src, f).not.toMatch(/#[0-9A-Fa-f]{6}/);
    }
    const cta = cssSrc.match(/\.cta-primary \{([\s\S]*?)\}/);
    const submit = cssSrc.match(/\.cf-submit \{([\s\S]*?)\}/);
    expect(cta, '.cta-primary is not defined in global.css').not.toBeNull();
    expect(submit, '.cf-submit is not defined in global.css').not.toBeNull();
    for (const decl of ['background: var(--c-accent)', 'color: var(--c-ground)', 'border-radius: 2px']) {
      expect(cta![1], `.cta-primary: ${decl}`).toContain(decl);
      expect(submit![1], `.cf-submit: ${decl}`).toContain(decl);
    }
  });
  it('the contact inputs are legible on the band', () => {
    expect(cssSrc).toMatch(/\.cf-input \{[\s\S]*?color: var\(--c-band-text\);/);
    expect(cssSrc).toMatch(/\.cf-input \{[\s\S]*?border: 1px solid var\(--c-input-border\);/);
  });
  it('the dark scheme is declared in CSS, never as a meta — the meta printed a charcoal @page frame', () => {
    // <meta name="color-scheme" content="dark"> made Chrome paint the printed
    // page-MARGIN box from the dark UA canvas: a 14mm #121212 frame on all 14
    // pages of the media kit (Task 3). @media print { html { background: #fff } }
    // cannot reach the margin box — only the used color-scheme can — so the
    // declaration moved into CSS, where the print block flips it back to light.
    // theme-color STAYS a meta: it has no CSS form, and it is pinned to
    // --c-ground so it cannot drift from the page colour.
    for (const p of ['dist/index.html', 'dist/fa/index.html']) {
      const html = readFileSync(p, 'utf8');
      expect(html, p).not.toMatch(/name="color-scheme"/);
      expect(html, p).toContain(`name="theme-color" content="${token('c-ground')}"`);
    }
    expect(builtScreen(), 'screen half of the built stylesheet').toMatch(/color-scheme:\s*dark/);
    expect(builtPrintRoot(), 'print :root in the built stylesheet').toMatch(/color-scheme:\s*light/);
  });
  it('print restores the paper palette token for token (spec §5)', () => {
    const paper: Record<string, string> = {
      'c-ground': '#F5F6F4', 'c-ink': '#26312B', 'c-accent': '#47705A', 'c-accent-deep': '#2F5140',
      'c-body2': '#55625B', 'c-muted': '#6C766F', 'c-hairline': '#D5DAD6',
      'c-band-text': '#C4CFC7', 'c-band-dim': '#9DB5A6', 'c-band': '#26312B', 'c-band-ink': '#F5F6F4',
    };
    Object.entries(paper).forEach(([n, hex]) => expect(printToken(n), n).toBe(hex));
    // --c-input-border is NOT in that map: in print it is a color-mix, not a
    // hex, so it has no entry to pin. It still has to EXIST — a token missing
    // from the print block keeps its charcoal screen value on paper.
    expect(printBlock(), '--c-input-border is not restored in print').toMatch(
      /--c-input-border:\s*color-mix\(in srgb, var\(--c-band-text\) 25%, transparent\)/);
  });
  it('no colour token is left charcoal in the PDF', () => {
    // Positive control on the block above: every --c-* declared on screen must
    // also be declared in print. A token added later and forgotten here would
    // print charcoal on paper.
    // [a-z0-9-]+, not [a-z-]+: --c-body2 carries a digit and the narrower
    // class could not match it, so the one token this reskin changes most was
    // exempt from this control and the count could never reach 11.
    const screen = [...cssSrc.slice(0, PRINT_AT()).matchAll(/(--c-[a-z0-9-]+):/g)].map((m) => m[1]);
    expect(screen.length).toBeGreaterThanOrEqual(11);
    screen.forEach((t) => expect(printBlock(), t).toContain(`${t}:`));
  });
});
describe('single-source-of-numbers guard (M3)', () => {
  it('facts literals are not retyped in i18n or data prose', () => {
    // DERIVED from facts.yaml, not retyped here. The list used to be a literal
    // array and it went stale the moment the numbers were refreshed — a guard
    // against copied numbers that itself held copied numbers.
    const f = loadFacts();
    const facts = [f.followers, f.km, f.viewsTopFilm, f.viewsSecondFilm, f.viewsBestFilm,
      f.views30d, f.interactions30d, f.nonFollowerReach,
      String(f.sharesTopFilm), f.sharesTopFilm.toLocaleString('en-US')];
    const surfaces = ['src/i18n/en.yaml', 'src/i18n/fa.yaml', 'src/data/work.yaml', 'src/data/offer.yaml']
      .map((f) => readFileSync(f, 'utf8')).join('\n');
    facts.forEach((v) => expect(surfaces, v).not.toContain(v));
  });
});
