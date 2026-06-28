import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { Subscription } from 'rxjs';

interface ActiveSession {
  id: string;
  name: string;
  deviceIcon: string;
  location: string;
  browser: string;
  isCurrent: boolean;
  time?: string;
}

interface LoginLog {
  event: string;
  dateTime: string;
  ip: string;
  location: string;
  type: 'success' | 'warning' | 'error';
}

@Component({
  selector: 'app-platform-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './platform-settings.component.html',
  styleUrl: './platform-settings.component.scss'
})
export class PlatformSettingsComponent implements OnInit, OnDestroy {
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private langSub?: Subscription;

  showLogTable = true;

  activeTab: 'sysInfo' | 'security' = 'sysInfo';

  // System info (static)
  platformName = 'منصة لفن للضيافة';
  platformUrl = 'https://lafin.sa';
  supportEmail = 'support@lafin.sa';
  timezone = '(GMT+03:00) الرياض، المملكة العربية السعودية';

  // Notifications
  notifEmail = true;
  notifUrgentBookings = false;
  notifMonthlyReports = true;

  // API Keys
  secretKey = 'sk_live_S1P5xK9mN3qR7tY2wZ8vA4c';
  webhookUrl = 'https://your-domain.com/webhooks';

  // Security
  twoFaEnabled = true;

  activeSessions: ActiveSession[] = [
    {
      id: '1',
      name: 'MacBook Pro',
      deviceIcon: 'device-laptop',
      location: 'الرياض، المملكة العربية السعودية',
      browser: 'Chrome',
      isCurrent: true
    },
    {
      id: '2',
      name: 'iPhone 15 Pro',
      deviceIcon: 'device-mobile',
      location: 'الرياض، المملكة العربية السعودية',
      browser: 'تطبيق لفن',
      isCurrent: false,
      time: 'منذ يومين'
    }
  ];

  loginLogs: LoginLog[] = [
    {
      event: 'تسجيل دخول ناجح',
      dateTime: '٨ أكتوبر ٢٠٢٤ ص ٩:٤٥',
      ip: '92.168.1.45',
      location: 'SA الرياض',
      type: 'success'
    },
    {
      event: 'تغيير كلمة المرور',
      dateTime: '٨ أكتوبر ٢٠٢٤ م ١:١٥',
      ip: '92.168.1.45',
      location: 'SA الرياض',
      type: 'warning'
    },
    {
      event: 'فشل تسجيل الدخول',
      dateTime: '٨ أكتوبر ٢٠٢٤ م ١٢:٣٠',
      ip: '104.21.4.12',
      location: 'UK لندن',
      type: 'error'
    }
  ];

  logColumns = ['event', 'dateTime', 'ip', 'location'];

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.showLogTable = false;
      setTimeout(() => {
        this.showLogTable = true;
        this.cdr.detectChanges();
      }, 0);
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get maskedSecretKey(): string {
    return this.secretKey.slice(0, 15) + ' . . .';
  }

  setTab(tab: 'sysInfo' | 'security'): void {
    this.activeTab = tab;
  }

  onSave(): void {
    // static data — no action needed
  }

  copySecretKey(): void {
    navigator.clipboard.writeText(this.secretKey).catch(() => {});
  }

  generateNewKey(): void {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'sk_live_';
    for (let i = 0; i < 26; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.secretKey = key;
  }

  logoutAll(): void {
    this.activeSessions = this.activeSessions.filter(s => s.isCurrent);
  }

  logoutSession(id: string): void {
    this.activeSessions = this.activeSessions.filter(s => s.id !== id);
  }
}
