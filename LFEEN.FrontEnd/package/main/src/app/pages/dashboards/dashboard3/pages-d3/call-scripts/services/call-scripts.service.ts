import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CallScript, CreateCallScriptRequest, UpdateCallScriptRequest } from '../interfaces/call-script.model';

/**
 * The core API wraps failures as { success: false, errorCode, message } and can send
 * them with a 200 status — turn those into errors so the page never shows a success toast for them.
 */
function failOnUnsuccessful<T>(url: string) {
  return map((res: T) => {
    const body = res as { success?: unknown } | null;
    if (body && typeof body === 'object' && body.success === false) {
      throw new HttpErrorResponse({ error: body, status: 400, statusText: 'Bad Request', url });
    }
    return res;
  });
}

@Injectable({ providedIn: 'root' })
export class CallScriptsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/call-scripts`;

  list(): Observable<CallScript[]> {
    return this.http.get<CallScript[]>(this.url);
  }

  create(body: CreateCallScriptRequest): Observable<CallScript> {
    return this.http.post<CallScript>(this.url, body).pipe(failOnUnsuccessful<CallScript>(this.url));
  }

  update(id: number, body: UpdateCallScriptRequest): Observable<CallScript> {
    const url = `${this.url}/${id}`;
    return this.http.put<CallScript>(url, body).pipe(failOnUnsuccessful<CallScript>(url));
  }

  /** Hard delete. The API refuses the active version (IVR_SCRIPT_DELETE_ACTIVE_NOT_ALLOWED). */
  delete(id: number): Observable<unknown> {
    const url = `${this.url}/${id}`;
    return this.http.delete<unknown>(url).pipe(failOnUnsuccessful<unknown>(url));
  }
}
