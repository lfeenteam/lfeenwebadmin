import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface CatalogIconRef {
  key: string;
  url: string;
}

export interface CatalogIconsManifest {
  // slug (iconKey) → CDN url
  icons: Record<string, string>;
  stats: Record<string, CatalogIconRef>;
  default: CatalogIconRef | null;
}

const EMPTY_MANIFEST: CatalogIconsManifest = { icons: {}, stats: {}, default: null };

// GET api/catalog-icons on the main API — public, cached by the server for an hour.
// Loaded once per session and shared. Uses HttpBackend so the admin interceptor
// doesn't attach the admin bearer token to a request for another host.
// A failed load resolves to an empty manifest: screens then fall back to the
// iconUrl from each response, or to no icon.
@Injectable({ providedIn: 'root' })
export class CatalogIconService {
  private readonly http: HttpClient;

  readonly manifest$: Observable<CatalogIconsManifest>;

  constructor(httpBackend: HttpBackend) {
    this.http = new HttpClient(httpBackend);
    this.manifest$ = this.http
      .get<{ data: CatalogIconsManifest | null }>(environment.catalogIconsUrl)
      .pipe(
        map(res => ({
          icons:   res?.data?.icons ?? {},
          stats:   res?.data?.stats ?? {},
          default: res?.data?.default ?? null
        })),
        catchError(() => of(EMPTY_MANIFEST)),
        shareReplay(1)
      );
  }

  urlFor(iconKey: string | null | undefined): Observable<string | null> {
    if (!iconKey) return of(null);
    return this.manifest$.pipe(map(m => m.icons[iconKey] ?? null));
  }
}
