import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn } from '@angular/router';
import { LoginService } from '../../../services/login/login.service';
import { forbiddenRedirect } from '../../../../../../guards/page-access.guard';
import { HasUnsavedChanges, unsavedChangesGuard } from '../../../../../../guards/unsaved-changes.guard';

// Kept free of component/dialog imports: app.routes.ts loads this file eagerly.

/**
 * Blocks the agreements pages without Agreements.View (the server adds View to Edit/Publish
 * holders) — to the "no permission" page (BUG-2496).
 */
export const agreementsViewGuard: CanActivateFn = (_route, state) => {
  const allowed = inject(LoginService).permissions().some((p) => p.toLowerCase() === 'agreements.view');
  if (allowed) return true;
  return forbiddenRedirect(state);
};

export type { HasUnsavedChanges } from '../../../../../../guards/unsaved-changes.guard';

/** Asks before leaving the draft editor with unsaved edits (in-app navigation; tab close uses beforeunload). */
export const unsavedAgreementGuard: CanDeactivateFn<HasUnsavedChanges> = unsavedChangesGuard;
