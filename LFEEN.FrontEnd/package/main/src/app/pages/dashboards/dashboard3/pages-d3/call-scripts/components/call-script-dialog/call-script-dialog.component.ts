import { Component, DestroyRef, Inject, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CoreService } from 'src/app/services/core.service';
import { CallScript, CallScriptScenarioType, scenarioDisplayName, scenarioHint } from '../../interfaces/call-script.model';
import { CallScriptsService } from '../../services/call-scripts.service';
import { resolveCallScriptError } from '../../interfaces/call-script-error.util';

// Validators.required lets "   " through; the API would then reject the trimmed empty value.
function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
}

// Mirrors the API rules for IVR scripts so bad data is caught before it reaches Voxa.
// Same list as IvrCallScriptValidation / IvrCallScriptContentRules on the API: absolute https URL,
// any host, audio extension compared case-insensitively.
export const CALL_SCRIPT_DESCRIPTION_MAX = 200;
export const CALL_SCRIPT_OPTIONS_MAX = 12;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|wma)$/i;
const DIGIT_PATTERN = /^[0-9*#]$/;

/** https URL whose path ends with an audio extension. Empty values pass — pair with requiredTrimmed when mandatory. */
function httpsAudioUrl(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && AUDIO_EXTENSIONS.test(url.pathname) ? null : { audioUrl: true };
  } catch {
    return { audioUrl: true };
  }
}

function digitFormat(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  return !value || DIGIT_PATTERN.test(value) ? null : { digit: true };
}

function trimmedMaxLength(max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    return value.length > max ? { maxlength: { requiredLength: max, actualLength: value.length } } : null;
  };
}

/** Array-level rules: no digit used twice, and at most CALL_SCRIPT_OPTIONS_MAX rows. */
function optionsRules(control: AbstractControl): ValidationErrors | null {
  const rows = (control as FormArray).controls;
  const errors: ValidationErrors = {};
  if (rows.length > CALL_SCRIPT_OPTIONS_MAX) errors['maxOptions'] = true;
  const seen = new Set<string>();
  for (const row of rows) {
    const digit = (row.get('digit')?.value ?? '').trim();
    if (!digit) continue;
    if (seen.has(digit)) { errors['duplicateDigit'] = true; break; }
    seen.add(digit);
  }
  return Object.keys(errors).length ? errors : null;
}

export interface CallScriptDialogData {
  /** The fixed scenario values the API accepts — used only to populate the picker. */
  scenarios: CallScriptScenarioType[];
  /** Present when editing an existing script; absent when creating a new one. */
  script?: CallScript;
}

/** Returned via afterClosed() only after the API accepted the create/update. */
export type CallScriptDialogResult = CallScript;

@Component({
  selector: 'app-call-script-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, ReactiveFormsModule],
  templateUrl: './call-script-dialog.component.html',
  styleUrl: './call-script-dialog.component.scss'
})
export class CallScriptDialogComponent {
  private translate = inject(TranslateService);
  private coreService = inject(CoreService);
  private service = inject(CallScriptsService);
  private destroyRef = inject(DestroyRef);

  /** True while the create/update request is in flight — blocks double submits and closing. */
  readonly submitting = signal(false);
  /** Server/transport error shown inside the dialog so the admin can fix the form and retry. */
  readonly serverError = signal('');

  readonly dirSignal = computed(() => this.coreService.getOptionsSignal()().dir);

  readonly descriptionMax = CALL_SCRIPT_DESCRIPTION_MAX;
  readonly optionsMax = CALL_SCRIPT_OPTIONS_MAX;

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
      audioFileUrl: [this.data.script?.audioFileUrl || '', [requiredTrimmed, httpsAudioUrl]],
      isActive: [this.data.script?.isActive ?? false],
      options: this.fb.array(seedOptions.map(o => this.buildOptionGroup(o)), { validators: optionsRules }),
    });

    // A stale server message would point at a field the admin may already have fixed.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { if (this.serverError()) this.serverError.set(''); });
  }

  get isEditMode(): boolean {
    return !!this.data.script;
  }

  get options(): FormArray {
    return this.form.get('options') as FormArray;
  }

  private buildOptionGroup(o?: { digit: string; description: string; responseMessageFileUrl?: string | null }): FormGroup {
    return this.fb.group({
      digit: [o?.digit || '', [requiredTrimmed, digitFormat]],
      description: [o?.description || '', [requiredTrimmed, trimmedMaxLength(CALL_SCRIPT_DESCRIPTION_MAX)]],
      responseMessageFileUrl: [o?.responseMessageFileUrl || '', [httpsAudioUrl]],
    });
  }

  /** Error to show under a control once touched, as a translation key suffix — first failing rule wins. */
  controlError(control: AbstractControl | null, rules: string[][]): string | null {
    if (!control || !control.invalid || !control.touched) return null;
    const hit = rules.find(([error]) => control.hasError(error));
    return hit ? hit[1] : null;
  }

  descriptionLength(index: number): number {
    return (this.options.at(index).get('description')?.value ?? '').trim().length;
  }

  get canAddOption(): boolean {
    return this.options.length < CALL_SCRIPT_OPTIONS_MAX;
  }

  scenarioName(scenarioType: CallScriptScenarioType, apiLabel?: string | null): string {
    return scenarioDisplayName(this.translate, scenarioType, apiLabel);
  }

  scenarioHintText(scenarioType: CallScriptScenarioType): string {
    return scenarioHint(this.translate, scenarioType);
  }

  addOption(): void {
    if (!this.canAddOption) return;
    this.options.push(this.buildOptionGroup());
  }

  // The IVR provider requires at least one menu item, so the last row can't be removed.
  removeOption(index: number): void {
    if (this.options.length <= 1) return;
    this.options.removeAt(index);
  }

  /**
   * Saves from inside the dialog and closes only on success. On any failure (400, 5xx, network)
   * the dialog stays open with everything the admin typed, and the error is shown in place.
   */
  save(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // getRawValue() (not .value) so the disabled scenarioType control is still included in edit mode.
    const value = this.form.getRawValue();
    const audioFileUrl: string = value.audioFileUrl.trim();
    const options = value.options.map((o: { digit: string; description: string; responseMessageFileUrl: string }) => ({
      digit: o.digit.trim(),
      description: o.description.trim(),
      responseMessageFileUrl: o.responseMessageFileUrl?.trim() || null,
    }));
    const isActive: boolean = value.isActive;

    const request$: Observable<CallScript> = this.data.script
      ? this.service.update(this.data.script.id, { audioFileUrl, options, isActive })
      : this.service.create({ scenarioType: value.scenarioType, audioFileUrl, options, isActive });

    this.setSubmitting(true);
    this.serverError.set('');

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.setSubmitting(false);
        this.dialogRef.close(saved);
      },
      error: err => {
        this.setSubmitting(false);
        this.serverError.set(resolveCallScriptError(err, this.translate));
      },
    });
  }

  close(): void {
    if (this.submitting()) return;
    this.dialogRef.close();
  }

  // Backdrop click / Esc must not discard an in-flight save either.
  private setSubmitting(value: boolean): void {
    this.submitting.set(value);
    this.dialogRef.disableClose = value;
  }
}
