import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface NavItem {
  title?: string;
  icon?: string;
  link?: string;
  divider?: boolean;
  children?: NavItem[];
}

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private apiUrl = '/api/sidebar/items';

  constructor(private http: HttpClient) {}

  getSidebarItems(): Observable<NavItem[]> {
    return this.http.get<NavItem[]>(this.apiUrl);
  }
}
