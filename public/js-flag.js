/* Marks the document as JavaScript-capable before first paint, so global.css
   can hide .reveal elements ONLY when something will reveal them again.

   It is a file and not an inline <script> because the origin serves a
   `script-src 'self'` CSP: an inline script is refused by the browser, and a
   refused flag here means `.js` is never set — which is safe (everything stays
   visible) but silently turns the reveal animation off and logs a violation on
   every page load. Loaded without defer, in <head>, because the class has to be
   on <html> before the stylesheet paints or the content flashes in and out. */
document.documentElement.classList.add('js');
