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
  ServiceSubscriber,
  SubscriptionBillingModel,
  SubscriptionCatalogItem,
  SubscriptionIntegrationField,
  SubscriptionPeriodOption,
  SubscriptionPricingItem,
  SubscriptionServiceFeature,
  SubscriptionTier,
} from '../interfaces/subscription.model';
import { PricingRowDialogComponent, PricingRowDialogData } from '../pricing-row-dialog/pricing-row-dialog.component';
import { PeriodOptionDialogComponent, PeriodOptionDialogData } from '../period-option-dialog/period-option-dialog.component';
import { IntegrationFieldDialogComponent, IntegrationFieldDialogData } from '../integration-field-dialog/integration-field-dialog.component';
import { ServiceFormDialogComponent, ServiceFormDialogData } from '../service-form-dialog/service-form-dialog.component';
import { BillingFieldsComponent } from '../billing-fields/billing-fields.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { LoginService } from '../../../services/login/login.service';
import { buildCatalogUpdate } from '../interfaces/catalog-update.util';
import { serviceVisual } from '../interfaces/service-visual.util';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { PricingStyle, pricingStyleOf } from '../interfaces/pricing-style.util';
import { periodText } from '../interfaces/period-text.util';
import { BillingFormValue, billingFieldsError, billingRequestFields } from '../interfaces/billing-fields.util';
import { MatDialog } from '@angular/material/dialog';
import { OfferConfirmDialogComponent, OfferConfirmDialogData } from '../../platform-offers/components/offer-confirm-dialog/offer-confirm-dialog.component';

// The catalog only has two flags, so only three states exist:
//   active    = isActive && isAvailable
//   suspended = isActive && !isAvailable   (exists, but merchants can't subscribe right now)
//   stopped   = !isActive                  (soft-deleted)
type ServiceState = 'active' | 'suspended' | 'stopped';

interface SubscriberRow {
  name: string;
  subtitle: string;
  planLabel: string;
  startDate: string;
  renewalDate: string;
  price: number | null;
  statusLabel: string;
  isActive: boolean;
  billingModel: SubscriptionBillingModel;
}

const TIER_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const SUBSCRIBERS_PAGE_SIZE = 10;

@Component({
  selector: 'app-subscription-service-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, BillingFieldsComponent, DashboardLoadingComponent],
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
  private login = inject(LoginService);
  private subscriptionsService = inject(SubscriptionsService);

  /** Catalog key from the route. */
  serviceId = '';
  serviceIcon = 'settings';
  loading = true;
  saving = false;

  catalogItem: SubscriptionCatalogItem | null = null;
  /** Every pricing row of this service, active or not (any row locks the billing style). */
  private servicePricing: SubscriptionPricingItem[] = [];
  /** Every period option of this service, active or not. */
  private serviceOptions: SubscriptionPeriodOption[] = [];

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
        this.billing = this.billingOf(item);
        this.servicePricing = pricing.filter(p => p.subscriptionServiceId === item.id);
        this.applyMessagePack();
        this.loadPeriodOptions();
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

  get serviceDescription(): string {
    const item = this.catalogItem;
    if (!item) return '';
    return ((this.currentLang === 'en' ? item.descriptionEn : item.descriptionAr) || item.descriptionAr || item.descriptionEn || '').trim();
  }

  /** Pricing section heading follows the billing style it prices. */
  get pricingTitleKey(): string {
    switch (this.pricingStyle) {
      case 'Package': return 'd3.periodOption.title';
      case 'Transaction': return 'd3.transactionRate.title';
      case 'MessagePack': return 'd3.smsPricing.title';
      default: return 'd3.subscriptions.serviceSettings.steps.pricing.title';
    }
  }

  get pricingDescKey(): string {
    switch (this.pricingStyle) {
      case 'Package': return 'd3.periodOption.desc';
      case 'Transaction': return 'd3.transactionRate.desc';
      case 'MessagePack': return 'd3.smsPricing.desc';
      default: return `d3.billingFields.noPricing.${this.billing.billingModel}`;
    }
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

  fmtPrecise(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 4 });
  }

  // ── Permissions (hide what the admin can't do rather than wait for a 403) ──
  private hasPermission(code: string): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === code);
  }

  get canManageCatalog(): boolean {
    return this.hasPermission('subscriptions.managecatalog');
  }

  get canManagePricing(): boolean {
    return this.hasPermission('subscriptions.managepricing');
  }

  get canManageTiers(): boolean {
    return this.hasPermission('subscriptions.managetiers');
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

  // ── Billing (catalog billingModel / billingStyle / setup fee / trial) ──
  /** The form's current choice — the saved values are on catalogItem until Save. */
  billing: BillingFormValue = this.billingOf(null);

  private billingOf(item: SubscriptionCatalogItem | null): BillingFormValue {
    return {
      billingModel: item?.billingModel ?? 'Paid',
      billingStyle: item?.billingStyle ?? null,
      hasSetupFee: item?.hasSetupFee ?? false,
      setupFeePrice: item?.setupFeePrice ?? null,
      hasTrial: item?.hasTrial ?? false,
      trialDurationDays: item?.trialDurationDays ?? null,
      trialTransactionCount: item?.trialTransactionCount ?? null,
    };
  }

  get isPaidService(): boolean {
    return this.billing.billingModel === 'Paid';
  }

  /**
   * The backend locks the style once any pricing row or period option exists for the service.
   * Only a style that's actually saved can be locked: a service priced before styles existed
   * (old rows, no style yet) still has to get one picked, or it could never be saved.
   */
  get billingStyleLocked(): boolean {
    return !!this.catalogItem?.billingStyle && (this.servicePricing.length > 0 || this.serviceOptions.length > 0);
  }

  /**
   * The same check the overview counts as misconfigured, for this one service: a Paid service
   * with no active price, or a Free / BuiltIn one with active pricing or tiers left over.
   * Judged on the saved catalog values, not the unsaved form.
   */
  get misconfiguredKey(): string | null {
    const item = this.catalogItem;
    if (!item || this.loading) return null;
    const activeRows = this.servicePricing.some(p => p.isActive);
    const activeOptions = this.serviceOptions.some(o => o.isActive);
    if (item.billingModel !== 'Paid') {
      return activeRows || activeOptions || this.tiers.some(t => t.isActive)
        ? 'd3.subscriptions.serviceSettings.misconfigured.leftoverPricing'
        : null;
    }
    if (this.periodOptionsLoading) return null;
    const style = pricingStyleOf(item, this.servicePricing);
    const priced = style === 'Package' ? activeOptions
      : style === 'Transaction' ? this.transactionRates.length > 0
      : style === 'MessagePack' ? !!this.activePack
      : true;
    return priced ? null : 'd3.subscriptions.serviceSettings.misconfigured.noPrice';
  }

  get isBuiltInService(): boolean {
    return this.catalogItem?.billingModel === 'BuiltIn';
  }

  get billingError(): string | null {
    return billingFieldsError(this.billing);
  }

  /** Which pricing section is shown — follows the form, so a style picked before Save shows its section. */
  get pricingStyle(): PricingStyle {
    const item = this.catalogItem;
    if (!item) return 'none';
    return pricingStyleOf({ key: item.key, billingModel: this.billing.billingModel, billingStyle: this.billing.billingStyle }, this.servicePricing);
  }

  /** Prices can only be added once the style the form shows is the saved one. */
  get pricingNeedsSave(): boolean {
    const item = this.catalogItem;
    return !!item && (item.billingModel !== this.billing.billingModel || (item.billingStyle ?? null) !== this.billing.billingStyle);
  }

  private get savedBillingModel(): SubscriptionBillingModel {
    return this.catalogItem?.billingModel ?? 'Paid';
  }

  private get billingChanged(): boolean {
    const item = this.catalogItem;
    if (!item) return false;
    const now = billingRequestFields(this.billing);
    const saved = billingRequestFields(this.billingOf(item));
    return this.billing.billingModel !== item.billingModel
      || (Object.keys(now) as (keyof typeof now)[]).some(k => now[k] !== saved[k]);
  }

  // ── Integration fields (GET/POST /integration-fields, deactivate) ──
  integrationFields: SubscriptionIntegrationField[] = [];
  integrationLoading = false;
  deactivatingFieldId: number | null = null;

  fieldLabel(field: SubscriptionIntegrationField): string {
    return (this.currentLang === 'en' ? field.labelEn : field.labelAr) || field.key;
  }

  fieldTypeLabel(type: string): string {
    const key = `d3.subscriptions.serviceSettings.integration.types.${type}`;
    const translated = this.translate.instant(key);
    return translated === key ? type : translated;
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
    const item = this.catalogItem;
    if (!item) return;
    this.dialog.open(IntegrationFieldDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      data: {
        subscriptionServiceId: item.id,
        existingKeys: this.integrationFields.map(f => f.key),
      } as IntegrationFieldDialogData,
    }).afterClosed().subscribe((created?: SubscriptionIntegrationField) => {
      if (!created) return;
      this.integrationFields = [...this.integrationFields, created];
      this.toastr.success(this.translate.instant('d3.integrationField.saved'));
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

  /**
   * A message balance has no term, and some lines come back without dates at all — then the
   * start / expiry columns would only show "-" and "no expiry", so they're left out.
   */
  get showSubscriberDates(): boolean {
    if (this.pricingStyle === 'MessagePack') return false;
    return !this.subscribers.length || this.subscribers.some(s => s.startDate !== '-' || s.renewalDate !== '-');
  }

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
    return {
      name: property || merchant || '-',
      subtitle: property ? [merchant, s.propertyClassification?.trim()].filter(Boolean).join(' · ') : (s.propertyClassification?.trim() || ''),
      planLabel: [s.tierName?.trim(), periodText(s.periodLabel, s.period)].filter(Boolean).join(' · ') || '-',
      startDate: formatApiDateLocal(s.startDate, this.currentLang) ?? '-',
      renewalDate: formatApiDateLocal(s.expiresAt, this.currentLang) ?? '-',
      price: typeof s.price === 'number' ? s.price : null,
      statusLabel: s.statusLabel?.trim() || s.status || '-',
      isActive: (s.status ?? '').toLowerCase() === 'active',
      billingModel: s.billingModel ?? 'Paid',
    };
  }

  // ── Package: period options (GET/POST/PUT /period-options, deactivate) ──
  periodOptions: SubscriptionPeriodOption[] = [];
  periodOptionsLoading = false;
  deactivatingOptionId: number | null = null;

  private loadPeriodOptions(): void {
    if (!this.catalogItem) return;
    this.periodOptionsLoading = true;
    this.subscriptionsService.getPeriodOptions(this.catalogItem.id)
      .pipe(catchError(err => {
        this.toastr.error(resolveSubscriptionError(err, this.translate));
        return of([] as SubscriptionPeriodOption[]);
      }), takeUntilDestroyed(this.destroyRef))
      .subscribe(options => {
        this.serviceOptions = options ?? [];
        // Superseded and retired rows stay in the response for history; only the live offer is listed.
        this.periodOptions = this.serviceOptions
          .filter(o => o.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder || a.durationInDays - b.durationInDays);
        this.periodOptionsLoading = false;
      });
  }

  optionName(o: SubscriptionPeriodOption): string {
    return (this.currentLang === 'en' ? o.nameEn : o.nameAr) || o.nameAr || o.nameEn;
  }

  optionTierName(o: SubscriptionPeriodOption): string {
    return o.tierName?.trim() || this.tierNameById(o.subscriptionServiceTierId);
  }

  openPeriodOption(option?: SubscriptionPeriodOption): void {
    if (!this.catalogItem || !this.canManagePricing) return;
    this.ensureBillingSaved(() => this.openPeriodOptionDialog(option));
  }

  private openPeriodOptionDialog(option?: SubscriptionPeriodOption): void {
    const item = this.catalogItem;
    if (!item) return;
    const maxOrder = this.periodOptions.reduce((m, o) => Math.max(m, o.displayOrder), 0);
    this.dialog.open(PeriodOptionDialogComponent, {
      width: '560px',
      maxWidth: '94vw',
      data: {
        subscriptionServiceId: item.id,
        tiers: this.activeTiers,
        option: option ?? null,
        nextDisplayOrder: maxOrder + 10,
      } as PeriodOptionDialogData,
    }).afterClosed().subscribe(saved => {
      if (!saved) return;
      this.toastr.success(this.translate.instant('d3.periodOption.saved'));
      this.loadPeriodOptions();
    });
  }

  deactivatePeriodOption(option: SubscriptionPeriodOption): void {
    if (this.deactivatingOptionId !== null || !this.canManagePricing) return;
    this.dialog.open(OfferConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: 'd3.periodOption.deactivateTitle',
        message: 'd3.periodOption.deactivateMessage',
        confirmLabel: 'd3.periodOption.deactivate',
        icon: 'player-pause',
        tone: 'warning',
      } as OfferConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deactivatingOptionId = option.id;
      this.subscriptionsService.deactivatePeriodOption(option.id).subscribe({
        next: () => {
          this.deactivatingOptionId = null;
          this.loadPeriodOptions();
        },
        error: err => {
          this.deactivatingOptionId = null;
          this.toastr.error(resolveSubscriptionError(err, this.translate));
        },
      });
    });
  }

  // ── Transaction: per-operation rate (POST /pricing, period None) ──
  get transactionRates(): SubscriptionPricingItem[] {
    return this.servicePricing.filter(p => p.isActive && p.period === 'None');
  }

  rateTierName(row: SubscriptionPricingItem): string {
    return row.tierName?.trim() || this.tierNameById(row.subscriptionServiceTierId);
  }

  ratePercent(row: SubscriptionPricingItem): number | null {
    return row.usageUnitType === 'PercentageOfValue' && typeof row.usageUnitPrice === 'number' ? row.usageUnitPrice * 100 : null;
  }

  openTransactionRate(): void {
    if (!this.catalogItem || !this.canManagePricing) return;
    this.ensureBillingSaved(() => this.openTransactionRateDialog());
  }

  private openTransactionRateDialog(): void {
    const item = this.catalogItem;
    if (!item) return;
    this.dialog.open(PricingRowDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      data: {
        subscriptionServiceId: item.id,
        tiers: this.activeTiers,
        activeRates: this.transactionRates,
      } as PricingRowDialogData,
    }).afterClosed().subscribe(saved => {
      if (!saved) return;
      this.toastr.success(this.translate.instant('d3.pricingRow.saved'));
      this.reloadPricing();
    });
  }

  private reloadPricing(): void {
    const item = this.catalogItem;
    if (!item) return;
    this.subscriptionsService.getPricing().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: pricing => {
        this.servicePricing = pricing.filter(p => p.subscriptionServiceId === item.id);
        this.applyMessagePack();
      },
      error: err => this.toastr.error(resolveSubscriptionError(err, this.translate)),
    });
  }

  // ── MessagePack (POST /pricing, period MessagePack) ─────────
  /** Pack price; null = not priced yet. */
  packPrice: number | null = null;
  /** Messages in one pack — also the smallest top-up a merchant can buy. */
  messagesPerPack: number | null = null;

  private get activePack(): SubscriptionPricingItem | undefined {
    const packs = this.servicePricing.filter(p => p.isActive && p.period === 'MessagePack');
    return packs.find(p => p.subscriptionServiceTierId == null) ?? packs[0];
  }

  private applyMessagePack(): void {
    const pack = this.activePack;
    this.packPrice = pack?.price ?? null;
    this.messagesPerPack = pack?.messagesPerPack ?? null;
  }

  get packPriceInvalid(): boolean {
    return this.packPrice !== null && !(this.packPrice > 0);
  }

  get messagesPerPackInvalid(): boolean {
    const n = this.messagesPerPack;
    return n !== null && !(Number.isInteger(n) && n >= 1);
  }

  /** A pack row needs both values — one without the other can't be saved. */
  get packIncomplete(): boolean {
    return (this.packPrice === null) !== (this.messagesPerPack === null);
  }

  get pricePerMessage(): number | null {
    if (this.packPrice === null || this.messagesPerPack === null) return null;
    if (this.packPriceInvalid || this.messagesPerPackInvalid) return null;
    return this.packPrice / this.messagesPerPack;
  }

  private packPricingRequest(): Observable<unknown> | null {
    const item = this.catalogItem;
    if (!item || this.pricingStyle !== 'MessagePack' || this.packPrice === null || this.messagesPerPack === null) return null;
    const row = this.activePack;
    if (row && row.price === this.packPrice && row.messagesPerPack === this.messagesPerPack) return null;
    return this.subscriptionsService.setPricing({
      subscriptionServiceId: item.id,
      subscriptionServiceTierId: row?.subscriptionServiceTierId ?? null,
      period: 'MessagePack',
      price: this.packPrice,
      usageUnitType: null,
      usageUnitPrice: null,
      usageMaxFeeAmount: null,
      messagesPerPack: this.messagesPerPack,
      currencyCode: row?.currencyCode ?? 'SAR',
    });
  }

  get packInvalid(): boolean {
    return this.pricingStyle === 'MessagePack' && (this.packPriceInvalid || this.messagesPerPackInvalid || this.packIncomplete);
  }

  // ── Service details (name, description, logo, category, order) ──
  editDetails(): void {
    const item = this.catalogItem;
    if (!item) return;
    this.dialog.open(ServiceFormDialogComponent, {
      width: '760px',
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

  private emptyTier(): { key: string; nameAr: string; nameEn: string; isDefault: boolean } {
    return { key: '', nameAr: '', nameEn: '', isDefault: false };
  }

  tierName(t: SubscriptionTier): string {
    return (this.currentLang === 'en' ? t.nameEn : t.nameAr) || t.key;
  }

  private tierNameById(id: number | null): string {
    const tier = id === null ? this.tiers.find(t => t.isDefault) : this.tiers.find(t => t.id === id);
    return tier ? this.tierName(tier) : this.translate.instant('d3.pricingRow.defaultTier');
  }

  get activeTiers(): SubscriptionTier[] {
    return this.tiers.filter(t => t.isActive);
  }

  get newTierKeyInvalid(): boolean {
    const key = this.newTier.key.trim();
    return !!key && (!TIER_KEY_PATTERN.test(key) || this.tiers.some(t => t.key === key));
  }

  get canSaveTier(): boolean {
    const t = this.newTier;
    return !this.savingTier && !!t.key.trim() && !this.newTierKeyInvalid && !!t.nameAr.trim() && !!t.nameEn.trim();
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
    }).subscribe({
      next: () => {
        this.savingTier = false;
        this.addingTier = false;
        this.loadTiers();
      },
      error: err => {
        this.savingTier = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  // ── Save (state + billing via PUT /catalog, then the message pack price) ──
  goBack(): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'subscriptions', 'settings']);
  }

  private catalogRequest(): Observable<unknown> | null {
    const item = this.catalogItem;
    if (!item) return null;
    const stateChanged = this.serviceState !== this.originalState;
    if (!stateChanged && !this.billingChanged) return null;

    return this.subscriptionsService.updateCatalogItem(item.id, buildCatalogUpdate(item, {
      isActive: this.serviceState !== 'stopped',
      // Stopping a service doesn't touch isAvailable, so it comes back as it was when re-enabled.
      isAvailable: this.serviceState === 'stopped' ? item.isAvailable : this.serviceState === 'active',
      // null = leave unchanged; only sent when the admin actually switched it.
      billingModel: this.billing.billingModel !== item.billingModel ? this.billing.billingModel : null,
      ...billingRequestFields(this.billing),
    }));
  }

  /** Translation key of the warning to confirm before saving, or null when the type didn't change. */
  private get billingChangeWarningKey(): string | null {
    const from = this.savedBillingModel;
    const to = this.billing.billingModel;
    // Switching to Paid changes no data (free subscribers keep their snapshot), so it isn't
    // confirmed — only a switch that deactivates prices, period options and tiers is.
    if (from === to || to === 'Paid') return null;
    return from === 'Paid'
      ? 'd3.subscriptions.serviceSettings.billingChange.toFree'
      : 'd3.subscriptions.serviceSettings.billingChange.other';
  }

  /**
   * POST /pricing and /period-options check the style saved on the service, not the form's.
   * So adding a price first saves the billing part (PUT /catalog, after the usual type-change
   * confirmation) when the form differs, then runs `proceed` — one click instead of two.
   */
  private ensureBillingSaved(proceed: () => void): void {
    if (this.saving || !this.catalogItem) return;
    if (!this.pricingNeedsSave) {
      proceed();
      return;
    }
    const billingError = this.billingError;
    if (billingError) {
      this.toastr.error(this.translate.instant(billingError));
      return;
    }
    this.confirmBillingChange(() => {
      const catalog$ = this.catalogRequest() as Observable<SubscriptionCatalogItem> | null;
      if (!catalog$) {
        proceed();
        return;
      }
      this.saving = true;
      catalog$.subscribe({
        next: updated => {
          this.saving = false;
          const item = this.catalogItem;
          if (updated && item) {
            // The PUT answer has no feature list; keep the loaded one.
            this.catalogItem = { ...item, ...updated, features: item.features };
            this.serviceState = this.originalState = this.stateOf(this.catalogItem);
            this.billing = this.billingOf(this.catalogItem);
          }
          proceed();
        },
        error: err => {
          this.saving = false;
          this.toastr.error(resolveSubscriptionError(err, this.translate));
        },
      });
    });
  }

  /** Asks before a billing-model switch (it closes or reopens pricing), then runs `proceed`. */
  private confirmBillingChange(proceed: () => void): void {
    const warningKey = this.billingChangeWarningKey;
    if (!warningKey) {
      proceed();
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
      if (confirmed) proceed();
    });
  }

  saveSettings(): void {
    if (this.saving || !this.catalogItem) return;
    const billingError = this.billingError;
    if (billingError) {
      this.toastr.error(this.translate.instant(billingError));
      return;
    }
    if (this.packInvalid) {
      this.toastr.error(this.translate.instant('d3.subscriptions.serviceSettings.errors.invalidPrice'));
      return;
    }
    this.confirmBillingChange(() => this.runSave());
  }

  private runSave(): void {
    const catalog$ = this.catalogRequest();
    const pack$ = this.packPricingRequest();
    if (!catalog$ && !pack$) {
      this.goBack();
      return;
    }

    this.saving = true;
    // The catalog goes first: a service switched to paid only accepts a price once it is.
    (catalog$ ?? of(null)).subscribe({
      next: () => {
        if (!pack$) {
          this.finishSave(null, false);
          return;
        }
        pack$.pipe(catchError(err => of({ __error: err }))).subscribe(result => {
          const failed = (result as { __error?: unknown })?.__error;
          this.finishSave(failed ?? null, !!catalog$);
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
