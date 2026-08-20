import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { AddFaqDialogComponent } from './components/add-faq-dialog/add-faq-dialog.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { FAQ_DEPARTMENT_OPTIONS, FaqArticle, FaqArticleDto, FaqDepartment, FaqDepartmentOption } from './interfaces/faq.model';
import { FaqService } from './services/faq.service';
import { CoreService } from 'src/app/services/core.service';

@Component({
  selector: 'app-faq-management',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule, MaterialModule, DashboardLoadingComponent],
  templateUrl: './faq-management.component.html',
  styleUrl: './faq-management.component.scss'
})
export class FaqManagementComponent implements OnInit {
  readonly departmentOptions = FAQ_DEPARTMENT_OPTIONS;
  departmentFilter = signal<FaqDepartment | 'all'>('all');
  loading = signal(false);

  private articles = signal<FaqArticle[]>([]);

  filteredArticles = computed(() => {
    const filter = this.departmentFilter();
    const list = filter === 'all' ? this.articles() : this.articles().filter(a => a.department === filter);
    return [...list].sort((a, b) => a.order - b.order);
  });

  totalCount = computed(() => this.articles().length);
  activeCount = computed(() => this.articles().filter(a => a.status === 'active').length);
  inactiveCount = computed(() => this.articles().filter(a => a.status === 'inactive').length);

  selectedDeptLabel(): string {
    const filter = this.departmentFilter();
    if (filter === 'all') return this.translate.instant('d3.faq.filter.all');
    const opt = this.departmentOptions.find(d => d.value === filter);
    return opt ? this.deptOptionLabel(opt) : this.translate.instant('d3.faq.filter.all');
  }

  constructor(
    private translate: TranslateService,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private faqService: FaqService,
    private coreService: CoreService
  ) {}

  // Sourced from CoreService's signal (not translate.currentLang) so [dir] updates
  // the instant the language changes, instead of waiting on the next zone.js change
  // detection tick that happens to run after ngx-translate resolves its language.
  readonly dirSignal = computed(() => this.coreService.getOptionsSignal()().dir);

  ngOnInit(): void {
    this.loadArticles();
  }

  private mapDtoToArticle(dto: FaqArticleDto): FaqArticle {
    return {
      externalId: dto.externalId,
      order: dto.displayOrder,
      titleEn: dto.titleEn,
      titleAr: dto.titleAr,
      contentEn: dto.bodyEn,
      contentAr: dto.bodyAr,
      department: dto.department,
      status: dto.isActive ? 'active' : 'inactive',
    };
  }

  loadArticles(): void {
    this.loading.set(true);
    this.faqService.getArticles({ activeOnly: false }).subscribe({
      next: (response) => {
        this.articles.set(response.data.map(dto => this.mapDtoToArticle(dto)));
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
        this.loading.set(false);
      }
    });
  }

  setDeptFilter(value: FaqDepartment | 'all'): void {
    this.departmentFilter.set(value);
  }

  departmentLabel(dept: FaqDepartment): string {
    const opt = this.departmentOptions.find(d => d.value === dept);
    return opt ? this.deptOptionLabel(opt) : '';
  }

  deptOptionLabel(opt: FaqDepartmentOption): string {
    return this.translate.currentLang === 'en' ? opt.labelEn : opt.labelAr;
  }

  openAddDialog(): void {
    const nextOrder = this.articles().reduce((max, a) => Math.max(max, a.order), 0) + 1;
    const dialogRef = this.dialog.open(AddFaqDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { nextOrder }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.faqService.createArticle({
        TitleEn: result.titleEn,
        TitleAr: result.titleAr,
        BodyEn: result.contentEn,
        BodyAr: result.contentAr,
        Department: result.department,
        DisplayOrder: result.order,
      }).subscribe({
        next: (dto) => {
          this.articles.update(list => [...list, this.mapDtoToArticle(dto)]);
          this.toastr.success(this.translate.instant('d3.faq.toast.addSuccess'));
        },
        error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
      });
    });
  }

  openEditDialog(article: FaqArticle): void {
    this.faqService.getArticleById(article.externalId).subscribe({
      next: (dto) => {
        const fresh = this.mapDtoToArticle(dto);
        const dialogRef = this.dialog.open(AddFaqDialogComponent, {
          width: '560px',
          maxWidth: '95vw',
          data: { article: fresh, nextOrder: fresh.order }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (!result) return;

          this.faqService.updateArticle(fresh.externalId, {
            TitleEn: result.titleEn,
            TitleAr: result.titleAr,
            BodyEn: result.contentEn,
            BodyAr: result.contentAr,
            Department: result.department,
            DisplayOrder: result.order,
            IsActive: result.status === 'active',
          }).subscribe({
            next: (updatedDto) => {
              this.articles.update(list => list.map(a => a.externalId === fresh.externalId ? this.mapDtoToArticle(updatedDto) : a));
              this.toastr.success(this.translate.instant('d3.faq.toast.updateSuccess'));
            },
            error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
          });
        });
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
    });
  }

  toggleStatus(article: FaqArticle): void {
    const isActivating = article.status === 'inactive';
    const titleKey = isActivating ? 'd3.faq.toggle.activateTitle' : 'd3.faq.toggle.deactivateTitle';
    const messageKey = isActivating ? 'd3.faq.toggle.activateMessage' : 'd3.faq.toggle.deactivateMessage';

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: { title: titleKey, message: messageKey },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      const request$ = isActivating
        ? this.faqService.activateArticle(article.externalId)
        : this.faqService.deactivateArticle(article.externalId);

      request$.subscribe({
        next: () => {
          this.articles.update(list => list.map(a => a.externalId === article.externalId ? { ...a, status: isActivating ? 'active' : 'inactive' } : a));
          this.toastr.success(this.translate.instant('d3.faq.toast.statusUpdateSuccess'));
        },
        error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
      });
    });
  }

  deleteArticle(article: FaqArticle): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: { title: 'd3.faq.delete.title', message: 'd3.faq.delete.message' },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.faqService.deleteArticle(article.externalId).subscribe({
        next: () => {
          this.articles.update(list => list.filter(a => a.externalId !== article.externalId));
          this.toastr.success(this.translate.instant('d3.faq.toast.deleteSuccess'));
        },
        error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
      });
    });
  }
}
