import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { pickAcceptedFiles, WALLET_ATTACHMENT_ACCEPT } from '../../interfaces/wallet-files.util';

@Component({
  selector: 'app-wallet-file-picker',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './wallet-file-picker.component.html',
  styleUrl: './wallet-file-picker.component.scss'
})
export class WalletFilePickerComponent {
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);

  @Input() files: File[] = [];
  @Output() filesChange = new EventEmitter<File[]>();
  /** How many files the entry can still take (already accounts for existing attachments). */
  @Input() slots = 5;
  @Input() disabled = false;

  readonly accept = WALLET_ATTACHMENT_ACCEPT;
  isDragging = false;

  get remainingSlots(): number {
    return Math.max(0, this.slots - this.files.length);
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.add(Array.from(input.files));
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    if (this.disabled) return;
    const dropped = event.dataTransfer?.files;
    if (dropped?.length) this.add(Array.from(dropped));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled) this.isDragging = true;
  }

  remove(index: number): void {
    if (this.disabled) return;
    this.filesChange.emit(this.files.filter((_, i) => i !== index));
  }

  formatSize(bytes: number): string {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  private add(incoming: File[]): void {
    const { accepted, rejection } = pickAcceptedFiles(incoming, this.remainingSlots);
    if (rejection) {
      this.toastr.error(this.translate.instant(`d3.wallet.files.${rejection}Error`));
    }
    if (accepted.length) this.filesChange.emit([...this.files, ...accepted]);
  }
}
