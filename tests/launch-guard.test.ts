import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasMockData, loadOffer, loadEpisodes } from '../src/lib/content';

/**
 * Mock data is allowed during development and MUST block a production launch.
 * Set LAUNCH=1 (CI does this on the release job) to turn every temp value into
 * a hard failure. Without it, we assert the guard itself is wired correctly.
 */
const LAUNCHING = process.env.LAUNCH === '1';

describe('launch guard', () => {
  it('hasMockData() reflects the data files', () => {
    const expected = loadOffer().contact.mock || loadEpisodes().mock || loadOffer().needs.some((n) => n.mock);
    expect(hasMockData()).toBe(expected);
  });

  it.runIf(LAUNCHING)('LAUNCH=1: no mock data may remain', () => {
    const o = loadOffer();
    const stillMock = [
      o.contact.mock && 'offer.yaml contact',
      loadEpisodes().mock && 'episodes.yaml',
      ...o.needs.filter((n) => n.mock).map((n) => `offer.yaml needs/${n.id} (Q26)`),
    ].filter(Boolean);
    expect(hasMockData(), `still placeholder: ${stillMock.join(', ')}`).toBe(false);
  });

  it.runIf(LAUNCHING)('LAUNCH=1: contact details are real', () => {
    const c = loadOffer().contact;
    expect(c.email).not.toMatch(/example\.com/);
    expect(c.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    expect(c.whatsapp).not.toMatch(/0{3}/);
  });

  it.runIf(LAUNCHING)('LAUNCH=1: metrics have been re-measured', () => {
    const facts = readFileSync('src/data/facts.yaml', 'utf8');
    expect(facts, 'facts.yaml still carries stale: true').toMatch(/^stale:\s*false/m);
  });

  it('dev builds visibly mark themselves when mock data is present', () => {
    if (!hasMockData()) return;
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html, 'mock data present but no dev ribbon in the build').toMatch(/data-mock-ribbon/);
  });
});
