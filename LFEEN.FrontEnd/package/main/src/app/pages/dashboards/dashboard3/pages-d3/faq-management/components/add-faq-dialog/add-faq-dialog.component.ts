import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FAQ_DEPARTMENT_OPTIONS, FaqArticle, FaqDepartment, FaqDepartmentOption } from '../../interfaces/faq.model';

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

  selectedDept: FaqDepartmentOption | null = null;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddFaqDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { article?: FaqArticle; nextOrder: number }
  ) {
    this.faqForm = this.fb.group({
      titleEn: [this.data.article?.titleEn || '', [Validators.required, Validators.minLength(2)]],
      titleAr: [this.data.article?.titleAr || '', [Validators.required, Validators.minLength(2)]],
      contentEn: [this.data.article?.contentEn || ''],
      contentAr: [this.data.article?.contentAr || ''],
      order: [this.data.article?.order ?? this.data.nextOrder, [Validators.required, Validators.min(1)]],
    });

    if (this.data.article?.department) {
      this.selectedDept = this.departmentOptions.find(d => d.value === this.data.article!.department) || null;
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

  clear(): void {
    this.faqForm.reset({ titleEn: '', titleAr: '', contentEn: '', contentAr: '', order: this.data.nextOrder });
    this.selectedDept = null;
  }

  save(): void {
    if (this.faqForm.invalid) {
      this.faqForm.markAllAsTouched();
      return;
    }

    const value = this.faqForm.value;
    const result: Omit<FaqArticle, 'externalId' | 'status'> & { status?: FaqArticle['status'] } = {
      titleEn: value.titleEn.trim(),
      titleAr: value.titleAr.trim(),
      contentEn: (value.contentEn || '').trim(),
      contentAr: (value.contentAr || '').trim(),
      order: Number(value.order),
      department: (this.selectedDept?.value as FaqDepartment) ?? null,
      status: this.data.article?.status ?? 'active',
    };

    this.dialogRef.close(result);
  }
}
