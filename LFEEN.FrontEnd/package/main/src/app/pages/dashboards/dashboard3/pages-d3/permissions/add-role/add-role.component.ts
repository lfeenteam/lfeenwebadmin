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
import { buildPermissionTree, PermissionTreeGroup } from '../../../utils/permission-tree.util';
import { PageBreadcrumbTrailService } from '../../../services/page-breadcrumb-trail.service';
import { applyRoleNameServerError, RoleNameField } from '../../../utils/role-error.util';
import {
  PermissionTreeComponent,
  PermissionGroupAction,
  SelectablePermission
} from '../components/permission-tree/permission-tree.component';
import { AppPluralPipe } from 'src/app/pipes/app-plural.pipe';
import { FieldErrorDirective } from '../../../directives/field-error.directive';

type PermissionRow = SelectablePermission;
type PermissionGroupSection = PermissionTreeGroup<PermissionRow>;

@Component({
  selector: 'app-add-role',
  standalone: true,
  imports: [
    CommonModule, MaterialModule, TablerIconsModule, ReactiveFormsModule, RouterModule, TranslateModule,
    PermissionTreeComponent,
    AppPluralPipe,
    FieldErrorDirective
  ],
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

  // ── Live summary panel ──

  get summaryName(): string {
    return (this.roleForm.get(this.primaryNameField)?.value ?? '').trim();
  }

  /** The department the role will belong to: the scoped one, or the one picked in the form. */
  get summaryDept(): string {
    if (this.deptId) return this.currentLang === 'ar' ? this.deptName : (this.deptEnglishName || this.deptName);
    const id = this.roleForm.get('departmentId')?.value;
    const dept = id ? this.departments.find(d => d.id === id) : null;
    if (!dept) return '';
    return (this.currentLang === 'ar' ? (dept.nameAr ?? dept.name) : (dept.nameEn ?? dept.name)) ?? '';
  }

  get summaryIsManager(): boolean {
    return !!this.roleForm.get('isManagerRole')?.value;
  }

  /** The compact switch writes the same form control the old slide toggle used. */
  toggleManager(): void {
    const control = this.roleForm.get('isManagerRole');
    control?.setValue(!control.value);
    control?.markAsDirty();
  }

  get selectedPercent(): number {
    return this.permissions.length ? (this.selectedCount / this.permissions.length) * 100 : 0;
  }

  /** Top-level groups that have at least one selected permission, with how many. */
  get selectedByGroup(): { id: string; name: string; count: number }[] {
    return this.groupedPermissions
      .map(g => ({ id: g.id, name: g.name, count: g.allPerms.filter(p => p.selected).length }))
      .filter(g => g.count > 0);
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
  }

  /** Top-level groups, each holding its sub-groups. */
  private buildGroups(groups: PermissionGroup[]): void {
    this.groupedPermissions = buildPermissionTree(
      this.permissions,
      groups,
      this.currentLang,
      this.translate.instant('d3.addRolePage.ungrouped')
    );
  }

  /**
   * Group actions (the group checkbox and its quick links) cover the group and its sub-groups:
   * all = pick everything, none = clear, base = keep only the base (view) permissions.
   */
  applyGroupAction({ group, action }: PermissionGroupAction): void {
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
          names: [...pending].map(p => this.permDisplayName(p)).join('، ')
        })
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
  /** Arrow function so the tree component can call it with this page as `this`. */
  readonly isLocked = (perm: PermissionRow): boolean =>
    perm.selected && this.blockingDependents(perm).length > 0;

  permDisplayName(perm: PermissionRow): string {
    return resolveBilingualText(this.currentLang, perm.nameAr, perm.nameEn, perm.name);
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
