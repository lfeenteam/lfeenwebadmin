import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { Subject, Subscription, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CoreService } from 'src/app/services/core.service';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import { LoginService } from '../../services/login/login.service';
import { ContactUsAttachment, ContactUsDetail, ContactUsListItem, ContactUsStatus } from './interfaces/contact-us.model';
import { ContactUsService } from './services/contact-us.service';

@Component({
  selector: 'app-contact-us-management', standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TablerIconsModule, DashboardLoadingComponent, A11yModule],
  templateUrl: './contact-us-management.component.html', styleUrl: './contact-us-management.component.scss'
})
export class ContactUsManagementComponent implements OnInit, OnDestroy {
  private readonly service = inject(ContactUsService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);
  private readonly core = inject(CoreService);
  private readonly login = inject(LoginService);
  private readonly searchChanges = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private detailRequest?: Subscription;
  private listRequest?: Subscription;
  private drawerTrigger?: HTMLElement;
  private previewTrigger?: HTMLElement;

  readonly dir = computed(() => this.core.getOptionsSignal()().dir);
  readonly canClose = computed(() => this.login.permissions().some(p => p.toLowerCase() === 'contactus.close'.toLowerCase()));
  items = signal<ContactUsListItem[]>([]); loading = signal(false); error = signal('');
  selected = signal<ContactUsDetail | null>(null); detailLoading = signal(false); detailError = signal('');
  status = signal<ContactUsStatus | 'all'>('all'); search = ''; page = signal(1); pageSize = 20;
  totalCount = signal(0); totalPages = signal(1); closeDialogOpen = signal(false); closing = signal(false); closeNote = '';
  previewAttachment = signal<ContactUsAttachment | null>(null);

  ngOnInit(): void {
    this.searchChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => { this.page.set(1); this.load(); });
    this.load();
  }
  ngOnDestroy(): void { this.detailRequest?.unsubscribe(); this.listRequest?.unsubscribe(); this.destroy$.next(); this.destroy$.complete(); }
  onSearch(value: string): void { this.search = value; this.searchChanges.next(value.trim()); }
  setStatus(value: ContactUsStatus | 'all'): void { this.status.set(value); this.page.set(1); this.load(); }
  load(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true); this.error.set('');
    this.listRequest = this.service.getRequests({ status: this.status() === 'all' ? undefined : this.status() as ContactUsStatus, search: this.search.trim() || undefined, page: this.page(), pageSize: this.pageSize }).subscribe({
      next: r => {
        const pages = Math.max(1, r.totalPages || 1);
        if (this.page() > pages) { this.page.set(pages); this.load(); return; }
        this.items.set(r.data || []); this.totalCount.set(r.totalCount || 0); this.totalPages.set(pages); this.loading.set(false);
      },
      error: e => { this.error.set(extractApiErrorMessage(e, this.translate.instant('d3.contactUs.errors.load'))); this.loading.set(false); }
    });
  }
  changePage(value: number): void { if (value < 1 || value > this.totalPages() || value === this.page()) return; this.page.set(value); this.load(); }
  open(item: ContactUsListItem, trigger?: Event): void {
    this.detailRequest?.unsubscribe();
    this.drawerTrigger = trigger?.currentTarget as HTMLElement | undefined;
    this.detailLoading.set(true); this.detailError.set(''); this.selected.set(null);
    this.detailRequest = this.service.getRequest(item.externalId).subscribe({
      next: detail => { this.selected.set(detail); this.detailLoading.set(false); this.items.update(rows => rows.map(r => r.externalId === item.externalId ? { ...r, status: detail.status } : r)); if (item.status !== detail.status && this.status() !== 'all') this.load(); },
      error: e => { this.detailError.set(extractApiErrorMessage(e, this.translate.instant('d3.contactUs.errors.detail'))); this.detailLoading.set(false); }
    });
  }
  closePanel(): void { this.closePreview(false); this.detailRequest?.unsubscribe(); this.detailRequest = undefined; this.detailLoading.set(false); this.selected.set(null); this.detailError.set(''); const trigger = this.drawerTrigger; this.drawerTrigger = undefined; setTimeout(() => trigger?.focus()); }
  statusKey(value: ContactUsStatus): string { return `d3.contactUs.status.${value.toLowerCase()}`; }
  formatBytes(bytes: number): string { if (!bytes) return '0 KB'; const units = ['B', 'KB', 'MB', 'GB']; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3); return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`; }
  pageEnd(): number { return Math.min(this.page() * this.pageSize, this.totalCount()); }
  showCloseDialog(): void { this.closeNote = ''; this.closeDialogOpen.set(true); }
  dismissCloseDialog(): void { if (!this.closing()) this.closeDialogOpen.set(false); }
  isImage(file: ContactUsAttachment): boolean { return file.contentType?.toLowerCase().startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.fileName); }
  openPreview(file: ContactUsAttachment, event: Event): void { this.previewTrigger = event.currentTarget as HTMLElement; this.previewAttachment.set(file); }
  closePreview(restoreFocus = true): void { if (!this.previewAttachment()) return; this.previewAttachment.set(null); const trigger = this.previewTrigger; this.previewTrigger = undefined; if (restoreFocus) setTimeout(() => trigger?.focus()); }
  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.previewAttachment()) this.closePreview(); else if (this.closeDialogOpen()) this.dismissCloseDialog(); else if (this.detailLoading() || this.selected() || this.detailError()) this.closePanel(); }
  confirmClose(): void {
    const detail = this.selected(); if (!detail || this.closing()) return;
    this.closing.set(true);
    this.service.closeRequest(detail.externalId, this.closeNote.trim() || undefined).subscribe({
      next: () => { const updated = { ...detail, status: 'Closed' as ContactUsStatus, closingNote: this.closeNote.trim() || null, closedAtUtc: new Date().toISOString() }; this.selected.set(updated); this.items.update(rows => rows.map(r => r.externalId === detail.externalId ? { ...r, status: 'Closed', closingNote: updated.closingNote } : r)); this.closeDialogOpen.set(false); this.closing.set(false); if (this.status() !== 'all') this.load(); this.toastr.success(this.translate.instant('d3.contactUs.close.success')); },
      error: e => { this.closing.set(false); this.toastr.error(extractApiErrorMessage(e, this.translate.instant('d3.contactUs.errors.close'))); }
    });
  }
}
