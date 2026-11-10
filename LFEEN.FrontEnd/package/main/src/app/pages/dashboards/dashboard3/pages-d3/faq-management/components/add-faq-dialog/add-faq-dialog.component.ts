import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AbstractControl, FormBuilder, FormGroup, Validators, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';
import {
  FAQ_BODY_MAX_LENGTH,
  FAQ_DEPARTMENT_OPTIONS,
  FAQ_TITLE_MAX_LENGTH,
  FAQ_TITLE_MIN_LENGTH,
  CreateFaqArticleRequest,
  FaqArticle,
  FaqArticleDto,
  FaqDepartmentOption
} from '../../interfaces/faq.model';
import { FaqFormField, parseFaqSaveError } from '../../interfaces/faq-error.util';
import { FaqService } from '../../services/faq.service';

/** Length rules on the trimmed text, so whitespace-only input counts as empty. */
function trimmedText(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = String(control.value ?? '').trim().length;
    if (!length) return { required: true };
    if (length < min) return { minlength: { requiredLength: min } };
    if (length > max) return { maxlength: { requiredLength: max } };
    return null;
  };
}

const REQUIRED_KEYS: Record<Exclude<FaqFormField, 'order'>, string> = {
  titleAr: 'd3.faq.dialog.validation.titleArRequired',
  titleEn: 'd3.faq.dialog.validation.titleEnRequired',
  contentAr: 'd3.faq.dialog.validation.contentArRequired',
  contentEn: 'd3.faq.dialog.validation.contentEnRequired'
};

/**
 * Creates or updates the article itself and stays open until the server answers, so a
 * rejection keeps what was typed and shows the server's message beside the field.
 * Closes with the saved FaqArticleDto.
 */
@Component({
  selector: 'app-add-faq-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, ReactiveFormsModule],
  templateUrl: './add-faq-dialog.component.html',
  styleUrl: './add-faq-dialog.component.scss'
})
export class AddFaqDialogComponent {
  faqForm: FormGroup;
  readonly departmentOptions = FAQ_DEPARTMENT_OPTIONS;
  readonly titleMax = FAQ_TITLE_MAX_LENGTH;
  readonly bodyMax = FAQ_BODY_MAX_LENGTH;

  selectedDept: FaqDepartmentOption | null = null;
  saving = false;
  /** A save error that no single field claims. */
  formError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private faqService: FaqService,
    private translate: TranslateService,
    public dialogRef: MatDialogRef<AddFaqDialogComponent, FaqArticleDto>,
    @Inject(MAT_DIALOG_DATA) public data: { article?: FaqArticle; nextOrder: number }
  ) {
    const title = trimmedText(FAQ_TITLE_MIN_LENGTH, FAQ_TITLE_MAX_LENGTH);
    const body = trimmedText(1, FAQ_BODY_MAX_LENGTH);
    this.faqForm = this.fb.group({
      titleEn: [this.data.article?.titleEn || '', title],
      titleAr: [this.data.article?.titleAr || '', title],
      contentEn: [this.data.article?.contentEn || '', body],
      contentAr: [this.data.article?.contentAr || '', body],
      order: [this.data.article?.order ?? this.data.nextOrder, [Validators.required, Validators.min(1)]],
    });

    if (this.data.article?.department) {
      const department = this.data.article.department;
      this.selectedDept = this.departmentOptions.find(d => d.value === department) ?? {
        value: department,
        labelEn: department,
        labelAr: department,
      };
    }
  }

  get isEditMode(): boolean {
    return !!this.data.article;
  }

  selectDepartment(dept: FaqDepartmentOption | null): void {
    this.selectedDept = dept;
  }

  deptDisplay(dept: FaqDepartmentOption): string {
    return `${dept.labelEn} — ${dept.labelAr}`;
  }

  showError(name: FaqFormField): boolean {
    const control = this.faqForm.get(name);
    return !!control && control.invalid && (control.touched || control.hasError('server'));
  }

  /** The message under a text field: the server's own text wins over the local rule. */
  fieldError(name: Exclude<FaqFormField, 'order'>): string {
    const errors = this.faqForm.get(name)?.errors;
    if (!errors) return '';
    if (errors['server']) return errors['server'];
    if (errors['required']) return this.translate.instant(REQUIRED_KEYS[name]);
    if (errors['minlength']) {
      return this.translate.instant('d3.faq.dialog.validation.minLength', { min: errors['minlength'].requiredLength });
    }
    if (errors['maxlength']) {
      return this.translate.instant('d3.faq.dialog.validation.maxLength', { max: errors['maxlength'].requiredLength });
    }
    return '';
  }

  orderError(): string {
    const errors = this.faqForm.get('order')?.errors;
    if (!errors) return '';
    if (errors['server']) return errors['server'];
    return this.translate.instant(errors['min'] ? 'd3.faq.dialog.validation.orderMin' : 'd3.faq.dialog.validation.orderRequired');
  }

  length(name: Exclude<FaqFormField, 'order'>): number {
    return String(this.faqForm.get(name)?.value ?? '').length;
  }

  clear(): void {
    this.faqForm.reset({ titleEn: '', titleAr: '', contentEn: '', contentAr: '', order: this.data.nextOrder });
    this.selectedDept = null;
    this.formError = null;
  }

  close(): void {
    if (!this.saving) this.dialogRef.close();
  }

  save(): void {
    if (this.saving) return;
    this.formError = null;
    if (this.faqForm.invalid) {
      this.faqForm.markAllAsTouched();
      return;
    }

    const value = this.faqForm.value;
    const payload: CreateFaqArticleRequest = {
      titleEn: value.titleEn.trim(),
      titleAr: value.titleAr.trim(),
      bodyEn: value.contentEn.trim(),
      bodyAr: value.contentAr.trim(),
      department: this.selectedDept?.value ?? null,
      displayOrder: Number(value.order),
    };

    const request$ = this.data.article
      ? this.faqService.updateArticle(this.data.article.externalId, payload)
      : this.faqService.createArticle(payload);

    this.saving = true;
    this.dialogRef.disableClose = true;
    request$
      .pipe(
        finalize(() => {
          this.saving = false;
          this.dialogRef.disableClose = false;
        })
      )
      .subscribe({
        next: dto => this.dialogRef.close(dto),
        error: err => this.applySaveError(err)
      });
  }

  private applySaveError(err: unknown): void {
    const { fieldErrors, message } = parseFaqSaveError(err, this.translate);
    for (const [name, text] of Object.entries(fieldErrors)) {
      const control = this.faqForm.get(name);
      // Cleared by the control's own validators on the next edit.
      control?.setErrors({ ...(control.errors ?? {}), server: text });
      control?.markAsTouched();
    }
    this.formError = message;
  }
}
