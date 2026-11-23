// Helpers for sending a signed-out admin back to the page they asked for after login.

const AUTH_PAGES = ['/d3/login', '/d3/forgot-password', '/d3/reset-password'];

/** Returns the URL if it is a safe in-app path to return to, otherwise null. */
export function safeReturnUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return null;
  }
  const path = url.split(/[?#]/)[0];
  if (AUTH_PAGES.some(page => path.endsWith(page) || path.includes(page + '/'))) {
    return null;
  }
  return url;
}

/** Swaps the language prefix (/ar or /en) so a language change on the login page is kept. */
export function withLang(url: string, lang: string): string {
  return url.replace(/^\/(ar|en)(?=\/|$|\?)/, `/${lang}`);
}
