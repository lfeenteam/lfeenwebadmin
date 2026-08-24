import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { DepartmentService } from '../../../services/department.service';
import { Permission, PermissionDependency } from '../../../interfaces/department.model';
import { DeleteConfirmDialogComponent } from '../../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { extractApiErrorMessage } from '../../../utils/api-error.util';

@Component({
  selector: 'app-permission-dependencies',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './permission-dependencies.component.html',
  styleUrl: './permission-dependencies.component.scss'
})
export class PermissionDependenciesComponent implements OnInit {
  permissionId: string | null = null;

  isLoading = true;
  isAdding = false;
  removingId: string | null = null;

  sourcePermission: Permission | null = null;
  dependencies: PermissionDependency[] = [];
  allPermissions: Permission[] = [];

  selectedRequiredId = '';

  constructor(
    private route: ActivatedRoute,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private toastr: ToastrService
  ) {
    this.permissionId = this.route.snapshot.paramMap.get('id');
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get sourcePermissionName(): string {
    if (!this.sourcePermission) return '';
    return (this.currentLang === 'ar' ? this.sourcePermission.nameAr : this.sourcePermission.nameEn)
      ?? this.sourcePermission.name
      ?? this.sourcePermission.nameAr
      ?? this.sourcePermission.nameEn
      ?? '';
  }

  get candidatePermissions(): Permission[] {
    const requiredIds = new Set(this.dependencies.map(d => d.requiredPermissionId));
    return this.allPermissions.filter(p => p.id !== this.permissionId && !requiredIds.has(p.id));
  }

  displayName(permission: Permission): string {
    return (this.currentLang === 'ar' ? permission.nameAr : permission.nameEn)
      ?? permission.name
      ?? permission.nameAr
      ?? permission.nameEn
      ?? '';
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    if (!this.permissionId) return;
    this.isLoading = true;
    forkJoin({
      permission: this.departmentService.getPermissionById(this.permissionId),
      dependencies: this.departmentService.getPermissionDependencies(this.permissionId),
      allPermissions: this.departmentService.getAllPermissionsForDropdown()
    }).subscribe({
      next: ({ permission, dependencies, allPermissions }) => {
        this.sourcePermission = permission;
        this.dependencies = dependencies;
        this.allPermissions = allPermissions;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  addDependency(): void {
    if (!this.permissionId || !this.selectedRequiredId) return;
    this.isAdding = true;
    this.departmentService.addPermissionDependency(this.permissionId, this.selectedRequiredId).subscribe({
      next: () => {
        this.isAdding = false;
        this.selectedRequiredId = '';
        this.toastr.success(this.translate.instant('d3.toast.addDependencySuccess'));
        this.loadData();
      },
      error: (err) => {
        this.isAdding = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.errorOp')));
      }
    });
  }

  removeDependency(dependency: PermissionDependency): void {
    const ref = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: this.translate.instant('d3.toast.removeDependencyTitle'),
        message: this.translate.instant('d3.toast.removeDependencyMessage', { code: dependency.requiredPermissionCode })
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed || !this.permissionId) return;
      this.removingId = dependency.requiredPermissionId;
      this.departmentService.removePermissionDependency(this.permissionId, dependency.requiredPermissionId).subscribe({
        next: () => {
          this.dependencies = this.dependencies.filter(d => d.requiredPermissionId !== dependency.requiredPermissionId);
          this.removingId = null;
          this.toastr.success(this.translate.instant('d3.toast.removeDependencySuccess'));
        },
        error: (err) => {
          this.removingId = null;
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.errorOp')));
        }
      });
    });
  }
}
