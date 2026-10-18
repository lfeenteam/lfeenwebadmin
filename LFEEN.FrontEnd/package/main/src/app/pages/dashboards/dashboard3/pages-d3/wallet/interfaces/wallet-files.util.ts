import { WALLET_ALLOWED_EXTENSIONS, WALLET_MAX_FILE_BYTES } from './wallet.model';

export type WalletFileRejection = 'type' | 'size' | 'count';

/**
 * The backend validates too, but rejects the whole request — checking here keeps the
 * admin's form (and already-picked files) intact instead of failing on submit.
 * `slots` = how many more files the entry can still take.
 */
export function pickAcceptedFiles(
  incoming: File[],
  slots: number,
): { accepted: File[]; rejection: WalletFileRejection | null } {
  const accepted: File[] = [];
  let rejection: WalletFileRejection | null = null;

  for (const file of incoming) {
    const name = file.name.toLowerCase();
    if (!WALLET_ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext))) { rejection = 'type'; continue; }
    if (file.size > WALLET_MAX_FILE_BYTES) { rejection = 'size'; continue; }
    if (accepted.length >= slots) { rejection = 'count'; continue; }
    accepted.push(file);
  }
  return { accepted, rejection };
}

export const WALLET_ATTACHMENT_ACCEPT = WALLET_ALLOWED_EXTENSIONS.join(',');
