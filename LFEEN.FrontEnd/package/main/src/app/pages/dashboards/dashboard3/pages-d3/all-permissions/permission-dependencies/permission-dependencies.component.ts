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
import { resolveBilingualText } from '../../../utils/bilingual.util';

interface DependencyTreeNode {
  id: string;
  code: string;
  name: string;
  children: DependencyTreeNode[];
}

interface ReverseDependent {
  id: string;
  code: string;
  name: string;
}

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
  allDependencies: PermissionDependency[] = [];

  dependencyTree: DependencyTreeNode[] = [];
  reverseDependents: ReverseDependent[] = [];
  private expandedIds = new Set<string>();
  private childrenByPermission = new Map<string, PermissionDependency[]>();

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
    return resolveBilingualText(this.currentLang, this.sourcePermission.nameAr, this.sourcePermission.nameEn, this.sourcePermission.name);
  }

  get candidatePermissions(): Permission[] {
    const requiredIds = new Set(this.dependencies.map(d => d.requiredPermissionId));
    return this.allPermissions.filter(p =>
      p.id !== this.permissionId && !requiredIds.has(p.id) && !this.wouldCreateCycle(p.id)
    );
  }

  private wouldCreateCycle(candidateId: string): boolean {
    if (!this.permissionId) return false;

    const visited = new Set<string>([candidateId]);
    let queue = [candidateId];

    while (queue.length) {
      const next: string[] = [];
      for (const id of queue) {
        for (const dep of this.childrenByPermission.get(id) ?? []) {
          if (dep.requiredPermissionId === this.permissionId) return true;
          if (visited.has(dep.requiredPermissionId)) continue;
          visited.add(dep.requiredPermissionId);
          next.push(dep.requiredPermissionId);
        }
      }
      queue = next;
    }

    return false;
  }

  displayName(permission: Permission): string {
    return resolveBilingualText(this.currentLang, permission.nameAr, permission.nameEn, permission.name);
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
      allPermissions: this.departmentService.getAllPermissionsForDropdown(),
      allDependencies: this.departmentService.getAllPermissionDependencies()
    }).subscribe({
      next: ({ permission, dependencies, allPermissions, allDependencies }) => {
        this.sourcePermission = permission;
        this.dependencies = dependencies;
        this.allPermissions = allPermissions;
        this.allDependencies = allDependencies;
        this.buildDependencyTree();
        this.buildReverseDependents();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  private permissionName(id: string, fallbackCode: string, fallbackName?: string): string {
    const perm = this.allPermissions.find(p => p.id === id);
    return resolveBilingualText(this.currentLang, perm?.nameAr, perm?.nameEn, perm?.name ?? fallbackName) || fallbackCode;
  }

  private buildDependencyTree(): void {
    this.childrenByPermission = new Map<string, PermissionDependency[]>();
    for (const dep of this.allDependencies) {
      const list = this.childrenByPermission.get(dep.sourcePermissionId) ?? [];
      list.push(dep);
      this.childrenByPermission.set(dep.sourcePermissionId, list);
    }

    if (!this.permissionId) { this.dependencyTree = []; return; }

    this.expandedIds = new Set<string>();

    const build = (id: string, ancestors: Set<string>): DependencyTreeNode[] => {
      const deps = this.childrenByPermission.get(id) ?? [];
      return deps.map(dep => {
        const childId = dep.requiredPermissionId;
        this.expandedIds.add(childId);
        const isCycle = ancestors.has(childId);
        return {
          id: childId,
          code: dep.requiredPermissionCode,
          name: this.permissionName(childId, dep.requiredPermissionCode, dep.requiredPermissionName),
          children: isCycle ? [] : build(childId, new Set(ancestors).add(childId))
        };
      });
    };

    this.dependencyTree = build(this.permissionId, new Set([this.permissionId]));
  }

  private buildReverseDependents(): void {
    if (!this.permissionId) { this.reverseDependents = []; return; }

    const parentsByPermission = new Map<string, PermissionDependency[]>();
    for (const dep of this.allDependencies) {
      const list = parentsByPermission.get(dep.requiredPermissionId) ?? [];
      list.push(dep);
      parentsByPermission.set(dep.requiredPermissionId, list);
    }

    const result: ReverseDependent[] = [];
    const visited = new Set<string>([this.permissionId]);
    let queue = [this.permissionId];

    while (queue.length) {
      const next: string[] = [];
      for (const id of queue) {
        for (const dep of parentsByPermission.get(id) ?? []) {
          if (visited.has(dep.sourcePermissionId)) continue;
          visited.add(dep.sourcePermissionId);
          result.push({
            id: dep.sourcePermissionId,
            code: dep.sourcePermissionCode,
            name: this.permissionName(dep.sourcePermissionId, dep.sourcePermissionCode, dep.sourcePermissionName)
          });
          next.push(dep.sourcePermissionId);
        }
      }
      queue = next;
    }

    this.reverseDependents = result;
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  toggleExpand(id: string): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
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
          this.allDependencies = this.allDependencies.filter(d =>
            !(d.sourcePermissionId === this.permissionId && d.requiredPermissionId === dependency.requiredPermissionId)
          );
          this.buildDependencyTree();
          this.buildReverseDependents();
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
