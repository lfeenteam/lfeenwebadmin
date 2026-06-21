import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { ComplaintTab } from '../../interfaces/complaint.model';

@Component({
  selector: 'app-complaint-tabs-bar',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule],
  templateUrl: './complaint-tabs-bar.component.html',
  styleUrl: './complaint-tabs-bar.component.scss'
})
export class ComplaintTabsBarComponent {
  @Input() activeTab: ComplaintTab = 'customers';
  @Output() tabChange = new EventEmitter<ComplaintTab>();

  readonly tabs: { key: ComplaintTab; labelKey: string }[] = [
        { key: 'hosts',     labelKey: 'd3.complaints.tabs.hosts'     },
    { key: 'customers', labelKey: 'd3.complaints.tabs.customers' },

    { key: 'resolved',  labelKey: 'd3.complaints.tabs.resolved'  },
  ];
}
