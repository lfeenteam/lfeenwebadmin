import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { WalletAdjustRequest, WalletAdjustResult, WalletBalance, WalletLedgerEntry } from '../interfaces/wallet.model';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/wallet`;

  getBalance(merchantAccountId: string): Observable<WalletBalance> {
    return this.http.get<WalletBalance>(`${this.url}/${merchantAccountId}/balance`);
  }

  getLedger(merchantAccountId: string): Observable<WalletLedgerEntry[]> {
    return this.http.get<WalletLedgerEntry[]>(`${this.url}/${merchantAccountId}/ledger`);
  }

  adjust(merchantAccountId: string, body: WalletAdjustRequest): Observable<WalletAdjustResult> {
    return this.http.post<WalletAdjustResult>(`${this.url}/${merchantAccountId}/adjust`, body);
  }
}
