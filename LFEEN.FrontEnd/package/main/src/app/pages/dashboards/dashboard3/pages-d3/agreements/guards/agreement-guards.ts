import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { LoginService } from '../../../services/login/login.service';

// Kept free of component/dialog imports: app.routes.ts loads this file eagerly.

/** Blocks the agreements pages without Agreements.View (the server adds View to Edit/Publish holders). */
export const agreementsViewGuard: CanActivateFn = (_route, state) => {
  const allowed = inject(LoginService).permissions().some((p) => p.toLowerCase() === 'agreements.view');
  if (allowed) return true;
  const lang = state.url.split('/')[1] || 'en';
  return inject(Router).parseUrl(`/${lang}/authentication/error`);
};

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  /** Asks the admin whether to drop the unsaved edits. */
  confirmDiscard(): Promise<boolean>;
}

/** Asks before leaving the draft editor with unsaved edits (in-app navigation; tab close uses beforeunload). */
export const unsavedAgreementGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges()) return true;
  // The session ended (401 → login redirect): nothing could be saved anyway.
  if (!inject(LoginService).isLoggedIn()) return true;
  return component.confirmDiscard();
};
