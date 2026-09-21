import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { CoreService } from 'src/app/services/core.service';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { LoginService } from '../../services/login/login.service';
import { CALL_SCRIPT_SCENARIOS, CallScript } from './interfaces/call-script.model';
import { resolveCallScriptError } from './interfaces/call-script-error.util';
import { CallScriptsService } from './services/call-scripts.service';
import { CallScriptDialogComponent, CallScriptDialogResult } from './components/call-script-dialog/call-script-dialog.component';

@Component({
  selector: 'app-call-scripts',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule, MaterialModule, DashboardLoadingComponent, DashboardEmptyComponent],
  templateUrl: './call-scripts.component.html',
  styleUrl: './call-scripts.component.scss'
})
export class CallScriptsComponent implements OnInit {
  private dialog = inject(MatDialog);
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);
  private service = inject(CallScriptsService);
  private coreService = inject(CoreService);
  private login = inject(LoginService);

  readonly canManage = computed(() => this.hasPermission('callscripts.manage'));
  readonly dirSignal = computed(() => this.coreService.getOptionsSignal()().dir);

  loading = signal(false);
  loadError = signal(false);
  forbidden = signal(false);

  private scripts = signal<CallScript[]>([]);

  // Sorted for display only — never used to invent a row that isn't in the API response.
  sortedScripts = computed(() =>
    [...this.scripts()].sort((a, b) => {
      if (a.scenarioType !== b.scenarioType) return a.scenarioType.localeCompare(b.scenarioType);
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    })
  );

  totalCount = computed(() => this.scripts().length);
  activeCount = computed(() => this.scripts().filter(s => s.isActive).length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.forbidden.set(false);

    this.service.list().subscribe({
      next: scripts => {
        this.scripts.set(scripts);
        this.loading.set(false);
      },
      error: err => {
        this.scripts.set([]);
        this.loading.set(false);
        this.loadError.set(true);
        this.forbidden.set((err as { status?: number })?.status === 403);
        this.toastr.error(resolveCallScriptError(err, this.translate));
      },
    });
  }

  optionDigits(script: CallScript): string {
    return script.options.map(o => o.digit).join(' / ');
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  openCreateDialog(): void {
    if (!this.canManage()) return;

    const dialogRef = this.dialog.open(CallScriptDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      data: { scenarios: CALL_SCRIPT_SCENARIOS },
    });

    dialogRef.afterClosed().subscribe((result?: CallScriptDialogResult) => {
      if (!result) return;

      this.service.create({
        scenarioType: result.scenarioType,
        audioFileUrl: result.audioFileUrl,
        options: result.options,
        isActive: result.isActive,
      }).subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.callScripts.toast.createSuccess'));
          this.load();
        },
        error: err => this.toastr.error(resolveCallScriptError(err, this.translate)),
      });
    });
  }

  openEditDialog(script: CallScript): void {
    if (!this.canManage()) return;

    const dialogRef = this.dialog.open(CallScriptDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      data: { scenarios: CALL_SCRIPT_SCENARIOS, script },
    });

    dialogRef.afterClosed().subscribe((result?: CallScriptDialogResult) => {
      if (!result) return;

      this.service.update(script.id, {
        audioFileUrl: result.audioFileUrl,
        options: result.options,
        isActive: result.isActive,
      }).subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.callScripts.toast.updateSuccess'));
          this.load();
        },
        error: err => this.toastr.error(resolveCallScriptError(err, this.translate)),
      });
    });
  }

  activateScript(script: CallScript): void {
    if (!this.canManage() || script.isActive) return;

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: { title: 'd3.callScripts.activateConfirm.title', message: 'd3.callScripts.activateConfirm.message' },
      panelClass: 'custom-confirm-dialog',
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.service.update(script.id, {
        audioFileUrl: script.audioFileUrl,
        options: script.options,
        isActive: true,
      }).subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.callScripts.toast.activateSuccess'));
          this.load();
        },
        error: err => this.toastr.error(resolveCallScriptError(err, this.translate)),
      });
    });
  }

  private hasPermission(permission: string): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === permission);
  }
}
