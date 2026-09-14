import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { loadFacts, loadStory } from '../src/lib/content';
import { t } from '../src/lib/i18n';
const PDF = 'dist/navid-media-kit.pdf';
// Letterspaced glyphs extract with spaces between characters, and the
// extractor wraps lines — strip every whitespace before comparing.
const compact = (s: string) => s.replace(/\s+/g, '');
const pageTexts = async () => {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(PDF)) });
  const { pages } = await parser.getText();
  return pages.map((p: { text: string }) => compact(p.text));
};
describe.skipIf(!existsSync(PDF))('pdf kit', () => {
  // 2026-09-09, live kit: page 2 held the stat row and the "WHO I AM / The
  // rider" heading over ~644px of white. The hero photograph printed at
  // 46vh = 517px and pushed the 211px stat row off page 1; then the first
  // frame (853px, break-inside: avoid) could not follow the 130px heading on
  // page 2 and took page 3 whole, leaving the heading orphaned from its prose.
  // Two structural facts hold the fix, whatever the page count becomes.
  it('the stat row prints on the first page, with the hero', async () => {
    const [page1] = await pageTexts();
    const s = t('en');
    for (const k of ['hero.statKm', 'hero.statDays', 'hero.statCountries'] as const)
      expect(page1, s[k]).toContain(compact(s[k]));
  });
  it('the story heading prints on the same page as its first frame', async () => {
    const pages = await pageTexts();
    const heading = compact(t('en')['story.heading']);
    const i = pages.findIndex((p) => p.includes(heading));
    expect(i, 'story heading not found in the PDF').toBeGreaterThan(0);
    // The first chapter's second sentence — the first has a {start} placeholder.
    const firstWords = compact(loadStory().chapters[0].body.en.split('. ')[1]);
    expect(firstWords.length).toBeGreaterThan(20);
    expect(pages[i], `page ${i + 1} carries the heading but not the first frame's words`).toContain(firstWords);
  });
  it('contains the same numbers as the site (M10)', async () => {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(readFileSync(PDF)) });
    const { text } = await parser.getText();
    // letterspaced glyphs extract with spaces between characters — normalize first
    const compact = text.replace(/\s+/g, '');
    expect(compact).toContain(loadFacts().followers);
    // Retargeted 2026-08-31: `61,452` was rendered only by WorkPanels, which
    // this restructure removed. viewsTopFilm is rendered by the Episodes
    // component, so the PDF's number-parity check stays live.
    expect(compact).toContain(loadFacts().viewsTopFilm);
    expect(compact).toMatch(/Shiraz/i);
    expect(compact).toMatch(/Tbilisi/i);
    expect(compact).not.toMatch(new RegExp(Buffer.from('cnVzc2lh', 'base64').toString('utf8'), 'i'));
  });
});
