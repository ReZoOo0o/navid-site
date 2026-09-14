import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
type Dict = Record<string, string>;
function flatten(obj: unknown, prefix = ''): Dict {
  if (typeof obj === 'string') return { [prefix]: obj };
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).reduce<Dict>((acc, [k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;
      return { ...acc, ...flatten(v, key) };
    }, {});
  }
  throw new Error(`i18n leaf at "${prefix}" must be a string`);
}
const cache: Partial<Record<'en' | 'fa', Dict>> = {};
export function t(locale: 'en' | 'fa'): Dict {
  if (!cache[locale]) {
    const raw = load(readFileSync(resolve(process.cwd(), 'src/i18n', `${locale}.yaml`), 'utf8'));
    const dict = flatten(raw);
    // A missing key is a BUILD ERROR, never a silent blank (spec §9).
    cache[locale] = new Proxy(dict, {
      get(o, k: string | symbol) {
        if (typeof k !== 'string' || k in o) return (o as Record<string | symbol, unknown>)[k as string] as string;
        throw new Error(`missing i18n key "${String(k)}" for locale "${locale}"`);
      },
    });
  }
  return cache[locale]!;
}
export const keys = (locale: 'en' | 'fa') => Object.keys(t(locale));
