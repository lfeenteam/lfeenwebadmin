import { TranslateService } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';
import { DemoChannelState, DemoSignupLink, DemoSignupLinkState } from '../../../interfaces/demo-signup-link.model';
import { DemoApiError, demoErrorMessage } from '../demo-accounts.util';

/**
 * The sign-up endpoints answer with a fixed errorCode and a friendly sentence already in the
 * page's language (Accept-Language) — show that sentence. Codes the demo-accounts screens
 * already translate (attachments, text, duration…) and transport errors keep their own text.
 */
export function signupErrorMessage(e: DemoApiError, translate: TranslateService): string {
  const own = e.code?.startsWith('DEMO_SIGNUP_') || e.code === 'DEMO_CHANNEL_TEST_FAILED';
  if (own && e.message) return e.message;
  if (e.status === 429) return translate.instant('d3.demoAccounts.signupLinks.errors.rateLimited');
  return demoErrorMessage(e, translate);
}

/**
 * The link to share. The server leaves url null when Demo:SelfSignup:PageUrl is not set —
 * then it is built from the client page + "/" + code. null when we can't build it either.
 */
export function signupLinkUrl(link: Pick<DemoSignupLink, 'url' | 'code'>): string | null {
  if (link.url) return link.url;
  const base = (environment as { demoSignupPageUrl?: string | null }).demoSignupPageUrl;
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

/** The server's reason sentence for a channel that is not ready. */
export function channelMessage(state: DemoChannelState | null | undefined, lang: string): string | null {
  if (!state || state.ready) return null;
  return (lang === 'en' ? state.messageEn : state.messageAr) || state.messageAr || state.messageEn || state.reason || null;
}

/** "https://lfeen.com.sa/demo-signup/Ab3dE…" → "…/demo-signup/Ab3dE…" for narrow cells. */
export function shortLink(url: string | null, code: string): string {
  if (!url) return code;
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/^www\./, '');
  } catch {
    return url;
  }
}
