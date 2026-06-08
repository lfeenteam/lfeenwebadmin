import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

interface Rule {
  id: number;
  title: string;
  icon: string;
  enabled: boolean;
}

@Component({
  selector: 'app-review-terms',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, FormsModule, TranslateModule],
  templateUrl: './review-terms.component.html',
  styleUrl: './review-terms.component.scss'
})
export class ReviewTermsComponent {
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<void>();

  checkInTime = '٠٤:٠٠ م';
  checkOutTime = '١١:٠٠ ص';
  earlyCheckIn = true;

  generalRules: Rule[] = [
    { id: 1, title: 'يسمح بالتدخين', icon: 'ban', enabled: true },
    { id: 2, title: 'يسمح بالحيوانات الأليفة', icon: 'dog', enabled: true },
    { id: 3, title: 'إقامة الحفلات', icon: 'music', enabled: true },
    { id: 4, title: 'مناسب للأطفال', icon: 'baby-carriage', enabled: true },
    { id: 5, title: 'التصوير التجاري', icon: 'camera-off', enabled: true },
    { id: 6, title: 'التصوير التجاري', icon: 'camera-off', enabled: true },
  ];

  customRules = [
    'يمنع إزعاج الجيران تماماً بعد الساعة ١١ مساءً لضمان خصوصية وهدوء السكان.',
    'يجب تسليم المفاتيح في الصندوق المخصص والموجود بجانب الباب الرئيسي عند المغادرة.',
    'الرجاء الالتزام بفرز النفايات ووضعها في الحاويات المخصصة أمام المبنى.'
  ];
}
