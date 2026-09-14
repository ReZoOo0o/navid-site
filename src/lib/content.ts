import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';

/** A string that must exist in both languages — missing fa is a BUILD ERROR. */
const Loc = z.object({ en: z.string().min(1), fa: z.string().min(1).regex(/[؀-ۿ]/, 'fa must be Persian') });
export type Loc = z.infer<typeof Loc>;
export const pick = (l: Loc, locale: 'en' | 'fa'): string => l[locale];

const FactsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  km: z.string(), kmNumeric: z.number().int(), kmSource: z.string(),
  countries: z.number().int(), countriesLivedWorked: z.number().int(),
  followers: z.string(), verified: z.literal(true),
  sharesTopFilm: z.number().int(), viewsTopFilm: z.string(), viewsSecondFilm: z.string(),
  views30d: z.string(), interactions30d: z.string(), viewsBestFilm: z.string(),
  nonFollowerReach: z.string(), metricsWindow: z.string(), stale: z.boolean(),
});
const StationSchema = z.object({
  // `en` and `fa` are the reader's name; `native` is the local script, shown
  // as a grace note beneath. Leading with `native` made the English page
  // unreadable to the sponsors it exists for.
  id: z.string(), en: z.string(), fa: z.string().regex(/[؀-ۿ]/, 'fa must be Persian'), native: z.string(),
  nativeLang: z.enum(['fa', 'hy', 'ka']), country: z.string(),
  km: z.number(), ridden: z.literal(true),
  day: z.number().int().optional(), elevationM: z.number().optional(),
});
const JourneySchema = z.object({ policyNoForward: z.literal(true), stations: z.array(StationSchema).min(5) });
const WorkItemSchema = z.object({ id: z.string(), title: Loc, body: Loc });
// `book` is OPTIONAL and currently ABSENT on purpose. See work.yaml.
const WorkSchema = z.object({ films: z.array(WorkItemSchema).length(2), book: WorkItemSchema.optional(), essay: WorkItemSchema });
const EpisodeSchema = z.object({
  id: z.string(),
  city: Loc,
  job: Loc,
  platform: z.string(),           // Yandex, Wolt, ... (brand name, not translated)
  hours: z.number().nullable(),   // null = he never told us; publish nothing
  reelUrl: z.string().url().nullable(),
  views: z.string().nullable(),
  mock: z.boolean().optional(),
});
/** A brand or organisation that has already paid or partnered with him (Q14). */
const PartnershipSchema = z.object({
  id: z.string(), client: z.string(), what: Loc, where: Loc,
});
const GearItemSchema = z.object({
  id: z.string(),
  item: Loc,
  why: Loc,
  brandHint: z.string().nullable(),
  mock: z.boolean().optional(),
});
/**
 * His first-person account, one paragraph per chapter. `photo` is optional
 * and names a file in src/assets/photos/ (Story.astro resolves it at build
 * time and fails the build if the file is missing). Alt and caption are
 * content, not UI strings, so they live here next to the chapter they show.
 */
const ChapterPhotoSchema = z.object({
  file: z.string().regex(/^[a-z0-9-]+\.jpg$/, 'photo file: lowercase-kebab .jpg in src/assets/photos/'),
  alt: Loc,
  caption: Loc,
});
const ChapterSchema = z.object({ id: z.string(), body: Loc, photo: ChapterPhotoSchema.optional() });
/**
 * Navid's own words, and ONLY his own words.
 * `pending: true` means he has not answered yet — body MUST be null, and the
 * component MUST render nothing. The refine below makes the flag incapable of
 * disagreeing with the data, so a half-finished edit fails the build instead
 * of quietly putting a sentence in his mouth.
 */
const QuoteSchema = z.object({
  id: z.string(),
  source: z.string(),          // which questionnaire item, or the essay
  pending: z.boolean(),
  context: Loc,                // "on why he counts the money on camera"
  body: Loc.nullable(),
}).refine((q) => q.pending === (q.body === null), {
  message: 'pending must be true exactly when body is null',
});
const TimelineSchema = z.object({ id: z.string(), when: Loc, body: Loc });
const ValuesSchema = z.object({ values: z.array(Loc).min(2), crafts: z.array(Loc).min(3), languages: z.array(Loc).min(2) });
const StorySchema = z.object({
  chapters: z.array(ChapterSchema).min(3),   // was 4; the essay-teaser chapter moves out
  quotes: z.array(QuoteSchema).min(1),
  // Three: the timeline covers only the years BEFORE the ride now — the ride
  // itself moved into `chapters` as his own first-person account (2026-09-01).
  timeline: z.array(TimelineSchema).min(3),
  values: ValuesSchema,
});
const EssaySchema = z.object({ title: Loc, intro: Loc, excerpts: z.array(z.object({ id: z.string(), body: Loc, frame: Loc })).length(3) });
const OfferSchema = z.object({
  proves: z.array(Loc).min(2),
  rails: z.array(z.object({ label: Loc, value: Loc })).min(3),
  ridesAlready: z.array(z.string()).min(3),
  needs: z.array(GearItemSchema),   // may be empty — see offer.yaml
  contact: z.object({
    instagram: z.string(),
    email: z.string(),
    whatsapp: z.string(),
    mock: z.boolean(),            // true = temp values, MUST be false to launch
  }),
});
const EpisodesSchema = z.object({
  mock: z.boolean(),
  items: z.array(EpisodeSchema).min(1),
  partnerships: z.array(PartnershipSchema).default([]),
  unfilmed: z.array(Loc).default([]),
});

function read<T>(file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const raw = load(readFileSync(resolve(process.cwd(), 'src/data', file), 'utf8'));
  const r = schema.safeParse(raw);
  if (!r.success) throw new Error(`${file} invalid: ${r.error.message}`);
  return r.data;
}
/** Days since he left Shiraz, inclusive of day 1. Derived — never stored. */
export function daysSince(startDate: string, now: Date = new Date()): number {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - start) / 86_400_000) + 1;
}
export type Facts = z.infer<typeof FactsSchema> & { day: number };
export type Station = z.infer<typeof StationSchema>;
export type Journey = z.infer<typeof JourneySchema>;
export type Work = z.infer<typeof WorkSchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
export type Episodes = z.infer<typeof EpisodesSchema>;
export type GearItem = z.infer<typeof GearItemSchema>;
export type Partnership = z.infer<typeof PartnershipSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Essay = z.infer<typeof EssaySchema>;
export type ChapterPhoto = NonNullable<Chapter['photo']>;
export type Frame = { id: string; photo: ChapterPhoto; chapters: Chapter[] };
/**
 * Group chapters into photo frames (spec 2026-09-05 §3). A chapter WITH a
 * photo closes a frame and gives it its id and photograph. Chapters without a
 * photo attach FORWARD to the next photo chapter; photo-less chapters at the
 * very end attach BACKWARD to the last frame. Order is preserved; every
 * chapter appears exactly once. A story with no photograph at all cannot be
 * rendered as frames, so that is a build error, not an empty page.
 */
export function framesFor(chapters: Chapter[]): Frame[] {
  const frames: Frame[] = [];
  let pending: Chapter[] = [];
  for (const c of chapters) {
    pending.push(c);
    if (c.photo) {
      frames.push({ id: c.id, photo: c.photo, chapters: pending });
      pending = [];
    }
  }
  if (frames.length === 0) throw new Error('framesFor: no chapter carries a photo');
  if (pending.length) frames[frames.length - 1].chapters.push(...pending);
  return frames;
}
export const loadFacts = (): Facts => {
  const f = read('facts.yaml', FactsSchema);
  return { ...f, day: daysSince(f.startDate) };
};
export const loadJourney = (): Journey => read('journey.yaml', JourneySchema);
export const loadWork = (): Work => read('work.yaml', WorkSchema);
export const loadOffer = (): Offer => read('offer.yaml', OfferSchema);
export const loadEpisodes = (): Episodes => read('episodes.yaml', EpisodesSchema);
export const loadStory = (): Story => read('story.yaml', StorySchema);
export const loadEssay = (): Essay => read('essay.yaml', EssaySchema);

/** True when ANY loaded data still carries temp values. Launch guard reads this. */
export function hasMockData(): boolean {
  return loadOffer().contact.mock
    || loadEpisodes().mock
    || loadOffer().needs.some((n) => n.mock === true);
}
