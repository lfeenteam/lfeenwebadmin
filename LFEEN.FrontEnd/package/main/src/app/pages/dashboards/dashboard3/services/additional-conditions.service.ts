import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  AdditionalConditionDecisionItem,
  AdditionalConditionListQuery,
  AdditionalConditionListResult,
  AdditionalConditionScope,
  AdminAdditionalCondition
} from '../interfaces/additional-condition.model';

// Each level is reviewed from its own place, with that place's permission
// (Accounts.Review / Properties.Review / Units.Review) — doc section 8.1.
const SCOPE_BASE: Record<AdditionalConditionScope, string> = {
  account:  'api/accounts',
  property: 'api/properties',
  unit:     'api/units'
};

@Injectable({ providedIn: 'root' })
export class AdditionalConditionsService {
  private readonly http = inject(HttpClient);

  private baseUrl(scope: AdditionalConditionScope): string {
    return `${environment.apiBaseUrl}/${SCOPE_BASE[scope]}`;
  }

  // POST /api/{level}/{id}/additional-conditions/review — the response is the
  // level's conditions after the decision, so callers swap their list with it.
  review(
    scope: AdditionalConditionScope,
    targetId: string | number,
    conditions: AdditionalConditionDecisionItem[]
  ): Observable<AdminAdditionalCondition[]> {
    return this.http
      .post<unknown>(`${this.baseUrl(scope)}/${targetId}/additional-conditions/review`, { conditions })
      .pipe(map(res => extractConditions(res)));
  }

  // GET /api/{level}/additional-conditions — status=Pending returns new conditions
  // and pending edits together, oldest edit first.
  list(scope: AdditionalConditionScope, query: AdditionalConditionListQuery): Observable<AdditionalConditionListResult> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http
      .get<unknown>(`${this.baseUrl(scope)}/additional-conditions`, { params })
      .pipe(map(res => normalizeList(res, query)));
  }
}

// The doc only says "list of conditions" — accept a bare array, a { conditions }
// wrapper, or a paged { items } object so a shape change doesn't blank the screen.
function extractConditions(res: any): AdminAdditionalCondition[] {
  const body = res?.data ?? res;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.conditions)) return body.conditions;
  if (Array.isArray(body?.conditions?.items)) return body.conditions.items;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

function normalizeList(res: any, query: AdditionalConditionListQuery): AdditionalConditionListResult {
  const body = res?.data ?? res;
  const page = body?.conditions && !Array.isArray(body.conditions) ? body.conditions : body;
  const items = extractConditions(body);
  const pageNumber = page?.pageNumber ?? query.pageNumber ?? 1;
  const totalPages = page?.totalPages ?? 1;
  return {
    items,
    stats:       body?.stats ?? null,
    pageNumber,
    totalPages,
    totalCount:  page?.totalCount ?? items.length,
    hasNextPage: page?.hasNextPage ?? pageNumber < totalPages
  };
}
