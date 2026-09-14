import { describe, it, expect } from 'vitest';
import { framesFor, loadStory, type Chapter } from '../src/lib/content';

// Minimal chapter factory. `photo` present ⇒ the chapter closes a frame.
const ch = (id: string, photo = false): Chapter => ({
  id,
  body: { en: `${id} en`, fa: 'فارسی' },
  ...(photo ? { photo: { file: `${id}.jpg`, alt: { en: 'alt text', fa: 'متن جایگزین' }, caption: { en: 'cap', fa: 'زیرنویس' } } } : {}),
});

describe('framesFor — spec §3', () => {
  it('a photo chapter closes a frame; photo-less chapters attach FORWARD', () => {
    const f = framesFor([ch('a'), ch('b', true), ch('c', true)]);
    expect(f.map((x) => x.id)).toEqual(['b', 'c']);
    expect(f[0].chapters.map((c) => c.id)).toEqual(['a', 'b']);
    expect(f[1].chapters.map((c) => c.id)).toEqual(['c']);
  });
  it('trailing photo-less chapters attach BACKWARD to the last frame', () => {
    const f = framesFor([ch('a', true), ch('b'), ch('c')]);
    expect(f).toHaveLength(1);
    expect(f[0].chapters.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
  it('every chapter lands in exactly one frame, in order', () => {
    const cs = [ch('a'), ch('b', true), ch('c'), ch('d'), ch('e', true), ch('f')];
    const flat = framesFor(cs).flatMap((f) => f.chapters.map((c) => c.id));
    expect(flat).toEqual(cs.map((c) => c.id));
  });
  it('every frame carries the photo of the chapter that closed it', () => {
    const f = framesFor([ch('a'), ch('b', true)]);
    expect(f[0].photo.file).toBe('b.jpg');
  });
  it('throws when nothing carries a photo — the story cannot render frameless', () => {
    expect(() => framesFor([ch('a'), ch('b')])).toThrow(/no chapter carries a photo/);
  });
  it('the real story today: five frames, chapters 2-1-1-2-1', () => {
    const f = framesFor(loadStory().chapters);
    expect(f.map((x) => x.id)).toEqual(['border', 'armenia', 'work', 'winter', 'georgia']);
    expect(f.map((x) => x.chapters.length)).toEqual([2, 1, 1, 2, 1]);
  });
});
