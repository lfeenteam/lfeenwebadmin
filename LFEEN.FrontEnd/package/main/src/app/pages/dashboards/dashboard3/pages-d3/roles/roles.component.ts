import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { isForbiddenError } from '../../utils/transport-error.util';
import { Subscription, forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DepartmentService } from '../../services/department.service';
import { Department, DepartmentRole } from '../../interfaces/department.model';
import { AddRoleDialogComponent } from '../permissions/components/add-role-dialog/add-role-dialog.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import { resolveBilingualText } from '../../utils/bilingual.util';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { PermissionService } from '../../services/permission.service';
import { AppPluralPipe } from 'src/app/pipes/app-plural.pipe';
import { CountUpDirective } from '../../directives/count-up.directive';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  departmentId: string | null;
  departmentName: string;
  isManagerRole: boolean;
  raw: DepartmentRole;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, FormsModule, RouterModule, TranslateModule, DashboardEmptyComponent, AppPluralPipe, CountUpDirective],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;
  private perms = inject(PermissionService);
  /** Add/edit/delete need a Roles write permission; Roles.View-only admins just browse (BUG-2739). */
  readonly canManage = computed(() => this.perms.canWrite('roles'));

  isLoading = true;
  loadError = false;
  /** The failed load was a 403 — the inline error says "no permission" (BUG-2496). */
  loadForbidden = false;
  deletingId: string | null = null;

  departments: Department[] = [];
  allRoles: RoleRow[] = [];
  roles: RoleRow[] = [];

  /** '' = all, NO_DEPT = roles without a department, otherwise a department id. */
  selectedDeptFilter = '';
  searchQuery = '';
  readonly NO_DEPT = '__none';

  private readonly deptTones = [
    { soft: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
    { soft: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6' },
    { soft: '#ECFDF5', text: '#047857', dot: '#10B981' },
    { soft: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
    { soft: '#FDF2F8', text: '#BE185D', dot: '#EC4899' },
    { soft: '#ECFEFF', text: '#0E7490', dot: '#06B6D4' },
  ];

  /** Summary over every loaded role (the API returns them all; paging is client-side). */
  get stats() {
    const withDept = this.allRoles.filter(r => !!r.departmentId);
    return {
      total: this.allRoles.length,
      managers: this.allRoles.filter(r => r.isManagerRole).length,
      departments: new Set(withDept.map(r => r.departmentId)).size,
      noDepartment: this.allRoles.length - withDept.length,
    };
  }

  /** Department chips: all, each department that has roles (with its count), then "no department". */
  get deptChips(): { value: string; label: string; count: number }[] {
    const counts = new Map<string, { label: string; count: number }>();
    for (const r of this.allRoles) {
      if (!r.departmentId) continue;
      const entry = counts.get(r.departmentId) ?? { label: r.departmentName, count: 0 };
      entry.count++;
      counts.set(r.departmentId, entry);
    }
    const chips = [{ value: '', label: this.translate.instant('d3.rolesPage.allDepartments'), count: this.allRoles.length }];
    counts.forEach((v, id) => chips.push({ value: id, label: v.label, count: v.count }));
    const none = this.stats.noDepartment;
    if (none > 0) chips.push({ value: this.NO_DEPT, label: this.translate.instant('d3.rolesPage.noDepartment'), count: none });
    return chips;
  }

  /** How many departments get their own chip; the rest go in the "more departments" menu. */
  readonly visibleDeptCount = 4;

  /** Departments with roles, busiest first (ties keep API order). */
  private get rankedDeptChips(): { value: string; label: string; count: number }[] {
    return this.deptChips
      .filter(c => c.value && c.value !== this.NO_DEPT)
      .map((c, i) => ({ c, i }))
      .sort((a, b) => b.c.count - a.c.count || a.i - b.i)
      .map(x => x.c);
  }

  /** "All", the busiest departments, then "no department" — always one short row. */
  get visibleChips(): { value: string; label: string; count: number }[] {
    const all = this.deptChips;
    const none = all.find(c => c.value === this.NO_DEPT);
    return [all[0], ...this.rankedDeptChips.slice(0, this.visibleDeptCount), ...(none ? [none] : [])];
  }

  get overflowChips(): { value: string; label: string; count: number }[] {
    return this.rankedDeptChips.slice(this.visibleDeptCount);
  }

  /** The selected department when it lives in the overflow menu (its button shows it). */
  get selectedOverflowChip(): { value: string; label: string; count: number } | undefined {
    return this.overflowChips.find(c => c.value === this.selectedDeptFilter);
  }

  /** Stable colour per department, so the same department always reads the same. */
  deptTone(departmentId: string | null): { soft: string; text: string; dot: string } {
    if (!departmentId) return { soft: '#F1F5F9', text: '#475569', dot: '#94A3B8' };
    let hash = 0;
    for (let i = 0; i < departmentId.length; i++) hash = (hash * 31 + departmentId.charCodeAt(i)) >>> 0;
    return this.deptTones[hash % this.deptTones.length];
  }

  selectDept(value: string): void {
    this.selectedDeptFilter = value;
    this.applyFilter();
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.applyFilter();
  }

  currentPage = 1;
  pageSize = 10;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.roles.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get pagedRoles(): RoleRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.roles.slice(start, start + this.pageSize);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
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

  loadData(): void {
    this.isLoading = true;
    this.loadError = false;
    this.loadForbidden = false;
    forkJoin({
      roles: this.departmentService.getAllRolesForDropdown(),
      departments: this.departmentService.getAllDepartmentsForDropdown()
    }).subscribe({
      next: ({ roles, departments }) => {
        this.departments = departments;
        this.allRoles = roles.map(role => this.toRow(role));
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        this.loadForbidden = isForbiddenError(err);
        // Clear the table so a failed load never reads as "no roles yet".
        this.allRoles = [];
        this.roles = [];
        this.isLoading = false;
        this.loadError = true;
      }
    });
  }

  private toRow(role: DepartmentRole): RoleRow {
    return {
      id: role.id,
      name: resolveBilingualText(this.currentLang, role.nameAr, role.nameEn, role.name),
      description: resolveBilingualText(this.currentLang, role.descriptionAr, role.descriptionEn, role.description),
      departmentId: role.departmentId,
      departmentName: role.departmentId
        ? resolveBilingualText(this.currentLang, role.departmentNameAr, role.departmentNameEn, role.departmentName)
        : '',
      isManagerRole: role.isManagerRole,
      raw: role
    };
  }

  private recomputeRoles(): void {
    const dept = this.selectedDeptFilter;
    const q = this.searchQuery.trim().toLowerCase();
    this.roles = this.allRoles.filter(r =>
      (!dept || (dept === this.NO_DEPT ? !r.departmentId : r.departmentId === dept)) &&
      (!q || r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)));
  }

  applyFilter(): void {
    this.recomputeRoles();
    this.currentPage = 1;
  }

  openAddRole(): void {
    if (!this.canManage()) return;
    this.router.navigate([`/${this.currentLang}/d3/roles/add`]);
  }

  viewPermissions(role: RoleRow): void {
    this.router.navigate([this.currentLang, 'd3', 'roles', role.id]);
  }

  editRole(role: RoleRow): void {
    if (!this.canManage()) return;
    const ref = this.dialog.open(AddRoleDialogComponent, {
      width: '560px',
      maxWidth: '600px',
      maxHeight: '100vh',
      panelClass: 'role-dialog-panel',
      data: { departmentId: role.departmentId, role: role.raw, deptName: role.departmentName }
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const index = this.allRoles.findIndex(r => r.id === role.id);
      if (index !== -1) {
        this.allRoles[index] = this.toRow({ ...role.raw, ...result });
        this.recomputeRoles();
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
        }
      }
    });
  }

  deleteRole(role: RoleRow): void {
    if (!this.canManage()) return;
    this.departmentService.getEmployeeCountForRole(role.id).subscribe({
      next: (count) => this.confirmDeleteRole(role, count),
      error: () => this.confirmDeleteRole(role, 0)
    });
  }

  private confirmDeleteRole(role: RoleRow, employeeCount: number): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('d3.toast.deleteRoleTitle'),
        message: employeeCount > 0
          ? this.translate.instant('d3.toast.deleteRoleMessageWithEmployees', { count: employeeCount })
          : this.translate.instant('d3.toast.deleteRoleMessage')
      },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deletingId = role.id;
      this.departmentService.deleteRole(role.id).subscribe({
        next: () => {
          this.deletingId = null;
          this.toastr.success(this.translate.instant('d3.toast.deleteRoleSuccess'));
          this.loadData();
        },
        error: (err) => {
          this.deletingId = null;
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.deleteError')));
        }
      });
    });
  }
}
