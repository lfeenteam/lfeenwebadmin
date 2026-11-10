import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subscription } from 'rxjs';
import { CatalogIconService } from 'src/app/services/catalog-icon.service';

// Single place that draws catalog icons (facilities, services, room/bed/sub-room types,
// unit/property types, view types). Order of precedence:
//   1. iconUrl from the response — the backend picks the right icon per item.
//   2. iconKey looked up in the api/catalog-icons manifest.
//   3. the old tabler `fallback` icon (fields are optional until Production is deployed).
// Never build the CDN url from iconKey by hand (Testing and Production differ, and the
// version can change).
@Component({
  selector: 'app-catalog-icon',
  standalone: true,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './catalog-icon.component.html',
  styleUrl: './catalog-icon.component.scss'
})
export class CatalogIconComponent implements OnChanges, OnDestroy {
  @Input() iconUrl?: string | null;
  @Input() iconKey?: string | null;
  // Tabler icon name drawn when there's no icon to load or it fails to load.
  @Input() fallback?: string | null;
  @Input() size = 20;

  private catalogIcons = inject(CatalogIconService);
  private keySub?: Subscription;

  src: string | null = null;
  failed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['iconUrl'] && !changes['iconKey']) return;

    this.failed = false;
    this.keySub?.unsubscribe();

    if (this.iconUrl) {
      this.src = this.iconUrl;
      return;
    }

    this.src = null;
    if (this.iconKey) {
      this.keySub = this.catalogIcons.urlFor(this.iconKey).subscribe(url => this.src = url);
    }
  }

  ngOnDestroy(): void {
    this.keySub?.unsubscribe();
  }

  get showImage(): boolean {
    return !!this.src && !this.failed;
  }
}
