/**
 * Avatar initials for the signed-in admin — the backend sends no user image.
 * First letter of the first two words ("Hassan Maghfouri" → "HM", "حسن مغفوري" → "حم").
 */
export function userInitials(fullName: string | null | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}
