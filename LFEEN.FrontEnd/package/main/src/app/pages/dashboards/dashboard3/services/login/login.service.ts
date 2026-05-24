import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { signal } from '@angular/core';
import { LoginRequest, LoginResponse } from './login.model';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private apiUrl = 'http://test-api-admin.lfeen.com/api/auth/Login';
  private refreshUrl = 'http://test-api-admin.lfeen.com/api/auth/refresh-token';
  private tokenKey = 'auth_token';
  private refreshTokenKey = 'auth_refresh_token';
  private tokenExpiresKey = 'auth_token_expires_at';
  private refreshTokenExpiresKey = 'auth_refresh_token_expires_at';
  private userKey = 'auth_user';

  loading = signal<boolean>(false);
  isLoggedIn = signal<boolean>(this.checkAuthentication());

  constructor(private http: HttpClient) { }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.loading.set(true);
    return this.http.post<LoginResponse>(this.apiUrl, credentials).pipe(
      tap((response) => this.handleAuthentication(response))
    );
  }

  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<LoginResponse>(this.refreshUrl, { refreshToken }).pipe(
      tap((response) => this.handleAuthentication(response))
    );
  }

  setToken(response: LoginResponse): void {
    this.handleAuthentication(response);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  getAccessTokenExpiry(): Date | null {
    const expires = localStorage.getItem(this.tokenExpiresKey);
    return expires ? new Date(expires) : null;
  }

  getRefreshTokenExpiry(): Date | null {
    const expires = localStorage.getItem(this.refreshTokenExpiresKey);
    return expires ? new Date(expires) : null;
  }

  getUser(): any {
    const user = localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !this.isAccessTokenExpired();
  }

  hasValidRefreshToken(): boolean {
    const refreshToken = this.getRefreshToken();
    const refreshExpiry = this.getRefreshTokenExpiry();
    return !!refreshToken && !!refreshExpiry && refreshExpiry.getTime() > Date.now();
  }

  isAccessTokenExpired(): boolean {
    const expiry = this.getAccessTokenExpiry();
    return !expiry || expiry.getTime() <= Date.now();
  }

  isRefreshRequestUrl(url: string): boolean {
    return url.includes(this.refreshUrl);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.tokenExpiresKey);
    localStorage.removeItem(this.refreshTokenExpiresKey);
    localStorage.removeItem(this.userKey);
    this.isLoggedIn.set(false);
  }

  private handleAuthentication(response: LoginResponse): void {
    localStorage.setItem(this.tokenKey, response.accessToken);
    localStorage.setItem(this.refreshTokenKey, response.refreshToken);
    localStorage.setItem(this.tokenExpiresKey, response.accessTokenExpiresAt);
    localStorage.setItem(this.refreshTokenExpiresKey, response.refreshTokenExpiresAt);
    localStorage.setItem(
      this.userKey,
      JSON.stringify({
        userId: response.userId,
        fullName: response.fullName || (response as any).userName,
        email: response.email,
        roles: response.roles,
      })
    );
    this.isLoggedIn.set(true);
  }

  private checkAuthentication(): boolean {
    return (!!this.getToken() && !this.isAccessTokenExpired()) || this.hasValidRefreshToken();
  }
}
