import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconModule } from 'src/app/icon/icon.module';
import { MaterialModule } from 'src/app/material.module';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { Router } from '@angular/router';
import { MediaMatcher } from '@angular/cdk/layout';
import { DeleteDialogComponent } from '../../delete-dialog/delete-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductService } from 'src/app/services/apps/product/product.service';
import { Element, PRODUCT_DATA } from '../ecommerceData';

export interface Section {
  name: string;
  icon: string;
}

@Component({
  selector: 'app-shop',
  imports: [
    MaterialModule,
    IconModule,
    CommonModule,
    FormsModule,
    NgScrollbarModule,
  ],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss',
})
export class ShopComponent implements OnInit {
  private router = inject(Router);
  readonly dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private _snackBar = inject(MatSnackBar);
  private productService = inject(ProductService);
  mobileQuery: MediaQueryList;
  private mediaMatcher: MediaQueryList = matchMedia(`(max-width: 1199px)`);
  durationInSeconds = 1;
  searchText: string = '';

  filteredCards: Element[] = PRODUCT_DATA;
  folders: Section[] = [
    { name: 'all', icon: 'users' },
    { name: 'fashion', icon: 'hanger' },
    { name: 'books', icon: 'book' },
    { name: 'toys', icon: 'mood-smile' },
    { name: 'electronics', icon: 'device-laptop' },
  ];
  selectedCategory: string = this.folders[0].name;
  notes: Section[] = [
    { name: 'newest', icon: 'calendar' },
    { name: 'Price: High-Low', icon: 'sort-descending' },
    { name: 'Price: Low-High', icon: 'sort-ascending' },
    { name: 'discounted', icon: 'percentage' },
  ];
  selectedSortBy: string = this.notes[0].name;
  selectedColor: string | null = null;
  isMobileView = false;
  selectedGender: string = 'all';
  genderOptions = [
    { label: 'All', value: 'all' },
    { label: 'Men', value: 'men' },
    { label: 'Women', value: 'women' },
    { label: 'Kids', value: 'kids' },
  ];

  selectedPrice: string = 'all';
  priceOptions = [
    { label: 'All', value: 'all' },
    { label: '0 – 50', value: '0-50' },
    { label: '50–100', value: '50-100' },
    { label: '100–200', value: '100-200' },
    { label: 'Over 200', value: 'over-200' },
  ];
  constructor() {
    const media = inject(MediaMatcher);
    this.mobileQuery = media.matchMedia('(max-width: 1199px)');
    this.isMobileView = this.mobileQuery.matches;

    this.mobileQuery.addEventListener('change', (e) => {
      this.isMobileView = e.matches;
    });
  }
  ngOnInit(): void {
    
  }

  filterCards() {
    const text = this.searchText.toLowerCase();
  
    this.filteredCards = PRODUCT_DATA.filter(
      (card) =>
        card.product_name.toLowerCase().includes(text) ||
        card.categories.join(' ').toLowerCase().includes(text)
    );
  }
  
  getCategory(name: string): void {
    this.selectedCategory = name;
    if (name.toLowerCase() === 'all') {
      this.filteredCards = [...PRODUCT_DATA];
    } else {
      this.filteredCards = PRODUCT_DATA.filter((card) =>
        card.categories.some(
          (cat) => cat.toLowerCase() === name.toLowerCase()
        )
      );
    }
  }
  

  getSorted(name: string): void {
    this.selectedSortBy = name; // ✅ Add this line to track selection

    const nameLower = name.toLowerCase();

    switch (nameLower) {
      case 'newest':
        this.filteredCards = [...PRODUCT_DATA].sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime(); // Newest first
        });
        break;

      case 'base_price: hiah-low':
      case 'base_price: high-low':
        this.filteredCards = [...PRODUCT_DATA].sort(
          (a, b) => +b.base_price - +a.base_price
        );
        break;

      case 'base_price: low-hiah':
      case 'base_price: low-high':
        this.filteredCards = [...PRODUCT_DATA].sort(
          (a, b) => +a.base_price - +b.base_price
        );
        break;

      case 'discounted':
        this.filteredCards = [...PRODUCT_DATA].sort((a, b) => {
          const discountA = +a.dealPrice - +a.base_price;
          const discountB = +b.dealPrice - +b.base_price;
          return discountB - discountA;
        });
        break;

      default:
        this.filteredCards = [...PRODUCT_DATA];
    }
  }

  getGender(gender: string): void {
    if (gender.toLowerCase() === 'all') {
      this.filteredCards = [...PRODUCT_DATA];
    } else {
      this.filteredCards = PRODUCT_DATA.filter(
        (card) => card.gender === gender.toLowerCase()
      );
    }
  }
  getPricing(base_priceRange: string): void {
    this.selectedPrice = base_priceRange;

    switch (base_priceRange) {
      case '0-50':
        this.filteredCards = PRODUCT_DATA.filter(
          (card) => +card.base_price >= 0 && +card.base_price <= 50
        );
        break;

      case '50-100':
        this.filteredCards = PRODUCT_DATA.filter(
          (card) => +card.base_price > 50 && +card.base_price <= 100
        );
        break;

      case '100-200':
        this.filteredCards = PRODUCT_DATA.filter(
          (card) => +card.base_price > 100 && +card.base_price <= 200
        );
        break;

      case 'over-200':
        this.filteredCards = PRODUCT_DATA.filter(
          (card) => +card.base_price > 200
        );
        break;

      case 'all':
      default:
        this.filteredCards = [...PRODUCT_DATA];
        break;
    }
  }
  getRestFilter() {
    this.selectedCategory = this.folders[0].name;
    this.selectedSortBy = this.notes[0].name;
    this.filteredCards = [...PRODUCT_DATA];
  }

  getProductList() {
    this.searchText = '';
    this.filteredCards = [...PRODUCT_DATA];
  }

  isOver(): boolean {
    return this.mediaMatcher.matches;
  }

  getAddProductRoute() {
    this.router.navigate(['apps/product/add-product']);
  }
  openDialog(idOrIds: number | number[]): void {
    const dialogRef = this.dialog.open(DeleteDialogComponent, {
      data: {
        ids: Array.isArray(idOrIds) ? idOrIds : [idOrIds], // Always pass as array
      },
      width: '400px',
      enterAnimationDuration: '0ms',
      exitAnimationDuration: '0ms',
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result === 'delete') {
        if (Array.isArray(idOrIds)) {
        } else {
          this.getDeletedById(idOrIds); // ⬅️ Handle single deletion
        }
      }
    });
  }
  getDeletedById(id: number) {
    this.filteredCards = this.filteredCards.filter(
      (product) => product.id !== id
    );

    this.cdr.detectChanges(); // Optional if view updates correctly
    this.openSnackBar('Product deleted successfully!');
  }
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Close', {
      duration: this.durationInSeconds * 1000,
      verticalPosition: 'top',
      horizontalPosition: 'center',
    });
  }
  getviewDetails(productcardDetails: Element) {
    this.productService.setProduct(productcardDetails);
    this.router.navigate(['apps/product/product-details']);
  }
  toggleColor(color: string): void {
    this.selectedColor = this.selectedColor === color ? null : color;
  }
  getEditedProduct(productcardDetails: Element) {
    this.productService.setProduct(productcardDetails);
    this.router.navigate(['apps/product/edit-product']);
  }
  getStarClass(index: number, rating?: number): string {
    const safeRating = rating ?? 0 ; // Fallback if undefined
    const fullStars = Math.floor(safeRating); // Full stars
    const partialStars = safeRating % 1 !== 0; // Whether there is a partial star
  
    if (index < fullStars) {
      return 'fill-warning'; // full star
    } else if (index === fullStars && partialStars) {
      return 'text-warning'; // partial star
    } else {
      return ''; // empty star, no class
    }
  }
  
  
  
}
