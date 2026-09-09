import { describe, it, expect, vi } from 'vitest';
import { validate, renderEmail, rateLimit, handleContact } from '../server/contact-handler.mjs';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const good = { name: 'Ada Lovelace', email: 'ada@ortlieb.example', message: 'We would like to send you panniers for the next stretch.' };

describe('contact validation', () => {
  it('accepts a well-formed enquiry', () => {
    expect(validate(good).ok).toBe(true);
  });
  it('rejects short name, bad email, short message', () => {
    expect(validate({ ...good, name: 'A' }).errors).toContain('name');
    expect(validate({ ...good, email: 'nope' }).errors).toContain('email');
    expect(validate({ ...good, message: 'hi' }).errors).toContain('message');
  });
  it('caps message length', () => {
    expect(validate({ ...good, message: 'x'.repeat(4001) }).errors).toContain('message_too_long');
  });
  it('honeypot marks spam without erroring', () => {
    const v = validate({ ...good, website: 'http://spam' });
    expect(v.spam).toBe(true);
  });
});

describe('email rendering', () => {
  it('subject prefers company, body carries everything', () => {
    const m = renderEmail({ ...good, company: 'Ortlieb' });
    expect(m.subject).toBe('Sponsorship enquiry — Ortlieb');
    expect(m.text).toContain('ada@ortlieb.example');
    expect(m.text).toContain('panniers');
  });
});

describe('rate limiting', () => {
  it('allows 3 per minute then blocks', () => {
    const ip = `t-${Math.random()}`;
    const t = 1_000_000;
    expect(rateLimit(ip, t).ok).toBe(true);
    expect(rateLimit(ip, t + 1).ok).toBe(true);
    expect(rateLimit(ip, t + 2).ok).toBe(true);
    expect(rateLimit(ip, t + 3).ok).toBe(false);
  });
  it('resets after the window', () => {
    const ip = `t-${Math.random()}`;
    rateLimit(ip, 0); rateLimit(ip, 1); rateLimit(ip, 2); 
    expect(rateLimit(ip, 3).ok).toBe(false);
    expect(rateLimit(ip, 70_000).ok).toBe(true);
  });
});

describe('handler end to end (mock delivery)', () => {
  const env = { MOCK: '1' };
  it('200s a good submission and reports it was mocked', async () => {
    const res = await handleContact(post(good, { 'x-forwarded-for': `ip-${Math.random()}` }), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, mocked: true });
  });
  it('422s an invalid submission with the offending fields', async () => {
    const res = await handleContact(post({ ...good, email: 'x' }, { 'x-forwarded-for': `ip-${Math.random()}` }), env);
    expect(res.status).toBe(422);
    expect((await res.json()).fields).toContain('email');
  });
  it('405s a GET', async () => {
    const res = await handleContact(new Request('http://x/api/contact'), env);
    expect(res.status).toBe(405);
  });
  it('accepts a spam submission silently and never delivers', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await handleContact(post({ ...good, website: 'x' }, { 'x-forwarded-for': `ip-${Math.random()}` }), env);
    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalledWith('[contact:mock]', expect.anything(), expect.anything(), expect.anything());
    spy.mockRestore();
  });
  it('429s after the limit for one ip', async () => {
    const ip = `burst-${Math.random()}`;
    for (let i = 0; i < 3; i++) await handleContact(post(good, { 'x-forwarded-for': ip }), env);
    const res = await handleContact(post(good, { 'x-forwarded-for': ip }), env);
    expect(res.status).toBe(429);
  });
});
