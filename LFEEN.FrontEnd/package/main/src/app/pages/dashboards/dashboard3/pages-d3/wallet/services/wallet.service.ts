import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  WalletAdjustInput,
  WalletAdjustResult,
  WalletBalance,
  WalletCategory,
  WalletLedgerEntry,
  WalletPendingAdjustment,
  WalletUpdateEntryInput,
} from '../interfaces/wallet.model';

// adjust and PUT ledger are multipart/form-data — the backend answers 415 to JSON.
// HttpClient sets the multipart boundary itself, so no Content-Type is set here.
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/wallet`;

  private categories$?: Observable<WalletCategory[]>;

  /** The list is static, so it's fetched once per session. */
  getCategories(): Observable<WalletCategory[]> {
    if (!this.categories$) {
      this.categories$ = this.http.get<WalletCategory[]>(`${this.url}/categories`).pipe(
        tap({ error: () => { this.categories$ = undefined; } }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.categories$;
  }

  getBalance(merchantAccountId: string): Observable<WalletBalance> {
    return this.http.get<WalletBalance>(`${this.url}/${merchantAccountId}/balance`);
  }

  getLedger(merchantAccountId: string): Observable<WalletLedgerEntry[]> {
    return this.http.get<WalletLedgerEntry[]>(`${this.url}/${merchantAccountId}/ledger`);
  }

  adjust(merchantAccountId: string, input: WalletAdjustInput): Observable<WalletAdjustResult> {
    const form = new FormData();
    form.append('Amount', String(input.amount));
    form.append('Category', input.category);
    if (input.reason) form.append('Reason', input.reason);
    form.append('IdempotencyKey', input.idempotencyKey);
    input.files.forEach(f => form.append('Attachments', f));
    return this.http.post<WalletAdjustResult>(`${this.url}/${merchantAccountId}/adjust`, form);
  }

  // Adjustments above the threshold wait here for a second admin (maker-checker).
  getPendingAdjustments(): Observable<WalletPendingAdjustment[]> {
    return this.http.get<WalletPendingAdjustment[] | { items?: WalletPendingAdjustment[] }>(`${this.url}/adjustments/pending`).pipe(
      map(res => (Array.isArray(res) ? res : res?.items ?? [])),
    );
  }

  approveAdjustment(id: string): Observable<WalletAdjustResult> {
    return this.http.post<WalletAdjustResult>(`${this.url}/adjustments/${id}/approve`, {});
  }

  rejectAdjustment(id: string, reason?: string): Observable<void> {
    return this.http.post<void>(`${this.url}/adjustments/${id}/reject`, { reason: reason || null });
  }

  updateEntry(merchantAccountId: string, entryId: string, changes: WalletUpdateEntryInput): Observable<WalletLedgerEntry> {
    const form = new FormData();
    if (changes.reason !== undefined) form.append('Reason', changes.reason);
    if (changes.category) form.append('Category', changes.category);
    changes.newFiles?.forEach(f => form.append('NewAttachments', f));
    changes.removedAttachmentIds?.forEach(id => form.append('RemovedAttachmentIds', id));
    return this.http.put<WalletLedgerEntry>(`${this.url}/${merchantAccountId}/ledger/${entryId}`, form);
  }
}
