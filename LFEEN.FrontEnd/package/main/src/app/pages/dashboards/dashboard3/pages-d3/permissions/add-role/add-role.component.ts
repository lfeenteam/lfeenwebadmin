import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { EMPTY, forkJoin, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { switchMap, map, catchError, distinctUntilChanged, tap } from 'rxjs/operators';
import { DepartmentService } from '../../../services/department.service';
import { Department, PermissionGroup, RolePayload, RolePermission } from '../../../interfaces/department.model';
import { extractApiErrorMessage } from '../../../utils/api-error.util';
import { resolveBilingualText } from '../../../utils/bilingual.util';
import { resolveTransitiveImpliedIds } from '../../../utils/permission-graph.util';
import { PageBreadcrumbTrailService } from '../../../services/page-breadcrumb-trail.service';
import { applyRoleNameServerError, RoleNameField } from '../../../utils/role-error.util';

interface PermissionRow extends RolePermission {
  selected: boolean;
}

interface PermissionGroupSection {
  id: string;
  name: string;
  perms: PermissionRow[];
}

@Component({
  selector: 'app-add-role',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, ReactiveFormsModule, RouterModule, TranslateModule],
  templateUrl: './add-role.component.html',
  styleUrl: './add-role.component.scss'
})
export class AddRoleComponent implements OnInit, OnDestroy {
  private readonly subs = new Subscription();
  /** Reload for the same department (retry, language change) — keeps the picked permissions. */
  private readonly reload$ = new Subject<void>();
  deptId: string | null = null;
  deptName = '';
  deptEnglishName = '';
  employeeCount = 0;

  roleForm: FormGroup;
  showNameSecondary = false;
  showDescSecondary = false;

  permissions: PermissionRow[] = [];
  groupedPermissions: PermissionGroupSection[] = [];
  collapsedGroups = new Set<string>();
  private collapseInitialized = false;
  currentPage = 1;
  readonly groupsPerPage = 10;
  isLoadingPerms = true;
  permsLoadError = false;
  isSubmitting = false;
  /** Set once save is attempted with no permission selected; the hint hides again as soon as one is picked. */
  noPermsError = false;

  departments: Department[] = [];

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private toastr: ToastrService,
    private pageBreadcrumbTrail: PageBreadcrumbTrailService
  ) {
    this.roleForm = this.fb.group({
      nameAr: [''],
      nameEn: [''],
      descriptionAr: [''],
      descriptionEn: [''],
      isManagerRole: [false],
      departmentId: ['']
    });
  }

  private updateValidators(): void {
    const nameAr = this.roleForm.get('nameAr')!;
    const nameEn = this.roleForm.get('nameEn')!;
    if (this.currentLang === 'ar') {
      nameAr.setValidators([Validators.required, Validators.minLength(2)]);
      nameEn.clearValidators();
    } else {
      nameEn.setValidators([Validators.required, Validators.minLength(2)]);
      nameAr.clearValidators();
    }
    nameAr.updateValueAndValidity();
    nameEn.updateValueAndValidity();
  }

  ngOnInit(): void {
    this.updateValidators();

    // The component is reused when only the department id in the URL changes (address bar,
    // back/forward), so follow the URL instead of reading the id once from the snapshot.
    const params$ = this.route.paramMap.pipe(
      map(p => p.get('id')),
      distinctUntilChanged(),
      tap(deptId => {
        this.deptId = deptId;
        this.resetState();
      }),
      map(() => false)
    );

    this.subs.add(
      merge(
        params$,
        this.reload$.pipe(map(() => true)),
        this.translate.onLangChange.pipe(
          tap(() => this.updateValidators()),
          map(() => true)
        )
      )
        // A newer department cancels the previous requests, so a late answer never lands on the new one.
        .pipe(switchMap(keepSelection => this.loadData(keepSelection)))
        .subscribe()
    );
  }

  /** Clears everything tied to the previous department so a new role starts clean. */
  private resetState(): void {
    this.deptName = '';
    this.deptEnglishName = '';
    this.employeeCount = 0;
    this.departments = [];
    this.permissions = [];
    this.groupedPermissions = [];
    this.collapsedGroups.clear();
    this.collapseInitialized = false;
    this.currentPage = 1;
    this.noPermsError = false;
    this.showNameSecondary = false;
    this.showDescSecondary = false;
    this.roleForm.reset({
      nameAr: '',
      nameEn: '',
      descriptionAr: '',
      descriptionEn: '',
      isManagerRole: false,
      departmentId: ''
    });
    this.isLoadingPerms = true;
    this.permsLoadError = false;
    this.pageBreadcrumbTrail.clear();
  }

  private loadData(keepSelection: boolean): Observable<unknown> {
    const deptId = this.deptId;
    const selectedIds = new Set(
      keepSelection
        ? this.permissions.filter(permission => permission.selected).map(permission => permission.id)
        : []
    );

    this.isLoadingPerms = true;
    this.permsLoadError = false;
    return forkJoin({
      perms: this.departmentService.getPermissions(500),
      groups: this.departmentService.getAllPermissionGroupsForDropdown(),
      ...(deptId
        ? { dept: this.departmentService.getDepartmentById(deptId) }
        : { allDepts: this.departmentService.getAllDepartmentsForDropdown() })
    }).pipe(
      tap((res: any) => {
        this.permissions = (res.perms as RolePermission[]).map(permission => ({
          ...permission,
          selected: selectedIds.has(permission.id)
        }));
        this.buildGroups((res.groups as PermissionGroup[]) ?? []);
        if (res.dept) {
          this.deptName = res.dept.nameAr ?? res.dept.name ?? '';
          this.deptEnglishName = res.dept.nameEn ?? res.dept.name ?? '';
          this.employeeCount = res.dept.employeeCount;
          const lang = this.currentLang;
          this.pageBreadcrumbTrail.set([
            {
              label: lang === 'ar' ? this.deptName : this.deptEnglishName,
              translate: false,
              route: ['/', lang, 'd3', 'permissions', deptId ?? '']
            }
          ]);
        }
        if (res.allDepts) {
          this.departments = res.allDepts;
        }
        this.isLoadingPerms = false;
      }),
      catchError(err => {
        // e.g. a department id that doesn't exist (400) — show the error, never the previous department
        this.deptName = '';
        this.deptEnglishName = '';
        this.employeeCount = 0;
        this.permissions = [];
        this.groupedPermissions = [];
        this.pageBreadcrumbTrail.clear();
        this.isLoadingPerms = false;
        this.permsLoadError = true;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.addRolePage.loadError')));
        return EMPTY;
      })
    );
  }

  retryLoad(): void {
    this.reload$.next();
  }

  get selectedCount(): number {
    return this.permissions.filter(p => p.selected).length;
  }

  get primaryNameField(): RoleNameField {
    return this.currentLang === 'ar' ? 'nameAr' : 'nameEn';
  }

  get secondaryNameField(): RoleNameField {
    return this.currentLang === 'ar' ? 'nameEn' : 'nameAr';
  }

  nameInvalid(field: RoleNameField): boolean {
    const c = this.roleForm.get(field);
    return !!(c?.invalid && c?.touched);
  }

  /** Server message (e.g. duplicate name) wins over the local "required" text. */
  nameError(field: RoleNameField): string {
    const c = this.roleForm.get(field);
    const server = c?.getError('serverError');
    if (server) return server;
    return c?.hasError('required') || c?.hasError('minlength')
      ? this.translate.instant('d3.addRolePage.validation.nameRequired')
      : '';
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

    // Start with every group collapsed — the user opens the ones they need
    if (!this.collapseInitialized) {
      this.groupedPermissions.forEach(s => this.collapsedGroups.add(s.id));
      this.collapseInitialized = true;
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.groupedPermissions.length / this.groupsPerPage));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  /** Groups shown on the current page. */
  get pagedGroups(): PermissionGroupSection[] {
    const page = Math.min(this.currentPage, this.totalPages);
    const start = (page - 1) * this.groupsPerPage;
    return this.groupedPermissions.slice(start, start + this.groupsPerPage);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  isGroupCollapsed(id: string): boolean {
    return this.collapsedGroups.has(id);
  }

  toggleGroupCollapse(id: string): void {
    if (this.collapsedGroups.has(id)) this.collapsedGroups.delete(id);
    else this.collapsedGroups.add(id);
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

    // Deselecting a whole group: turn off what we can, collect the blocked ones
    // and show a single combined warning instead of one toast per permission.
    const blocked: string[] = [];
    for (const p of section.perms) {
      if (!p.selected) continue;
      const outsideDependents = this.blockingDependents(p).filter(d => !section.perms.includes(d));
      if (outsideDependents.length > 0) blocked.push(this.permDisplayName(p));
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

  /** Currently-selected permissions that transitively require `perm`. */
  private blockingDependents(perm: PermissionRow): PermissionRow[] {
    return this.permissions.filter(
      p => p.selected && p.id !== perm.id && this.impliedIdsOf(p.id).has(perm.id)
    );
  }

  /** A selected permission that another selected permission depends on — can't be turned off directly. */
  isLocked(perm: PermissionRow): boolean {
    return perm.selected && this.blockingDependents(perm).length > 0;
  }

  permDisplayName(perm: PermissionRow): string {
    return resolveBilingualText(this.currentLang, perm.nameAr, perm.nameEn, perm.name);
  }

  permDisplayDescription(perm: PermissionRow): string {
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
          names: dependents.map(d => this.permDisplayName(d)).join('، ')
        })
      );
      return;
    }
    perm.selected = false;
  }

  private get backRoute(): string {
    return this.deptId
      ? `/${this.currentLang}/d3/permissions/${this.deptId}`
      : `/${this.currentLang}/d3/roles`;
  }

  save(): void {
    // Never create a role while the department behind the URL isn't loaded (or doesn't exist)
    if (this.isSubmitting || this.isLoadingPerms || this.permsLoadError) return;

    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.toastr.warning(
        this.translate.instant('d3.toast.fillRequired')
      );
      return;
    }

    // A role is created first and its permissions are assigned in a second request,
    // so the backend can't enforce this — a new role with no permissions is useless.
    if (this.selectedCount === 0) {
      this.noPermsError = true;
      this.toastr.warning(this.translate.instant('d3.addRolePage.validation.permissionsRequired'));
      return;
    }

    this.isSubmitting = true;
    const v = this.roleForm.value;
    // Pin the department shown when save was pressed; the URL may change while the request runs.
    const deptId = this.deptId;
    const backRoute = this.backRoute;

    const payload: RolePayload = {
      nameAr: v.nameAr || v.nameEn,
      nameEn: v.nameEn || v.nameAr,
      descriptionAr: v.descriptionAr || v.descriptionEn,
      descriptionEn: v.descriptionEn || v.descriptionAr,
      isManagerRole: v.isManagerRole,
      ...((deptId || v.departmentId) ? { departmentId: deptId || v.departmentId } : {})
    };

    this.departmentService.createRole(payload).pipe(
      switchMap((newRole: any) => {
        const roleId = newRole?.id ?? newRole?.data?.id;
        const selectedIds = this.permissions.filter(p => p.selected).map(p => p.id);
        if (!roleId || selectedIds.length === 0) {
          return of({ permsFailed: false });
        }
        return this.departmentService.bulkAssignPermissions(roleId, selectedIds).pipe(
          map(() => ({ permsFailed: false })),
          catchError(() => of({ permsFailed: true }))
        );
      })
    ).subscribe({
      next: (result: { permsFailed: boolean }) => {
        this.isSubmitting = false;
        if (result.permsFailed) {
          this.toastr.warning(this.translate.instant('d3.addRolePage.roleCreatedPermsFailed'));
        } else {
          this.toastr.success(this.translate.instant('d3.toast.addRoleSuccess'));
        }
        // Only leave the page if it still shows the department the role was created in
        if (deptId === this.deptId) this.router.navigate([backRoute]);
      },
      error: (err) => {
        this.isSubmitting = false;
        if (deptId !== this.deptId) {
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.saveError')));
          return;
        }
        const field = applyRoleNameServerError(err, this.roleForm);
        if (field && field !== this.primaryNameField) this.showNameSecondary = true;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.saveError')));
      }
    });
  }

  cancel(): void {
    this.router.navigate([this.backRoute]);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.pageBreadcrumbTrail.clear();
  }
}
