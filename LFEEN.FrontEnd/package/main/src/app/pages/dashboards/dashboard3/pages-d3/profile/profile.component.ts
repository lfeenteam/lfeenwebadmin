import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);

  notifEmail = true;
  notifBrowser = false;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  async openChangePassword(): Promise<void> {
    const { ChangePasswordDialogComponent } = await import(
      './components/change-password-dialog/change-password-dialog.component'
    );
    this.dialog.open(ChangePasswordDialogComponent, {
      width: '420px',
      panelClass: 'change-password-dialog-panel',
      direction: this.currentDir
    });
  }
}
