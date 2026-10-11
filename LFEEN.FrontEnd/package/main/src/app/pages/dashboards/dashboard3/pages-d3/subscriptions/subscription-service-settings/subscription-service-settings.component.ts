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
  SubscriptionServiceFeature,
  SubscriptionTier,
  SubscriptionUsageUnitType,
} from '../interfaces/subscription.model';
import { ServiceFormDialogComponent, ServiceFormDialogData } from '../service-form-dialog/service-form-dialog.component';
import { SeasonalPriceDialogComponent, SeasonalPriceDialogData } from '../seasonal-price-dialog/seasonal-price-dialog.component';
import { formatLocalizedNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { buildCatalogUpdate } from '../interfaces/catalog-update.util';
import { serviceVisual } from '../interfaces/service-visual.util';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { MatDialog } from '@angular/material/dialog';
import { OfferConfirmDialogComponent, OfferConfirmDialogData } from '../../platform-offers/components/offer-confirm-dialog/offer-confirm-dialog.component';

type BillingModel = 'Paid' | 'Free' | 'BuiltIn';
type ActivationMode = 'AdminApproval' | 'Instant';

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
  billingModel: 'Paid' | 'Free' | 'BuiltIn';
  isAutoActivated: boolean;
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
  seasonalPriceId: number | null;
  seasonalUntil: string;
}

const FIELD_KEY_PATTERN = /^[A-Za-z0-9_]+$/;
const TIER_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
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
  private dialog = inject(MatDialog);
  private subscriptionsService = inject(SubscriptionsService);

  /** Catalog key from the route. */
  serviceId = '';
  serviceIcon = 'settings';
  loading = true;
  saving = false;

  catalogItem: SubscriptionCatalogItem | null = null;
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
        this.billingModel = item.billingModel ?? 'Paid';
        this.activationMode = item.activationMode ?? 'AdminApproval';
        this.vatSupported = typeof item.isPriceVatInclusive === 'boolean';
        this.vatIncluded = item.isPriceVatInclusive ?? false;
        this.trialDays = item.trialDays ?? 0;
        this.applyPricing(pricing);
        this.loadIntegrationFields();
        this.loadSubscribers();
        this.loadFeatures();
        this.loadTiers();
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

  // ── Service type & activation (catalog billingModel / activationMode) ──
  /** The form's current choice — the saved value is on catalogItem until Save. */
  billingModel: BillingModel = 'Paid';
  activationMode: ActivationMode = 'AdminApproval';

  readonly billingModels: BillingModel[] = ['Paid', 'Free', 'BuiltIn'];
  readonly activationModes: ActivationMode[] = ['AdminApproval', 'Instant'];

  /** Follows the form's choice, so switching a free service to paid shows the price fields to fill in. */
  get isPaidService(): boolean {
    return this.billingModel === 'Paid';
  }

  private get savedBillingModel(): BillingModel {
    return this.catalogItem?.billingModel ?? 'Paid';
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
      billingModel: s.billingModel ?? 'Paid',
      isAutoActivated: s.isAutoActivated ?? false,
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
        seasonalPriceId: p.seasonalPriceId ?? null,
        seasonalUntil: formatApiDateLocal(p.seasonalPriceEndDate, this.currentLang) ?? '',
      };
    });

    this.monthlyPrice = this.activeRow('Monthly')?.price ?? null;
    this.annualPrice = this.activeRow('Yearly')?.price ?? null;
    const anyRow = this.activeRow('Monthly') ?? this.activeRow('Yearly');
    this.setupFee = typeof anyRow?.setupFee === 'number' ? anyRow.setupFee : null;

    // Usage fee: one setting applied to both periods' rows, like the setup fee.
    const type = anyRow?.usageUnitType;
    this.usageUnitType = type === 'PerUnit' || type === 'PercentageOfValue' ? type : 'None';
    const unit = typeof anyRow?.usageUnitPrice === 'number' ? anyRow.usageUnitPrice : null;
    // PercentageOfValue is stored as a rate (0.025) and edited as a percent (2.5).
    this.usageUnitPrice = unit === null ? null : this.usageUnitType === 'PercentageOfValue' ? +(unit * 100).toFixed(4) : unit;
    this.usageMaxFeeAmount = typeof anyRow?.usageMaxFeeAmount === 'number' ? anyRow.usageMaxFeeAmount : null;
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

  // ── Usage fee (metered, debited from the merchant's wallet — never goes through review) ──
  usageUnitType: SubscriptionUsageUnitType = 'None';
  /** PerUnit: SAR per unit. PercentageOfValue: a percent (2.5 = 2.5%). */
  usageUnitPrice: number | null = null;
  /** Worst case reserved from the wallet; required for PercentageOfValue. */
  usageMaxFeeAmount: number | null = null;
  readonly usageUnitTypes: SubscriptionUsageUnitType[] = ['None', 'PerUnit', 'PercentageOfValue'];

  get hasUsageFee(): boolean {
    return this.usageUnitType !== 'None';
  }

  /** The value POST /pricing expects: a rate for PercentageOfValue, an amount for PerUnit. */
  private get usageUnitPriceForApi(): number | null {
    if (this.usageUnitPrice === null) return null;
    return this.usageUnitType === 'PercentageOfValue' ? +(this.usageUnitPrice / 100).toFixed(6) : this.usageUnitPrice;
  }

  get usageError(): string | null {
    if (!this.isPaidService || !this.hasUsageFee) return null;
    const v = this.usageUnitPrice;
    if (v === null || !(v > 0)) return 'd3.subscriptions.serviceSettings.usage.errors.unitPrice';
    if (this.usageUnitType === 'PercentageOfValue') {
      if (v > 100) return 'd3.discountCodes.create.errors.percentMax';
      if (this.usageMaxFeeAmount === null || !(this.usageMaxFeeAmount > 0)) return 'd3.subscriptions.serviceSettings.usage.errors.cap';
    }
    return null;
  }

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
    if (!item || !this.isPaidService) return [];
    const setupFee = this.setupFee ?? 0;
    const calls: Observable<unknown>[] = [];

    for (const period of BILLING_PERIODS) {
      const price = period === 'Monthly' ? this.monthlyPrice : this.annualPrice;
      // A pricing row can't exist without a price, so an empty field leaves that period alone.
      if (price === null) continue;

      const row = this.activeRow(period);
      const usageType = this.usageUnitType;
      const usageUnit = this.hasUsageFee ? this.usageUnitPriceForApi : null;
      const usageCap = this.usageUnitType === 'PercentageOfValue' ? this.usageMaxFeeAmount : null;
      const unchanged = row && row.price === price && (row.setupFee ?? 0) === setupFee
        && (row.usageUnitType ?? 'None') === usageType
        && (row.usageUnitPrice ?? null) === usageUnit
        && (row.usageMaxFeeAmount ?? null) === usageCap;
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
      if (this.hasUsageFee) {
        body.usageUnitType = usageType;
        body.usageUnitPrice = usageUnit;
        body.usageMaxFeeAmount = usageCap;
      }
      calls.push(this.subscriptionsService.setPricing(body));
    }
    return calls;
  }

  private catalogRequest(): Observable<unknown> | null {
    const item = this.catalogItem;
    if (!item) return null;
    const stateChanged = this.serviceState !== this.originalState;
    // VAT only applies to paid services; a free/built-in one keeps whatever it had.
    const vatChanged = this.isPaidService && this.vatSupported && this.vatIncluded !== item.isPriceVatInclusive;
    const modeChanged = this.billingModel !== this.savedBillingModel
      || this.activationMode !== (item.activationMode ?? 'AdminApproval');
    if (!stateChanged && !vatChanged && !modeChanged) return null;

    return this.subscriptionsService.updateCatalogItem(item.id, buildCatalogUpdate(item, {
      isActive: this.serviceState !== 'stopped',
      // Stopping a service doesn't touch isAvailable, so it comes back as it was when re-enabled.
      isAvailable: this.serviceState === 'stopped' ? item.isAvailable : this.serviceState === 'active',
      billingModel: this.billingModel,
      activationMode: this.activationMode,
      ...(vatChanged ? { isPriceVatInclusive: this.vatIncluded } : {}),
    }));
  }

  /** Translation key of the warning to confirm before saving, or null when the type didn't change. */
  private get billingChangeWarningKey(): string | null {
    const from = this.savedBillingModel;
    const to = this.billingModel;
    if (from === to) return null;
    if (to === 'Paid') return 'd3.subscriptions.serviceSettings.billingChange.toPaid';
    return from === 'Paid'
      ? 'd3.subscriptions.serviceSettings.billingChange.toFree'
      : 'd3.subscriptions.serviceSettings.billingChange.other';
  }

  // A paid service's price must be above zero — except when it charges a usage fee instead,
  // where a 0 subscription fee is allowed (rule 6 of the free-services guide).
  get pricesInvalid(): boolean {
    const recurringInvalid = [this.monthlyPrice, this.annualPrice]
      .some(v => v !== null && !(this.hasUsageFee ? v >= 0 : v > 0));
    const setupInvalid = this.setupFee !== null && !(this.setupFee >= 0);
    return this.isPaidService && (recurringInvalid || setupInvalid || !!this.usageError);
  }

  // ── Service details (name, description, logo, category, order, price floors) ──
  editDetails(): void {
    const item = this.catalogItem;
    if (!item) return;
    this.dialog.open(ServiceFormDialogComponent, {
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'edit', item } as ServiceFormDialogData,
    }).afterClosed().subscribe(saved => {
      if (!saved) return;
      this.toastr.success(this.translate.instant('d3.subscriptions.serviceSettings.saved'));
      this.load();
    });
  }

  // ── Catalog card features (GET/POST /features, deactivate) ──
  features: SubscriptionServiceFeature[] = [];
  featuresLoading = false;
  addingFeature = false;
  savingFeature = false;
  deactivatingFeatureId: number | null = null;
  newFeature = { textAr: '', textEn: '' };

  featureText(f: SubscriptionServiceFeature): string {
    return (this.currentLang === 'en' ? f.textEn : f.textAr) || f.textAr || f.textEn;
  }

  get canSaveFeature(): boolean {
    return !this.savingFeature && !!this.newFeature.textAr.trim() && !!this.newFeature.textEn.trim();
  }

  private loadFeatures(): void {
    if (!this.catalogItem) return;
    this.featuresLoading = true;
    this.subscriptionsService.getFeatures(this.catalogItem.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.features = (list ?? [])
          .filter(f => f.isActive !== false)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        this.featuresLoading = false;
      },
      error: err => {
        this.features = [];
        this.featuresLoading = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  startAddFeature(): void {
    this.newFeature = { textAr: '', textEn: '' };
    this.addingFeature = true;
  }

  cancelAddFeature(): void {
    if (!this.savingFeature) this.addingFeature = false;
  }

  saveFeature(): void {
    if (!this.catalogItem || !this.canSaveFeature) return;
    this.savingFeature = true;
    this.subscriptionsService.createFeature({
      subscriptionServiceId: this.catalogItem.id,
      textAr: this.newFeature.textAr.trim(),
      textEn: this.newFeature.textEn.trim(),
    }).subscribe({
      next: created => {
        this.savingFeature = false;
        this.addingFeature = false;
        this.features = [...this.features, created];
      },
      error: err => {
        this.savingFeature = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  // No update endpoint — changing the wording means deactivating and adding a new one.
  deactivateFeature(f: SubscriptionServiceFeature): void {
    if (this.deactivatingFeatureId !== null) return;
    this.deactivatingFeatureId = f.id;
    this.subscriptionsService.deactivateFeature(f.id).subscribe({
      next: () => {
        this.deactivatingFeatureId = null;
        this.features = this.features.filter(x => x.id !== f.id);
      },
      error: err => {
        this.deactivatingFeatureId = null;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  // ── Tiers (GET/POST /tiers — no update endpoint) ────────────
  tiers: SubscriptionTier[] = [];
  tiersLoading = false;
  addingTier = false;
  savingTier = false;
  newTier = this.emptyTier();

  private emptyTier(): { key: string; nameAr: string; nameEn: string; isDefault: boolean; trialDays: number | null } {
    return { key: '', nameAr: '', nameEn: '', isDefault: false, trialDays: 0 };
  }

  tierName(t: SubscriptionTier): string {
    return (this.currentLang === 'en' ? t.nameEn : t.nameAr) || t.key;
  }

  get activeTiers(): SubscriptionTier[] {
    return this.tiers.filter(t => t.isActive);
  }

  get newTierKeyInvalid(): boolean {
    const key = this.newTier.key.trim();
    return !!key && (!TIER_KEY_PATTERN.test(key) || this.tiers.some(t => t.key === key));
  }

  get newTierTrialInvalid(): boolean {
    const d = this.newTier.trialDays;
    return d !== null && (!Number.isInteger(d) || d < 0);
  }

  get canSaveTier(): boolean {
    const t = this.newTier;
    return !this.savingTier && !!t.key.trim() && !this.newTierKeyInvalid
      && !!t.nameAr.trim() && !!t.nameEn.trim() && !this.newTierTrialInvalid;
  }

  private loadTiers(): void {
    if (!this.catalogItem) return;
    this.tiersLoading = true;
    this.subscriptionsService.getTiers(this.catalogItem.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        // Tiers of a service switched to free/built-in come back inactive — they're shown muted.
        this.tiers = [...(list ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
        this.tiersLoading = false;
      },
      error: err => {
        this.tiers = [];
        this.tiersLoading = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  startAddTier(): void {
    this.newTier = this.emptyTier();
    this.addingTier = true;
  }

  cancelAddTier(): void {
    if (!this.savingTier) this.addingTier = false;
  }

  saveTier(): void {
    const item = this.catalogItem;
    if (!item || !this.canSaveTier) return;
    this.savingTier = true;
    const maxOrder = this.tiers.reduce((m, t) => Math.max(m, t.displayOrder), 0);
    this.subscriptionsService.createTier({
      subscriptionServiceId: item.id,
      key: this.newTier.key.trim(),
      nameAr: this.newTier.nameAr.trim(),
      nameEn: this.newTier.nameEn.trim(),
      isDefault: this.newTier.isDefault,
      displayOrder: maxOrder + 10,
      trialDays: this.newTier.trialDays ?? 0,
    }).subscribe({
      next: () => {
        this.savingTier = false;
        this.addingTier = false;
        // A new default tier moves the flag (and the catalog's trialDays) — reload the real state.
        this.load();
      },
      error: err => {
        this.savingTier = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  // ── Seasonal prices (POST /seasonal-prices, deactivate) ─────
  deactivatingSeasonalId: number | null = null;

  /** Periods with an active price — a seasonal price can only replace one of those. */
  get seasonalPeriods(): SubscriptionPricingPeriod[] {
    const periods = this.activePricing.map(p => p.period).filter((p): p is SubscriptionPricingPeriod => !!p);
    return [...new Set(periods)];
  }

  addSeasonalPrice(): void {
    const item = this.catalogItem;
    if (!item || !this.seasonalPeriods.length) return;
    this.dialog.open(SeasonalPriceDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      data: {
        subscriptionServiceId: item.id,
        periods: this.seasonalPeriods,
        tiers: this.activeTiers,
        currencyCode: item.currencyCode ?? 'SAR',
      } as SeasonalPriceDialogData,
    }).afterClosed().subscribe(created => {
      if (!created) return;
      this.toastr.success(this.translate.instant('d3.seasonalPrice.created'));
      this.load();
    });
  }

  // No update endpoint — to change one, deactivate it and create a new one.
  deactivateSeasonalPrice(row: PricingRow): void {
    const id = row.seasonalPriceId;
    if (id === null || this.deactivatingSeasonalId !== null) return;
    this.dialog.open(OfferConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: 'd3.seasonalPrice.deactivateTitle',
        message: 'd3.seasonalPrice.deactivateMessage',
        confirmLabel: 'd3.seasonalPrice.deactivate',
        icon: 'player-pause',
        tone: 'warning',
      } as OfferConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deactivatingSeasonalId = id;
      this.subscriptionsService.deactivateSeasonalPrice(id).subscribe({
        next: () => {
          this.deactivatingSeasonalId = null;
          this.load();
        },
        error: err => {
          this.deactivatingSeasonalId = null;
          this.toastr.error(resolveSubscriptionError(err, this.translate));
        },
      });
    });
  }

  saveSettings(): void {
    if (this.saving || !this.catalogItem) return;
    if (this.pricesInvalid) {
      this.toastr.error(this.translate.instant('d3.subscriptions.serviceSettings.errors.invalidPrice'));
      return;
    }

    const warningKey = this.billingChangeWarningKey;
    if (!warningKey) {
      this.runSave();
      return;
    }

    this.dialog.open(OfferConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: 'd3.subscriptions.serviceSettings.billingChange.title',
        message: warningKey,
        confirmLabel: 'd3.subscriptions.serviceSettings.billingChange.confirm',
        icon: 'alert-triangle',
        tone: 'warning',
      } as OfferConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.runSave();
    });
  }

  private runSave(): void {
    const catalog$ = this.catalogRequest();
    const pricing = this.pricingRequests();
    if (!catalog$ && !pricing.length) {
      this.goBack();
      return;
    }

    this.saving = true;
    // The catalog update goes first: a free service switched to paid only accepts a price
    // once the backend sees it as paid.
    const catalogStep$: Observable<unknown> = catalog$ ?? of(null);
    catalogStep$.subscribe({
      next: () => {
        if (!pricing.length) {
          this.finishSave(null, false);
          return;
        }
        // Each price reports its own failure so one rejected price doesn't hide that the others saved.
        forkJoin(pricing.map(c => c.pipe(catchError(err => of({ __error: err }))))).subscribe(results => {
          const failed = results.find(r => !!(r as { __error?: unknown })?.__error) as { __error: unknown } | undefined;
          this.finishSave(failed?.__error ?? null, !!catalog$ || results.length > 1);
        });
      },
      error: err => this.finishSave(err, false),
    });
  }

  /** `partial` = something may already be saved, so the form reloads instead of keeping stale values. */
  private finishSave(error: unknown, partial: boolean): void {
    this.saving = false;
    if (error) {
      this.toastr.error(resolveSubscriptionError(error, this.translate));
      if (partial) this.load();
      return;
    }
    this.toastr.success(this.translate.instant('d3.subscriptions.serviceSettings.saved'));
    this.goBack();
  }
}
