import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DepartmentService } from '../../services/department.service';
import { Permission } from '../../interfaces/department.model';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import { AddPermissionDialogComponent } from './components/add-permission-dialog/add-permission-dialog.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';

@Component({
  selector: 'app-all-permissions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './all-permissions.component.html',
  styleUrl: './all-permissions.component.scss'
})
export class AllPermissionsComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;

  isLoading = true;
  deletingId: string | null = null;

  permissions: Permission[] = [];

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalCount = 0;

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  constructor(
    private router: Router,
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

  displayName(permission: Permission): string {
    return (this.currentLang === 'ar' ? permission.nameAr : permission.nameEn)
      ?? permission.name
      ?? permission.nameAr
      ?? permission.nameEn
      ?? '';
  }

  private loadData(): void {
    this.isLoading = true;
    this.departmentService.getAllPermissions(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        this.permissions = res.data;
        this.totalPages = res.totalPages;
        this.totalCount = res.totalCount;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.loadPermissionsError')));
      }
    });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  }

  openAddPermission(): void {
    const ref = this.dialog.open(AddPermissionDialogComponent, {
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

  editPermission(permission: Permission): void {
    const ref = this.dialog.open(AddPermissionDialogComponent, {
      width: '560px',
      maxWidth: '600px',
      maxHeight: '100vh',
      panelClass: 'role-dialog-panel',
      data: { permission }
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.loadData();
    });
  }

  manageDependencies(permission: Permission): void {
    this.router.navigate([this.currentLang, 'd3', 'all-permissions', permission.id, 'dependencies']);
  }

  deletePermission(permission: Permission): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('d3.toast.deletePermissionTitle'),
        message: this.translate.instant('d3.toast.deletePermissionMessage')
      },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deletingId = permission.id;
      this.departmentService.deletePermission(permission.id).subscribe({
        next: () => {
          this.deletingId = null;
          this.toastr.success(this.translate.instant('d3.toast.deletePermissionSuccess'));
          if (this.permissions.length === 1 && this.currentPage > 1) {
            this.currentPage--;
          }
          this.loadData();
        },
        error: (err) => {
          this.deletingId = null;
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.deletePermissionInUseError')));
        }
      });
    });
  }
}
