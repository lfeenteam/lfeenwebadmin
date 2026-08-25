import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AccountTypeFeeRule,
  IntegrationField,
  ServiceSubscribedFacility,
} from '../interfaces/subscription.model';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';

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

  selectState(state: ServiceState): void {
    this.serviceState = state;
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

  addIntegrationField(): void {
    const nextId = Math.max(0, ...this.integrationFields.map(f => f.id)) + 1;
    this.integrationFields.push({ id: nextId, name: '', dataType: '', required: false, isNew: true });
  }

  editIntegrationField(field: IntegrationField): void {
    field.isEditing = true;
  }

  removeIntegrationField(field: IntegrationField): void {
    this.integrationFields = this.integrationFields.filter(f => f.id !== field.id);
  }

  // ── Account type fee rules ─────────────────────────────────
  accountTypeRules: AccountTypeFeeRule[] = [
    { id: 1, icon: 'user', name: 'الأفراد وملاك العقار الواحد', desc: 'أصحاب الوحدة السكنية الواحدة', adjustmentPercent: 0, active: true },
    { id: 2, icon: 'building-skyscraper', name: 'الفنادق والمنتجعات السياحية', desc: 'منشآت فندقية مصنفة رسمياً', adjustmentPercent: 20, active: true },
    { id: 3, icon: 'briefcase', name: 'المؤسسات والشركات الكبرى', desc: 'إدارة عقارات متعددة المواقع', adjustmentPercent: 15, active: true },
    { id: 4, icon: 'rocket', name: 'المنشآت الناشئة والمشاريع الصغيرة', desc: 'حديثو التسجيل، أقل من سنة', adjustmentPercent: -10, active: false },
  ];

  newRuleName = '';
  newRulePercent = 0;
  newRuleActive = true;
  newRuleIconPreview: string | null = null;
  showNewRuleRow = false;

  toggleAddRuleRow(): void {
    this.showNewRuleRow = !this.showNewRuleRow;
    this.newRuleIconPreview = null;
  }

  onRuleIconSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.newRuleIconPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  addAccountTypeRule(): void {
    const name = this.newRuleName.trim();
    if (!name) return;
    const nextId = Math.max(0, ...this.accountTypeRules.map(r => r.id)) + 1;
    this.accountTypeRules.push({
      id: nextId,
      icon: 'building',
      iconImage: this.newRuleIconPreview ?? undefined,
      name,
      desc: '',
      adjustmentPercent: this.newRulePercent,
      active: this.newRuleActive,
    });
    this.newRuleName = '';
    this.newRulePercent = 0;
    this.newRuleActive = true;
    this.newRuleIconPreview = null;
    this.showNewRuleRow = false;
  }

  editAccountTypeRule(rule: AccountTypeFeeRule): void {
    rule.isEditing = true;
  }

  removeAccountTypeRule(rule: AccountTypeFeeRule): void {
    this.accountTypeRules = this.accountTypeRules.filter(r => r.id !== rule.id);
  }

  toggleAccountTypeRule(rule: AccountTypeFeeRule): void {
    rule.active = !rule.active;
  }

  // ── Subscribed facilities ──────────────────────────────────
  subscribedFacilities: ServiceSubscribedFacility[] = [
    { id: 1, name: 'فندق الريتز كارلتون', classificationLabel: 'تصنيف فندقي 5 نجوم', icon: 'building-skyscraper', plan: 'annualAdvanced', subscribeDate: new Date(2024, 6, 14), startDate: new Date(2025, 6, 4), amountPaid: 1450, status: 'active' },
    { id: 2, name: 'شقق لاند مارك الفاخرة', classificationLabel: 'تصنيف شقق مفروشة', icon: 'building', plan: 'monthly', subscribeDate: new Date(2024, 6, 1), startDate: new Date(2025, 6, 1), amountPaid: 150, status: 'active' },
    { id: 3, name: 'فندق الموسم الدولي', classificationLabel: 'تصنيف فندق 4 نجوم', icon: 'building-skyscraper', plan: 'annualTrial', subscribeDate: new Date(2024, 7, 10), startDate: new Date(2024, 7, 10), amountPaid: null, status: 'trial' },
  ];

  get filteredFacilities(): ServiceSubscribedFacility[] {
    const q = this.facilitySearch.trim();
    if (!q) return this.subscribedFacilities;
    return this.subscribedFacilities.filter(f => f.name.includes(q));
  }

  onFacilitySearchChange(value: string): void {
    this.facilitySearch = value;
  }

  // ── Default pricing ─────────────────────────────────────────
  defaultMonthlyPrice = 150;
  defaultAnnualPrice = 1450;
  vatIncluded = true;

  // ── Free trial settings ─────────────────────────────────────
  trialEnabled = true;
  trialDurationDays = 14;
  trialDurationOptions = [7, 14, 30];

  setTrialDuration(days: number): void {
    this.trialDurationDays = days;
  }

  goBack(): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'subscriptions', 'settings']);
  }

  saveSettings(): void {
    this.goBack();
  }
}
