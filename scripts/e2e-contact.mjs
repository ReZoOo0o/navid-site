import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { serveDist } from './serve.mjs';

// Start our own contact endpoint in mock mode so `npm run e2e` is one command
// with no setup. Killed on exit, whatever happens.
const PORT = 8788;
const api = spawn(process.execPath, ['server/serve-contact.mjs'], {
  env: { ...process.env, MOCK: '1', PORT: String(PORT) },
  stdio: 'ignore',
});
process.on('exit', () => api.kill());
process.on('SIGINT', () => { api.kill(); process.exit(1); });
await new Promise((r) => setTimeout(r, 700));

const { srv, url } = await serveDist();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const fails = [];
const check = (name, cond) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fails.push(name); };
try {
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  // point the form at our throwaway endpoint regardless of how dist was built
  await page.evaluate((ep) => document.querySelector('[data-contact-form]').setAttribute('action', ep),
    `http://127.0.0.1:${PORT}/api/contact`);

  // 1. happy path
  await page.fill('#cf-name', 'Ada Lovelace');
  await page.fill('#cf-company', 'Ortlieb');
  await page.fill('#cf-email', 'ada@ortlieb.example');
  await page.fill('#cf-message', 'We would like to send you panniers for the road ahead.');
  await page.click('.cf-submit');
  // wait for a TERMINAL status, not the interim "Sending…"
  await page.waitForFunction("/sent|check|could not|too many/i.test(document.querySelector('[data-cf-status]').textContent)", null, { timeout: 10000 });
  const ok = await page.textContent('[data-cf-status]');
  check(`happy path shows success (got: "${(ok||'').trim()}")`, /sent/i.test(ok || ''));
  check('form cleared after success', (await page.inputValue('#cf-name')) === '');

  // 2. validation path
  await page.fill('#cf-name', 'A');
  await page.fill('#cf-email', 'not-an-email');
  await page.fill('#cf-message', 'short');
  await page.click('.cf-submit');
  await page.waitForFunction("/check/i.test(document.querySelector('[data-cf-status]').textContent)", null, { timeout: 8000 });
  const bad = await page.textContent('[data-cf-status]');
  check(`validation reports offending fields (got: "${(bad||'').trim()}")`, /name/.test(bad || '') && /email/.test(bad || ''));

  // 3. a11y basics on the form
  const labelled = await page.$$eval('form [id^=cf-]:not([tabindex="-1"])', (els) =>
    els.every((el) => !!document.querySelector(`label[for="${el.id}"]`)));
  check('every visible field has a label', labelled);
  const btn = await page.locator('.cf-submit').boundingBox();
  check(`submit target >= 44px tall (${Math.round((btn||{}).height || 0)}px)`, ((btn||{}).height || 0) >= 44);
  const inputBox = await page.locator('#cf-email').boundingBox();
  check(`inputs >= 44px tall (${Math.round((inputBox||{}).height || 0)}px)`, ((inputBox||{}).height || 0) >= 44);

  // 4. keyboard focus visible.
  // Measured BEFORE and AFTER focusing, and compared. It used to read
  // borderColor once, after focus, and assert !!outline — but
  // getComputedStyle always returns a non-empty colour string, so that check
  // was true even with :focus-visible deleted. It could not fail.
  const styleOf = () => page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('#cf-name'));
    return { border: s.borderColor, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
  });
  const before = await styleOf();
  await page.focus('#cf-name');
  const after = await styleOf();
  const ringed = after.outlineWidth !== '0px' && after.outlineWidth !== before.outlineWidth;
  const changed = after.border !== before.border || after.boxShadow !== before.boxShadow;
  check(`focus is visibly indicated (border ${before.border} -> ${after.border}, outline ${before.outlineWidth} -> ${after.outlineWidth})`,
    ringed || changed);

  // 5. WCAG 2.2 target size across the whole page
  const undersized = await page.evaluate(() => [...document.querySelectorAll('a,button,input,textarea')]
    .map((e) => ({ t: (e.textContent || e.id || e.tagName).trim().slice(0, 30), r: e.getBoundingClientRect() }))
    .filter((o) => o.r.width && o.r.height && (o.r.height < 24 || o.r.width < 24))
    .map((o) => `${o.t} ${Math.round(o.r.width)}x${Math.round(o.r.height)}`));
  check(`all targets >= 24px (WCAG 2.2 AA)${undersized.length ? ' — ' + undersized.join(', ') : ''}`, undersized.length === 0);

  // 6. honeypot hidden from humans
  // Measure the WRAPPER, not the input: the input keeps its natural size and is
  // clipped away by the wrapper, which is the part that must not occupy layout.
  const hp = await page.evaluate(() => {
    const el = document.querySelector('#cf-website');
    const wrap = el.closest('div');
    const r = wrap.getBoundingClientRect();
    const cs = getComputedStyle(wrap);
    return { w: r.width, h: r.height, clip: cs.clipPath, hidden: wrap.getAttribute('aria-hidden'), tab: el.tabIndex };
  });
  check('honeypot occupies no layout and is clipped', hp.w <= 1 && hp.h <= 1 && hp.clip !== 'none');
  check('honeypot is hidden from AT and keyboard', hp.hidden === 'true' && hp.tab === -1);

  // 6b. Story photo frames (spec 2026-09-05). The pin is the whole design:
  // scroll inside the first frame and its photograph must still start at the
  // top of the viewport. Then the lightbox: opens on tap, closes on Escape,
  // hands focus back to the link. Then the phone: one full screen of photo.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  // `html { scroll-behavior: smooth }` would leave scrollIntoView mid-flight, so scroll instantly.
  const frameTop = await page.evaluate(async () => {
    const frame = document.querySelector('[data-frame]');
    const y = frame.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y + 400, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 100)));
    return Math.round(frame.querySelector('.frame-fig').getBoundingClientRect().top);
  });
  check(`frame photo stays pinned while its words scroll (top=${frameTop}px)`, frameTop === 0);
  // `pswp--open` and `pswp--ui-visible` are both set when the zoom animation
  // STARTS, but PhotoSwipe's close() does nothing until it ENDS and
  // `opener.isOpen` flips — measured ~380ms later, in headed Chrome as much as
  // headless. An Escape sent before that is swallowed and never retried, which
  // is why a fixed 400ms wait was a coin flip. Wait for the state close() reads.
  const lightboxOpen = () => page.waitForFunction(() => window.pswp?.opener?.isOpen === true, null, { timeout: 10000 }).then(() => true).catch(() => false);
  const lightboxGone = () => page.waitForFunction(() => !document.querySelector('.pswp.pswp--open') && !window.pswp, null, { timeout: 10000 }).then(() => true).catch(() => false);
  await page.click('[data-frame] a.pswp-link');
  const opened = await page.waitForSelector('.pswp.pswp--open', { timeout: 5000 }).then(() => true).catch(() => false);
  check('tapping a frame photo opens the lightbox', opened);
  check('the lightbox finishes opening (PhotoSwipe reports it open)', await lightboxOpen());
  await page.keyboard.press('Escape');
  check('Escape closes the lightbox opened by tap', await lightboxGone());
  // Opened with a pointer, PhotoSwipe deliberately leaves focus on the link, so
  // "focus returns" would be vacuous. Open it the way a keyboard user does:
  // focus moves INTO the dialog, and closing has to hand it back (spec §5).
  await page.$eval('[data-frame] a.pswp-link', (a) => a.focus());
  await page.keyboard.press('Enter');
  const kbdOpen = await lightboxOpen();
  const inDialog = await page.evaluate(() => {
    const el = document.querySelector('.pswp');
    return !!el && el.getAttribute('role') === 'dialog' && el.contains(document.activeElement);
  });
  check('opened from the keyboard, focus moves into the lightbox dialog', kbdOpen && inDialog);
  await page.keyboard.press('Escape');
  const closed = await lightboxGone();
  const focusBack = await page.evaluate(() => document.activeElement?.classList.contains('pswp-link') === true);
  check('Escape closes the lightbox and focus returns to the photo link', closed && focusBack);
  // Scripts blocked: the same tap is a plain link to the full-size image.
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const np = await nojs.newPage();
  await np.goto(`${url}/`, { waitUntil: 'load' });
  const link = await np.$eval('[data-frame] a.pswp-link', (a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target') }));
  const nojsImg = await np.request.get(`${url}${link.href}`).then((r) => r.status()).catch(() => 0);
  check(`without JavaScript the photo is a plain link to the full image (${link.target}, HTTP ${nojsImg})`, link.target === '_blank' && nojsImg === 200 && /\.webp$/.test(link.href));
  await nojs.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  const figH = await page.$eval('[data-frame] .frame-fig', (el) => Math.round(el.getBoundingClientRect().height));
  check(`phone frame photo is one full screen (${figH}px of 844)`, Math.abs(figH - 844) <= 2);

  // 7. No horizontal overflow, either language, desktop or phone.
  // The Persian page once ran 9,999px wide because the honeypot hid itself with
  // `left:-9999px`, which only works in an LTR document. RTL scrolls the other
  // way, so the whole page became a sliver of content on an empty canvas.
  for (const [label, path] of [['EN', '/'], ['FA', '/fa/']]) {
    for (const w of [1280, 390]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(`${url}${path}`, { waitUntil: 'networkidle' });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(`${label} @${w} does not scroll sideways (over by ${over}px)`, over <= 1);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
} finally {
  await browser.close(); srv.close(); api.kill();
}
console.log(fails.length ? `\nFAILED: ${fails.join(', ')}` : '\nALL E2E CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
