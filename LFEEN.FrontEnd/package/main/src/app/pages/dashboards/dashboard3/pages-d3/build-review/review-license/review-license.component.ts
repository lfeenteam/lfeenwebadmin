import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-review-license',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, FormsModule, TranslateModule],
  templateUrl: './review-license.component.html',
  styleUrl: './review-license.component.scss'
})
export class ReviewLicenseComponent {
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<void>();

  licenseNumber = 'LIC-2024-00874';
  licenseImage = 'assets/images/products/license_sample.png'; // Placeholder for the license image shown in screenshot
  issueDate = '٢٠٢٣/٠٩/١٣';
  expiryDate = '٢٠٢٤/٠٥/١١ (منتهي)';
  businessType = 'إدارة وتشغيل مرافق الضيافة السكنية';
  
  isExpired = true;
  hasRejection = false;

  setStatus(rejected: boolean) {
    this.hasRejection = rejected;
  }
}
