import type { Station } from './content';

export interface TrackPoint { x: number; tickTall: boolean; anchor: 'start' | 'middle' | 'end'; s: Station }
export interface ProfilePoint { x: number; y: number; anchor: 'start' | 'middle' | 'end'; above: boolean; s: Station }
export interface Profile { route: ProfilePoint[]; summit: ProfilePoint | null }
export interface RouteStop { x: number; y: number; anchor: 'start' | 'middle' | 'end'; s: Station }
export interface CountryBand { country: string; startIdx: number; endIdx: number; x1: number; x2: number }
export interface RouteLayout { stops: RouteStop[]; bands: CountryBand[]; summit: { x: number; s: Station } | null }

const PAD = 95;

export function layoutTrack(stations: Station[], width: number): TrackPoint[] {
  stations = [...stations].sort((a, b) => a.km - b.km);
  const maxKm = Math.max(...stations.map((s) => s.km)) || 1;
  const span = width - PAD * 2;
  const seen = new Set<number>();
  return stations.map((s, i) => {
    let x = Math.round(PAD + (s.km / maxKm) * span);
    while (seen.has(x)) x += 1;
    seen.add(x);
    const nearStart = x < PAD + 40;
    const nearEnd = x > width - PAD - 40;
    return { x, tickTall: i % 2 === 0, anchor: nearStart ? 'start' : nearEnd ? 'end' : 'middle', s };
  });
}

/**
 * Route strip.
 *
 * This replaced an elevation profile that was, in the end, a lie: the x-axis
 * was not distance (stations are evenly spaced) and the y-axis was "not to
 * scale" (said so in its own caption). A curve that encodes neither axis still
 * invites the eye to read data off it, and then has none to give.
 *
 * So: one straight line, stations evenly spaced along it, and the countries
 * banded underneath — which is the fact a sponsor actually wants and the old
 * chart never showed. Elevation survives as a number in each label, where it
 * is precise, instead of as a shape that was only decorative.
 *
 * A station sharing another's km but towering over it (Aragats) is a side-trip
 * SUMMIT: drawn above the line at its twin's position, never on it.
 */
export function layoutRoute(stations: Station[], width: number, baselineY: number): RouteLayout {
  // Group by km, then decide by ELEVATION which of a pair is the road and which
  // is the summit. Deciding by input order instead meant that reversing
  // journey.yaml put Aragats on the route and dropped Yerevan entirely.
  const byKm = new Map<number, Station[]>();
  for (const st of stations) byKm.set(st.km, [...(byKm.get(st.km) ?? []), st]);
  const route: Station[] = [];
  let summitSt: Station | null = null;
  let summitTwinIdx = -1;
  for (const km of [...byKm.keys()].sort((a, b) => a - b)) {
    const group = [...byKm.get(km)!].sort((a, b) => (a.elevationM ?? 0) - (b.elevationM ?? 0));
    route.push(group[0]);                       // the road is the lower one
    if (group.length > 1) {                     // anything towering over it is a side trip
      summitSt = group[group.length - 1];
      summitTwinIdx = route.length - 1;
    }
  }
  const span = width - PAD * 2;
  const xAt = (i: number) => Math.round(PAD + (route.length > 1 ? (i / (route.length - 1)) * span : span / 2));
  const stops: RouteStop[] = route.map((s, i) => ({
    x: xAt(i), y: baselineY, s,
    anchor: i === 0 ? 'start' : i === route.length - 1 ? 'end' : 'middle',
  }));

  // Country bands. A border is crossed between two stations, so the boundary
  // sits at the midpoint between them — not on either station.
  const bands: CountryBand[] = [];
  for (let i = 0; i < route.length; i++) {
    const prev = bands[bands.length - 1];
    if (prev && prev.country === route[i].country) { prev.endIdx = i; continue; }
    bands.push({ country: route[i].country, startIdx: i, endIdx: i, x1: 0, x2: 0 });
  }
  bands.forEach((b, i) => {
    b.x1 = i === 0 ? PAD : Math.round((xAt(bands[i - 1].endIdx) + xAt(b.startIdx)) / 2);
    b.x2 = i === bands.length - 1 ? PAD + span : Math.round((xAt(b.endIdx) + xAt(bands[i + 1].startIdx)) / 2);
  });

  return {
    stops, bands,
    summit: summitSt ? { x: stops[summitTwinIdx].x, s: summitSt } : null,
  };
}

/** C1-smooth cubic through the points (mirrored tangents, no kinks). */
export function profilePath(pts: ProfilePoint[]): string {
  if (pts.length < 2) return '';
  const t = 0.38; // tangent tightness
  const tangent = (i: number) => {
    const p0 = pts[Math.max(0, i - 1)], p2 = pts[Math.min(pts.length - 1, i + 1)];
    return { x: (p2.x - p0.x) * t, y: (p2.y - p0.y) * t };
  };
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ta = tangent(i), tb = tangent(i + 1);
    d += ` C ${Math.round(a.x + ta.x / 2)} ${Math.round(a.y + ta.y / 2)} ${Math.round(b.x - tb.x / 2)} ${Math.round(b.y - tb.y / 2)} ${b.x} ${b.y}`;
  }
  return d;
}
