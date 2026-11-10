import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import {
  SubscriptionBillingModel,
  SubscriptionCatalogItem,
} from '../interfaces/subscription.model';
import { SUBSCRIPTION_CATEGORY_KEYS, categoryKeyFromLabel } from '../interfaces/service-visual.util';
import { buildCatalogUpdate } from '../interfaces/catalog-update.util';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { BillingFormValue, billingFieldsError, billingRequestFields } from '../interfaces/billing-fields.util';
import { BillingFieldsComponent } from '../billing-fields/billing-fields.component';

/** `create` = POST /catalog, billing setup included. `edit` = PUT /catalog/{id} for the
 *  descriptive fields only — state and billing stay on the service settings page. */
export type ServiceFormDialogData =
  | { mode: 'create' }
  | { mode: 'edit'; item: SubscriptionCatalogItem };

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const KEY_MAX = 50;
const URL_PATTERN = /^https?:\/\/\S+$/i;

@Component({
  selector: 'app-service-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule, BillingFieldsComponent],
  templateUrl: './service-form-dialog.component.html',
  styleUrls: [
    '../subscription-discount-codes/create-discount-code-dialog/create-discount-code-dialog.component.scss',
    './service-form-dialog.component.scss',
  ],
})
export class ServiceFormDialogComponent {
  private translate = inject(TranslateService);
  private service = inject(SubscriptionsService);

  readonly categories = SUBSCRIPTION_CATEGORY_KEYS;
  readonly billingModels: SubscriptionBillingModel[] = ['Paid', 'Free', 'BuiltIn'];
  readonly keyMax = KEY_MAX;

  key = '';
  nameAr = '';
  nameEn = '';
  descriptionAr = '';
  descriptionEn = '';
  category: string | null = null;
  logoUrl = '';
  isAvailable = false;
  displayOrder: number | null = null;

  /** Create only — on edit, billing is changed from the service settings page. */
  billing: BillingFormValue = {
    billingModel: 'Paid',
    billingStyle: null,
    hasSetupFee: false,
    setupFeePrice: null,
    hasTrial: false,
    trialDurationDays: null,
    trialTransactionCount: null,
  };

  submitting = false;
  serverError = '';

  constructor(
    public dialogRef: MatDialogRef<ServiceFormDialogComponent, SubscriptionCatalogItem>,
    @Inject(MAT_DIALOG_DATA) public data: ServiceFormDialogData,
  ) {
    if (data.mode === 'edit') {
      const item = data.item;
      this.key = item.key;
      this.nameAr = item.nameAr;
      this.nameEn = item.nameEn;
      this.descriptionAr = item.descriptionAr ?? '';
      this.descriptionEn = item.descriptionEn ?? '';
      this.category = categoryKeyFromLabel(item.categoryLabel);
      this.logoUrl = item.logoUrl ?? '';
      this.displayOrder = item.displayOrder;
    }
  }

  get isEdit(): boolean {
    return this.data.mode === 'edit';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  /** The category the backend sent couldn't be matched to a known key — keep it rather than overwrite it. */
  get unknownCategoryLabel(): string | null {
    if (this.data.mode !== 'edit' || this.category) return null;
    return this.data.item.categoryLabel || null;
  }

  // ── Validation (mirrors the backend so the form says what's wrong first) ──
  get keyError(): string | null {
    if (this.isEdit) return null;
    const key = this.key.trim();
    if (!key) return null;
    return key.length > KEY_MAX || !KEY_PATTERN.test(key) ? 'd3.serviceForm.errors.key' : null;
  }

  get logoError(): boolean {
    const url = this.logoUrl.trim();
    return !!url && !URL_PATTERN.test(url);
  }

  get displayOrderInvalid(): boolean {
    return this.isEdit && (this.displayOrder === null || !Number.isInteger(this.displayOrder) || this.displayOrder < 0);
  }

  get canSubmit(): boolean {
    return !this.submitting
      && !!this.nameAr.trim() && !!this.nameEn.trim()
      && (this.isEdit || (!!this.key.trim() && !this.keyError && !billingFieldsError(this.billing)))
      && !this.logoError && !this.displayOrderInvalid;
  }

  categoryLabel(key: string): string {
    const k = `d3.subscriptionCategories.${key}`;
    const t = this.translate.instant(k);
    return t === k ? key : t;
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.serverError = '';

    const text = (v: string) => v.trim() || null;
    const request$ = this.data.mode === 'edit'
      ? this.service.updateCatalogItem(this.data.item.id, buildCatalogUpdate(this.data.item, {
          nameAr: this.nameAr.trim(),
          nameEn: this.nameEn.trim(),
          descriptionAr: text(this.descriptionAr),
          descriptionEn: text(this.descriptionEn),
          // An unmatched category is left to buildCatalogUpdate, which resends what the API returned.
          ...(this.category ? { category: this.category } : {}),
          logoUrl: text(this.logoUrl),
          displayOrder: this.displayOrder ?? this.data.item.displayOrder,
        }))
      : this.service.createCatalogItem({
          key: this.key.trim(),
          nameAr: this.nameAr.trim(),
          nameEn: this.nameEn.trim(),
          descriptionAr: text(this.descriptionAr),
          descriptionEn: text(this.descriptionEn),
          category: this.category,
          logoUrl: text(this.logoUrl),
          isAvailable: this.isAvailable,
          billingModel: this.billing.billingModel,
          ...billingRequestFields(this.billing),
        });

    request$.subscribe({
      next: saved => {
        this.submitting = false;
        this.dialogRef.close(saved);
      },
      error: err => {
        this.submitting = false;
        this.serverError = resolveSubscriptionError(err, this.translate);
      },
    });
  }

  close(): void {
    if (this.submitting) return;
    this.dialogRef.close();
  }
}
