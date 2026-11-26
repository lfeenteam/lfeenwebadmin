import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { EMPTY, forkJoin, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { DepartmentService } from '../../../services/department.service';
import { DepartmentManager, PermissionGroup, RolePermission } from '../../../interfaces/department.model';
import { PageTitleOverrideService } from '../../../services/page-title-override.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { extractApiErrorMessage } from '../../../utils/api-error.util';
import { resolveBilingualText } from '../../../utils/bilingual.util';
import { resolveTransitiveImpliedIds } from '../../../utils/permission-graph.util';
import { buildPermissionTree, PermissionTreeGroup } from '../../../utils/permission-tree.util';
import { MatDialog } from '@angular/material/dialog';
import { PermissionService } from '../../../services/permission.service';
import {
  OfferConfirmDialogComponent,
  OfferConfirmDialogData,
} from '../../platform-offers/components/offer-confirm-dialog/offer-confirm-dialog.component';
import {
  PermissionTreeComponent,
  PermissionGroupAction,
  SelectablePermission
} from '../components/permission-tree/permission-tree.component';

type PermissionRow = SelectablePermission;
type PermissionGroupSection = PermissionTreeGroup<PermissionRow>;

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule, PermissionTreeComponent],
  templateUrl: './role-permissions.component.html',
  styleUrl: './role-permissions.component.scss'
})
export class RolePermissionsComponent implements OnInit, OnDestroy {
  private readonly subs = new Subscription();
  /** Reload the same role (retry, language change, failed save) — keeps in-progress edits. */
  private readonly reload$ = new Subject<void>();
  private perms = inject(PermissionService);
  /** This page both views and edits a role: without a Roles write permission it is read-only (BUG-2739). */
  readonly canManage = computed(() => this.perms.canWrite('roles'));
  deptId: string | null = null;
  roleId: string | null = null;

  deptName = '';
  managers: DepartmentManager[] = [];
  employeeCount = 0;
  roleName = '';
  roleDescription = '';
  hasDepartmentContext = false;

  isLoading = true;
  loadError = false;
  isSaving = false;

  permissions: PermissionRow[] = [];
  private originalSelectedIds = new Set<string>();
  groupedPermissions: PermissionGroupSection[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private toastr: ToastrService,
    private pageTitleOverride: PageTitleOverrideService,
    private dialog: MatDialog
  ) {}

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get backRoute(): string {
    return this.deptId
      ? `/${this.currentLang}/d3/permissions/${this.deptId}`
      : `/${this.currentLang}/d3/roles`;
  }

  ngOnInit(): void {
    // The component is reused when only the route params change (address bar, back/forward),
    // so the ids must follow the URL instead of being read once from the snapshot.
    const params$ = this.route.paramMap.pipe(
      map(p => ({ deptId: p.get('id'), roleId: p.get('roleId') })),
      distinctUntilChanged((a, b) => a.deptId === b.deptId && a.roleId === b.roleId),
      tap(({ deptId, roleId }) => {
        this.deptId = deptId;
        this.roleId = roleId;
        this.resetState();
      }),
      map(() => false)
    );

    this.subs.add(
      merge(
        params$,
        this.reload$.pipe(map(() => true)),
        this.translate.onLangChange.pipe(map(() => true))
      )
        // A newer id cancels the previous requests, so a late answer for the old role never lands on the new one.
        .pipe(switchMap(keepEdits => this.loadData(keepEdits)))
        .subscribe()
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.pageTitleOverride.clear();
  }

  /** Clears everything shown for the previous role so none of it leaks onto the new one. */
  private resetState(): void {
    this.permissions = [];
    this.originalSelectedIds = new Set<string>();
    this.groupedPermissions = [];
    this.deptName = '';
    this.managers = [];
    this.employeeCount = 0;
    this.roleName = '';
    this.roleDescription = '';
    this.hasDepartmentContext = false;
    this.isLoading = true;
    this.loadError = false;
    this.pageTitleOverride.clear();
  }

  private loadData(keepEdits: boolean): Observable<unknown> {
    const roleId = this.roleId;
    const deptId = this.deptId;
    if (!roleId) {
      this.isLoading = false;
      this.loadError = true;
      return EMPTY;
    }
    this.isLoading = true;
    this.loadError = false;

    // Preserve in-progress edits across a reload of the same role (language change, retry)
    const keptSelected = new Set(this.permissions.filter(p => p.selected).map(p => p.id));
    const wasTouched = keepEdits && this.isDirty;

    return forkJoin({
      perms: this.departmentService.getPermissions(500),
      groups: this.departmentService.getAllPermissionGroupsForDropdown(),
      rolePerms: this.departmentService.getRolePermissions(roleId),
      role: this.departmentService.getRoleById(roleId),
      dept: deptId ? this.departmentService.getDepartmentById(deptId) : of(null)
    }).pipe(
      tap(({ perms, groups, rolePerms, role, dept }) => {
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
        // The role's own description; empty → nothing is shown (no placeholder text).
        this.roleDescription = (
          resolveBilingualText(this.currentLang, role.descriptionAr, role.descriptionEn, role.description) || ''
        ).trim();
        this.pageTitleOverride.set(this.roleName);
        this.isLoading = false;
      }),
      catchError(err => {
        // A new role id: drop the previous role's data so the error isn't shown on top of it.
        // Reloading the same role (retry, language change, failed save): keep the admin's unsaved edits.
        if (!keepEdits) this.resetState();
        this.isLoading = false;
        this.loadError = true;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.addRolePage.loadError')));
        return EMPTY;
      })
    );
  }

  retryLoad(): void {
    this.reload$.next();
  }

  // ── Grouping ────────────────────────────────────────────────
  /** Top-level groups, each holding its sub-groups. */
  private buildGroups(groups: PermissionGroup[]): void {
    this.groupedPermissions = buildPermissionTree(
      this.permissions,
      groups,
      this.currentLang,
      this.translate.instant('d3.addRolePage.ungrouped')
    );
  }

  // ── Selection ──────────────────────────────────────────────
  get selectedCount(): number {
    return this.permissions.filter(p => p.selected).length;
  }

  get allPermissionsSelected(): boolean {
    return this.permissions.length > 0 && this.permissions.every(p => p.selected);
  }

  toggleSelectAll(): void {
    if (!this.canManage()) return;
    const selectAll = !this.allPermissionsSelected;
    this.permissions.forEach(p => p.selected = selectAll);
  }

  /**
   * Group actions (the group checkbox and its quick links) cover the group and its sub-groups:
   * all = pick everything, none = clear, base = keep only the base (view) permissions.
   */
  applyGroupAction({ group, action }: PermissionGroupAction): void {
    if (!this.canManage()) return;
    const perms = group.allPerms;
    const keep = action === 'all' ? perms : action === 'base' ? perms.filter(p => p.isBase === true) : [];
    keep.forEach(p => { if (!p.selected) this.togglePermission(p, true); });

    // Clear the rest, dependents before what they depend on; anything still needed by a
    // permission outside the group stays on and is named in one combined warning.
    const pending = new Set(perms.filter(p => p.selected && !keep.includes(p)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of [...pending]) {
        if (this.blockingDependents(p).length === 0) {
          p.selected = false;
          pending.delete(p);
          changed = true;
        }
      }
    }
    if (pending.size > 0) {
      this.toastr.warning(
        this.translate.instant('d3.addRolePage.dependencyBlocked', {
          names: [...pending].map(p => this.permName(p)).join('، ')
        })
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

  /** Arrow function so the tree component can call it with this page as `this`. */
  readonly isLocked = (perm: PermissionRow): boolean =>
    perm.selected && this.blockingDependents(perm).length > 0;

  permName(perm: RolePermission): string {
    return resolveBilingualText(this.currentLang, perm.nameAr, perm.nameEn, perm.name);
  }

  togglePermission(perm: PermissionRow, checked: boolean): void {
    if (!this.canManage()) return;
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
    if (!this.canManage()) return;
    if (!this.roleId || !this.isDirty || this.isSaving || this.isLoading || this.loadError) return;
    // Pin the role the admin is looking at now; the URL may change while the dialog is open.
    const roleId = this.roleId;

    // Clearing every permission can be intentional (suspend the role without deleting it),
    // but it strips access from everyone assigned to it — so ask first.
    if (this.selectedCount === 0) {
      this.dialog.open<OfferConfirmDialogComponent, OfferConfirmDialogData, boolean>(OfferConfirmDialogComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'd3.permissions.rolePermsEdit.removeAllTitle',
          message: 'd3.permissions.rolePermsEdit.removeAllMessage',
          confirmLabel: 'd3.permissions.rolePermsEdit.removeAllConfirm',
          icon: 'shield-off',
          tone: 'danger',
        },
      }).afterClosed().subscribe(ok => { if (ok) this.persist(roleId); });
      return;
    }

    this.persist(roleId);
  }

  private persist(roleId: string): void {
    // The URL moved to another role (or it failed to load) since save was pressed — don't write anything.
    if (!this.canManage() || this.isSaving || this.isLoading || this.loadError || roleId !== this.roleId) return;

    const backRoute = this.backRoute;
    const currentIds = new Set(this.permissions.filter(p => p.selected).map(p => p.id));
    const toAdd = [...currentIds].filter(id => !this.originalSelectedIds.has(id));
    const toRemove = [...this.originalSelectedIds].filter(id => !currentIds.has(id));

    this.isSaving = true;
    const ops = [
      toAdd.length ? this.departmentService.bulkAssignPermissions(roleId, toAdd) : of(null),
      ...toRemove.map(id => this.departmentService.deleteRolePermission(roleId, id))
    ];

    forkJoin(ops).subscribe({
      next: () => {
        this.isSaving = false;
        this.toastr.success(this.translate.instant('d3.permissions.rolePermsEdit.saveSuccess'));
        // Only touch the page if it still shows the role that was saved
        if (roleId !== this.roleId) return;
        this.originalSelectedIds = new Set(currentIds);
        this.router.navigate([backRoute]);
      },
      error: (err) => {
        this.isSaving = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.saveError')));
        if (roleId === this.roleId) this.reload$.next();
      }
    });
  }

  cancel(): void {
    this.router.navigate([this.backRoute]);
  }
}
