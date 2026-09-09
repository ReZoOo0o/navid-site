const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const pad = (n: number, width: number): string => String(n).padStart(width, '0');
/** Digits (and thousands separators) in the locale's numeral system. */
export function localizeDigits(s: string, locale: 'en' | 'fa'): string {
  if (locale !== 'fa') return s;
  return s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]).replace(/,/g, '٬');
}
/** Odometer-style zero-padded figure, numerals localized. width 0 = no padding. */
export function odometer(n: number, width: number, locale: 'en' | 'fa'): string {
  return localizeDigits(width > 0 ? pad(n, width) : String(n), locale);
}
/** Interpolate {tokens} in a template from a value map. Throws on unknown token. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`fill(): unknown token {${k}} in "${template}"`);
    return String(vars[k]);
  });
}
/**
 * The one place the start date becomes prose. facts.yaml holds the only copy
 * as an ISO string; anything that wants to say the date out loud asks here, so
 * a correction to facts.yaml reaches every sentence that mentions it.
 */
export function startDateText(startDate: string, locale: 'en' | 'fa'): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const faMonths = ['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  return locale === 'fa'
    ? `${localizeDigits(String(d), 'fa')} ${faMonths[m - 1]} ${localizeDigits(String(y), 'fa')}`
    : `${d} ${enMonths[m - 1]} ${y}`;
}
