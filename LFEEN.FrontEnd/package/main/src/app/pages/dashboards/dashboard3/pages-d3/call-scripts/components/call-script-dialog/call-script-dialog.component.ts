import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CallScript, CallScriptScenarioType } from '../../interfaces/call-script.model';

export interface CallScriptDialogData {
  /** The fixed scenario values the API accepts — used only to populate the picker. */
  scenarios: CallScriptScenarioType[];
  /** Present when editing an existing script; absent when creating a new one. */
  script?: CallScript;
}

export interface CallScriptDialogResult {
  scenarioType: CallScriptScenarioType;
  audioFileUrl: string;
  options: { digit: string; description: string; responseMessageFileUrl: string | null }[];
  isActive: boolean;
}

@Component({
  selector: 'app-call-script-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, ReactiveFormsModule],
  templateUrl: './call-script-dialog.component.html',
  styleUrl: './call-script-dialog.component.scss'
})
export class CallScriptDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CallScriptDialogComponent, CallScriptDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: CallScriptDialogData
  ) {
    const seedOptions = this.data.script?.options?.length
      ? this.data.script.options
      : [{ digit: '', description: '', responseMessageFileUrl: null }];

    this.form = this.fb.group({
      // Fixed at creation and not part of the update payload — locked once a script exists.
      scenarioType: [{ value: this.data.script?.scenarioType || '', disabled: this.isEditMode }, [Validators.required]],
      audioFileUrl: [this.data.script?.audioFileUrl || '', [Validators.required]],
      isActive: [this.data.script?.isActive ?? false],
      options: this.fb.array(seedOptions.map(o => this.buildOptionGroup(o))),
    });
  }

  get isEditMode(): boolean {
    return !!this.data.script;
  }

  get options(): FormArray {
    return this.form.get('options') as FormArray;
  }

  private buildOptionGroup(o?: { digit: string; description: string; responseMessageFileUrl?: string | null }): FormGroup {
    return this.fb.group({
      digit: [o?.digit || '', Validators.required],
      description: [o?.description || '', Validators.required],
      responseMessageFileUrl: [o?.responseMessageFileUrl || ''],
    });
  }

  addOption(): void {
    this.options.push(this.buildOptionGroup());
  }

  // The IVR provider requires at least one menu item, so the last row can't be removed.
  removeOption(index: number): void {
    if (this.options.length <= 1) return;
    this.options.removeAt(index);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // getRawValue() (not .value) so the disabled scenarioType control is still included in edit mode.
    const value = this.form.getRawValue();
    const result: CallScriptDialogResult = {
      scenarioType: value.scenarioType,
      audioFileUrl: value.audioFileUrl.trim(),
      options: value.options.map((o: { digit: string; description: string; responseMessageFileUrl: string }) => ({
        digit: o.digit.trim(),
        description: o.description.trim(),
        responseMessageFileUrl: o.responseMessageFileUrl?.trim() || null,
      })),
      isActive: value.isActive,
    };

    this.dialogRef.close(result);
  }
}
