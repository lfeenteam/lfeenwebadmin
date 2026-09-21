import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CallScript, CreateCallScriptRequest, UpdateCallScriptRequest } from '../interfaces/call-script.model';

@Injectable({ providedIn: 'root' })
export class CallScriptsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/call-scripts`;

  list(): Observable<CallScript[]> {
    return this.http.get<CallScript[]>(this.url);
  }

  create(body: CreateCallScriptRequest): Observable<CallScript> {
    return this.http.post<CallScript>(this.url, body);
  }

  update(id: number, body: UpdateCallScriptRequest): Observable<CallScript> {
    return this.http.put<CallScript>(`${this.url}/${id}`, body);
  }
}
