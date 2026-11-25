import { Component, Input, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { InvitationField, InvitationVariable } from '../../../../interfaces/demo-account.model';
import { InvitationEditorStore } from './invitation-editor.store';
import { TokenFieldComponent } from './token-field.component';

// The invitation text editor: presets, language, variable chips, subject (Email only)
// and message. Variables sit in the text as locked chips; the preview's issues are marked in place.
@Component({
  selector: 'app-invitation-editor',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, TablerIconsModule, TranslateModule, TokenFieldComponent],
  templateUrl: './invitation-editor.component.html',
  styleUrl: './invitation-editor.component.scss'
})
export class InvitationEditorComponent {
  readonly store = inject(InvitationEditorStore);

  @Input() disabled = false;
  /** No frame or own title — for pages that wrap the editor in their own card. */
  @Input() bare = false;
  /**
   * Which part to show. 'full' (default) = everything. A page that puts the subject elsewhere
   * (sign-up links: the subject is an extra setting) shows 'message' in one place and 'subject'
   * in the other — both share the page's InvitationEditorStore.
   */
  @Input() set mode(value: 'full' | 'message' | 'subject') {
    this._mode = value;
    this.focusedField = value === 'subject' ? 'Subject' : 'Message';
  }
  get mode(): 'full' | 'message' | 'subject' { return this._mode; }
  private _mode: 'full' | 'message' | 'subject' = 'full';

  @ViewChild('subjectField') private subjectField?: TokenFieldComponent;
  @ViewChild('messageField') private messageField?: TokenFieldComponent;

  /** Where a chip inserts: the last focused field (the message by default). */
  focusedField: InvitationField = 'Message';

  /** Language, presets and the message. */
  get showMain(): boolean { return this._mode !== 'subject'; }
  /** The subject goes only with Email. */
  get showSubject(): boolean { return this._mode !== 'message' && this.store.isEmail; }

  /** Subject-only mode lists just the variables a subject may hold. */
  get chipVariables(): InvitationVariable[] {
    return this._mode === 'subject' ? this.store.variables.filter(v => v.allowedInSubject) : this.store.variables;
  }

  canInsert(v: InvitationVariable): boolean {
    return !this.disabled && (this.focusedField === 'Message' || v.allowedInSubject);
  }

  /** Puts the variable at the caret of the last focused field, as one locked chip. */
  insert(v: InvitationVariable): void {
    if (!this.canInsert(v)) return;
    const field = this.focusedField === 'Subject' && this.showSubject ? this.subjectField : this.messageField;
    field?.insert(this.store.tokenOf(v));
  }
}
