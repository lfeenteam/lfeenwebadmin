import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Department {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string;
  icon: string | null;
  descriptionAr: string;
  descriptionEn: string;
  managerId: string | null;
  managerFullName: string | null;
  employeeCount: number;
  createdAt: string;
  updatedAt: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private apiUrl = 'http://test-api-admin.lfeen.com/api/departments';

  constructor(private http: HttpClient) {}

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.apiUrl);
  }
}
