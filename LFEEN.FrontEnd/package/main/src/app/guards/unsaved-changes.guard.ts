import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { LoginService } from '../pages/dashboards/dashboard3/services/login/login.service';

// Kept free of component/dialog imports: app.routes.ts loads this file eagerly.

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  /** Asks the admin whether to drop the unsaved edits. */
  confirmDiscard(): Promise<boolean>;
}

/** Asks before leaving a page with unsaved edits (in-app navigation; tab close uses beforeunload). */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges()) return true;
  // The session ended (401 → login redirect): nothing could be saved anyway.
  if (!inject(LoginService).isLoggedIn()) return true;
  return component.confirmDiscard();
};
