import { Component, inject, signal, OnInit, OnDestroy, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { ComplaintService } from '../../services/complaint.service';
import { AR_DATE_LOCALE, TicketAttachment, TicketDetail, TicketMessage } from '../../interfaces/complaint.model';
import { PageTitleOverrideService } from '../../../../services/page-title-override.service';
import { LoginService } from '../../../../services/login/login.service';
import { DashboardEmptyComponent } from '../../../../../../../components/dashboard3/dashboard-empty/dashboard-empty.component';

type LoadState = 'loading' | 'ready' | 'notFound' | 'error';

type LoadResult =
  | { kind: 'ok'; detail: TicketDetail }
  | { kind: 'notFound' | 'error' };

@Component({
  selector: 'app-host-complaint-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent],
  templateUrl: './host-complaint-detail.component.html',
  styleUrl: './host-complaint-detail.component.scss'
})
export class HostComplaintDetailComponent implements OnInit, OnDestroy {
  private translate = inject(TranslateService);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private service   = inject(ComplaintService);
  private pageTitleOverride = inject(PageTitleOverrideService);
  private loginService = inject(LoginService);
  private toastr = inject(ToastrService);
  private destroyRef = inject(DestroyRef);

  replyText       = '';
  closeNote       = '';
  loading         = signal(true);
  sendingReply    = signal(false);
  showCloseDialog = signal(false);
  closingTicket   = signal(false);
  closeError      = signal<string | null>(null);
  ticket          = signal<TicketDetail | null>(null);
  selectedFile    = signal<File | null>(null);
  loadState       = signal<LoadState>('loading');
  viewOnly        = signal(false);

  /** Id of the ticket currently in the URL — every write targets this, and
   * async results are dropped if it changed while they were in flight. */
  private ticketId = '';
  private reload$ = new Subject<void>();

  private lastTrigger = this.service.closeDialogTrigger();

  constructor() {
    effect(() => {
      const n = this.service.closeDialogTrigger();
      if (n > this.lastTrigger) {
        this.lastTrigger = n;
        this.openCloseDialog();
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(q => this.viewOnly.set(q.get('mode') === 'view'));

    // The component is reused when only :id changes (address bar, back/forward,
    // notifications), so follow the param instead of reading the snapshot once.
    combineLatest([this.route.paramMap, this.reload$.pipe(startWith(undefined))]).pipe(
      map(([params]) => params.get('id') ?? ''),
      tap(id => this.resetFor(id)),
      switchMap((id): Observable<LoadResult> => !id
        ? of({ kind: 'notFound' })
        : this.service.getTicketById(id).pipe(
            map((detail): LoadResult => ({ kind: 'ok', detail })),
            catchError(err => of<LoadResult>({
              kind: err?.status === 404 || err?.status === 400 ? 'notFound' : 'error',
            })),
          )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (result.kind === 'ok') {
        this.ticket.set(result.detail);
        this.pageTitleOverride.set(result.detail.subject);
        this.loadState.set('ready');
      } else {
        this.loadState.set(result.kind);
      }
      this.loading.set(false);
    });
  }

  retryLoad(): void {
    this.reload$.next();
  }

  backToList(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  /** Clears everything tied to the previous ticket so a draft reply, an open close
   * dialog or stale details can never be applied to the ticket now in the URL. */
  private resetFor(id: string): void {
    this.ticketId = id;
    this.ticket.set(null);
    this.replyText = '';
    this.closeNote = '';
    this.selectedFile.set(null);
    this.showCloseDialog.set(false);
    this.closeError.set(null);
    this.sendingReply.set(false);
    this.closingTicket.set(false);
    this.pageTitleOverride.clear();
    this.loading.set(true);
    this.loadState.set('loading');
  }

  private get canWrite(): boolean {
    return this.loadState() === 'ready' && !!this.ticket() && !!this.ticketId && !this.viewOnly();
  }

  ngOnDestroy(): void {
    this.pageTitleOverride.clear();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  getInitials(name: string | null | undefined): string {
    if (!name) return '';
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  /** The API only returns `accountName` for some ticket sources — fall back to
   * `createdByName` (always present) so the profile card never renders blank. */
  get accountDisplayName(): string {
    const t = this.ticket();
    return t?.accountName || t?.createdByName || '-';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(
      this.currentDir === 'rtl' ? AR_DATE_LOCALE : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    );
  }

  formatBytes(bytes: number): string {
    if (!bytes) return `0 ${this.translate.instant('d3.complaints.hostDetail.kb')}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ${this.translate.instant('d3.complaints.hostDetail.kb')}`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${this.translate.instant('d3.complaints.hostDetail.mb')}`;
  }

  isImageAttachment(contentType: string | null | undefined): boolean {
    return !!contentType && contentType.startsWith('image/');
  }

  getFileIcon(contentType: string | null | undefined): string {
    if (!contentType) return 'file';
    if (contentType.startsWith('image/')) return 'photo';
    if (contentType === 'application/pdf') return 'file-type-pdf';
    if (contentType.includes('word') || contentType === 'application/msword') return 'file-type-doc';
    if (contentType.includes('sheet') || contentType === 'application/vnd.ms-excel') return 'file-type-xls';
    if (contentType.startsWith('video/')) return 'video';
    return 'file';
  }

  /** Swaps a broken image thumbnail for the generic file icon instead of leaving a broken-image box. */
  onThumbnailError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  openAttachment(att: TicketAttachment | null | undefined): void {
    if (!att?.fileUrl) {
      this.toastr.error(this.translate.instant('d3.complaints.hostDetail.fileUnavailable'));
      return;
    }
    window.open(att.fileUrl, '_blank', 'noopener,noreferrer');
  }

  /** Top-level `attachments` can legitimately repeat a file already shown under the
   * initial message or a reply (older data / previous mapping) — filter those out by
   * externalId so nothing is shown twice on the page. */
  legacyAttachments(ticket: TicketDetail): TicketAttachment[] {
    const shownIds = new Set<string>();
    if (ticket.initialMessage?.attachment?.externalId) {
      shownIds.add(ticket.initialMessage.attachment.externalId);
    }
    for (const m of ticket.messages ?? []) {
      if (m?.attachment?.externalId) shownIds.add(m.attachment.externalId);
    }
    return (ticket.attachments ?? []).filter(a => a && !shownIds.has(a.externalId));
  }

  /** Full conversation after the initial message — replies from the merchant/guest
   * must be shown too, not only admin replies. */
  get threadMessages(): TicketMessage[] {
    return (this.ticket()?.messages ?? []).filter(m => m != null);
  }

  isAdminMessage(m: TicketMessage): boolean {
    return m.senderTypeName === 'Admin' || m.senderType === 'Admin' || +m.senderType === 2;
  }

  get hostSubtitle(): string {
    const t = this.ticket();
    if (!t) return '';
    const role = this.currentDir === 'rtl' ? 'مضيف' : 'Host';
    return t.propertyName ? `${role} · ${t.propertyName}` : role;
  }

  get lastUpdateDate(): string {
    const t = this.ticket();
    if (!t) return '';
    const all = [t.initialMessage, ...t.messages];
    const last = all[all.length - 1];
    return this.formatDate(last.createdAt);
  }

  trackById(_: number, item: TicketAttachment | TicketMessage): string {
    return item.externalId;
  }

  get canSendReply(): boolean {
    return !!this.replyText.trim() || !!this.selectedFile();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    input.value = '';
  }

  clearSelectedFile(): void {
    this.selectedFile.set(null);
  }

  sendReply(): void {
    const body = this.replyText.trim();
    const attachment = this.selectedFile();
    if ((!body && !attachment) || this.sendingReply() || !this.canWrite) return;

    // Pin the target once: the whole assign → reply → refresh chain goes to the
    // ticket that was on screen when the admin pressed send.
    const id = this.ticketId;
    this.sendingReply.set(true);
    this.assignToCurrentUserIfUnassigned(id).then(() => {
      if (id !== this.ticketId) return;
      this.service.sendTicketReply(id, body, attachment).subscribe({
        next: result => {
          if (id !== this.ticketId) return;
          this.replyText = '';
          this.selectedFile.set(null);
          const newMsg = result?.reply ?? null;
          if (newMsg) {
            this.ticket.update(t =>
              t ? { ...t, messages: [...t.messages, newMsg] } : t
            );
            this.sendingReply.set(false);
          } else {
            this.service.getTicketById(id).subscribe({
              next: detail => {
                if (id !== this.ticketId) return;
                this.ticket.set(detail);
                this.sendingReply.set(false);
              },
              error: () => {
                if (id === this.ticketId) this.sendingReply.set(false);
              },
            });
          }
        },
        error: () => {
          if (id !== this.ticketId) return;
          this.sendingReply.set(false);
          this.toastr.error(this.translate.instant('d3.toast.errorOp'));
        },
      });
    });
  }

  /** Assigns the ticket to the current user only when they actually reply — merely
   * viewing the ticket must not claim it and lock out reassignment. */
  private assignToCurrentUserIfUnassigned(id: string): Promise<void> {
    const t = this.ticket();
    if (!t || t.assignedAdminUserId) return Promise.resolve();
    const user = this.loginService.getUser();
    if (!user?.userId) return Promise.resolve();

    return new Promise(resolve => {
      this.service.assignTicket(id, user.userId).subscribe({
        next: () => {
          if (id === this.ticketId) {
            this.ticket.update(curr =>
              curr ? { ...curr, assignedAdminUserId: user.userId, assignedAdminName: user.fullName } : curr
            );
          }
          resolve();
        },
        error: () => resolve(),
      });
    });
  }

  openCloseDialog(): void {
    // The header "resolve" button doesn't know the page state — never offer to
    // close a ticket that failed to load, doesn't exist, or is still loading.
    if (!this.canWrite) return;
    this.closeError.set(null);
    this.showCloseDialog.set(true);
  }

  cancelClose(): void {
    this.showCloseDialog.set(false);
    this.closeNote  = '';
    this.closeError.set(null);
  }

  confirmClose(): void {
    if (this.closingTicket() || !this.canWrite) return;
    const id = this.ticketId;
    this.closingTicket.set(true);
    this.closeError.set(null);
    this.service.updateTicketStatus(id, '5', this.closeNote.trim() || undefined).subscribe({
      next: () => {
        if (id !== this.ticketId) return;
        this.closingTicket.set(false);
        this.showCloseDialog.set(false);
        this.router.navigate(['../'], {
          relativeTo: this.route,
          queryParams: { tab: 'resolved' },
        });
      },
      error: () => {
        if (id !== this.ticketId) return;
        this.closingTicket.set(false);
        this.closeError.set('حدث خطأ أثناء إغلاق الشكوى، يرجى المحاولة مرة أخرى.');
      },
    });
  }
}
