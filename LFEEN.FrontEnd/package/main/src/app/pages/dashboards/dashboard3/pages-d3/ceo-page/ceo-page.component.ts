import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { CardsTopComponent } from '../../../../../components/dashboard3/cards-top/cards-top.component';
import { ChartComponent } from '../../../../../components/dashboard3/chart/chart.component';
import { InsightsComponent } from '../../../../../components/dashboard3/insights/insights.component';

@Component({
  selector: 'app-ceo-page',
  standalone: true,
  imports: [CommonModule, CardsTopComponent, ChartComponent, InsightsComponent],
  templateUrl: './ceo-page.component.html',
  styleUrl: './ceo-page.component.scss'
})
export class CeoPageComponent {
  constructor(private translate: TranslateService) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }
}
