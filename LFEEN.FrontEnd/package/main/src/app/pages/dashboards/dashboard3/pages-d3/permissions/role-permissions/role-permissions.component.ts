import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of, Subscription } from 'rxjs';
import { DepartmentService } from '../../../services/department.service';
import { DepartmentManager, PermissionGroup, RolePermission } from '../../../interfaces/department.model';
import { PageTitleOverrideService } from '../../../services/page-title-override.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { extractApiErrorMessage } from '../../../utils/api-error.util';
import { resolveBilingualText } from '../../../utils/bilingual.util';
import { resolveTransitiveImpliedIds } from '../../../utils/permission-graph.util';

interface PermissionRow extends RolePermission {
  selected: boolean;
}

interface PermissionGroupSection {
  id: string;
  name: string;
  perms: PermissionRow[];
}

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './role-permissions.component.html',
  styleUrl: './role-permissions.component.scss'
})
export class RolePermissionsComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;
  deptId: string | null = null;
  roleId: string | null = null;

  deptName = '';
  managers: DepartmentManager[] = [];
  employeeCount = 0;
  roleName = '';
  hasDepartmentContext = false;

  isLoading = true;
  loadError = false;
  isSaving = false;

  permissions: PermissionRow[] = [];
  private originalSelectedIds = new Set<string>();
  groupedPermissions: PermissionGroupSection[] = [];
  collapsedGroups = new Set<string>();
  private collapseInitialized = false;
  currentPage = 1;
  readonly groupsPerPage = 10;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private toastr: ToastrService,
    private pageTitleOverride: PageTitleOverrideService
  ) {
    this.deptId = this.route.snapshot.paramMap.get('id');
    this.roleId = this.route.snapshot.paramMap.get('roleId');
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get backRoute(): string {
    return this.deptId
      ? `/${this.currentLang}/d3/permissions/${this.deptId}`
      : `/${this.currentLang}/d3/roles`;
  }

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => this.loadData());
    this.loadData();
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.pageTitleOverride.clear();
  }

  private loadData(): void {
    if (!this.roleId) return;
    this.isLoading = true;
    this.loadError = false;

    // Preserve in-progress edits across a language refresh
    const keptSelected = new Set(this.permissions.filter(p => p.selected).map(p => p.id));
    const wasTouched = this.isDirty;

    forkJoin({
      perms: this.departmentService.getPermissions(500),
      groups: this.departmentService.getAllPermissionGroupsForDropdown(),
      rolePerms: this.departmentService.getRolePermissions(this.roleId),
      role: this.departmentService.getRoleById(this.roleId),
      dept: this.deptId ? this.departmentService.getDepartmentById(this.deptId) : of(null)
    }).subscribe({
      next: ({ perms, groups, rolePerms, role, dept }) => {
        this.originalSelectedIds = new Set(rolePerms.map(p => p.id));
        this.permissions = perms.map(p => ({
          ...p,
          selected: wasTouched ? keptSelected.has(p.id) : this.originalSelectedIds.has(p.id)
        }));
        this.buildGroups(groups);

        this.hasDepartmentContext = !!dept;
        if (dept) {
          this.deptName = resolveBilingualText(this.currentLang, dept.nameAr, dept.nameEn, dept.name);
          this.managers = dept.managers?.length
            ? dept.managers
            : (dept.managerFullName ? [{ id: '', fullName: dept.managerFullName, avatar: dept.managerAvatar }] : []);
          this.employeeCount = dept.employeeCount;
        } else {
          this.deptName = resolveBilingualText(
            this.currentLang, role.departmentNameAr, role.departmentNameEn, role.departmentName
          );
        }
        this.roleName = resolveBilingualText(this.currentLang, role.nameAr, role.nameEn, role.name);
        this.pageTitleOverride.set(this.roleName);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = true;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.addRolePage.loadError')));
      }
    });
  }

  retryLoad(): void {
    this.loadData();
  }

  // ── Grouping ────────────────────────────────────────────────
  private buildGroups(groups: PermissionGroup[]): void {
    const order = new Map<string, number>();
    const nameById = new Map<string, string>();
    groups.forEach((g, i) => {
      order.set(g.id, i);
      nameById.set(g.id, resolveBilingualText(this.currentLang, g.nameAr, g.nameEn, g.name));
    });

    const sections = new Map<string, PermissionGroupSection>();
    for (const perm of this.permissions) {
      const gid = perm.permissionGroupId || '__ungrouped__';
      let section = sections.get(gid);
      if (!section) {
        section = {
          id: gid,
          name: nameById.get(gid)
            || perm.permissionGroupName
            || this.translate.instant('d3.addRolePage.ungrouped'),
          perms: []
        };
        sections.set(gid, section);
      }
      section.perms.push(perm);
    }

    this.groupedPermissions = Array.from(sections.values()).sort((a, b) => {
      const oa = order.has(a.id) ? order.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const ob = order.has(b.id) ? order.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.name.localeCompare(b.name, this.currentLang);
    });

    if (!this.collapseInitialized) {
      this.groupedPermissions.forEach(s => this.collapsedGroups.add(s.id));
      this.collapseInitialized = true;
    }
  }

  // ── Pagination (by group) ──────────────────────────────────
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.groupedPermissions.length / this.groupsPerPage));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get pagedGroups(): PermissionGroupSection[] {
    const page = Math.min(this.currentPage, this.totalPages);
    const start = (page - 1) * this.groupsPerPage;
    return this.groupedPermissions.slice(start, start + this.groupsPerPage);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  // ── Collapse ───────────────────────────────────────────────
  isGroupCollapsed(id: string): boolean {
    return this.collapsedGroups.has(id);
  }

  toggleGroupCollapse(id: string): void {
    if (this.collapsedGroups.has(id)) this.collapsedGroups.delete(id);
    else this.collapsedGroups.add(id);
  }

  // ── Selection ──────────────────────────────────────────────
  get selectedCount(): number {
    return this.permissions.filter(p => p.selected).length;
  }

  get allPermissionsSelected(): boolean {
    return this.permissions.length > 0 && this.permissions.every(p => p.selected);
  }

  toggleSelectAll(): void {
    const selectAll = !this.allPermissionsSelected;
    this.permissions.forEach(p => p.selected = selectAll);
    if (selectAll) {
      this.collapsedGroups.clear();
    } else {
      this.groupedPermissions.forEach(g => this.collapsedGroups.add(g.id));
    }
  }

  selectedInGroup(section: PermissionGroupSection): number {
    return section.perms.filter(p => p.selected).length;
  }

  groupState(section: PermissionGroupSection): 'all' | 'some' | 'none' {
    const n = this.selectedInGroup(section);
    if (n === 0) return 'none';
    return n === section.perms.length ? 'all' : 'some';
  }

  toggleGroup(section: PermissionGroupSection): void {
    const select = this.groupState(section) !== 'all';

    if (select) {
      this.collapsedGroups.delete(section.id);
      section.perms.forEach(p => { if (!p.selected) this.togglePermission(p, true); });
      return;
    }

    const blocked: string[] = [];
    for (const p of section.perms) {
      if (!p.selected) continue;
      const outsideDependents = this.blockingDependents(p).filter(d => !section.perms.includes(d));
      if (outsideDependents.length > 0) blocked.push(this.permName(p));
      else p.selected = false;
    }
    if (blocked.length > 0) {
      this.toastr.warning(
        this.translate.instant('d3.addRolePage.dependencyBlocked', { names: blocked.join('، ') })
      );
    }
  }

  private impliedIdsOf(permId: string): Set<string> {
    return resolveTransitiveImpliedIds(permId, id => this.permissions.find(p => p.id === id)?.impliedPermissionIds);
  }

  private blockingDependents(perm: PermissionRow): PermissionRow[] {
    return this.permissions.filter(
      p => p.selected && p.id !== perm.id && this.impliedIdsOf(p.id).has(perm.id)
    );
  }

  isLocked(perm: PermissionRow): boolean {
    return perm.selected && this.blockingDependents(perm).length > 0;
  }

  permName(perm: RolePermission): string {
    return resolveBilingualText(this.currentLang, perm.nameAr, perm.nameEn, perm.name);
  }

  permDescription(perm: RolePermission): string {
    return resolveBilingualText(this.currentLang, perm.descriptionAr, perm.descriptionEn, perm.description);
  }

  togglePermission(perm: PermissionRow, checked: boolean): void {
    if (checked) {
      perm.selected = true;
      this.impliedIdsOf(perm.id).forEach(id => {
        const implied = this.permissions.find(p => p.id === id);
        if (implied) implied.selected = true;
      });
      return;
    }

    const dependents = this.blockingDependents(perm);
    if (dependents.length > 0) {
      this.toastr.warning(
        this.translate.instant('d3.addRolePage.dependencyBlocked', {
          names: dependents.map(d => this.permName(d)).join('، ')
        })
      );
      return;
    }
    perm.selected = false;
  }

  // ── Save (diff against the original assignment) ─────────────
  get isDirty(): boolean {
    if (this.permissions.length === 0) return false;
    const current = this.permissions.filter(p => p.selected);
    if (current.length !== this.originalSelectedIds.size) return true;
    return current.some(p => !this.originalSelectedIds.has(p.id));
  }

  save(): void {
    if (!this.roleId || !this.isDirty || this.isSaving) return;

    const currentIds = new Set(this.permissions.filter(p => p.selected).map(p => p.id));
    const toAdd = [...currentIds].filter(id => !this.originalSelectedIds.has(id));
    const toRemove = [...this.originalSelectedIds].filter(id => !currentIds.has(id));

    this.isSaving = true;
    const ops = [
      toAdd.length ? this.departmentService.bulkAssignPermissions(this.roleId, toAdd) : of(null),
      ...toRemove.map(id => this.departmentService.deleteRolePermission(this.roleId!, id))
    ];

    forkJoin(ops).subscribe({
      next: () => {
        this.isSaving = false;
        this.originalSelectedIds = new Set(currentIds);
        this.toastr.success(this.translate.instant('d3.permissions.rolePermsEdit.saveSuccess'));
        this.router.navigate([this.backRoute]);
      },
      error: (err) => {
        this.isSaving = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.saveError')));
        this.loadData();
      }
    });
  }

  cancel(): void {
    this.router.navigate([this.backRoute]);
  }
}
