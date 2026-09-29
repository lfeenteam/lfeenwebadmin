import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AdminNotificationList,
  AdminNotificationQuery,
  NotificationActionResponse,
  UnreadCountResponse,
} from '../interfaces/admin-notification.model';

@Injectable({
  providedIn: 'root'
})
export class AdminNotificationsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/api/notifications`;

  getTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/types`);
  }

  getNotifications(query: AdminNotificationQuery = {}): Observable<AdminNotificationList> {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('pageSize', query.pageSize ?? 20);
    if (query.isRead != null) params = params.set('isRead', query.isRead);
    if (query.type) params = params.set('type', query.type);
    return this.http.get<AdminNotificationList>(this.apiUrl, { params });
  }

  getUnreadCount(): Observable<UnreadCountResponse> {
    return this.http.get<UnreadCountResponse>(`${this.apiUrl}/unread-count`);
  }

  markAsRead(notificationId: string): Observable<NotificationActionResponse> {
    return this.http.patch<NotificationActionResponse>(`${this.apiUrl}/${notificationId}/read`, {});
  }

  markAllAsRead(): Observable<NotificationActionResponse> {
    return this.http.patch<NotificationActionResponse>(`${this.apiUrl}/read-all`, {});
  }

  delete(notificationId: string): Observable<NotificationActionResponse> {
    return this.http.delete<NotificationActionResponse>(`${this.apiUrl}/${notificationId}`);
  }
}
