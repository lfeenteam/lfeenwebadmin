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
  DemoChannel,
  toLocalPhone
} from '../../../interfaces/demo-account.model';
import { DemoApiError, demoErrorMessage, formatRiyadhDate, readDemoError } from '../demo-accounts.util';
import {
  DemoAction,
  DemoActionDialogComponent,
  DemoActionDialogData,
  DemoActionDialogResult
} from '../components/demo-action-dialog/demo-action-dialog.component';
import { CredentialsDialogComponent, CredentialsDialogData } from '../components/credentials-dialog/credentials-dialog.component';

const EMPTY = '—';

interface ActionButton {
  action: DemoAction;
  icon: string;
  labelKey: string;
}

// Header order (§5.3); Disable is rendered apart as the danger button.
const ACTIONS: ActionButton[] = [
  { action: 'resend', icon: 'send', labelKey: 'd3.demoAccounts.actions.resend' },
  { action: 'resetPin', icon: 'key', labelKey: 'd3.demoAccounts.actions.resetPin' },
  { action: 'extend', icon: 'calendar-plus', labelKey: 'd3.demoAccounts.actions.extend' },
  { action: 'unlock', icon: 'lock-open', labelKey: 'd3.demoAccounts.actions.unlock' },
];

@Component({
  selector: 'app-demo-account-details',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, TablerIconsModule, TranslateModule, DashboardLoadingComponent, DashboardEmptyComponent],
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

  readonly actions = ACTIONS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly emptyValue = EMPTY;

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
  }

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
    this.account = { ...account, deliveries: account.deliveries ?? [] };
    this.pageTitle.set(account.fullName);
  }

  // After a new PIN: show it once, then re-read the account (the response has no deliveries).
  private showNewPin(credentials: DemoAccountCredentials): void {
    const account = credentials.account;
    this.setAccount({ ...account, deliveries: this.account?.deliveries ?? [] });

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
    const t = (key: string, params?: object) => this.translate.instant(`d3.demoAccounts.toasts.${key}`, params);
    switch (action) {
      case 'resend': {
        // 200 even when delivery failed — the real result is the newest attempt.
        const last = account.deliveries?.[0];
        if (last?.succeeded === true) {
          this.toastr.success(t('resent'));
        } else {
          this.toastr.error(`${t('resendFailed')}${last?.error ? `: ${last.error}` : ''}`);
        }
        break;
      }
      case 'extend':
        this.toastr.success(t('extended', { date: formatRiyadhDate(account.expiresAt, this.currentLang) ?? '' }));
        break;
      case 'unlock':
        this.toastr.success(t('unlocked'));
        break;
      case 'disable':
        this.toastr.success(t('disabled'));
        break;
    }
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
