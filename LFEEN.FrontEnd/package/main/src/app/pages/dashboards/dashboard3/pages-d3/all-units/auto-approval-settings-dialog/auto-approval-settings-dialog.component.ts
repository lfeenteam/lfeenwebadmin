import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { UnitsService } from '../../../services/units.service';
import { UnitAutoApprovalSettings } from '../../../interfaces/unit-card.model';

type SettingsField = 'pricingTolerancePercent' | 'depositTolerancePercent';

// Sample "last-approved" values used only to illustrate the accepted range under each input.
const EXAMPLE_BASE: Record<SettingsField, number> = {
  pricingTolerancePercent: 100,
  depositTolerancePercent: 1000,
};

@Component({
  selector: 'app-auto-approval-settings-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './auto-approval-settings-dialog.component.html',
  styleUrl: './auto-approval-settings-dialog.component.scss'
})
export class AutoApprovalSettingsDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<AutoApprovalSettingsDialogComponent, UnitAutoApprovalSettings | undefined>);
  private unitsService = inject(UnitsService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);

  readonly fields: SettingsField[] = ['pricingTolerancePercent', 'depositTolerancePercent'];

  readonly form = this.fb.group({
    pricingTolerancePercent: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    depositTolerancePercent: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
  });

  isLoading = true;
  loadFailed = false;
  submitting = false;
  updatedAtUtc: string | null = null;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get canSubmit(): boolean {
    return !this.isLoading && !this.loadFailed && !this.submitting && this.form.valid && this.form.dirty;
  }

  get updatedAtLabel(): string {
    if (!this.updatedAtUtc) return '—';
    const date = new Date(this.updatedAtUtc);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.form.disable();

    this.unitsService.getAutoApprovalSettings().subscribe({
      next: settings => {
        this.applySettings(settings);
        this.isLoading = false;
        this.form.enable();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.loadFailed = true;
        this.toastr.error(this.translate.instant(this.errorKey(err)));
      },
    });
  }

  hasError(field: SettingsField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  /** "100 → 75 – 125" for the sample base value, or null while the input isn't a valid percentage. */
  exampleRange(field: SettingsField): { base: string; min: string; max: string } | null {
    const control = this.form.controls[field];
    const percent = control.value;
    if (percent === null || control.invalid) return null;

    const base = EXAMPLE_BASE[field];
    const delta = (base * percent) / 100;
    return { base: this.fmt(base), min: this.fmt(base - delta), max: this.fmt(base + delta) };
  }

  close(result?: UnitAutoApprovalSettings): void {
    this.dialogRef.close(result);
  }

  save(): void {
    if (!this.canSubmit) {
      this.form.markAllAsTouched();
      return;
    }

    const { pricingTolerancePercent, depositTolerancePercent } = this.form.getRawValue();
    this.submitting = true;
    this.dialogRef.disableClose = true;

    // Always send BOTH fields — the PUT replaces the whole row and zeroes any field left out.
    this.unitsService.updateAutoApprovalSettings({
      pricingTolerancePercent: pricingTolerancePercent!,
      depositTolerancePercent: depositTolerancePercent!,
    }).subscribe({
      next: saved => {
        this.submitting = false;
        this.dialogRef.disableClose = false;
        // Refresh from the response so the form always mirrors what the server stored.
        this.applySettings(saved);
        this.toastr.success(this.translate.instant('d3.allUnits.autoApproval.saved'));
        this.close(saved);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting = false;
        this.dialogRef.disableClose = false;
        this.toastr.error(this.translate.instant(this.errorKey(err)));
      },
    });
  }

  private applySettings(settings: UnitAutoApprovalSettings): void {
    this.form.reset({
      pricingTolerancePercent: settings.pricingTolerancePercent,
      depositTolerancePercent: settings.depositTolerancePercent,
    });
    this.updatedAtUtc = settings.updatedAtUtc;
  }

  // Branch on errorCode, never on message. A 401 has no JSON body at all.
  private errorKey(err: HttpErrorResponse): string {
    if (err?.error?.errorCode === 'VALIDATION_ERROR') return 'd3.allUnits.autoApproval.errors.validation';
    if (err?.status === 403) return 'd3.allUnits.autoApproval.errors.forbidden';
    if (!err?.status || err.status >= 500) return 'd3.allUnits.autoApproval.errors.network';
    return 'd3.toast.errorOp';
  }

  private fmt(value: number): string {
    return value.toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
  }
}
