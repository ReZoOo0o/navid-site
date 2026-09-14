/**
 * Portable contact handler for the Navid media kit.
 *
 * ONE function, THREE deploy targets — chosen because Cloudflare's dashboard has
 * historically been unreachable for Iranian users, so we must not depend on it:
 *   1. Node/VPS      — `node server/serve-contact.mjs` behind nginx (Reza owns VPSes)
 *   2. Cloudflare Worker — `export default { fetch: handleContact }`
 *   3. Local mock    — MOCK=1, logs and succeeds, no account needed
 *
 * Delivery is pluggable so no single provider is load-bearing.
 */

const LIMIT_WINDOW_MS = 60_000;
const LIMIT_MAX = 3;
const hits = new Map();

export function rateLimit(ip, now = Date.now()) {
  const rec = hits.get(ip);
  if (!rec || now - rec.start > LIMIT_WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    return { ok: true, remaining: LIMIT_MAX - 1 };
  }
  rec.n += 1;
  return { ok: rec.n <= LIMIT_MAX, remaining: Math.max(0, LIMIT_MAX - rec.n) };
}

export function validate(body) {
  const errors = [];
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const message = String(body.message ?? '').trim();
  const company = String(body.company ?? '').trim();
  const website = String(body.website ?? '').trim(); // honeypot — humans never fill this

  if (website) return { ok: false, errors: ['spam'], spam: true };
  if (name.length < 2) errors.push('name');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) errors.push('email');
  if (message.length < 10) errors.push('message');
  if (message.length > 4000) errors.push('message_too_long');
  return { ok: errors.length === 0, errors, data: { name, email, message, company } };
}

export function renderEmail({ name, email, message, company }) {
  return {
    subject: `Sponsorship enquiry — ${company || name}`,
    text: [
      `From:    ${name}`,
      `Email:   ${email}`,
      company ? `Company: ${company}` : null,
      '',
      message,
      '',
      '— sent from the media kit contact form',
    ].filter(Boolean).join('\n'),
  };
}

/** Pluggable delivery. Add a provider here; nothing else changes. */
export async function deliver(mail, env) {
  if (env.MOCK === '1' || !env.RESEND_API_KEY) {
    console.log('[contact:mock]', mail.subject, '\n', mail.text);
    return { delivered: false, mocked: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM, to: [env.MAIL_TO], reply_to: mail.replyTo, subject: mail.subject, text: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`delivery failed: ${res.status}`);
  return { delivered: true, mocked: false };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export async function handleContact(request, env = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type' } });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(ip).ok) return json({ error: 'rate_limited', message: 'Too many messages. Try again in a minute.' }, 429);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const v = validate(body);
  if (v.spam) return json({ ok: true });            // silently accept, never deliver
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 422);

  try {
    const mail = { ...renderEmail(v.data), replyTo: v.data.email };
    const out = await deliver(mail, env);
    return json({ ok: true, ...out });
  } catch (err) {
    console.error('[contact:error]', err);
    return json({ error: 'delivery_failed', message: 'Could not send. Please email directly.' }, 502);
  }
}

export default { fetch: handleContact };   // Cloudflare Worker entrypoint
