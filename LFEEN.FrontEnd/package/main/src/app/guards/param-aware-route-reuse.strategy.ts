import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, Params } from '@angular/router';

// Angular reuses the same component instance when only a route's path params
// change (e.g. unit-review/38/66 -> unit-review/14/20, via the address bar,
// back/forward, or a notification link). Pages that read their id once from
// route.snapshot then keep showing — and submitting decisions for — the
// previous entity until a full reload.
//
// Routes flagged with `data: { recreateOnParamChange: true }` get a fresh
// instance whenever their path params change, so their state and in-flight
// requests start clean. Query params are deliberately not compared:
// build-review keeps ?section= in the URL while switching its internal views
// and must not be recreated for that.
export class ParamAwareRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) return false;
    if (!future.data?.['recreateOnParamChange']) return true;
    return sameParams(future.params, curr.params);
  }
}

function sameParams(a: Params, b: Params): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
}
