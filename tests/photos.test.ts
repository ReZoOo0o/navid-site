import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { loadStory } from '../src/lib/content';

const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));

// Chapter photographs are declared in story.yaml and resolved by StoryFrames.astro
// against src/assets/photos/. These pin the contract so a renamed file or a
// typo fails in tests, not as a broken figure on the live page.
describe('chapter photographs', () => {
  const withPhoto = loadStory().chapters.filter((c) => c.photo);
  it('at least the five Sep-2026 chapters carry a photograph', () => {
    expect(withPhoto.map((c) => c.id)).toEqual(expect.arrayContaining(['border', 'armenia', 'work', 'winter', 'georgia']));
  });
  it('every declared photo file exists', () => {
    withPhoto.forEach((c) => expect(existsSync(`src/assets/photos/${c.photo!.file}`), c.photo!.file).toBe(true));
  });
  it('every JPEG in the photo tree is metadata-free, rendered or not (no EXIF APP1)', () => {
    // The deploy audit runs a PIL EXIF sweep; this is the cheap local tripwire.
    // A JPEG with EXIF carries an APP1 marker (FF E1) followed by "Exif\0\0".
    //
    // It walks the WHOLE tree, not only the declared photos: a retired
    // photograph is exactly the one nobody looks at again, so an unrendered
    // file has to be swept too, not just the ones story.yaml still points at.
    const jpegs = walk('src/assets/photos').filter((f) => /\.jpe?g$/i.test(f));
    expect(jpegs.length).toBeGreaterThanOrEqual(withPhoto.length);
    withPhoto.forEach((c) => expect(jpegs, `${c.photo!.file} not swept`).toContain(`src/assets/photos/${c.photo!.file}`));
    jpegs.forEach((f) => {
      const buf = readFileSync(f);
      expect(buf.indexOf(Buffer.from('Exif\0\0')), `${f} carries EXIF`).toBe(-1);
    });
  });
  it('captions and alts are real bilingual text, and alt is not the caption', () => {
    withPhoto.forEach((c) => {
      const p = c.photo!;
      expect(p.alt.en.length).toBeGreaterThan(20);
      expect(p.alt.fa).not.toBe(p.caption.fa);
      expect(p.alt.en).not.toBe(p.caption.en);
    });
  });
});
