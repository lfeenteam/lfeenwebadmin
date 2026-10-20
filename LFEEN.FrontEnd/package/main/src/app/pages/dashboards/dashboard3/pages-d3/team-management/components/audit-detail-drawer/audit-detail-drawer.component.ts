import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from 'src/app/material.module';
import { OperationAuditsService } from '../../../../services/operation-audits.service';
import { AdminOperationAuditDetail, AdminOperationAuditItem } from '../../../../interfaces/operation-audit.model';
import {
  auditActionIcon,
  auditDepartmentName,
  auditEntityRoute,
  auditInitials,
  auditStatusClass,
  auditStatusKey,
  formatAuditDate,
  formatAuditIp,
  humanizeKey,
  summarizeUserAgent
} from '../ops-log-table/audit-presentation';

const I18N = 'd3.teamManagement.opsLog.details';

export interface AuditDetailDrawerData {
  item: AdminOperationAuditItem;
  lang: string;
}

/** Closed with this result when the entry no longer exists, so the caller can refresh the list. */
export const AUDIT_DETAIL_NOT_FOUND = 'notFound';

@Component({
  selector: 'app-audit-detail-drawer',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './audit-detail-drawer.component.html',
  styleUrl: './audit-detail-drawer.component.scss'
})
export class AuditDetailDrawerComponent implements OnInit {
  private readonly auditsService = inject(OperationAuditsService);
  private readonly dialogRef = inject(MatDialogRef<AuditDetailDrawerComponent>);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<AuditDetailDrawerData>(MAT_DIALOG_DATA);

  // The list row is shown immediately; the detail call only adds the trace fields.
  readonly item = this.data.item;
  readonly detail = signal<AdminOperationAuditDetail | null>(null);
  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);

  readonly occurred = formatAuditDate(this.item.occurredAt, this.data.lang);
  readonly actionIcon = auditActionIcon(this.item.actionCode);
  readonly statusClass = auditStatusClass(this.item.status);
  readonly statusKey = auditStatusKey(this.item.status);
  readonly departmentName = auditDepartmentName(this.item);
  readonly initials = auditInitials(this.item.actorName);
  readonly entityRoute = auditEntityRoute(this.item);
  readonly entityTypeLabel = this.translateOr(`${I18N}.entityTypes.${this.item.entityType}`, this.item.entityType);
  readonly durationLabel = this.formatDuration(this.item.durationMilliseconds);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);

    this.auditsService
      .getById(this.item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => {
          this.detail.set(detail);
          this.isLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);
          if (err.status === 404) {
            this.toastr.error(this.translate.instant('d3.teamManagement.opsLog.details.notFound'));
            this.dialogRef.close(AUDIT_DETAIL_NOT_FOUND);
            return;
          }
          this.loadFailed.set(true);
        }
      });
  }

  // Metadata values are unknown JSON; they are rendered through interpolation
  // (escaped text), never as HTML.
  get metadataEntries(): { key: string; label: string; value: string }[] {
    const metadata = this.detail()?.metadata;
    if (!metadata) return [];

    return Object.entries(metadata).map(([key, value]) => ({
      key,
      label: this.translateOr(`${I18N}.metadataKeys.${key}`, humanizeKey(key)),
      value: this.formatValue(value)
    }));
  }

  get ipAddress(): string | null {
    return formatAuditIp(this.detail()?.ipAddress ?? null);
  }

  get device(): string | null {
    return summarizeUserAgent(this.detail()?.userAgent ?? null);
  }

  copy(value: string | null): void {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(
      () => this.toastr.success(this.translate.instant(`${I18N}.copied`)),
      () => undefined
    );
  }

  private get locale(): string {
    return this.data.lang === 'ar' ? 'ar-EG' : 'en-US';
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') return value.toLocaleString(this.locale);
    if (typeof value === 'boolean') return this.translate.instant(`${I18N}.${value ? 'yes' : 'no'}`);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private formatDuration(ms: number): string {
    const unit = this.translate.instant(`${I18N}.${ms >= 1000 ? 'seconds' : 'milliseconds'}`);
    const amount = ms >= 1000 ? +(ms / 1000).toFixed(1) : ms;
    return `${amount.toLocaleString(this.locale)} ${unit}`;
  }

  // ngx-translate returns the key itself when a translation is missing.
  private translateOr(key: string, fallback: string): string {
    const text = this.translate.instant(key);
    return text && text !== key ? text : fallback;
  }

  openEntity(): void {
    if (!this.entityRoute) return;
    this.dialogRef.close();
    this.router.navigate(['/', this.data.lang, 'd3', ...this.entityRoute]);
  }

  close(): void {
    this.dialogRef.close();
  }
}
