/** A stable 0–5 color tone per name, so each person keeps the same avatar color everywhere. */
export function avatarTone(name: string | null | undefined): number {
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}
