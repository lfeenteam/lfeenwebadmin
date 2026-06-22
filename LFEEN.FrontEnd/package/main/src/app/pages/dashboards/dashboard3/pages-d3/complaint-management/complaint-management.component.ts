import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComplaintTabsBarComponent } from './components/complaint-tabs-bar/complaint-tabs-bar.component';
import { ComplaintsTableComponent } from './components/complaints-table/complaints-table.component';
import { ComplaintChatComponent } from './components/complaint-chat/complaint-chat.component';
import { ComplaintService } from './services/complaint.service';
import { Complaint, ComplaintTab } from './interfaces/complaint.model';

@Component({
  selector: 'app-complaint-management',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ComplaintTabsBarComponent,
    ComplaintsTableComponent,
    ComplaintChatComponent,
  ],
  templateUrl: './complaint-management.component.html',
  styleUrl: './complaint-management.component.scss'
})
export class ComplaintManagementComponent {
  private service = inject(ComplaintService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  activeTab    = signal<ComplaintTab>('customers');
  selectedComplaint = signal<Complaint | null>(null);

  private allComplaints = this.service.complaints;

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as ComplaintTab | null;
    if (tab === 'customers' || tab === 'hosts' || tab === 'resolved') {
      this.activeTab.set(tab);
    }
  }

  visibleComplaints = computed(() => {
    const tab = this.activeTab();
    return this.allComplaints().filter(c => {
      if (tab === 'customers') return c.type === 'customer' && !c.resolved;
      if (tab === 'hosts')     return c.type === 'host'     && !c.resolved;
      return c.resolved;
    });
  });

  setTab(tab: ComplaintTab): void {
    this.activeTab.set(tab);
    this.selectedComplaint.set(null);
  }

  onRowSelect(complaint: Complaint): void {
    if (this.activeTab() === 'hosts') return;

    const current = this.selectedComplaint();
    this.selectedComplaint.set(current?.id === complaint.id ? null : complaint);
  }

  openHostComplaint(complaint: Complaint): void {
    this.router.navigate([this.translate.currentLang || 'ar', 'd3', 'complaints', complaint.id]);
  }

  onResolve(complaint: Complaint): void {
    if (this.selectedComplaint()?.id === complaint.id) {
      this.selectedComplaint.set(null);
    }
    this.service.resolveComplaint(complaint.id).subscribe();
  }

  closeChat(): void {
    this.selectedComplaint.set(null);
  }

  get chatOpen(): boolean {
    return this.selectedComplaint() !== null;
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }
}
