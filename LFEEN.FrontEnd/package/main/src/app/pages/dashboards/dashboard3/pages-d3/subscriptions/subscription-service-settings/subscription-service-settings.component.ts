import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  IntegrationField,
  ServiceOperationPricing,
  ServiceSubscribedFacility,
} from '../interfaces/subscription.model';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';

interface ServiceMeta {
  icon: string;
  tone: 'green' | 'blue' | 'purple' | 'orange';
}

type ServiceState = 'stopped' | 'renewalStopped' | 'suspended' | 'active';

const SERVICE_META: Record<string, ServiceMeta> = {
  whatsappMuqam: { icon: 'brand-whatsapp', tone: 'green' },
  rasd: { icon: 'map-pin', tone: 'blue' },
  whatsappBusiness: { icon: 'brand-whatsapp', tone: 'green' },
  zatca: { icon: 'receipt', tone: 'purple' },
  payments: { icon: 'credit-card', tone: 'blue' },
  sms: { icon: 'message-2', tone: 'orange' },
};

@Component({
  selector: 'app-subscription-service-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './subscription-service-settings.component.html',
  styleUrl: './subscription-service-settings.component.scss'
})
export class SubscriptionServiceSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private subscriptionsService = inject(SubscriptionsService);

  private subscriptionServiceId: number | null = null;
  private originalMonthlyPrice: number | null = null;
  private originalAnnualPrice: number | null = null;

  serviceId = '';
  serviceIcon = 'settings';
  serviceTone: ServiceMeta['tone'] = 'green';

  facilitySearch = '';

  // ── Service state control ───────────────────────────────────
  serviceState: ServiceState = 'active';

  stateOptions: { value: ServiceState; icon: string; labelKey: string; descKey: string }[] = [
    { value: 'active', icon: 'player-play', labelKey: 'd3.subscriptions.serviceSettings.state.active', descKey: 'd3.subscriptions.serviceSettings.state.activeDesc' },
    { value: 'suspended', icon: 'player-pause', labelKey: 'd3.subscriptions.serviceSettings.state.suspended', descKey: 'd3.subscriptions.serviceSettings.state.suspendedDesc' },
    { value: 'renewalStopped', icon: 'repeat-off', labelKey: 'd3.subscriptions.serviceSettings.state.renewalStopped', descKey: 'd3.subscriptions.serviceSettings.state.renewalStoppedDesc' },
    { value: 'stopped', icon: 'ban', labelKey: 'd3.subscriptions.serviceSettings.state.stopped', descKey: 'd3.subscriptions.serviceSettings.state.stoppedDesc' },
  ];

  get currentStateOption() {
    return this.stateOptions.find(o => o.value === this.serviceState) ?? this.stateOptions[0];
  }

  get isActive(): boolean {
    return this.serviceState === 'active';
  }

  get showDurationSettings(): boolean {
    return this.serviceState === 'suspended' || this.serviceState === 'renewalStopped';
  }

  durationOptions = [
    { value: 7, labelKey: 'd3.subscriptions.serviceSettings.state.oneWeek' },
    { value: 14, labelKey: 'd3.subscriptions.serviceSettings.state.twoWeeks' },
    { value: 30, labelKey: 'd3.subscriptions.serviceSettings.state.oneMonth' },
  ];

  selectedDurationDays = 7;
  appliedDurationDays = 7;

  confirmDurationChange(): void {
    this.appliedDurationDays = this.selectedDurationDays;
  }

  ngOnInit(): void {
    this.serviceId = this.route.snapshot.paramMap.get('id') || 'whatsappBusiness';
    const meta = SERVICE_META[this.serviceId] ?? SERVICE_META['whatsappBusiness'];
    this.serviceIcon = meta.icon;
    this.serviceTone = meta.tone;

    forkJoin({
      catalog: this.subscriptionsService.getCatalog(),
      pricing: this.subscriptionsService.getPricing(),
    }).subscribe(({ catalog, pricing }) => {
      const catalogItem = catalog.find(c => c.key === this.serviceId);
      if (!catalogItem) return;

      this.subscriptionServiceId = catalogItem.id;
      const monthly = pricing.find(p => p.subscriptionServiceId === catalogItem.id && p.period === 'Monthly' && p.isActive);
      const annual = pricing.find(p => p.subscriptionServiceId === catalogItem.id && p.period === 'Yearly' && p.isActive);

      this.originalMonthlyPrice = monthly ? monthly.price : null;
      this.originalAnnualPrice = annual ? annual.price : null;
      this.defaultMonthlyPrice = this.originalMonthlyPrice ?? 0;
      this.defaultAnnualPrice = this.originalAnnualPrice ?? 0;
    });
  }

  get serviceNameKey(): string {
    return `d3.subscriptions.settings.services.${this.serviceId}.name`;
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.translate.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconAlt(): string {
    return this.translate.currentLang === 'en' ? 'SAR' : 'ريال سعودي';
  }

  get currencyIconEn(): boolean {
    return this.translate.currentLang === 'en';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.translate.currentLang);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // ── Integration fields ────────────────────────────────────
  integrationFields: IntegrationField[] = [
    { id: 1, name: 'المفتاح الأساسي للـ API (Key API)', dataType: 'نص مشفر سري (Encrypted Secret)', required: true },
    { id: 2, name: 'رقم تعريف الحساب (Client ID)', dataType: 'نص عادي (Text String)', required: true },
    { id: 3, name: 'رابط الـ Webhook للإشعارات المباشرة', dataType: 'رابط إنترنت (URL Format)', required: false },
  ];

  editIntegrationField(field: IntegrationField): void {
    field.isEditing = true;
  }

  removeIntegrationField(field: IntegrationField): void {
    this.integrationFields = this.integrationFields.filter(f => f.id !== field.id);
  }

  // ── Subscribed facilities ──────────────────────────────────
  // No backend endpoint currently returns per-service subscriber lists (see subscriptions API
  // guide) — left empty so the template's existing empty state renders instead of fake data.
  subscribedFacilities: ServiceSubscribedFacility[] = [];

  get filteredFacilities(): ServiceSubscribedFacility[] {
    const q = this.facilitySearch.trim();
    if (!q) return this.subscribedFacilities;
    return this.subscribedFacilities.filter(f => f.name.includes(q));
  }

  onFacilitySearchChange(value: string): void {
    this.facilitySearch = value;
  }

  // ── Operations & subscriptions pricing ─────────────────────
  // The pricing API only exposes one setup/usage fee per (service, tier, period) — there's no
  // per-operation-type breakdown to back this table, so it's left empty (existing empty state).
  operationPricing: ServiceOperationPricing[] = [];

  operationSearch = '';

  get filteredOperationPricing(): ServiceOperationPricing[] {
    const q = this.operationSearch.trim();
    if (!q) return this.operationPricing;
    return this.operationPricing.filter(p => this.translate.instant(p.nameKey).includes(q));
  }

  onOperationSearchChange(value: string): void {
    this.operationSearch = value;
  }

  // ── Default pricing ─────────────────────────────────────────
  defaultMonthlyPrice = 150;
  defaultAnnualPrice = 1450;
  vatIncluded = true;

  // ── Free trial settings ─────────────────────────────────────
  trialEnabled = true;
  trialDurationDays = 14;
  trialDurationOptions = [7, 14, 30];
  trialSetupFee: number | null = null;

  setTrialDuration(days: number): void {
    this.trialDurationDays = days;
  }

  goBack(): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'subscriptions', 'settings']);
  }

  saveSettings(): void {
    if (this.subscriptionServiceId === null) {
      this.goBack();
      return;
    }

    const calls = [];
    if (this.defaultMonthlyPrice !== this.originalMonthlyPrice) {
      calls.push(this.subscriptionsService.setPrice(this.subscriptionServiceId, 'Monthly', this.defaultMonthlyPrice));
    }
    if (this.defaultAnnualPrice !== this.originalAnnualPrice) {
      calls.push(this.subscriptionsService.setPrice(this.subscriptionServiceId, 'Yearly', this.defaultAnnualPrice));
    }

    if (calls.length === 0) {
      this.goBack();
      return;
    }

    forkJoin(calls).subscribe(() => this.goBack());
  }
}
