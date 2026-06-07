import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Account } from '../../account-management.component';

@Component({
  selector: 'app-account-card',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './account-card.component.html',
  styleUrl: './account-card.component.scss'
})
export class AccountCardComponent {
  @Input() account!: Account;

  get statusLabel(): string {
    const map: Record<string, string> = {
      active: 'نشط',
      suspended: 'موقوف',
      under_review: 'تحت المراجعة',
      rejected: 'مرفوض'
    };
    return map[this.account?.status] ?? '';
  }

  get idFieldLabel(): string {
    return this.account?.type === 'company' ? 'السجل التجاري' : 'رقم الهوية';
  }

  get actionLabel(): string {
    return this.account?.type === 'company' ? 'أعمال مؤسسة' : 'أفراد إسناد';
  }
}
