import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { ReviewConfirmDialogComponent } from '../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { AccountProfileChangesService } from '../../../services/account-profile-changes.service';
import { LoginService } from '../../../services/login/login.service';
import {
  AccountProfile,
  BrandingValues,
  CertificateVersion,
  CommercialRegisterValues,
  PROFILE_REJECTION_REASON_MAX,
  ProfileDecision,
  ProfileSection,
  ProfileSectionView,
  toProfileSectionRoute
} from '../../../interfaces/account-profile-change.model';

type AnySectionView = ProfileSectionView<BrandingValues> | ProfileSectionView<CommercialRegisterValues>;

// One account's pending settings changes: each section shows current vs requested
// and is approved / rejected on its own with the section's changeId (guide sections 5–7).
@Component({
  selector: 'app-profile-change-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TablerIconsModule],
  templateUrl: './profile-change-review.component.html',
  styleUrl: './profile-change-review.component.scss'
})
export class ProfileChangeReviewComponent implements OnInit {
  private service = inject(AccountProfileChangesService);
  private login = inject(LoginService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  readonly reasonMax = PROFILE_REJECTION_REASON_MAX;
  readonly canReview = computed(() => this.login.permissions().some(p => p.toLowerCase() === 'accounts.review'));

  accountId = '';
  profile: AccountProfile | null = null;
  isLoading = false;
  isError = false;

  rejecting: ProfileSection | null = null;
  // Keyed by ProfileSection; string-keyed so the template context (untyped) can index it.
  reasons: Record<string, string> = { Branding: '', CommercialRegister: '' };
  submitting: ProfileSection | null = null;
  downloading: CertificateVersion | null = null;

  get dir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.accountId = params.get('accountId') ?? '';
        this.load();
      });

    // legalName comes back localized per Accept-Language.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  load(): void {
    if (!this.accountId) return;
    this.isLoading = true;
    this.isError = false;
    this.service.getProfile(this.accountId).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.isError = true;
        this.toastr.error(this.translate.instant(
          err?.status === 404 ? 'd3.profileChanges.errors.accountNotFound' : 'd3.toast.errorOp'
        ));
      }
    });
  }

  businessTypeLabel(type: string | null | undefined): string {
    if (!type) return '—';
    const key = `d3.profileChanges.businessTypes.${type}`;
    const label = this.translate.instant(key);
    return label === key ? type : label;
  }

  isPending(view: AnySectionView | null | undefined): boolean {
    return view?.status === 'PendingReview';
  }

  canDecide(view: AnySectionView | null | undefined): boolean {
    return this.canReview() && this.isPending(view) && !!view?.changeId;
  }

  // Requested values are shown next to the current ones while pending, and after a
  // rejection (so the admin sees what was turned down).
  showRequested(view: AnySectionView | null | undefined): boolean {
    return !!view?.requested && (view.status === 'PendingReview' || view.status === 'Rejected');
  }

  // Empty and null both mean "no value" — clearing a name counts as a change.
  differs(a: unknown, b: unknown): boolean {
    const norm = (v: unknown) => (v === '' || v === undefined ? null : v);
    return norm(a) !== norm(b);
  }

  statusClass(view: AnySectionView): string {
    switch (view.status) {
      case 'PendingReview': return 'pending';
      case 'Approved':      return 'approved';
      case 'Rejected':      return 'rejected';
      default:              return 'none';
    }
  }

  startReject(section: ProfileSection): void {
    this.rejecting = section;
  }

  cancelReject(): void {
    this.rejecting = null;
  }

  approve(section: ProfileSection): void {
    const view = this.viewOf(section);
    if (!this.canDecide(view) || this.submitting) return;
    this.confirm('approve', () => this.submit(section, view!.changeId!, 'Approved'));
  }

  reject(section: ProfileSection): void {
    const view = this.viewOf(section);
    if (!this.canDecide(view) || this.submitting) return;
    const reason = this.reasons[section].trim();
    if (!reason) {
      this.toastr.warning(this.translate.instant('d3.profileChanges.errors.reasonRequired'));
      return;
    }
    if (reason.length > this.reasonMax) {
      this.toastr.warning(this.translate.instant('d3.profileChanges.errors.reasonTooLong', { max: this.reasonMax }));
      return;
    }
    this.confirm('reject', () => this.submit(section, view!.changeId!, 'Rejected', reason));
  }

  openCertificate(version: CertificateVersion): void {
    if (this.downloading) return;
    // Opened synchronously so the popup blocker treats it as a user action; the
    // blob is loaded into it once it arrives.
    const win = window.open('', '_blank');
    this.downloading = version;
    this.service.downloadCertificate(this.accountId, version).subscribe({
      next: (blob) => {
        this.downloading = null;
        const url = URL.createObjectURL(blob);
        if (win) {
          win.location.href = url;
        } else {
          window.open(url, '_blank');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) => {
        this.downloading = null;
        win?.close();
        this.toastr.error(this.translate.instant(
          err?.status === 404 ? 'd3.profileChanges.errors.certificateNotFound' : 'd3.toast.errorOp'
        ));
      }
    });
  }

  private viewOf(section: ProfileSection): AnySectionView | null {
    if (!this.profile) return null;
    return section === 'Branding' ? this.profile.branding : this.profile.commercialRegister;
  }

  private confirm(kind: 'approve' | 'reject', onConfirmed: () => void): void {
    const ref = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   `d3.profileChanges.confirm.${kind}Title`,
        messageKey: `d3.profileChanges.confirm.${kind}Message`,
        confirmKey: kind === 'reject' ? 'd3.buildReview.confirm.rejectAction' : 'd3.buildReview.confirm.approveAction',
        tone:       kind
      }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) onConfirmed();
    });
  }

  private submit(section: ProfileSection, changeId: string, decision: ProfileDecision, rejectionReason?: string): void {
    this.submitting = section;
    this.service.review(this.accountId, toProfileSectionRoute(section), {
      changeId,
      decision,
      ...(decision === 'Rejected' ? { rejectionReason } : {})
    }).subscribe({
      next: () => {
        this.submitting = null;
        this.rejecting = null;
        this.reasons[section] = '';
        this.toastr.success(this.translate.instant(
          decision === 'Approved' ? 'd3.profileChanges.toast.approveSuccess' : 'd3.profileChanges.toast.rejectSuccess'
        ));
        this.load();
      },
      error: (err) => {
        this.submitting = null;
        this.handleError(err);
      }
    });
  }

  // The API only sends English messages, so known cases are mapped to our own keys.
  private handleError(err: any): void {
    const status: number | undefined = err?.status;
    const message: string = (err?.error?.message ?? '').toString();
    let key = 'd3.toast.errorOp';
    let reload = false;

    if (status === 409) {
      key = 'd3.profileChanges.errors.stale';
      reload = true;
    } else if (status === 404) {
      key = 'd3.profileChanges.errors.accountNotFound';
    } else if (status === 403) {
      key = 'd3.profileChanges.errors.forbidden';
    } else if (status === 400 && /no draft/i.test(message)) {
      key = 'd3.profileChanges.errors.noDraft';
      reload = true;
    } else if (status === 400 && /reason is required/i.test(message)) {
      key = 'd3.profileChanges.errors.reasonRequired';
    } else if (status === 400 && /at most/i.test(message)) {
      key = 'd3.profileChanges.errors.reasonTooLong';
    }

    this.toastr.error(this.translate.instant(key, { max: this.reasonMax }));
    if (reload) {
      this.rejecting = null;
      this.load();
    }
  }
}
