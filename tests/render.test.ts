import { describe, it, expect } from 'vitest';
import { loadFacts, loadOffer } from '../src/lib/content';
import { t } from '../src/lib/i18n';
import { readFileSync, existsSync } from 'node:fs';
import { localizeDigits } from '../src/lib/format';
const en = () => readFileSync('dist/index.html', 'utf8');
const fa = () => readFileSync('dist/fa/index.html', 'utf8');
describe('rendered pages', () => {
  it('EN page carries masthead unit label and CTA anchor', () => {
    // Caucasus Light portrait nav (2026-08-31, Task 4): nav.unit is now just
    // his name, not "FIELD UNIT 360°" — see task-4-brief.md.
    expect(en()).toContain('NAVID FARAMARZNEZHAD');
    expect(en()).toMatch(/href="#sponsors"/);
  });
  it('hero is the portrait, not the pitch', () => {
    expect(en()).toContain('Slow travel, documented properly.');
    expect(en()).not.toContain('data-hero-lens');
    // shares number must not appear before the #work section. Read from
    // facts.yaml rather than typed here — it was pinned to a literal 61,452
    // and stopped testing anything the day the top film changed (2026-09-09).
    const beforeWork = en().slice(0, en().indexOf('id="work"'));
    const shares = loadFacts().sharesTopFilm;
    expect(beforeWork).not.toContain(String(shares));
    expect(beforeWork).not.toContain(shares.toLocaleString('en-US'));
    // the km stat reads as an estimate
    expect(en()).toContain('≈');
  });
  // Caucasus Light redesign, 2026-08-31: the old hero-lens chip row (odometer
  // digits in [ KM 000000 ] brackets) is gone; the hero now shows the same
  // three facts as a plain stat row using the hero.stat* i18n labels.
  it('hero presents the km/day/countries stat row instead of the old lens chips', () => {
    expect(en()).not.toContain('data-hero-lens');
    [t('en')['hero.statKm'], t('en')['hero.statDays'], t('en')['hero.statCountries']]
      .forEach((label) => expect(en(), label).toContain(label));
  });
  it('track shows stations in native scripts on both pages', () => {
    for (const page of [en(), fa()]) {
      expect(page).toContain('თბილისი');
      expect(page).toContain('شیراز');
      expect(page).toContain('Երևան');
    }
  });
  it('sponsors section states the terms and always carries an ask', () => {
    expect(en()).toContain('USDT');
    expect(en()).toContain('id="sponsors"');
    // The section must never be a dead end: either the named gear list, or the
    // sentence inviting the reader to ask for it. Never neither.
    const hasList = loadOffer().needs.length > 0;
    expect(en()).toContain(hasList ? t('en')['sponsor.needsLabel'] : t('en')['sponsor.needsAsk']);
  });
  it('sponsorship is one quiet band that still says everything true', () => {
    // Caucasus Light redesign, 2026-08-31 (Task 7): the file's helper for a
    // dist page is en(), not distHtml() — brief's snippet adapted to match.
    const html = en();
    const band = html.slice(html.indexOf('id="sponsors"'), html.indexOf('id="contact"'));
    expect(band).toContain('USDT');
    expect(band).toContain('Giant');
    // Q26's gear list landed 2026-09-01, so the band renders the named list
    // and its label rather than the ask-for-the-list sentence. Asserted as the
    // invariant that holds either way — and every row must actually render.
    const needs = loadOffer().needs;
    if (needs.length > 0) {
      expect(band).toContain(t('en')['sponsor.needsLabel']);
      needs.forEach((n) => expect(band, n.id).toContain(n.item.en));
    } else {
      expect(band).toContain(t('en')['sponsor.needsAsk'].slice(0, 40));
    }
    expect(band).not.toContain('grid-cols-[1.1fr_0.9fr]');              // the old two-panel layout is gone
  });
  it('FA page is RTL, Persian, and has NO untranslated work/sponsor prose (B1)', () => {
    expect(existsSync('dist/fa/index.html')).toBe(true);
    expect(fa()).toMatch(/dir="rtl"/);
    expect(fa()).toContain('سفرِ آهسته'); // FA hero headline, Caucasus Light redesign 2026-08-31 (was 'تمام جاده')
    expect(fa()).toContain('یک روز کار');           // films translated
    // Caucasus Light redesign, 2026-08-31 (Task 7): rails rows are gone; the
    // rails fact (no bank rails) now lives in the sponsor lead sentence.
    expect(fa()).toContain('مسیرِ بانکی در کار نیست');
    expect(fa()).not.toContain('Twelve hours of food delivery');
    expect(fa()).not.toContain('first-class, not fallback');
  });
  it('FA page zeroes letter-spacing and falls back mono→Vazirmatn (B2)', () => {
    // Strip any deploy base prefix: a project page serves from /<repo>/, dist does not.
    const cssFiles = [...en().matchAll(/href="([^"]+\.css)"/g)]
      .map((m) => readFileSync('dist' + m[1].replace(/^.*?(\/_astro\/)/, '$1'), 'utf8')).join('');
    const inline = (en() + fa()).match(/<style[^>]*>[\s\S]*?<\/style>/g)?.join('') ?? '';
    const all = cssFiles + inline;
    expect(all).toMatch(/lang=(?:"|\\")?fa(?:"|\\")?[^{}]*\{[^}]*letter-spacing:\s*0/);
    // Caucasus Light redesign: --f-mono/--f-mono-fa are gone, `.mono` now
    // renders in --f-sans and the FA override points at --f-fa instead.
    expect(all, '--f-fa must name a Persian family').toMatch(/--f-fa:[^;]*Vazirmatn/);
    expect(all).toMatch(/lang=(?:"|\\")?fa(?:"|\\")?[^{}]*\.mono[^{}]*\{[^}]*(?:Vazirmatn|--f-fa)/);
  });
  // Caucasus Light redesign, 2026-08-31: the old chip odometer was zero-padded
  // to 6 digits inside `[ KM 000000 ]` brackets; the hero stat row prints the
  // bare, unpadded figure instead, so the assertions move to that shape —
  // the day-derivation check itself (facts, never a literal) is unchanged.
  it('FA hero stat row uses Persian numerals (m5)', () => {
    const fdigits = (n: string) => n.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
    expect(fa()).toContain(fdigits(String(loadFacts().day)));
    expect(fa()).toContain(fdigits(String(loadFacts().countries)));
  });
  it('bidi isolation on handle and metrics window (M1)', () => {
    expect(fa()).toMatch(/<bdi dir="ltr">@navid__fa<\/bdi>/);
    expect(fa()).toContain(`<bdi dir="ltr">${loadFacts().metricsWindow}`);
  });
  // The FA clients grid printed "11+1 by Tumo" as "by Tumo 11+1" (live,
  // 2026-09-09): a bare Latin-plus-digits string inside an RTL paragraph is
  // reordered by the bidi algorithm — "11+1" resolves as a number run, "by
  // Tumo" as a Latin run, and RTL order lays the words out first. Measured on
  // the built page before the fix: "Tumo" at x=383, "11+1" at x=434. A brand
  // name is an LTR island, isolated the same way as the handle above. Both
  // locales, so the component carries no locale branch.
  it('every client name is bidi-isolated on both pages (the "11+1 by Tumo" case)', async () => {
    const { loadEpisodes } = await import('../src/lib/content');
    const e = loadEpisodes();
    expect(e.partnerships.some((p) => /\d/.test(p.client) && /[A-Za-z]/.test(p.client)), 'the mixed case is still in the data').toBe(true);
    for (const p of e.partnerships) {
      expect(fa(), p.id).toContain(`<bdi dir="ltr">${p.client}</bdi>`);
      expect(en(), p.id).toContain(`<bdi dir="ltr">${p.client}</bdi>`);
    }
  });
  it('every img has non-empty alt', () => {
    for (const page of [en(), fa()]) {
      const imgs = page.match(/<img [^>]+>/g) || [];
      expect(imgs.length).toBeGreaterThan(0);
      imgs.forEach((tag) => expect(tag, tag.slice(0, 80)).toMatch(/alt="[^"]+"/));
    }
  });
  it('og/meta complete: absolute image, url, locales, twitter, canonical, hreflang (M13)', () => {
    for (const page of [en(), fa()]) {
      expect(page).toMatch(/property="og:image" content="https?:\/\//);
      expect(page).toMatch(/property="og:url"/);
      expect(page).toMatch(/property="og:locale"/);
      expect(page).toMatch(/name="twitter:card"/);
      expect(page).toMatch(/rel="canonical"/);
      expect(page).toMatch(/hreflang="fa"/);
    }
  });
  it('noscript safety: reveal hiding is scoped to .js (M6)', () => {
    expect(en()).toMatch(/documentElement\.classList\.add\(['"]js['"]\)/);
  });
  it('sr-only station list for assistive tech (M8)', () => {
    // Was pinned to the literal `Shiraz, Iran, km 0` — the hand-rolled English
    // string that turned out to be on the Persian page too. The list now uses
    // the component's own localized helpers, so the assertion is that the
    // first station is there with its distance, not that it is spelled the one
    // way the bug spelled it.
    const [first] = srOnlyItems(en());
    expect(first).toContain('Shiraz');
    expect(first).toMatch(/\b0\b/);
  });
  it('media kit PDF is linked (M10)', () => {
    expect(en()).toMatch(/href="[^"]*navid-media-kit\.pdf"/);
  });
  it('no root-absolute hrefs authored in i18n (M12)', () => {
    for (const f of ['src/i18n/en.yaml', 'src/i18n/fa.yaml']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/href: "\//);
    }
  });
  it('404 page exists, is styled and routes home', () => {
    const p = readFileSync('dist/404.html', 'utf8');
    expect(p).toMatch(/This road isn't on the map|road isn/);
    expect(p).toMatch(/href="\/"/);
    expect(p).toMatch(/_astro\/.*\.css/);
  });

  it('the linked media kit PDF actually exists in dist', () => {
    const linked = /href="[^"]*navid-media-kit\.pdf"/.test(en());
    expect(linked, 'footer no longer links the PDF').toBe(true);
    // astro build clears dist/, so the PDF must be regenerated after every build
    expect(existsSync('dist/navid-media-kit.pdf'), 'PDF is linked but missing from dist — run `npm run pdf` after `npm run build`').toBe(true);
  });

  it('sitemap and robots ship', () => {
    expect(existsSync('dist/sitemap-index.xml')).toBe(true);
    const sm = readFileSync('dist/sitemap-0.xml', 'utf8');
    expect(sm).toMatch(/<loc>/);
    expect(readFileSync('dist/robots.txt', 'utf8')).toMatch(/Sitemap:/);
  });

  it('JSON-LD is valid and leaks no placeholder contact', () => {
    const m = readFileSync('dist/index.html', 'utf8').match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    expect(m, 'no JSON-LD block').toBeTruthy();
    const data = JSON.parse(m![1]);
    expect(data['@type']).toBe('Person');
    expect(data.name).toBe('Navid Faramarznezhad');
    expect(JSON.stringify(data)).not.toMatch(/example\.com|CONFIRMING/);
  });

  it('contact form renders with labels and honeypot on both locales', () => {
    for (const page of [en(), fa()]) {
      expect(page).toMatch(/data-contact-form/);
      expect(page).toMatch(/for="cf-email"/);
      expect(page).toMatch(/id="cf-website"/);
    }
  });

  it('no element carries two style attributes (silent-drop bug)', () => {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const files = readdirSync('src/components').filter((f) => f.endsWith('.astro'));
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f) => {
      const src = readFileSync(`src/components/${f}`, 'utf8');
      expect(src, `${f} has a tag with two style attributes`).not.toMatch(/style="[^"]*"[^>]*style="/);
    });
  });

  it('no raw px font-size in components — sizes come from tokens', () => {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    readdirSync('src/components').filter((f) => f.endsWith('.astro')).forEach((f) => {
      const src = readFileSync(`src/components/${f}`, 'utf8');
      const raw = src.match(/font-size:\s*\d+px/g) || [];
      expect(raw, `${f}: ${raw.join(', ')}`).toHaveLength(0);
    });
  });

  // Renamed from HeroLens to Hero — the Caucasus Light redesign (2026-08-31)
  // retired the odometer/pad chip row, but the no-hardcoded-number guard
  // still applies to whatever component owns the hero stats.
  it('no hardcoded content number in Hero (B3)', () => {
    expect(readFileSync('src/components/Hero.astro', 'utf8')).not.toMatch(/pad\(\s*\d|odometer\(\s*\d{2,}/);
  });
  it('the story chapter is present and bilingual', () => {
    for (const page of [en(), fa()]) expect(page).toContain('id="story"');
    expect(en()).toContain('I left Shiraz');   // first person since 2026-09-01
    expect(fa()).toMatch(/از شیراز راه افتاد/);
  });
  it('the account is in HIS voice — no third person in the story (2026-09-01)', async () => {
    // The site speaks as "I". Third person creeping back into his own account
    // is the failure this guards: it would put our narration in his mouth.
    const { loadStory, pick } = await import('../src/lib/content');
    loadStory().chapters.forEach((c) => {
      expect(pick(c.body, 'en'), `${c.id} uses third person`).not.toMatch(/\b(he|his|him)\b/i);
    });
  });
  it('the story carries the years and the crafts, in both locales', () => {
    // Task 5: timeline + values + photographs expand #story.
    expect(en()).toContain('I left Shiraz');
    expect(en()).toContain('Barista training');
    expect(fa()).toContain('سال‌های تور');
    expect(fa()).toContain('آموزش باریستا');
    expect(en()).toContain('The whole road, in frame.');   // the motif survives, inside the story
  });
  it('the essay is on the page, verbatim, in his own words', () => {
    expect(en()).toContain('id="essay"');
    expect(en()).toContain('the bicycle is more energy efficient than an airplane');
    expect(en()).toContain('for seeing the world how it truly is');
    expect(fa()).toContain('فلسفهٔ دوچرخه');
  });
  it('his essay quote is on the page for #essay (moved out of #story, 2026-08-31 redesign; rendered by Task 6)', async () => {
    // The "borders" quote moved from story.yaml's #story blockquotes to
    // essay.yaml, and Task 6's Essay.astro now renders #essay — so this
    // checks dist directly, not just the data that feeds it.
    const { loadEssay, pick } = await import('../src/lib/content');
    const essay = loadEssay();
    const rhythm = essay.excerpts.find((x) => x.id === 'ex-rhythm')!;
    expect(pick(rhythm.body, 'en')).toContain('cultures refuse to stop at country borders');
    expect(pick(essay.title, 'en')).toBe('The Philosophy of the Bicycle');
    expect(en()).toContain('cultures refuse to stop at country borders');
  });
  it('the start date is rendered from facts, not printed as a token', async () => {
    const { loadFacts } = await import('../src/lib/content');
    const { startDateText } = await import('../src/lib/format');
    for (const page of [en(), fa()]) expect(page).not.toContain('{start}');
    expect(en()).toContain(startDateText(loadFacts().startDate, 'en'));
    expect(fa()).toContain(startDateText(loadFacts().startDate, 'fa'));
  });
  it('every filmed day is listed, with no invented hours', async () => {
    const { loadEpisodes } = await import('../src/lib/content');
    const e = loadEpisodes();
    expect(en()).toContain('id="work"');
    e.items.forEach((i) => expect(en(), i.id).toContain(i.job.en));
    // hours: null must print nothing at all — never "0" and never "null".
    expect(en()).not.toMatch(/>\s*null\s*</);
    expect(en()).not.toMatch(/0\s*(H|HOURS)\b/);
  });
  it('names every client he has already delivered for', async () => {
    const { loadEpisodes } = await import('../src/lib/content');
    const e = loadEpisodes();
    expect(en()).toContain('id="clients"');
    expect(e.partnerships.length).toBeGreaterThanOrEqual(7);
    e.partnerships.forEach((p) => expect(en(), p.id).toContain(p.client));
    e.unfilmed.forEach((u) => expect(en()).toContain(u.en));
  });
  it('the Persian page carries the work and clients chapters too', async () => {
    const { loadEpisodes, pick } = await import('../src/lib/content');
    const e = loadEpisodes();
    for (const id of ['work', 'clients']) expect(fa(), id).toContain(`id="${id}"`);
    e.items.forEach((i) => expect(fa(), i.id).toContain(pick(i.job, 'fa')));
    e.partnerships.forEach((p) => expect(fa(), p.id).toContain(pick(p.what, 'fa')));
    e.unfilmed.forEach((u) => expect(fa()).toContain(u.fa));
  });
  // The track's screen-reader alternative was English on BOTH pages until
  // 2026-09-09 — a Persian user heard "Shiraz, Iran, km 0, 1486 m" under a
  // heading that had just been read in Persian. Nothing could see it: it is
  // invisible to the eye, `npm run fonts` only judges Persian that IS there,
  // and every other guard reads the visible page.
  const srOnlyItems = (html: string) => {
    const ol = html.match(/<ol class="sr-only">([\s\S]*?)<\/ol>/);
    expect(ol, 'the track has no sr-only station list at all').toBeTruthy();
    return [...ol![1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim());
  };
  it('the FA track speaks Persian to a screen reader, not English', async () => {
    const { loadJourney } = await import('../src/lib/content');
    const stations = loadJourney().stations;
    const items = srOnlyItems(fa());
    expect(items.length).toBe(stations.length);
    items.forEach((li, i) => {
      // Persian script present, and NO Latin station name left behind.
      expect(li, `sr-only[${i}] is not Persian: ${li}`).toMatch(/[؀-ۿ]/);
      expect(li, `sr-only[${i}] still carries Latin words: ${li}`).not.toMatch(/[A-Za-z]{2,}/);
    });
    // Every station's own Persian name, and Persian digits for its distance.
    stations.forEach((st) => {
      expect(items.join(' | '), st.id).toContain(st.fa);
    });
    expect(items.join(' | ')).toMatch(/[۰-۹]/);
    expect(items.join(' | ')).not.toMatch(/\bkm\b|\bm\b/);
  });
  it('the EN track keeps its own names, so the two are a mirror not a copy', async () => {
    const { loadJourney } = await import('../src/lib/content');
    const items = srOnlyItems(en()).join(' | ');
    loadJourney().stations.forEach((st) => expect(items, st.id).toContain(st.en));
    expect(items).not.toMatch(/[؀-ۿ]/);
  });
  it('nav is the portrait nav; sponsor is reachable but not advertised', () => {
    const html = en();
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    for (const a of ['#story', '#essay', '#track', '#work']) expect(nav).toContain(`href="${a}"`);
    expect(nav).not.toContain('#sponsors');
    // the footer keeps a door to the sponsor chapter
    const footer = html.slice(html.indexOf('<footer'));
    expect(footer).toContain('href="#sponsors"');
  });
  it('nav links to every chapter and the CTA opens the one door', () => {
    for (const page of [en(), fa()]) {
      ['#story', '#track', '#work', '#sponsors'].forEach((a) =>
        expect(page, a).toContain(`href="${a}"`));
      expect(page).toContain('href="#contact"');
    }
    expect(en()).toContain('Get in touch');
  });
  it('contact names more than one reason to write', () => {
    expect(en()).toMatch(/sponsor the road ahead/i);
    expect(en()).toMatch(/hire me to film/i);
    expect(fa()).toMatch(/[؀-ۿ]/);
    expect(fa()).toContain('id="contact"');
  });
});

describe('story photo frames (spec 2026-09-05)', () => {
  const frameIds = (page: string) => [...page.matchAll(/data-frame="([a-z-]+)"/g)].map((m) => m[1]);
  it('renders one frame per photo group, in order, in both locales', async () => {
    const { framesFor, loadStory } = await import('../src/lib/content');
    const want = framesFor(loadStory().chapters).map((f) => f.id);
    expect(want).toEqual(['border', 'armenia', 'work', 'winter', 'georgia']);
    expect(frameIds(en())).toEqual(want);
    expect(frameIds(fa())).toEqual(want);
  });
  it('every frame photo is a full-size link with dimensions — the no-JS path and the lightbox target', () => {
    for (const page of [en(), fa()]) {
      const links = page.match(/<a class="pswp-link[^"]*"[^>]*>/g) || [];
      expect(links).toHaveLength(frameIds(page).length);
      links.forEach((a) => {
        expect(a, a).toMatch(/href="[^"]*\/_astro\/[^"]+\.webp"/);
        expect(a, a).toMatch(/data-pswp-width="\d+"/);
        expect(a, a).toMatch(/data-pswp-height="\d+"/);
        expect(a, a).toMatch(/target="_blank"/);
      });
    }
  });
  it("frame numbers use the page's own digits", () => {
    expect(en()).toContain('>01<');
    expect(fa()).toContain('>۰۱<');
    expect(fa()).not.toContain('>01<');
  });
  it('the two retired captioned photos left the story, and their strings are gone', () => {
    expect(en()).not.toContain('Riding past the carved facades');
    expect(en()).not.toContain('Above the clouds in the Armenian mountains');
    expect(readFileSync('src/i18n/en.yaml', 'utf8')).not.toMatch(/photo[12](Caption|Alt)/);
    expect(readFileSync('src/i18n/fa.yaml', 'utf8')).not.toMatch(/photo[12](Caption|Alt)/);
  });
  it('the words of every chapter are still on the page, inside its frame', () => {
    expect(en()).toMatch(/data-frame="border"[\s\S]*?I left Shiraz[\s\S]*?I reached the Norduz crossing[\s\S]*?data-frame="armenia"/);
    expect(en()).toMatch(/data-frame="winter"[\s\S]*?Then a road accident[\s\S]*?The hardest winter[\s\S]*?data-frame="georgia"/);
  });
  it('StoryFrames uses logical properties only — the RTL mirror comes for free', () => {
    const src = readFileSync('src/components/StoryFrames.astro', 'utf8');
    expect(src).not.toMatch(/\b(left|right|pl|pr|ml|mr)-\[?\d/);
    expect(src).not.toMatch(/\b(text-left|text-right)\b/);
    expect(src).not.toMatch(/\b(left|right)\s*:/);
  });
  it('captions sit on the paper strip, not on the photograph', () => {
    // the figcaption is a sibling AFTER the link, never inside it
    for (const page of [en(), fa()]) {
      const anchors = page.match(/<a class="pswp-link[\s\S]*?<\/a>/g) || [];
      expect(anchors).toHaveLength(frameIds(page).length);
      anchors.forEach((a) => expect(a).not.toContain('<figcaption'));
      expect((page.match(/<\/a>\s*<figcaption/g) || []).length).toBe(frameIds(page).length);
    }
  });
});

// 2026-09-09, Navid's read-through of the live skin: two hero changes.
describe('hero — motto first, and the countries note (2026-09-09)', () => {
  const motto = (l: 'en' | 'fa') => t(l)['hero.motto'];
  const headline = (l: 'en' | 'fa') => t(l)['hero.headline'];
  it('the motto precedes the headline on both pages', () => {
    for (const [l, page] of [['en', en()], ['fa', fa()]] as const) {
      const m = page.indexOf(motto(l));
      const h = page.indexOf(headline(l));
      expect(m, `${l}: motto present`).toBeGreaterThan(-1);
      expect(h, `${l}: headline present`).toBeGreaterThan(-1);
      expect(m, `${l}: motto should come before the headline`).toBeLessThan(h);
    }
  });
  it('the countries stat carries the lived-and-travelled note with the number from facts', () => {
    const n = loadFacts().countriesLivedWorked;
    expect(en()).toContain(`But I have travelled and lived in ${n} Asian countries.`);
    expect(fa()).toContain(`اما تجربهٔ سفر و زندگی در ${localizeDigits(String(n), 'fa')} کشور آسیایی را دارم.`);
    // it sits INSIDE the third stat's column, after its label, not as a separate row
    const enPage = en();
    const label = enPage.indexOf(t('en')['hero.statCountries']);
    const note = enPage.indexOf('Asian countries');
    expect(note).toBeGreaterThan(label);
    expect(enPage.slice(label, note)).not.toContain('role="listitem"');
  });
  it('the note is a template — no locale file or component hardcodes the 13', () => {
    for (const l of ['en', 'fa'] as const) expect(t(l)['hero.statCountriesNote']).toContain('{n}');
    expect(readFileSync('src/components/Hero.astro', 'utf8')).not.toMatch(/\b13\b|۱۳/);
  });
});
