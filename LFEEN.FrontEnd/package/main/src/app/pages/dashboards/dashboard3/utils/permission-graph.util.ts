export function resolveTransitiveImpliedIds(
  startId: string,
  getImpliedIds: (id: string) => string[] | undefined
): Set<string> {
  const result = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length) {
    const current = queue.shift();
    if (current === undefined) continue;
    for (const impliedId of getImpliedIds(current) ?? []) {
      if (!result.has(impliedId)) {
        result.add(impliedId);
        queue.push(impliedId);
      }
    }
  }

  return result;
}
