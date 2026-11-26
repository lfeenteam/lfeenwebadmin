import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ComplaintService } from '../../services/complaint.service';
import { AR_DATE_LOCALE, EmployeeComplaintDetail } from '../../interfaces/complaint.model';
import { DashboardEmptyComponent } from '../../../../../../../components/dashboard3/dashboard-empty/dashboard-empty.component';
import { TextDirPipe } from '../../../../../../../pipes/text-dir.pipe';

type LoadState = 'loading' | 'ready' | 'notFound' | 'error';

type LoadResult =
  | { kind: 'ok'; detail: EmployeeComplaintDetail }
  | { kind: 'notFound' | 'error' };

/**
 * Read-only detail of a complaint filed against an employee (GET /api/complaints/{id}).
 * Opened from the "new complaint against an employee" notification (BUG-2813) — these
 * are not tickets, so the ticket detail page (complaints/:id) can't show them.
 */
@Component({
  selector: 'app-employee-complaint-detail',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, TextDirPipe],
  templateUrl: './employee-complaint-detail.component.html',
  // Same look as the ticket detail page (summary strip, profile row, message card, badges).
  styleUrls: [
    '../host-complaint-detail/host-complaint-detail.component.scss',
    './employee-complaint-detail.component.scss',
  ],
})
export class EmployeeComplaintDetailComponent implements OnInit {
  private translate  = inject(TranslateService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private service    = inject(ComplaintService);
  private destroyRef = inject(DestroyRef);

  complaint = signal<EmployeeComplaintDetail | null>(null);
  loadState = signal<LoadState>('loading');
  loading   = computed(() => this.loadState() === 'loading');

  private reload$ = new Subject<void>();

  ngOnInit(): void {
    // Follow :id (reused component when only the id changes, e.g. from notifications).
    combineLatest([this.route.paramMap, this.reload$.pipe(startWith(undefined))]).pipe(
      map(([params]) => params.get('id') ?? ''),
      tap(() => {
        this.complaint.set(null);
        this.loadState.set('loading');
      }),
      switchMap((id): Observable<LoadResult> => !id
        ? of({ kind: 'notFound' })
        : this.service.getEmployeeComplaintById(id).pipe(
            map((detail): LoadResult => ({ kind: 'ok', detail })),
            catchError(err => of<LoadResult>({
              kind: err?.status === 404 || err?.status === 400 ? 'notFound' : 'error',
            })),
          )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (result.kind === 'ok') {
        this.complaint.set(result.detail);
        this.loadState.set('ready');
      } else {
        this.loadState.set(result.kind);
      }
    });
  }

  retryLoad(): void {
    this.reload$.next();
  }

  backToList(): void {
    this.router.navigate(['../../'], { relativeTo: this.route });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  getInitials(name: string | null | undefined): string {
    if (!name) return '';
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  createdAt(c: EmployeeComplaintDetail): string {
    if (!c.createdAt) return '-';
    const date = new Date(c.createdAt);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(
      this.currentDir === 'rtl' ? AR_DATE_LOCALE : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    );
  }

  /** Lower-cased status for the shared badge colours (new / pending / resolved / closed). */
  statusAttr(status: string | null | undefined): string {
    return (status ?? '').trim().toLowerCase();
  }

  /** Localized label for a backend enum value; an unknown value is shown as the API sent it. */
  enumLabel(group: 'status' | 'complainantType' | 'reason' | 'priority', value: string | null | undefined): string {
    const v = value?.trim();
    if (!v) return '-';
    const key = `d3.complaints.employeeDetail.${group}.${v}`;
    const label = this.translate.instant(key);
    return label === key ? v : label;
  }
}
