import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/services/core.service';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import { SingleDateCalendarComponent } from '../all-bookings/components/single-date-calendar/single-date-calendar.component';
import { BookingUnitOption } from '../all-bookings/interfaces/booking.model';
import { BookingService } from '../all-bookings/services/booking.service';
import { TimeSelectComponent } from './components/time-select/time-select.component';
import {
  OfferFormValue,
  PlatformOfferDetail,
} from './interfaces/platform-offer.model';
import { PlatformOffersService } from './services/platform-offers.service';

@Component({
  selector: 'app-platform-offer-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslateModule,
    TablerIconsModule,
    MaterialModule,
    SingleDateCalendarComponent,
    TimeSelectComponent,
  ],
  templateUrl: './platform-offer-form.component.html',
  styleUrl: './platform-offers.component.scss',
})
export class PlatformOfferFormComponent implements OnInit {
  readonly messageTypes = ['None', 'NotFound', 'NotStarted', 'Expired', 'UsageLimitReached', 'UserUsageLimitReached', 'InvalidUnit', 'StayPeriodMismatch', 'MinDaysBeforeArrivalNotMet', 'MinStayDaysNotMet', 'MaxStayDaysExceeded', 'PaymentMethodNotAllowed', 'ExclusionPeriodConflict', 'MinAmountNotMet', 'DayOfWeekMismatch', 'HappyHourMismatch', 'ChannelMMismatch', 'StayDayOfWeekMismatch'];
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(PlatformOffersService);
  private bookingService = inject(BookingService);
  private core = inject(CoreService);
  private tr = inject(TranslateService);
  private toast = inject(ToastrService);
  private code$ = new Subject<string>();
  dir = computed(() => this.core.getOptionsSignal()().dir);
  id?: number;
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  open = signal(new Set(['basics']));
  banner?: File;
  preview = signal('');
  codeState = signal<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  units = signal<BookingUnitOption[]>([]);
  days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  form = this.fb.group({
    internalNameAr: ['', Validators.required],
    internalNameEn: ['', Validators.required],
    externalNameAr: [''],
    externalNameEn: [''],
    descriptionAr: [''],
    descriptionEn: [''],
    triggerType: ['Automatic', Validators.required],
    code: [''],
    discountType: ['Percentage', Validators.required],
    discountValue: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    maxDiscountAmount: [null as number | null],
    appliedTo: ['AllUnits', Validators.required],
    unitIds: [[] as number[]],
    offerStartDate: [''],
    offerEndDate: [''],
    offerDaysOfWeek: [''],
    happyHourStart: [''],
    happyHourEnd: [''],
    stayStartDate: [''],
    stayEndDate: [''],
    stayDaysOfWeek: [''],
    maxTotalUsage: [null as number | null],
    maxDailyUsage: [null as number | null],
    maxDailyUsagePerUser: [null as number | null],
    maxTotalUsagePerUser: [null as number | null],
    minDaysBeforeArrival: [null as number | null],
    minStayDays: [null as number | null],
    maxStayDays: [null as number | null],
    allowedPaymentMethods: [''],
    minBookingAmount: [null as number | null],
    displayChannel: ['All'],
    canBeCombined: [false],
    expirationPolicy: ['WhicheverFirst'],
    loyaltyPointsMultiplier: [1],
    exclusionPeriods: this.fb.array([]),
    customMessages: this.fb.array([]),
    offerTerms: this.fb.array([]),
  });
  get exclusions() {
    return this.form.controls.exclusionPeriods as FormArray;
  }
  get messages() {
    return this.form.controls.customMessages as FormArray;
  }
  get terms() {
    return this.form.controls.offerTerms as FormArray;
  }
  enumLabel(value: string | null | undefined): string {
    return value ? this.tr.instant(`d3.platformOffers.enums.${value}`) : '—';
  }
  ngOnInit() {
    const raw = this.route.snapshot.paramMap.get('id');
    if (raw) this.id = +raw;
    this.code$
      .pipe(
        debounceTime(450),
        distinctUntilChanged(),
        switchMap((code) => this.service.checkCode(code)),
      )
      .subscribe({
        next: (r) => this.codeState.set(r.isAvailable ? 'ok' : 'taken'),
        error: () => this.codeState.set('idle'),
      });
    this.bookingService
      .getPublishedUnits()
      .subscribe({ next: (u) => this.units.set(u) });
    if (this.id) this.load();
  }
  toggle(k: string) {
    this.open.update((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }
  isOpen(k: string) {
    return this.open().has(k);
  }
  load() {
    this.loading.set(true);
    this.service.get(this.id!).subscribe({
      next: (d) => {
        this.patch(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(
          extractApiErrorMessage(
            e,
            this.tr.instant('d3.platformOffers.errors.detail'),
          ),
        );
        this.loading.set(false);
      },
    });
  }
  patch(d: PlatformOfferDetail) {
    const date = (v?: string | null) => (v ? v.slice(0, 16) : '');
    this.form.patchValue({
      ...d,
      offerStartDate: date(d.offerStartDate),
      offerEndDate: date(d.offerEndDate),
      stayStartDate: date(d.stayStartDate),
      stayEndDate: date(d.stayEndDate),
      unitIds: d.offerUnits.map((u) => u.unitId),
    } as any);
    this.preview.set(d.banner || '');
    d.exclusionPeriods.forEach((x) => this.exclusions.push(this.exclusion(x)));
    d.customMessages.forEach((x) => this.messages.push(this.message(x)));
    d.offerTerms.forEach((x) => this.terms.push(this.term(x)));
  }
  file(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) {
      this.banner = f;
      this.preview.set(URL.createObjectURL(f));
    }
  }
  lang() {
    return this.router.url.split('/')[1] || 'ar';
  }
  datePart(c: AbstractControl | null) {
    const v = (c?.value as string) || '';
    return v ? v.slice(0, 10) : '';
  }
  timePart(c: AbstractControl | null) {
    const v = (c?.value as string) || '';
    return v.length >= 16 ? v.slice(11, 16) : '';
  }
  setDatePart(c: AbstractControl | null, iso: string) {
    if (!c) return;
    c.setValue(`${iso}T${this.timePart(c) || '00:00'}`);
    c.markAsDirty();
  }
  setTimePart(c: AbstractControl | null, time: string) {
    if (!c) return;
    const datePart = this.datePart(c) || this.todayIso();
    c.setValue(time ? `${datePart}T${time}` : datePart);
    c.markAsDirty();
  }
  private todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  dateTimeLabel(c: AbstractControl | null) {
    const iso = this.datePart(c);
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const locale = this.dir() === 'rtl' ? 'ar-SA' : 'en-US';
    const formatted = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d));
    return `${formatted} - ${this.formatTime12(this.timePart(c) || '00:00')}`;
  }
  timeLabel(hhmm: string | null | undefined) {
    return hhmm ? this.formatTime12(hhmm) : '';
  }
  private formatTime12(hhmm: string) {
    const [hStr, m] = hhmm.split(':');
    const h24 = Number(hStr) || 0;
    const isAm = h24 < 12;
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const period =
      this.dir() === 'rtl' ? (isAm ? 'صباحًا' : 'مساءً') : isAm ? 'AM' : 'PM';
    return `${String(h12).padStart(2, '0')}:${m} ${period}`;
  }
  listLink() {
    return ['/', this.lang(), 'd3', 'platform-offers'];
  }
  codeChanged(v: string) {
    if (this.form.value.triggerType === 'Coupon' && v.trim().length > 2) {
      this.codeState.set('checking');
      this.code$.next(v.trim());
    } else this.codeState.set('idle');
  }
  exclusion(v: any = {}) {
    return this.fb.group({
      id: [v.id],
      startDate: [v.startDate?.slice(0, 16) || '', Validators.required],
      endDate: [v.endDate?.slice(0, 16) || '', Validators.required],
      reason: [v.reason || ''],
    });
  }
  message(v: any = {}) {
    return this.fb.group({
      id: [v.id],
      type: [v.type || 'None', Validators.required],
      messageAr: [v.messageAr || '', Validators.required],
      messageEn: [v.messageEn || '', Validators.required],
    });
  }
  term(v: any = {}) {
    return this.fb.group({
      id: [v.id],
      termAr: [v.termAr || '', Validators.required],
      termEn: [v.termEn || '', Validators.required],
      order: [v.order ?? this.terms.length + 1, Validators.required],
    });
  }
  submit() {
    const coupon = this.form.value.triggerType === 'Coupon';
    this.form.controls.code.setValidators(coupon ? [Validators.required] : []);
    this.form.controls.code.updateValueAndValidity();
    if (this.form.invalid || this.codeState() === 'taken') {
      this.form.markAllAsTouched();
      this.open.set(
        new Set([
          'basics',
          'discount',
          'scope',
          'timing',
          'stay',
          'usage',
          'settings',
          'exclusions',
          'messages',
          'terms',
        ]),
      );
      setTimeout(() =>
        document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus(),
      );
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue() as unknown as OfferFormValue;
    const onDone = (newId?: number) => {
      this.saving.set(false);
      this.toast.success(this.tr.instant('d3.platformOffers.saved'));
      this.router.navigate([
        '/',
        this.lang(),
        'd3',
        'platform-offers',
        this.id || newId,
      ]);
    };
    const onErr = (e: unknown) => {
      this.saving.set(false);
      this.toast.error(
        extractApiErrorMessage(
          e,
          this.tr.instant('d3.platformOffers.errors.save'),
        ),
      );
    };
    if (this.id)
      this.service
        .update(this.id, value, this.banner)
        .subscribe({ next: () => onDone(), error: onErr });
    else
      this.service
        .create(value, this.banner)
        .subscribe({ next: (r) => onDone(r), error: onErr });
  }
}
