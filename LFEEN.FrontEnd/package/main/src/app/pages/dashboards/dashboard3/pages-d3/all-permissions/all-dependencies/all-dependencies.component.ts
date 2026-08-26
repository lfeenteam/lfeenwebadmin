import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { DepartmentService } from '../../../services/department.service';
import { Permission, PermissionDependency, PermissionGroup } from '../../../interfaces/department.model';
import { resolveBilingualText } from '../../../utils/bilingual.util';

interface DependencyTreeNode {
  id: string;
  code: string;
  name: string;
  children: DependencyTreeNode[];
}

interface DependencySourceRow {
  id: string;
  code: string;
  name: string;
  groupId: string;
  groupName: string;
  directCount: number;
  tree: DependencyTreeNode[];
}

@Component({
  selector: 'app-all-dependencies',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './all-dependencies.component.html',
  styleUrl: './all-dependencies.component.scss'
})
export class AllDependenciesComponent implements OnInit {
  isLoading = true;

  private allPermissions: Permission[] = [];
  private allDependencies: PermissionDependency[] = [];
  groups: PermissionGroup[] = [];
  rows: DependencySourceRow[] = [];

  searchTerm = '';
  selectedGroupId = '';

  private expandedRowIds = new Set<string>();
  private expandedTreeIds = new Set<string>();

  constructor(
    private departmentService: DepartmentService,
    private translate: TranslateService
  ) {}

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading = true;
    forkJoin({
      allPermissions: this.departmentService.getAllPermissionsForDropdown(),
      allDependencies: this.departmentService.getAllPermissionDependencies(),
      groups: this.departmentService.getAllPermissionGroupsForDropdown()
    }).subscribe({
      next: ({ allPermissions, allDependencies, groups }) => {
        this.allPermissions = allPermissions;
        this.allDependencies = allDependencies;
        this.groups = groups;
        this.buildRows();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  private displayName(permission: Permission): string {
    return resolveBilingualText(this.currentLang, permission.nameAr, permission.nameEn, permission.name);
  }

  groupDisplayName(group: PermissionGroup): string {
    return resolveBilingualText(this.currentLang, group.nameAr, group.nameEn, group.name);
  }

  private buildRows(): void {
    const permissionById = new Map(this.allPermissions.map(p => [p.id, p]));
    const childrenByPermission = new Map<string, PermissionDependency[]>();
    for (const dep of this.allDependencies) {
      const list = childrenByPermission.get(dep.sourcePermissionId) ?? [];
      list.push(dep);
      childrenByPermission.set(dep.sourcePermissionId, list);
    }

    const nodeName = (id: string, fallbackCode: string, fallbackName?: string): string => {
      const perm = permissionById.get(id);
      return (perm ? this.displayName(perm) : '') || fallbackName || fallbackCode;
    };

    this.expandedTreeIds = new Set<string>();

    const buildTree = (id: string, ancestors: Set<string>): DependencyTreeNode[] => {
      const deps = childrenByPermission.get(id) ?? [];
      return deps.map(dep => {
        const childId = dep.requiredPermissionId;
        this.expandedTreeIds.add(childId);
        const isCycle = ancestors.has(childId);
        return {
          id: childId,
          code: dep.requiredPermissionCode,
          name: nodeName(childId, dep.requiredPermissionCode, dep.requiredPermissionName),
          children: isCycle ? [] : buildTree(childId, new Set(ancestors).add(childId))
        };
      });
    };

    this.rows = Array.from(childrenByPermission.keys()).map(sourceId => {
      const perm = permissionById.get(sourceId);
      const deps = childrenByPermission.get(sourceId) ?? [];
      const firstDep = deps[0];
      return {
        id: sourceId,
        code: perm?.code ?? firstDep?.sourcePermissionCode ?? '',
        name: perm ? this.displayName(perm) : (firstDep?.sourcePermissionName ?? firstDep?.sourcePermissionCode ?? ''),
        groupId: perm?.permissionGroupId ?? '',
        groupName: perm?.permissionGroupName ?? '',
        directCount: deps.length,
        tree: buildTree(sourceId, new Set([sourceId]))
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }

  get filteredRows(): DependencySourceRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.rows.filter(row => {
      const matchesGroup = !this.selectedGroupId || row.groupId === this.selectedGroupId;
      const matchesSearch = !term
        || row.code.toLowerCase().includes(term)
        || row.name.toLowerCase().includes(term);
      return matchesGroup && matchesSearch;
    });
  }

  isRowExpanded(id: string): boolean {
    return this.expandedRowIds.has(id);
  }

  toggleRow(id: string): void {
    if (this.expandedRowIds.has(id)) {
      this.expandedRowIds.delete(id);
    } else {
      this.expandedRowIds.add(id);
    }
  }

  isTreeExpanded(id: string): boolean {
    return this.expandedTreeIds.has(id);
  }

  toggleTree(id: string): void {
    if (this.expandedTreeIds.has(id)) {
      this.expandedTreeIds.delete(id);
    } else {
      this.expandedTreeIds.add(id);
    }
  }
}
