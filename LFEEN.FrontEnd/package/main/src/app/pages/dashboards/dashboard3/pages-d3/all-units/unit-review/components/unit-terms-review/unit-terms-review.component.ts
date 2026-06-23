import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { UnitTermsResponse } from '../../../../../interfaces/unit-card.model';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';

interface UnitRule {
  icon: string;
  translationKey: string;
  approved: boolean;
}

@Component({
  selector: 'app-unit-terms-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './unit-terms-review.component.html',
  styleUrl: './unit-terms-review.component.scss'
})
export class UnitTermsReviewComponent implements OnInit {
  termsData: UnitTermsResponse | null = null;
  buildingId = '';
  unitId = '';
  finalNotes = '';
  earlyCheckInEnabled = false;
  isLoading = false;
  isReadOnly = false;
  mappedConditions: UnitRule[] = [];

  private readonly conditionIconMap: Record<string, string> = {
    SmokingForbidden: 'smoking-no',
    PetsNotAllowed: 'paw-off',
    PartiesForbidden: 'music-off',
    RequiresIdIdentification: 'id',
    AllowChildren: 'mood-kid',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService,
    private dialog: MatDialog
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  formatTime(time: string | null | undefined): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    if (this.unitId) {
      this.isLoading = true;
      this.unitsService.getUnitTerms(this.unitId).subscribe({
        next: (data) => {
          this.termsData           = data;
          this.earlyCheckInEnabled = data.isEarlyCheckInAllowed;
          this.mappedConditions    = data.conditions.map(c => ({
            icon:           this.conditionIconMap[c.conditionKey] ?? 'check',
            translationKey: `d3.unitReview.termsView.conditions.${c.conditionKey}`,
            approved:       c.isSelected,
          }));
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
    }
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId) return;
    const isApprove = decision === 'approved';
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.termsApproveTitle'   : 'd3.unitReview.confirm.termsRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.termsApproveMessage' : 'd3.unitReview.confirm.termsRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'       : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const apiDecision = isApprove ? 'Approved' : 'Rejected';
      const rejectionReason = isApprove ? null : (this.finalNotes.trim() || null);
      this.unitsService.reviewUnitTerms(this.unitId, apiDecision, rejectionReason).subscribe({
        next: () => {
          if (this.buildingId) {
            this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'terms', decision);
          }
          this.onBack();
        }
      });
    });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
