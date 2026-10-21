import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { BookingService } from '../../services/booking.service';
import {
  REVIEW_TARGET_FIELD_LABEL_KEY,
  ReviewReportItem,
  isReviewReportGone,
  reviewReportErrorMessage,
} from '../../interfaces/review-report.model';

/** 'approved' on success; 'gone' when the reports were already actioned elsewhere. */
export type ApproveReviewDialogResult = 'approved' | 'gone';

interface CommentToken {
  text: string;
  /** The token with surrounding punctuation stripped — what a click picks. */
  word: string;
}

// Leading/trailing punctuation (Latin + Arabic) dropped when a word is clicked.
const EDGE_PUNCTUATION = /^[\s.,!?;:"'()[\]{}«»…\-–—،؛؟]+|[\s.,!?;:"'()[\]{}«»…\-–—،؛؟]+$/g;

@Component({
  selector: 'app-approve-review-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './approve-review-dialog.component.html',
  styleUrl: './approve-review-dialog.component.scss'
})
export class ApproveReviewDialogComponent {
  public dialogRef = inject(MatDialogRef<ApproveReviewDialogComponent, ApproveReviewDialogResult>);
  public data = inject<ReviewReportItem>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);
  private toastr = inject(ToastrService);

  readonly targetLabelKey = REVIEW_TARGET_FIELD_LABEL_KEY[this.data.targetField];

  // Whitespace kept as its own tokens so the comment renders with its original spacing.
  readonly tokens: CommentToken[] = (this.data.commentText ?? '')
    .split(/(\s+)/)
    .filter(t => t.length)
    .map(text => ({ text, word: text.replace(EDGE_PUNCTUATION, '') }));

  blockedWord = '';
  submitting = false;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  pick(token: CommentToken): void {
    if (!token.word || this.submitting) return;
    this.blockedWord = token.word;
  }

  isPicked(token: CommentToken): boolean {
    const picked = this.blockedWord.trim().toLowerCase();
    if (!picked || !token.word) return false;
    return picked.split(/\s+/).includes(token.word.toLowerCase());
  }

  confirm(): void {
    const word = this.blockedWord.trim();
    if (this.submitting || !word) return;
    this.submitting = true;
    this.bookingService
      .approveReviewReport(this.data.bookingReviewId, this.data.targetField, word)
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.bookings.reviewReports.toast.approved'));
          this.dialogRef.close('approved');
        },
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          if (isReviewReportGone(err)) {
            this.toastr.info(this.translate.instant('d3.bookings.reviewReports.toast.alreadyHandled'));
            this.dialogRef.close('gone');
            return;
          }
          this.toastr.error(reviewReportErrorMessage(err) ?? this.translate.instant('d3.toast.errorOp'));
        },
      });
  }
}
