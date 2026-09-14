import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { loadFacts, loadJourney, loadWork, loadOffer, loadEpisodes, loadStory, loadEssay, pick } from '../src/lib/content';
describe('content loaders', () => {
  it('facts load and are typed', () => {
    const f = loadFacts();
    expect(f.verified).toBe(true);
    // Instagram's rounded share figure for the top film (56K on the 2026-09-09
    // screenshot). It was an exact 61,452 for a different film until the Pride
    // day overtook it — pinned so a refresh that forgets it fails here.
    expect(f.sharesTopFilm).toBe(56000);
    expect(f.kmNumeric).toBe(5000);
    expect(f.stale).toBe(false);
    // Ridden countries, not countries visited — he has cycled three (Q10).
    expect(f.countries).toBe(3);
    expect(f.countriesLivedWorked).toBe(13);
  });
  it('the day counter derives from the start date and never goes stale', async () => {
    const { daysSince } = await import('../src/lib/content');
    expect(daysSince('2025-05-28', new Date('2025-05-28T00:00:00Z'))).toBe(1);
    expect(daysSince('2025-05-28', new Date('2026-08-29T00:00:00Z'))).toBe(459);
    // The real one must keep climbing, not sit frozen in a yaml file.
    const f = loadFacts();
    expect(f.day).toBeGreaterThanOrEqual(459);
    expect(f.day).toBe(daysSince(f.startDate));
  });
  it('episodes carry the real Q14 work, its clients and its unknowns', () => {
    const e = loadEpisodes();
    expect(e.mock).toBe(false);
    // He never gave hours for the newer days — null, never a guessed number.
    expect(e.items.some((i) => i.hours === null)).toBe(true);
    expect(e.partnerships.length).toBeGreaterThanOrEqual(7);
    expect(e.partnerships.map((p) => p.client)).toContain('MENQ');
    expect(e.unfilmed.length).toBeGreaterThanOrEqual(3);
  });
  it('journey is ridden-only by construction', () => {
    const j = loadJourney();
    expect(j.policyNoForward).toBe(true);
    expect(j.stations.length).toBeGreaterThanOrEqual(5);
    j.stations.forEach((s) => expect(s.ridden).toBe(true));
    expect(j.stations.map((s) => s.id)).toContain('shiraz');
  });
  it('work is bilingual and picks per locale', () => {
    const w = loadWork();
    expect(w.films).toHaveLength(2);
    expect(pick(w.films[0].title, 'en')).toMatch(/Armenia/);
    expect(pick(w.films[0].title, 'fa')).toMatch(/[؀-ۿ]/);
  });
  it('gear rows are real and bilingual, or there are none at all', () => {
    const o = loadOffer();
    // The list may legitimately be empty (v1 shipped without it, Q26 pending).
    // What it may never be is present-but-placeholder, or English-only.
    o.needs.forEach((n) => {
      expect(n.mock, `${n.id} is still placeholder`).not.toBe(true);
      expect(n.item.fa).toMatch(/[؀-ۿ]/);
      expect(n.why.fa).toMatch(/[؀-ۿ]/);
    });
    expect(typeof o.contact.mock).toBe('boolean');
  });
  it('episodes load bilingual and carry the two record films', () => {
    const e = loadEpisodes();
    expect(e.items.length).toBeGreaterThanOrEqual(2);
    expect(e.items[0].city.fa).toMatch(/[؀-ۿ]/);
    expect(e.items.map((i) => i.platform)).toContain('Wolt');
  });
  it('story loads, is bilingual, and cannot lie about pending quotes', async () => {
    const { loadStory } = await import('../src/lib/content');
    const st = loadStory();
    // Was >=4; the essay-teaser chapter moved to essay.yaml in the Caucasus
    // Light redesign (2026-08-31), leaving leaving/the-work/before.
    expect(st.chapters.length).toBeGreaterThanOrEqual(3);
    st.chapters.forEach((c) => {
      expect(c.body.en.length).toBeGreaterThan(20);
      expect(c.body.fa).toMatch(/[؀-ۿ]/);
    });
    // The flag and the data are the same fact, enforced by the schema.
    st.quotes.forEach((q) => {
      expect(q.pending, `${q.id}: pending must match body===null`).toBe(q.body === null);
      expect(q.context.fa).toMatch(/[؀-ۿ]/);
    });
    // His one real quote (the essay excerpt) moved to essay.yaml in the
    // Caucasus Light redesign (2026-08-31) — story.yaml's quotes are now
    // pending-only until he answers Q18/Q44.
    expect(st.quotes.some((q) => q.pending)).toBe(true);
  });
  it('story carries a sourced timeline and values', () => {
    const s = loadStory();
    // Three: the timeline is only the years BEFORE the ride now — the ride
    // itself is his first-person account in `chapters` (2026-09-01).
    expect(s.timeline.length).toBeGreaterThanOrEqual(3);
    expect(s.values.crafts.length).toBeGreaterThanOrEqual(3);
  });
  it('essay excerpts are verbatim-bearing and bilingual', () => {
    const e = loadEssay();
    expect(e.excerpts).toHaveLength(3);
    expect(e.excerpts[1].body.en).toContain('cultures refuse to stop at country borders');
  });
  it('the story quotes now hold only pending slots (the essay owns his written words)', () => {
    expect(loadStory().quotes.every((q) => q.pending)).toBe(true);
  });
  it('the start date is spoken from facts.yaml, never retyped', async () => {
    const { startDateText } = await import('../src/lib/format');
    const { loadStory, loadFacts } = await import('../src/lib/content');
    expect(startDateText('2025-05-28', 'en')).toBe('28 May 2025');
    expect(startDateText('2025-05-28', 'fa')).toBe('۲۸ مه ۲۰۲۵');
    // The prose must carry the token, not the answer.
    const leaving = loadStory().chapters.find((c) => c.id === 'leaving')!;
    expect(leaving.body.en).toContain('{start}');
    expect(leaving.body.fa).toContain('{start}');
    const f = loadFacts();
    [leaving.body.en, leaving.body.fa].forEach((s) => {
      expect(s).not.toMatch(/2025/);
      expect(s).not.toMatch(/۲۰۲۵/);
      expect(s).not.toContain(f.startDate);
    });
  });
  it('error path: invalid data fails loud with the file named (spec §9)', async () => {
    const { z } = await import('zod');
    const { readFileSync } = await import('node:fs');
    const { load } = await import('js-yaml');
    const raw = load(readFileSync('src/data/work.yaml', 'utf8')) as Record<string, unknown>;
    delete (raw as { book?: unknown }).book;
    const Item = z.object({ id: z.string() });
    const S = z.object({ films: z.array(Item), book: Item, essay: Item });
    expect(() => {
      const r = S.safeParse(raw);
      if (!r.success) throw new Error(`work.yaml invalid: ${r.error.message}`);
    }).toThrow(/work\.yaml invalid/);
  });
});
