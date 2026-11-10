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

  @ViewChild('subjectField') private subjectField?: TokenFieldComponent;
  @ViewChild('messageField') private messageField?: TokenFieldComponent;

  /** Where a chip inserts: the last focused field (the message by default). */
  focusedField: InvitationField = 'Message';

  canInsert(v: InvitationVariable): boolean {
    return !this.disabled && (this.focusedField === 'Message' || v.allowedInSubject);
  }

  /** Puts the variable at the caret of the last focused field, as one locked chip. */
  insert(v: InvitationVariable): void {
    if (!this.canInsert(v)) return;
    const field = this.focusedField === 'Subject' && this.store.isEmail ? this.subjectField : this.messageField;
    field?.insert(this.store.tokenOf(v));
  }
}
