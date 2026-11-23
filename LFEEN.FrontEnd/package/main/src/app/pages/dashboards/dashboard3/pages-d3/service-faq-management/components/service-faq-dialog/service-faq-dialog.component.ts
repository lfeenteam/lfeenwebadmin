import { Component, Inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/services/core.service';
import { wholeNumberValidator } from '../../../../utils/number-validators';
import {
  SERVICE_FAQ_ANSWER_MAX_LENGTH,
  SERVICE_FAQ_CATEGORY_OPTIONS,
  SERVICE_FAQ_KEY_MAX_LENGTH,
  SERVICE_FAQ_KEY_PATTERN,
  SERVICE_FAQ_ORDER_MAX,
  SERVICE_FAQ_QUESTION_MAX_LENGTH,
  SaveServiceFaqRequest,
  ServiceFaqCategory,
  ServiceFaqCategoryOption,
  ServiceFaqDto,
} from '../../interfaces/service-faq.model';
import { ServiceFaqFormField, parseServiceFaqError } from '../../interfaces/service-faq-error.util';
import { ServiceFaqService } from '../../services/service-faq.service';

export interface ServiceFaqDialogData {
  faq?: ServiceFaqDto;
  nextOrder: number;
}

/** Required + max length on the trimmed text, so whitespace-only input counts as empty. */
function trimmedText(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const length = String(control.value ?? '').trim().length;
    if (!length) return { required: true };
    if (length > max) return { maxlength: { requiredLength: max } };
    return null;
  };
}

type TextField = 'questionAr' | 'questionEn' | 'answerAr' | 'answerEn';

/**
 * Creates or updates the question itself and stays open until the server answers, so a
 * rejection keeps what was typed and shows the server's message beside the field.
 * Closes with the saved ServiceFaqDto (or 'notFound' when the row was deleted meanwhile).
 */
@Component({
  selector: 'app-service-faq-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, ReactiveFormsModule],
  templateUrl: './service-faq-dialog.component.html',
  styleUrls: [
    '../../../faq-management/components/add-faq-dialog/add-faq-dialog.component.scss',
    './service-faq-dialog.component.scss',
  ],
})
export class ServiceFaqDialogComponent {
  readonly categoryOptions = SERVICE_FAQ_CATEGORY_OPTIONS;
  readonly keyMax = SERVICE_FAQ_KEY_MAX_LENGTH;
  readonly questionMax = SERVICE_FAQ_QUESTION_MAX_LENGTH;
  readonly answerMax = SERVICE_FAQ_ANSWER_MAX_LENGTH;
  readonly orderMax = SERVICE_FAQ_ORDER_MAX;

  readonly dir = computed(() => this.coreService.getOptionsSignal()().dir);

  form: FormGroup;
  saving = false;
  /** A save error that no single field claims. */
  formError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private api: ServiceFaqService,
    private translate: TranslateService,
    private coreService: CoreService,
    public dialogRef: MatDialogRef<ServiceFaqDialogComponent, ServiceFaqDto | 'notFound'>,
    @Inject(MAT_DIALOG_DATA) public data: ServiceFaqDialogData,
  ) {
    const f = data.faq;
    this.form = this.fb.group({
      key: [f?.key ?? '', [Validators.maxLength(SERVICE_FAQ_KEY_MAX_LENGTH), Validators.pattern(SERVICE_FAQ_KEY_PATTERN)]],
      category: [f?.category ?? null as ServiceFaqCategory | null, Validators.required],
      questionAr: [f?.questionAr ?? '', trimmedText(SERVICE_FAQ_QUESTION_MAX_LENGTH)],
      questionEn: [f?.questionEn ?? '', trimmedText(SERVICE_FAQ_QUESTION_MAX_LENGTH)],
      answerAr: [f?.answerAr ?? '', trimmedText(SERVICE_FAQ_ANSWER_MAX_LENGTH)],
      answerEn: [f?.answerEn ?? '', trimmedText(SERVICE_FAQ_ANSWER_MAX_LENGTH)],
      displayOrder: [f?.displayOrder ?? data.nextOrder, [
        Validators.required,
        Validators.min(0),
        Validators.max(SERVICE_FAQ_ORDER_MAX),
        wholeNumberValidator,
      ]],
      isActive: [f?.isActive ?? true],
    });
  }

  get isEditMode(): boolean {
    return !!this.data.faq;
  }

  get selectedCategory(): ServiceFaqCategoryOption | undefined {
    const value = this.form.get('category')?.value;
    return this.categoryOptions.find(c => c.value === value);
  }

  selectCategory(value: ServiceFaqCategory): void {
    const control = this.form.get('category');
    control?.setValue(value);
    control?.markAsTouched();
  }

  showError(name: ServiceFaqFormField): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.touched || control.hasError('server'));
  }

  length(name: TextField | 'key'): number {
    return String(this.form.get(name)?.value ?? '').length;
  }

  /** The message under a field: the server's own text wins over the local rule. */
  fieldError(name: ServiceFaqFormField): string {
    const errors = this.form.get(name)?.errors;
    if (!errors) return '';
    if (errors['server']) return errors['server'];
    const t = (k: string, p?: object) => this.translate.instant(`d3.serviceFaq.dialog.validation.${k}`, p);
    if (name === 'key') {
      if (errors['pattern']) return t('keyPattern');
      if (errors['maxlength']) return t('maxLength', { max: SERVICE_FAQ_KEY_MAX_LENGTH });
      return '';
    }
    if (name === 'displayOrder') {
      if (errors['required']) return t('orderRequired');
      if (errors['min']) return t('orderMin');
      if (errors['max']) return t('orderMax', { max: SERVICE_FAQ_ORDER_MAX });
      if (errors['wholeNumber']) return t('orderWholeNumber');
      return '';
    }
    if (errors['required']) return t(`required.${name}`);
    if (errors['maxlength']) return t('maxLength', { max: errors['maxlength'].requiredLength });
    return '';
  }

  close(): void {
    if (!this.saving) this.dialogRef.close();
  }

  save(): void {
    if (this.saving) return;
    this.formError = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const key = String(v.key ?? '').trim();
    const body: SaveServiceFaqRequest = {
      // Blank key: on create the server generates one, on update it keeps the current one.
      ...(key ? { key } : {}),
      category: v.category,
      questionAr: v.questionAr.trim(),
      questionEn: v.questionEn.trim(),
      answerAr: v.answerAr.trim(),
      answerEn: v.answerEn.trim(),
      displayOrder: Number(v.displayOrder),
      isActive: !!v.isActive,
    };

    const request$ = this.data.faq ? this.api.update(this.data.faq.id, body) : this.api.create(body);

    this.saving = true;
    this.dialogRef.disableClose = true;
    request$
      .pipe(finalize(() => {
        this.saving = false;
        this.dialogRef.disableClose = false;
      }))
      .subscribe({
        next: dto => this.dialogRef.close(dto),
        error: err => this.applySaveError(err),
      });
  }

  private applySaveError(err: unknown): void {
    const parsed = parseServiceFaqError(err, this.translate);
    if (parsed.notFound && this.isEditMode) {
      this.dialogRef.close('notFound');
      return;
    }
    for (const [name, text] of Object.entries(parsed.fieldErrors)) {
      const control = this.form.get(name);
      // Cleared by the control's own validators on the next edit.
      control?.setErrors({ ...(control.errors ?? {}), server: text });
      control?.markAsTouched();
    }
    this.formError = parsed.message;
  }
}
