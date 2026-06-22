import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-host-complaint-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './host-complaint-detail.component.html',
  styleUrl: './host-complaint-detail.component.scss'
})
export class HostComplaintDetailComponent {
  private translate = inject(TranslateService);

  replyText = '';
  readonly hostInitials = 'FS';

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  sendReply(): void {
    this.replyText = '';
  }
}
