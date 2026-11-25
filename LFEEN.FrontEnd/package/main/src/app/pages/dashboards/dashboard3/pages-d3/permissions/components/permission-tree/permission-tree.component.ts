import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RolePermission } from '../../../../interfaces/department.model';
import { resolveBilingualText } from '../../../../utils/bilingual.util';
import { PermissionTreeGroup } from '../../../../utils/permission-tree.util';

export interface SelectablePermission extends RolePermission {
  selected: boolean;
}

export type PermissionGroupState = 'all' | 'some' | 'none';

/** all = pick everything, none = clear, base = keep only the base (view) permissions. */
export interface PermissionGroupAction {
  group: PermissionTreeGroup<SelectablePermission>;
  action: 'all' | 'none' | 'base';
}

export function permissionGroupState(perms: SelectablePermission[]): PermissionGroupState {
  const n = perms.filter(p => p.selected).length;
  if (n === 0) return 'none';
  return n === perms.length ? 'all' : 'some';
}

type TreeGroup = PermissionTreeGroup<SelectablePermission>;

/** A base permission with the permissions under it, or a run of permissions with no family. */
type PermBlock =
  | { kind: 'family'; key: string; base: SelectablePermission; subs: SelectablePermission[] }
  | { kind: 'loose'; key: string; perms: SelectablePermission[] };

/**
 * Role page permission picker: a toolbar (search, "selected only", expand all) and one collapsible
 * row per group with a checkbox for the whole group; inside, a checkbox grid where each base
 * permission comes first with the permissions that depend on it after it.
 * Selection rules stay with the host page.
 */
@Component({
  selector: 'app-permission-tree',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './permission-tree.component.html',
  styleUrl: './permission-tree.component.scss'
})
export class PermissionTreeComponent implements OnChanges {
  /** Top-level groups, each holding its sub-groups. */
  @Input({ required: true }) groups: TreeGroup[] = [];
  @Input() lang = 'ar';
  @Input() isLocked: (perm: SelectablePermission) => boolean = () => false;

  @Output() permissionToggle = new EventEmitter<{ perm: SelectablePermission; checked: boolean }>();
  @Output() groupAction = new EventEmitter<PermissionGroupAction>();

  query = '';
  selectedOnly = false;
  private readonly expanded = new Set<string>();
  private initialized = false;
  private allIds: string[] = [];

  ngOnChanges(): void {
    const ids: string[] = [];
    const walk = (list: TreeGroup[]) => list.forEach(g => { ids.push(g.id); walk(g.children); });
    walk(this.groups);
    this.allIds = ids;
    // Open the first group once; later reloads (language change, retry) keep what the user opened.
    if (!this.initialized && this.groups.length) {
      this.expanded.add(this.groups[0].id);
      this.initialized = true;
    }
  }

  // ── Filtering ─────────────────────────────────────────
  get filtering(): boolean {
    return !!this.query.trim() || this.selectedOnly;
  }

  private permVisible(perm: SelectablePermission): boolean {
    if (this.selectedOnly && !perm.selected) return false;
    const q = this.query.trim().toLowerCase();
    if (!q) return true;
    return [this.permName(perm), this.permDescription(perm), perm.code]
      .some(t => !!t && t.toLowerCase().includes(q));
  }

  /**
   * The group's own permissions: each base permission with the ones under it, and the
   * permissions with no family together in one grid. While filtering, a base stays shown
   * when one of its sub-permissions matches, so the sub never appears without its base.
   */
  blocks(group: TreeGroup): PermBlock[] {
    const q = this.query.trim().toLowerCase();
    const showAll = !!q && !this.selectedOnly && group.name.toLowerCase().includes(q);
    const show = (p: SelectablePermission) => showAll || this.permVisible(p);

    const out: PermBlock[] = [];
    for (const entry of group.entries) {
      if (entry.subs.length > 0) {
        const subs = entry.subs.filter(show);
        if (subs.length > 0 || show(entry.perm)) {
          out.push({ kind: 'family', key: entry.perm.id, base: entry.perm, subs });
        }
        continue;
      }
      if (!show(entry.perm)) continue;
      const last = out[out.length - 1];
      if (last?.kind === 'loose') last.perms.push(entry.perm);
      else out.push({ kind: 'loose', key: 'loose-' + entry.perm.id, perms: [entry.perm] });
    }
    return out;
  }

  visible(group: TreeGroup): boolean {
    if (!this.filtering) return true;
    return this.blocks(group).length > 0 || group.children.some(c => this.visible(c));
  }

  /** Quick links only make sense with more than one permission to choose from. */
  showActions(group: TreeGroup): boolean {
    return group.entries.reduce((n, e) => n + 1 + e.subs.length, 0) > 1;
  }

  get hasResults(): boolean {
    return this.groups.some(g => this.visible(g));
  }

  // ── Expand / collapse ─────────────────────────────────
  isOpen(group: TreeGroup): boolean {
    return this.filtering || this.expanded.has(group.id);
  }

  toggleOpen(group: TreeGroup): void {
    if (this.expanded.has(group.id)) this.expanded.delete(group.id);
    else this.expanded.add(group.id);
  }

  get allOpen(): boolean {
    return this.allIds.length > 0 && this.allIds.every(id => this.expanded.has(id));
  }

  toggleAllOpen(): void {
    if (this.allOpen) this.expanded.clear();
    else this.allIds.forEach(id => this.expanded.add(id));
  }

  // ── Selection helpers ─────────────────────────────────
  selectedIn(group: TreeGroup): number {
    return group.allPerms.filter(p => p.selected).length;
  }

  stateOf(group: TreeGroup): PermissionGroupState {
    return permissionGroupState(group.allPerms);
  }

  hasBase(group: TreeGroup): boolean {
    return group.allPerms.some(p => p.isBase === true);
  }

  onGroupCheck(group: TreeGroup): void {
    this.groupAction.emit({ group, action: this.stateOf(group) === 'all' ? 'none' : 'all' });
  }

  permName(perm: RolePermission): string {
    return resolveBilingualText(this.lang, perm.nameAr, perm.nameEn, perm.name);
  }

  permDescription(perm: RolePermission): string {
    return resolveBilingualText(this.lang, perm.descriptionAr, perm.descriptionEn, perm.description);
  }
}
