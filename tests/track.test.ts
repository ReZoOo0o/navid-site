import { describe, it, expect } from 'vitest';
import { layoutTrack, layoutRoute } from '../src/lib/track';
import { pad, localizeDigits, odometer, fill } from '../src/lib/format';
import { loadJourney } from '../src/lib/content';
describe('track layout', () => {
  const stations = loadJourney().stations;
  const pts = layoutTrack(stations, 1200);
  it('starts at pad and ends within bounds', () => {
    expect(pts[0].x).toBe(95);
    expect(Math.max(...pts.map((p) => p.x))).toBeLessThanOrEqual(1200 - 95 + 6);
  });
  it('x is monotonically non-decreasing', () => {
    for (let i = 1; i < pts.length; i++) expect(pts[i].x).toBeGreaterThanOrEqual(pts[i - 1].x);
  });
  it('duplicate-km stations do not overlap', () => {
    const xs = pts.map((p) => p.x);
    expect(new Set(xs).size).toBe(xs.length);
  });
  it('alternates label rows', () => {
    expect(pts[0].tickTall).not.toBe(pts[1].tickTall);
  });
  it('shuffled input is sorted by km, not trusted (m7)', () => {
    const shuffled = [...stations].reverse();
    const p2 = layoutTrack(shuffled, 1200);
    expect(p2[0].s.km).toBe(0);
    for (let i = 1; i < p2.length; i++) expect(p2[i].x).toBeGreaterThanOrEqual(p2[i - 1].x);
  });
});
describe('route strip', () => {
  const stations = loadJourney().stations;
  const r = layoutRoute(stations, 1312, 92);
  it('puts the ridden stations on the line and Aragats above it', () => {
    expect(r.stops.map((p) => p.s.id)).toEqual(['shiraz', 'norduz', 'yerevan', 'dilijan', 'tbilisi']);
    expect(r.summit?.s.id).toBe('aragats');
  });
  it('the summit sits over its twin, never as its own stop', () => {
    const yerevan = r.stops.find((p) => p.s.id === 'yerevan')!;
    expect(r.summit!.x).toBe(yerevan.x);
    expect(r.stops.some((p) => p.s.id === 'aragats')).toBe(false);
  });
  it('stations are evenly spaced, because km spacing misrepresented the ride', () => {
    const gaps = r.stops.slice(1).map((p, i) => p.x - r.stops[i].x);
    gaps.forEach((g) => expect(Math.abs(g - gaps[0])).toBeLessThanOrEqual(1));
  });
  it('every stop sits on the baseline', () => {
    r.stops.forEach((p) => expect(p.y).toBe(92));
  });
  it('bands cover the three ridden countries in order, without gaps', () => {
    expect(r.bands.map((b) => b.country)).toEqual(['Iran', 'Armenia', 'Georgia']);
    r.bands.slice(1).forEach((b, i) => expect(b.x1).toBe(r.bands[i].x2));
    expect(r.bands[0].x1).toBe(r.stops[0].x);
    expect(r.bands[r.bands.length - 1].x2).toBe(r.stops[r.stops.length - 1].x);
  });
  it('a border falls between two stations, never on one', () => {
    const xs = r.stops.map((p) => p.x);
    r.bands.slice(1).forEach((b) => expect(xs).not.toContain(b.x1));
  });
  it('shuffled input is sorted, not trusted', () => {
    const r2 = layoutRoute([...stations].reverse(), 1312, 92);
    expect(r2.stops.map((p) => p.s.id)).toEqual(r.stops.map((p) => p.s.id));
  });
});

describe('format', () => {
  it('pads to width', () => { expect(pad(4000, 6)).toBe('004000'); });
  it('never truncates', () => { expect(pad(1234567, 4)).toBe('1234567'); });
  it('localizes digits and separators for fa', () => {
    expect(localizeDigits('4,000+', 'fa')).toBe('۴٬۰۰۰+');
    expect(localizeDigits('98%', 'en')).toBe('98%');
  });
  it('odometer composes pad + localize', () => {
    expect(odometer(300, 6, 'fa')).toBe('۰۰۰۳۰۰');
    expect(odometer(300, 0, 'en')).toBe('300');
  });
  it('fill interpolates and throws on unknown token', () => {
    expect(fill('{a} x {b}', { a: 1, b: 'y' })).toBe('1 x y');
    expect(() => fill('{nope}', {})).toThrow(/unknown token/);
  });
});
