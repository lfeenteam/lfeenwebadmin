import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DepartmentService } from '../../services/department.service';
import { PermissionGroup } from '../../interfaces/department.model';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import { AddPermissionGroupDialogComponent } from './components/add-permission-group-dialog/add-permission-group-dialog.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';

@Component({
  selector: 'app-permission-groups',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './permission-groups.component.html',
  styleUrl: './permission-groups.component.scss'
})
export class PermissionGroupsComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;

  isLoading = true;
  deletingId: string | null = null;

  groups: PermissionGroup[] = [];

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalCount = 0;

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  constructor(
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private toastr: ToastrService
  ) {}

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => this.loadData());
    this.loadData();
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  displayName(group: PermissionGroup): string {
    return (this.currentLang === 'ar' ? group.nameAr : group.nameEn)
      ?? group.name
      ?? group.nameAr
      ?? group.nameEn
      ?? '';
  }

  displayDescription(group: PermissionGroup): string {
    return (this.currentLang === 'ar' ? group.descriptionAr : group.descriptionEn)
      ?? group.description
      ?? group.descriptionAr
      ?? group.descriptionEn
      ?? '';
  }

  private loadData(): void {
    this.isLoading = true;
    this.departmentService.getPermissionGroups(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        this.groups = res.data;
        this.totalPages = res.totalPages;
        this.totalCount = res.totalCount;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.loadPermissionGroupsError')));
      }
    });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  }

  openAddGroup(): void {
    const ref = this.dialog.open(AddPermissionGroupDialogComponent, {
      width: '560px',
      maxWidth: '600px',
      maxHeight: '100vh',
      panelClass: 'role-dialog-panel',
      data: {}
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.loadData();
    });
  }

  editGroup(group: PermissionGroup): void {
    const ref = this.dialog.open(AddPermissionGroupDialogComponent, {
      width: '560px',
      maxWidth: '600px',
      maxHeight: '100vh',
      panelClass: 'role-dialog-panel',
      data: { group }
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.loadData();
    });
  }

  deleteGroup(group: PermissionGroup): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('d3.toast.deletePermissionGroupTitle'),
        message: this.translate.instant('d3.toast.deletePermissionGroupMessage')
      },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deletingId = group.id;
      this.departmentService.deletePermissionGroup(group.id).subscribe({
        next: () => {
          this.deletingId = null;
          this.toastr.success(this.translate.instant('d3.toast.deletePermissionGroupSuccess'));
          if (this.groups.length === 1 && this.currentPage > 1) {
            this.currentPage--;
          }
          this.loadData();
        },
        error: (err) => {
          this.deletingId = null;
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.deletePermissionGroupInUseError')));
        }
      });
    });
  }
}
