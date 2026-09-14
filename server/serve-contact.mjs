/**
 * Standalone Node server for the contact endpoint — for Reza's own VPS.
 * Run:  MOCK=1 node server/serve-contact.mjs        (local, no account)
 *       MAIL_TO=… RESEND_API_KEY=… node server/serve-contact.mjs   (live)
 * Put nginx in front (see deploy/nginx.conf) and proxy /api/contact here.
 */
import { createServer } from 'node:http';
import { handleContact } from './contact-handler.mjs';

const PORT = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  if (!req.url?.startsWith('/api/contact')) { res.writeHead(404).end('not found'); return; }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
  const out = await handleContact(request, process.env);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(await out.text());
}).listen(PORT, () => console.log(`contact endpoint on :${PORT} (MOCK=${process.env.MOCK ?? '0'})`));
