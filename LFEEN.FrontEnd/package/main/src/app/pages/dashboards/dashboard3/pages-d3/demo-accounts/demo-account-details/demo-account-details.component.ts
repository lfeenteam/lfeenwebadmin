import { Component, DestroyRef, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { LoginService } from '../../../services/login/login.service';
import { DemoAccountsService } from '../../../services/demo-accounts.service';
import { PageTitleOverrideService } from '../../../services/page-title-override.service';
import {
  DEMO_CHANNEL_ICONS,
  DEMO_PERMISSIONS,
  DemoAccount,
  DemoAccountCredentials,
  DemoAttachment,
  DemoChannel,
  attachmentSize,
  toLocalPhone
} from '../../../interfaces/demo-account.model';
import {
  DEMO_ACTION_BUTTONS,
  DemoApiError,
  demoActionToast,
  demoErrorMessage,
  demoFileIcon,
  formatFileSize,
  formatRiyadhDate,
  readDemoError,
  saveBlob
} from '../demo-accounts.util';
import {
  DemoAction,
  DemoActionDialogComponent,
  DemoActionDialogData,
  DemoActionDialogResult
} from '../components/demo-action-dialog/demo-action-dialog.component';
import { CredentialsDialogComponent, CredentialsDialogData } from '../components/credentials-dialog/credentials-dialog.component';
import { ActivationRequestPanelComponent } from '../components/activation-request-panel/activation-request-panel.component';
import { InvitationTextComponent } from '../components/invitation-editor/invitation-text.component';
import type { ActivationRequest, InvitationVariable } from '../../../interfaces/demo-account.model';

const EMPTY = '—';

/** Turns a Blob error body (responseType: 'blob') back into JSON so readDemoError can read it. */
async function parseBlobError(err: any): Promise<any> {
  if (err?.error instanceof Blob) {
    try {
      return { ...err, status: err.status, error: JSON.parse(await err.error.text()) };
    } catch {
      return { ...err, status: err.status, error: {} };
    }
  }
  return err;
}

@Component({
  selector: 'app-demo-account-details',
  standalone: true,
  imports: [
    CommonModule, MatTooltipModule, TablerIconsModule, TranslateModule,
    DashboardLoadingComponent, DashboardEmptyComponent, ActivationRequestPanelComponent, InvitationTextComponent,
  ],
  templateUrl: './demo-account-details.component.html',
  styleUrl: './demo-account-details.component.scss'
})
export class DemoAccountDetailsComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);
  private readonly clipboard = inject(Clipboard);
  private readonly service = inject(DemoAccountsService);
  private readonly login = inject(LoginService);
  private readonly pageTitle = inject(PageTitleOverrideService);

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly actions = DEMO_ACTION_BUTTONS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly emptyValue = EMPTY;
  readonly fileIcon = demoFileIcon;
  /** The attachment being downloaded, if any. */
  downloading: string | null = null;

  currentLang = this.translate.currentLang || 'ar';
  id = '';
  account: DemoAccount | null = null;
  loading = false;
  loadError: string | null = null;
  demoDisabled = false;
  /** An action dialog is open or its result is being applied — every action button is off. */
  busy = false;
  copied: 'sid' | 'phone' | null = null;

  private loadRequest?: Subscription;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    // The variables, so the saved texts show chips instead of {{tokens}}. Without them
    // (an error), the texts just show as saved.
    this.service.getInvitationTemplates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: t => (this.variables = t.variables ?? []), error: () => {} });
  }

  /** From GET /invitation-templates — turns saved {{tokens}} into readable chips. */
  variables: InvitationVariable[] = [];

  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
    this.pageTitle.clear();
  }

  get dir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get showActions(): boolean {
    return this.canManage() && !!this.account && this.account.status !== 'Disabled';
  }

  load(): void {
    this.loadRequest?.unsubscribe();
    this.loading = true;
    this.loadError = null;

    this.loadRequest = this.service.get(this.id).subscribe({
      next: account => {
        this.loading = false;
        this.demoDisabled = false;
        this.setAccount(account);
      },
      error: err => {
        this.loading = false;
        const e = readDemoError(err);
        if (this.isNotFound(e)) {
          this.goBackNotFound();
          return;
        }
        this.demoDisabled = e.code === 'DEMO_DISABLED';
        this.loadError = demoErrorMessage(e, this.translate);
      },
    });
  }

  openAction(action: DemoAction): void {
    if (!this.account || this.busy || !this.showActions) return;

    // Resend holds the invitation editor and its preview — it has its own page.
    if (action === 'resend') {
      this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', this.account.id, 'resend']);
      return;
    }
    this.busy = true;

    const ref = this.dialog.open(DemoActionDialogComponent, {
      width: action === 'disable' ? '480px' : '520px',
      maxWidth: '94vw',
      disableClose: true,
      direction: this.dir,
      data: { action, account: this.account } as DemoActionDialogData,
    });

    ref.afterClosed().subscribe((result?: DemoActionDialogResult) => {
      this.busy = false;
      if (!result) return;

      if (result.type === 'error') {
        this.handleActionError(result.error);
        return;
      }

      if (result.type === 'credentials') {
        this.showNewPin(result.credentials);
        return;
      }

      this.setAccount(result.account);
      this.toastAfter(action, result.account);
    });
  }

  copy(key: 'sid' | 'phone'): void {
    if (!this.account) return;
    const value = key === 'sid' ? this.account.loginSid : toLocalPhone(this.account.loginPhone) ?? '';
    if (!value || !this.clipboard.copy(value)) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.copyFailed'));
      return;
    }
    this.copied = key;
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => (this.copied = null), 1800);
    this.toastr.success(this.translate.instant('d3.demoAccounts.copied'));
  }

  /** A follow-up on the request card: keep the account's copy in step. */
  onRequestChanged(request: ActivationRequest): void {
    if (!this.account) return;
    this.account = { ...this.account, activationRequest: request, activationRequestStatus: request.status };
  }

  // ── Email invitation content (§5.4) ───────────────────────

  /** Shown for Email accounts, or when a subject or file is saved. */
  get showInvitationContent(): boolean {
    return !!this.account; // the message and language apply to every channel
  }

  /** The files row: Email accounts, or when files are saved. */
  get showAttachments(): boolean {
    const a = this.account;
    return !!a && (a.channel === 'Email' || a.attachments.length > 0);
  }

  fileSizeOf(f: DemoAttachment): string | null {
    const size = attachmentSize(f);
    return size ? formatFileSize(size) : null;
  }

  // Fetched as a blob so the access token is sent, then saved under its fileName.
  download(f: DemoAttachment): void {
    if (!this.account || this.downloading) return;
    this.downloading = f.id;
    this.service.downloadAttachment(this.account.id, f.id).subscribe({
      next: blob => {
        this.downloading = null;
        saveBlob(blob, f.fileName);
      },
      error: async err => {
        this.downloading = null;
        // A blob request returns its JSON error as a Blob — read it before branching.
        const e = readDemoError(await parseBlobError(err));
        if (e.code === 'DEMO_ATTACHMENT_NOT_FOUND' || e.status === 404) {
          this.toastr.error(this.translate.instant('d3.demoAccounts.errors.DEMO_ATTACHMENT_NOT_FOUND'));
          this.load();
          return;
        }
        this.toastr.error(demoErrorMessage(e, this.translate));
      },
    });
  }

  // ── Display helpers ────────────────────────────────────────

  statusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  statusLabel(status: string): string {
    const key = `d3.demoAccounts.status.${status}`;
    const label = this.translate.instant(key);
    return label === key ? status : label;
  }

  channelLabel(channel: DemoChannel): string {
    const key = `d3.demoAccounts.channels.${channel}`;
    const label = this.translate.instant(key);
    return label === key ? channel : label;
  }

  phone(value: string | null): string | null {
    return toLocalPhone(value);
  }

  date(value: string | null, withTime = true): string | null {
    return formatRiyadhDate(value, this.currentLang, withTime);
  }

  num(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  // ── Internals ──────────────────────────────────────────────

  private setAccount(account: DemoAccount): void {
    this.account = { ...account, deliveries: account.deliveries ?? [], attachments: account.attachments ?? [] };
    this.pageTitle.set(account.fullName);
  }

  // After a new PIN: show it once, then re-read the account (the response has no deliveries or attachments).
  private showNewPin(credentials: DemoAccountCredentials): void {
    const account = credentials.account;
    this.setAccount({
      ...account,
      deliveries: this.account?.deliveries ?? [],
      attachments: this.account?.attachments ?? [],
    });

    const recipient = account.channel === 'Email' ? account.email : toLocalPhone(account.contactPhone);
    const ref = this.dialog.open(CredentialsDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      disableClose: true,
      direction: this.dir,
      data: { credentials, mode: 'resetPin', recipient } as CredentialsDialogData,
    });
    ref.afterClosed().subscribe(() => this.load());
  }

  private toastAfter(action: DemoAction, account: DemoAccount): void {
    const toast = demoActionToast(action, account, this.translate, this.currentLang);
    if (toast) toast.ok ? this.toastr.success(toast.message) : this.toastr.error(toast.message);
  }

  private handleActionError(e: DemoApiError): void {
    if (this.isNotFound(e)) {
      this.goBackNotFound();
      return;
    }
    // DEMO_ACCOUNT_DISABLED: another admin may have stopped it — show it as it is now.
    this.toastr.error(demoErrorMessage(e, this.translate));
    this.load();
  }

  private isNotFound(e: DemoApiError): boolean {
    return e.code === 'DEMO_ACCOUNT_NOT_FOUND' || (!e.code && e.status === 404);
  }

  private goBackNotFound(): void {
    this.toastr.error(this.translate.instant('d3.demoAccounts.errors.DEMO_ACCOUNT_NOT_FOUND'));
    this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts']);
  }
}
