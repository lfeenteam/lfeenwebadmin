import { TranslateService } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import type { DemoAccountStatus } from '../../../interfaces/demo-account.model';
import { DemoSignupLink, DemoSignupLinkState } from '../../../interfaces/demo-signup-link.model';
import { DemoApiError, demoErrorMessage } from '../demo-accounts.util';

/**
 * The sign-up endpoints answer with a fixed errorCode and a sentence that is always English
 * (whatever Accept-Language says), so the page translates the code itself
 * (signupLinks.errors.<code>) and shows the server's sentence only for a code it doesn't know.
 * Codes the demo-accounts screens already translate (text, duration…) and transport errors
 * keep their own text.
 */
export function signupErrorMessage(e: DemoApiError, translate: TranslateService): string {
  // Any invalid value is a plain 400 VALIDATION_ERROR whose message may be English — never show it.
  if (e.code === 'VALIDATION_ERROR') return translate.instant('d3.demoAccounts.signupLinks.errors.validation');
  if (e.code?.startsWith('DEMO_SIGNUP_')) {
    const key = `d3.demoAccounts.signupLinks.errors.${e.code}`;
    const own = translate.instant(key);
    if (own !== key) return own;
    if (e.message) return e.message;
  }
  if (e.status === 429) return translate.instant('d3.demoAccounts.signupLinks.errors.rateLimited');
  return demoErrorMessage(e, translate);
}

/**
 * The link to share. The server leaves url null when Demo:SelfSignup:PageUrl is not set —
 * then it is built from this build's client page + "/" + code. null when that is unknown too.
 */
export function signupLinkUrl(link: Pick<DemoSignupLink, 'url' | 'code'>): string | null {
  if (link.url) return link.url;
  const base = environment.demoSignupPageUrl;
  return base && link.code ? `${base.replace(/\/+$/, '')}/${link.code}` : null;
}

/** Badge colour: always from the state, never from the label text. */
export function signupStateClass(state: DemoSignupLinkState | string): string {
  return `ls-${String(state).toLowerCase()}`;
}

/** The server's label in the page language, else our own. */
export function signupStateLabel(link: Pick<DemoSignupLink, 'state' | 'stateLabelAr' | 'stateLabelEn'>, translate: TranslateService): string {
  const server = translate.currentLang === 'en' ? link.stateLabelEn : link.stateLabelAr;
  if (server) return server;
  const key = `d3.demoAccounts.signupLinks.states.${link.state}`;
  const label = translate.instant(key);
  return label === key ? link.state : label;
}

/** The demo account behind an opened link: active / trial ended / stopped. */
export function accountStatusKey(status: DemoAccountStatus | null | undefined): 'Active' | 'Expired' | 'Disabled' | null {
  if (!status) return null;
  if (status === 'Disabled') return 'Disabled';
  if (status === 'Expired') return 'Expired';
  return 'Active';
}

export type CountNoun = 'link' | 'account';

/**
 * "3 روابط" — Arabic counted nouns as the guide asks: 1 «رابط واحد», 2 «رابطين», 3–10 «روابط»,
 * 11+ «رابطًا» (and the same for حساب). English: "1 link" / "3 links".
 */
export function countText(n: number, noun: CountNoun, translate: TranslateService): string {
  const lang = translate.currentLang === 'en' ? 'en' : 'ar';
  const base = `d3.demoAccounts.signupLinks.count.${noun}`;
  const num = formatLocalizedNumber(n, lang);
  if (lang === 'en') return translate.instant(`${base}.${n === 1 ? 'one' : 'other'}`, { count: num });
  const mod100 = n % 100;
  const form = n === 1 ? 'one' : n === 2 ? 'two' : mod100 >= 3 && mod100 <= 10 ? 'few' : 'many';
  return translate.instant(`${base}.${form}`, { count: num });
}

/** "https://lfeen.com/demo-signup/Ab3dE…" → "lfeen.com/demo-signup/Ab3dE…" for narrow cells. */
export function shortLink(url: string | null, code: string): string {
  if (!url) return code;
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/^www\./, '');
  } catch {
    return url;
  }
}
