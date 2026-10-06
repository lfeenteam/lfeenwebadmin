import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import {
  IntegrationFieldType,
  ServiceSubscriber,
  SetSubscriptionPriceRequest,
  SubscriptionCatalogItem,
  SubscriptionIntegrationField,
  SubscriptionPricingItem,
  SubscriptionPricingPeriod,
} from '../interfaces/subscription.model';
import { formatLocalizedNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { buildCatalogUpdate } from '../interfaces/catalog-update.util';
import { serviceVisual } from '../interfaces/service-visual.util';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';

// The catalog only has two flags, so only three states exist:
//   active    = isActive && isAvailable
//   suspended = isActive && !isAvailable   (exists, but merchants can't subscribe right now)
//   stopped   = !isActive                  (soft-deleted)
type ServiceState = 'active' | 'suspended' | 'stopped';

interface SubscriberRow {
  name: string;
  subtitle: string;
  planLabel: string;
  planClass: string;
  startDate: string;
  renewalDate: string;
  price: number | null;
  statusLabel: string;
  isActive: boolean;
}

interface PricingRow {
  id: number;
  name: string;
  setupFee: number | null;
  /** Flat amount per unit (PerUnit) — null when the row has no per-unit usage fee. */
  usageAmount: number | null;
  /** Percentage of the transaction value (PercentageOfValue), already ×100. */
  usagePercent: number | null;
  seasonalPrice: number | null;
  seasonalName: string;
}

const FIELD_KEY_PATTERN = /^[A-Za-z0-9_]+$/;
const SUBSCRIBERS_PAGE_SIZE = 10;
const BILLING_PERIODS: SubscriptionPricingPeriod[] = ['Monthly', 'Yearly'];

@Component({
  selector: 'app-subscription-service-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './subscription-service-settings.component.html',
  styleUrl: './subscription-service-settings.component.scss'
})
export class SubscriptionServiceSettingsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private subscriptionsService = inject(SubscriptionsService);

  /** Catalog key from the route. */
  serviceId = '';
  serviceIcon = 'settings';
  loading = true;
  saving = false;

  private catalogItem: SubscriptionCatalogItem | null = null;
  /** Active pricing rows of this service only. */
  private activePricing: SubscriptionPricingItem[] = [];

  readonly fieldTypes: IntegrationFieldType[] = ['Text', 'Secret', 'Url'];

  ngOnInit(): void {
    this.serviceId = this.route.snapshot.paramMap.get('id') ?? '';
    this.serviceIcon = serviceVisual(this.serviceId).icon;

    this.subscriberSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.subscribersPage = 1;
        this.loadSubscribers();
      });

    this.load();
  }

  private load(): void {
    this.loading = true;
    forkJoin({
      catalog: this.subscriptionsService.getCatalog(),
      pricing: this.subscriptionsService.getPricing(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ catalog, pricing }) => {
        const item = catalog.find(c => c.key === this.serviceId) ?? null;
        this.catalogItem = item;
        this.loading = false;
        if (!item) return;

        this.serviceIcon = serviceVisual(item.key, item.categoryLabel).icon;
        this.serviceState = this.originalState = this.stateOf(item);
        this.vatSupported = typeof item.isPriceVatInclusive === 'boolean';
        this.vatIncluded = item.isPriceVatInclusive ?? false;
        this.trialDays = item.trialDays ?? 0;
        this.applyPricing(pricing);
        this.loadIntegrationFields();
        this.loadSubscribers();
      },
      error: err => {
        this.loading = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  get serviceFound(): boolean {
    return !!this.catalogItem;
  }

  get serviceName(): string {
    const item = this.catalogItem;
    if (!item) return '';
    return this.currentLang === 'en' ? item.nameEn : item.nameAr;
  }

  get logoUrl(): string | null {
    return this.catalogItem?.logoUrl ?? null;
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconAlt(): string {
    return this.currentLang === 'en' ? 'SAR' : 'ريال سعودي';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
  }

  // ── Service state (catalog isActive / isAvailable) ──────────
  serviceState: ServiceState = 'active';
  private originalState: ServiceState = 'active';

  readonly stateOptions: { value: ServiceState; labelKey: string }[] = [
    { value: 'active', labelKey: 'd3.subscriptions.serviceSettings.state.active' },
    { value: 'suspended', labelKey: 'd3.subscriptions.serviceSettings.state.suspended' },
    { value: 'stopped', labelKey: 'd3.subscriptions.serviceSettings.state.stopped' },
  ];

  get currentStateOption() {
    return this.stateOptions.find(o => o.value === this.serviceState) ?? this.stateOptions[0];
  }

  private stateOf(item: SubscriptionCatalogItem): ServiceState {
    if (!item.isActive) return 'stopped';
    return item.isAvailable ? 'active' : 'suspended';
  }

  // ── Integration fields (GET/POST /integration-fields, deactivate) ──
  integrationFields: SubscriptionIntegrationField[] = [];
  integrationLoading = false;
  addingField = false;
  savingField = false;
  deactivatingFieldId: number | null = null;
  newField = this.emptyField();

  private emptyField() {
    return { key: '', labelAr: '', labelEn: '', fieldType: 'Text' as IntegrationFieldType, isRequired: true };
  }

  fieldLabel(field: SubscriptionIntegrationField): string {
    return (this.currentLang === 'en' ? field.labelEn : field.labelAr) || field.key;
  }

  fieldTypeLabel(type: string): string {
    const key = `d3.subscriptions.serviceSettings.integration.types.${type}`;
    const translated = this.translate.instant(key);
    return translated === key ? type : translated;
  }

  get newFieldKeyInvalid(): boolean {
    const key = this.newField.key.trim();
    return !!key && (!FIELD_KEY_PATTERN.test(key) || this.integrationFields.some(f => f.key === key));
  }

  get canSaveField(): boolean {
    const f = this.newField;
    return !this.savingField && !!f.key.trim() && !this.newFieldKeyInvalid && !!f.labelAr.trim() && !!f.labelEn.trim();
  }

  private loadIntegrationFields(): void {
    if (!this.catalogItem) return;
    this.integrationLoading = true;
    this.subscriptionsService.getIntegrationFields(this.catalogItem.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fields => {
          // Deactivated fields stay in the response for history; only live ones are listed.
          this.integrationFields = (fields ?? [])
            .filter(f => f.isActive !== false)
            .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          this.integrationLoading = false;
        },
        error: err => {
          this.integrationFields = [];
          this.integrationLoading = false;
          this.toastr.error(resolveSubscriptionError(err, this.translate));
        },
      });
  }

  startAddField(): void {
    this.newField = this.emptyField();
    this.addingField = true;
  }

  cancelAddField(): void {
    if (this.savingField) return;
    this.addingField = false;
  }

  saveNewField(): void {
    if (!this.catalogItem || !this.canSaveField) return;
    this.savingField = true;
    this.subscriptionsService.createIntegrationField({
      subscriptionServiceId: this.catalogItem.id,
      key: this.newField.key.trim(),
      labelAr: this.newField.labelAr.trim(),
      labelEn: this.newField.labelEn.trim(),
      fieldType: this.newField.fieldType,
      isRequired: this.newField.isRequired,
    }).subscribe({
      next: created => {
        this.savingField = false;
        this.addingField = false;
        this.integrationFields = [...this.integrationFields, created];
      },
      error: err => {
        this.savingField = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  // There's no edit or delete endpoint — a field is deactivated and recreated to change it.
  deactivateField(field: SubscriptionIntegrationField): void {
    if (this.deactivatingFieldId !== null) return;
    this.deactivatingFieldId = field.id;
    this.subscriptionsService.deactivateIntegrationField(field.id).subscribe({
      next: () => {
        this.deactivatingFieldId = null;
        this.integrationFields = this.integrationFields.filter(f => f.id !== field.id);
      },
      error: err => {
        this.deactivatingFieldId = null;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  // ── Subscribers (GET /{id}/subscribers — server search + paging) ──
  subscribers: SubscriberRow[] = [];
  subscribersLoading = false;
  subscriberSearch = '';
  subscribersPage = 1;
  subscribersTotalPages = 1;
  private subscriberSearch$ = new Subject<string>();
  private subscribersRequest?: Subscription;

  get subscriberPages(): (number | '...')[] {
    return getVisiblePages(this.subscribersPage, this.subscribersTotalPages);
  }

  onSubscriberSearchChange(value: string): void {
    this.subscriberSearch = value;
    this.subscriberSearch$.next(value.trim());
  }

  changeSubscribersPage(page: number): void {
    if (page < 1 || page > this.subscribersTotalPages || page === this.subscribersPage) return;
    this.subscribersPage = page;
    this.loadSubscribers();
  }

  private loadSubscribers(): void {
    if (!this.catalogItem) return;
    this.subscribersRequest?.unsubscribe();
    this.subscribersLoading = true;
    this.subscribersRequest = this.subscriptionsService.getServiceSubscribers(this.catalogItem.id, {
      search: this.subscriberSearch.trim() || undefined,
      pageNumber: this.subscribersPage,
      pageSize: SUBSCRIBERS_PAGE_SIZE,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => {
        this.subscribers = page.data.map(s => this.toSubscriberRow(s));
        this.subscribersTotalPages = page.totalPages;
        this.subscribersLoading = false;
      },
      error: err => {
        this.subscribers = [];
        this.subscribersTotalPages = 1;
        this.subscribersLoading = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  private toSubscriberRow(s: ServiceSubscriber): SubscriberRow {
    // propertyName is null for account-wide subscriptions — the merchant is then the "facility".
    const merchant = s.merchantName?.trim() || '';
    const property = s.propertyName?.trim() || '';
    const status = (s.status ?? '').toLowerCase();
    const period = (s.period ?? '').toLowerCase();
    return {
      name: property || merchant || '-',
      subtitle: property ? [merchant, s.propertyClassification?.trim()].filter(Boolean).join(' · ') : (s.propertyClassification?.trim() || ''),
      planLabel: [s.tierName?.trim(), s.periodLabel?.trim() || s.period].filter(Boolean).join(' · ') || '-',
      planClass: period === 'monthly' ? 'plan-monthly' : period === 'yearly' ? 'plan-annualAdvanced' : 'plan-annualTrial',
      startDate: formatApiDateLocal(s.startDate, this.currentLang) ?? '-',
      renewalDate: formatApiDateLocal(s.expiresAt, this.currentLang) ?? '-',
      price: typeof s.price === 'number' ? s.price : null,
      statusLabel: s.statusLabel?.trim() || s.status || '-',
      isActive: status === 'active',
    };
  }

  // ── Fees per pricing row (GET /pricing) ─────────────────────
  pricingRows: PricingRow[] = [];

  private applyPricing(pricing: SubscriptionPricingItem[]): void {
    const id = this.catalogItem?.id;
    this.activePricing = pricing.filter(p => p.subscriptionServiceId === id && p.isActive);

    this.pricingRows = this.activePricing.map(p => {
      const usage = typeof p.usageUnitPrice === 'number' ? p.usageUnitPrice : null;
      return {
        id: p.id,
        name: [p.tierName?.trim(), p.periodLabel?.trim() || p.period].filter(Boolean).join(' · ') || '-',
        setupFee: typeof p.setupFee === 'number' ? p.setupFee : null,
        usageAmount: p.usageUnitType === 'PerUnit' ? usage : null,
        usagePercent: p.usageUnitType === 'PercentageOfValue' && usage !== null ? usage * 100 : null,
        seasonalPrice: typeof p.seasonalPrice === 'number' ? p.seasonalPrice : null,
        seasonalName: (this.currentLang === 'en' ? p.seasonalPriceNameEn : p.seasonalPriceNameAr)?.trim() || '',
      };
    });

    this.monthlyPrice = this.activeRow('Monthly')?.price ?? null;
    this.annualPrice = this.activeRow('Yearly')?.price ?? null;
    const anyRow = this.activeRow('Monthly') ?? this.activeRow('Yearly');
    this.setupFee = typeof anyRow?.setupFee === 'number' ? anyRow.setupFee : null;
  }

  // Most services have a single (default) tier, so there's one active row per period. With
  // several tiers the default one (subscriptionServiceTierId: null) is preferred.
  private activeRow(period: SubscriptionPricingPeriod): SubscriptionPricingItem | undefined {
    const rows = this.activePricing.filter(p => p.period === period);
    return rows.find(p => p.subscriptionServiceTierId == null) ?? rows[0];
  }

  // ── Prices (POST /pricing) ──────────────────────────────────
  /** null = no active price for that period (the field stays empty rather than showing 0). */
  monthlyPrice: number | null = null;
  annualPrice: number | null = null;
  /** One-time setup fee, applied to both periods' rows. */
  setupFee: number | null = null;

  // ── VAT (catalog isPriceVatInclusive) ───────────────────────
  vatIncluded = false;
  /** false when the catalog response doesn't carry the flag — the toggle is then disabled. */
  vatSupported = false;

  // ── Free trial (default tier's trialDays — read-only, tiers have no update endpoint) ──
  trialDays = 0;

  goBack(): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'subscriptions', 'settings']);
  }

  private pricingRequests(): Observable<unknown>[] {
    const item = this.catalogItem;
    if (!item) return [];
    const setupFee = this.setupFee ?? 0;
    const calls: Observable<unknown>[] = [];

    for (const period of BILLING_PERIODS) {
      const price = period === 'Monthly' ? this.monthlyPrice : this.annualPrice;
      // A pricing row can't exist without a price, so an empty field leaves that period alone.
      if (price === null) continue;

      const row = this.activeRow(period);
      const unchanged = row && row.price === price && (row.setupFee ?? 0) === setupFee;
      if (unchanged) continue;

      // POST /pricing replaces the active row, so its usage fee and tier are carried over.
      const body: SetSubscriptionPriceRequest = {
        subscriptionServiceId: item.id,
        subscriptionServiceTierId: row?.subscriptionServiceTierId ?? null,
        period,
        price,
        setupFee,
        currencyCode: row?.currencyCode ?? item.currencyCode ?? 'SAR',
      };
      if (row?.usageUnitType && row.usageUnitType !== 'None') {
        body.usageUnitType = row.usageUnitType;
        body.usageUnitPrice = row.usageUnitPrice ?? null;
        body.usageMaxFeeAmount = row.usageMaxFeeAmount ?? null;
      }
      calls.push(this.subscriptionsService.setPricing(body));
    }
    return calls;
  }

  private catalogRequest(): Observable<unknown> | null {
    const item = this.catalogItem;
    if (!item) return null;
    const stateChanged = this.serviceState !== this.originalState;
    const vatChanged = this.vatSupported && this.vatIncluded !== item.isPriceVatInclusive;
    if (!stateChanged && !vatChanged) return null;

    return this.subscriptionsService.updateCatalogItem(item.id, buildCatalogUpdate(item, {
      isActive: this.serviceState !== 'stopped',
      // Stopping a service doesn't touch isAvailable, so it comes back as it was when re-enabled.
      isAvailable: this.serviceState === 'stopped' ? item.isAvailable : this.serviceState === 'active',
      ...(this.vatSupported ? { isPriceVatInclusive: this.vatIncluded } : {}),
    }));
  }

  get pricesInvalid(): boolean {
    return [this.monthlyPrice, this.annualPrice, this.setupFee].some(v => v !== null && !(v >= 0));
  }

  saveSettings(): void {
    if (this.saving || !this.catalogItem) return;
    if (this.pricesInvalid) {
      this.toastr.error(this.translate.instant('d3.subscriptions.serviceSettings.errors.negativePrice'));
      return;
    }

    const catalog$ = this.catalogRequest();
    const calls = [...this.pricingRequests(), ...(catalog$ ? [catalog$] : [])];
    if (!calls.length) {
      this.goBack();
      return;
    }

    this.saving = true;
    // Each call reports its own failure so one rejected price doesn't hide that the others saved.
    forkJoin(calls.map(c => c.pipe(catchError(err => of({ __error: err }))))).subscribe(results => {
      this.saving = false;
      const failed = results.find(r => !!(r as { __error?: unknown })?.__error) as { __error: unknown } | undefined;
      if (failed) {
        this.toastr.error(resolveSubscriptionError(failed.__error, this.translate));
        // Some of the other calls may have gone through — reload so the form shows what's
        // actually saved and a retry doesn't post those again.
        if (results.length > 1) this.load();
        return;
      }
      this.toastr.success(this.translate.instant('d3.subscriptions.serviceSettings.saved'));
      this.goBack();
    });
  }
}
