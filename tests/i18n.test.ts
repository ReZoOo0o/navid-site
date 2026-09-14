import { describe, it, expect } from 'vitest';
import { t, keys } from '../src/lib/i18n';
import { loadStory, loadOffer, loadEpisodes } from '../src/lib/content';
describe('i18n parity', () => {
  it('en and fa expose identical key sets', () => {
    expect(keys('fa').sort()).toEqual(keys('en').sort());
  });
  it('no empty fa values', () => {
    const fa = t('fa');
    keys('fa').forEach((k) => expect(fa[k].trim(), k).not.toBe(''));
  });
  it('fa prose is actually Persian', () => {
    const fa = t('fa');
    // work.heading was retired in the Caucasus Light redesign (task 8, 2026-08-31)
    // along with the rest of the work.* block — WorkPanels.astro is gone and
    // episodes.heading now covers the #work section; swapped in as the third probe.
    ['hero.headline', 'sponsor.lead', 'episodes.heading'].forEach((k) => expect(fa[k], k).toMatch(/[؀-ۿ]/));
  });
  it('missing key throws instead of rendering blank (spec §9)', () => {
    expect(() => t('en')['no.such.key']).toThrow(/missing i18n key/);
  });
  it('data-file prose is localized too — the B1 regression guard', () => {
    const st = loadStory();
    const o = loadOffer();
    const e = loadEpisodes();
    [...st.chapters.map((c) => c.body), ...st.quotes.filter((q) => q.body).map((q) => q.body!),
     ...st.quotes.map((q) => q.context),
     ...o.proves, ...o.rails.map((r) => r.value),
     ...o.needs.map((n) => n.item), ...o.needs.map((n) => n.why),
     ...e.items.map((i) => i.city), ...e.items.map((i) => i.job),
     ...e.partnerships.map((p) => p.what), ...e.partnerships.map((p) => p.where), ...e.unfilmed]
      .forEach((l) => expect(l.fa, l.en.slice(0, 40)).toMatch(/[؀-ۿ]/));
  });
});
