import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const dist = 'dist';
function allText(): string {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  return walk(dist).filter(f => f.endsWith('.html') || f.endsWith('.css'))
    .map(f => readFileSync(f, 'utf8')).join('\n');
}
describe('fonts are self-hosted', () => {
  it('dist exists (run npm run build first)', () => { expect(existsSync('dist/index.html')).toBe(true); });
  it('no Google Fonts hosts anywhere in dist', () => {
    const t = allText();
    expect(t).not.toMatch(/fonts\.googleapis\.com/);
    expect(t).not.toMatch(/fonts\.gstatic\.com/);
  });
  it('woff2 files shipped locally', () => {
    expect(allText()).toMatch(/\.woff2/);
  });
});

describe('English display font resolution', () => {
  it('the guard bites (positive control)', () => {
    // The same shape as the check below, run against a stack that is wrong on
    // purpose — otherwise a typo'd matcher would pass this file forever.
    const bad = "font-family: 'Cormorant Garamond', Georgia, serif";
    expect(/cormorant/i.test(bad)).toBe(true);
    expect(bad).not.toMatch(/Cormorant Garamond Variable/);
  });
  it('every Cormorant stack names the family that is actually loaded', () => {
    // Cloned from the Vazirmatn guard above, and for the same reason:
    // @fontsource registers 'Cormorant Garamond Variable'. A stack that says
    // only 'Cormorant Garamond' falls through to Georgia — a different serif,
    // at a different width, on every English heading. It would still LOOK like
    // a serif, so no screenshot review would catch it.
    const css = readFileSync('src/styles/global.css', 'utf8');
    const built = readdirSync('dist', { recursive: true })
      .filter((f) => typeof f === 'string' && /\.(html|css)$/.test(f))
      .map((f) => readFileSync(`dist/${f}`, 'utf8')).join('\n');
    let seen = 0;
    for (const src of [css, built]) {
      for (const stack of src.match(/font-family:[^;}"']+/g) ?? []) {
        if (/cormorant/i.test(stack)) {
          seen++;
          expect(stack, `stack omits the loaded family: ${stack}`).toMatch(/Cormorant Garamond Variable/);
        }
      }
    }
    // The corpus must not be empty, or this guard passes by finding nothing.
    expect(seen, 'no Cormorant stack found in source or dist').toBeGreaterThan(0);
  });
});
describe('Persian font resolution', () => {
  it("every Vazirmatn stack names the family that is actually loaded", () => {
    // @fontsource registers 'Vazirmatn Variable'. A stack that says only
    // `Vazirmatn` silently falls through to monospace, which renders Persian
    // with broken cursive joins — invisible in tests, obvious to a reader.
    const css = readFileSync('src/styles/global.css', 'utf8');
    const built = readdirSync('dist', { recursive: true })
      .filter((f) => typeof f === 'string' && /\.(html|css)$/.test(f))
      .map((f) => readFileSync(`dist/${f}`, 'utf8')).join('\n');
    for (const src of [css, built]) {
      for (const stack of src.match(/font-family:[^;}"']+/g) ?? []) {
        if (/vazirmatn/i.test(stack)) {
          expect(stack, `stack omits the loaded family: ${stack}`).toMatch(/Vazirmatn Variable/);
        }
      }
    }
  });
});
