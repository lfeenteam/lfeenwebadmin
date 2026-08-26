export function resolveBilingualText(
  lang: string,
  ar?: string | null,
  en?: string | null,
  flat?: string | null
): string {
  return (lang === 'ar' ? ar : en) ?? flat ?? ar ?? en ?? '';
}
