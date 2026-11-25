import { PermissionGroup, RolePermission } from '../interfaces/department.model';
import { resolveBilingualText } from './bilingual.util';

export const UNGROUPED_PERMISSION_GROUP_ID = '__ungrouped__';

/** A base permission with the permissions that depend on it, or a single permission with no family. */
export interface PermissionTreeEntry<P extends RolePermission> {
  perm: P;
  subs: P[];
}

export interface PermissionTreeGroup<P extends RolePermission> {
  id: string;
  name: string;
  /** This group's own permissions. */
  entries: PermissionTreeEntry<P>[];
  children: PermissionTreeGroup<P>[];
  /** Own permissions plus every descendant group's — what the group toggle and counter cover. */
  allPerms: P[];
}

/**
 * Builds the role page tree only from what the API returns, with no guessing:
 * - groups nest by `parentGroupId` and sort by `sortOrder` (then API order, then name);
 * - inside a group, a permission sits under the base permission (`isBase`) of the same group
 *   listed in its `impliedPermissionIds`.
 * Without those fields (older API) the result is the flat list the page showed before.
 */
export function buildPermissionTree<P extends RolePermission>(
  perms: P[],
  groups: PermissionGroup[],
  lang: string,
  ungroupedLabel: string
): PermissionTreeGroup<P>[] {
  const meta = new Map<string, { group: PermissionGroup | null; index: number }>();
  groups.forEach((g, index) => {
    if (!meta.has(g.id)) meta.set(g.id, { group: g, index });
  });

  const nodes = new Map<string, PermissionTreeGroup<P>>();
  const ownPerms = new Map<string, P[]>();
  const nodeFor = (id: string, fallbackName: string): PermissionTreeGroup<P> => {
    let node = nodes.get(id);
    if (!node) {
      const g = meta.get(id)?.group;
      node = {
        id,
        name: (g && resolveBilingualText(lang, g.nameAr, g.nameEn, g.name)) || fallbackName,
        entries: [],
        children: [],
        allPerms: []
      };
      nodes.set(id, node);
      ownPerms.set(id, []);
    }
    return node;
  };

  groups.forEach(g => nodeFor(g.id, ''));
  for (const perm of perms) {
    const gid = perm.permissionGroupId || UNGROUPED_PERMISSION_GROUP_ID;
    const node = nodeFor(gid, perm.permissionGroupName || ungroupedLabel);
    if (!node.name) node.name = perm.permissionGroupName || ungroupedLabel;
    ownPerms.get(gid)!.push(perm);
  }

  // Link children to parents; a missing parent or a cycle makes the group top-level.
  const parentOf = (id: string): string | null => {
    const parentId = meta.get(id)?.group?.parentGroupId;
    return parentId && parentId !== id && nodes.has(parentId) ? parentId : null;
  };
  const createsCycle = (id: string): boolean => {
    const seen = new Set<string>([id]);
    for (let p = parentOf(id); p; p = parentOf(p)) {
      if (seen.has(p)) return true;
      seen.add(p);
    }
    return false;
  };

  const roots: PermissionTreeGroup<P>[] = [];
  for (const node of nodes.values()) {
    const parentId = parentOf(node.id);
    if (parentId && !createsCycle(node.id)) nodes.get(parentId)!.children.push(node);
    else roots.push(node);
  }

  const sortKey = (id: string) => {
    const m = meta.get(id);
    return {
      order: m?.group?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      index: m ? m.index : Number.MAX_SAFE_INTEGER
    };
  };
  const compare = (a: PermissionTreeGroup<P>, b: PermissionTreeGroup<P>): number => {
    const ka = sortKey(a.id);
    const kb = sortKey(b.id);
    if (ka.order !== kb.order) return ka.order - kb.order;
    if (ka.index !== kb.index) return ka.index - kb.index;
    return a.name.localeCompare(b.name, lang);
  };

  const finish = (node: PermissionTreeGroup<P>): boolean => {
    const own = ownPerms.get(node.id) ?? [];
    node.entries = buildEntries(own);
    node.children = node.children.filter(finish).sort(compare);
    node.allPerms = [...own, ...node.children.flatMap(c => c.allPerms)];
    // Drop groups with nothing to pick (an empty folder with no permissions below it).
    return node.allPerms.length > 0;
  };

  return roots.filter(finish).sort(compare);
}

function buildEntries<P extends RolePermission>(perms: P[]): PermissionTreeEntry<P>[] {
  const baseEntries = new Map<string, PermissionTreeEntry<P>>();
  for (const perm of perms) {
    if (perm.isBase === true) baseEntries.set(perm.id, { perm, subs: [] });
  }

  const entries: PermissionTreeEntry<P>[] = [];
  for (const perm of perms) {
    const own = baseEntries.get(perm.id);
    if (own) {
      entries.push(own);
      continue;
    }
    const baseId = (perm.impliedPermissionIds ?? []).find(id => baseEntries.has(id));
    if (baseId) baseEntries.get(baseId)!.subs.push(perm);
    else entries.push({ perm, subs: [] });
  }
  return entries;
}
