import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';
import { IconModule } from 'src/app/icon/icon.module';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService } from 'src/app/services/apps/product/product.service';
import { productcards } from '../ecommerceData';

@Component({
  selector: 'app-product-details',
  imports: [MaterialModule, CarouselModule, IconModule, CommonModule],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss',
})
export class ProductDetailsComponent implements AfterViewInit {
  @ViewChild('carouselContainer', { static: false })
  private productService = inject(ProductService);
  carouselContainer!: ElementRef;
  product: any;
  isSelected = false;

  quantity: number = 1;
  toggleValue: any = null;

  selectedTabIndex = 0;

  customOptions: OwlOptions = {
    loop: true,
    mouseDrag: false,
    touchDrag: false,
    pullDrag: false,
    dots: false,
    navSpeed: 700,
    navText: ['', ''],
    responsive: {
      0: {
        items: 1,
      },
      400: {
        items: 2,
      },
      740: {
        items: 3,
      },
      940: {
        items: 4,
      },
    },
    nav: true,
  };
  slides = [
    {
      id: 'slide-1',
      imgUrl: 'assets/images/products/s2.jpg',
      altText: 'Slide 1',
      title: 'text1',
    },
    {
      id: 'slide-2',
      imgUrl: 'assets/images/products/s2.jpg',
      altText: 'Slide 2',
      title: 'text2',
    },
    {
      id: 'slide-3',
      imgUrl: 'path/to/image3.jpg',
      altText: 'Slide 3',
      title: 'text3',
    },
    {
      id: 'slide-3',
      imgUrl: 'path/to/image3.jpg',
      altText: 'Slide 3',
      title: 'text3',
    },
    // Add more slides as needed
  ];

  productcards = productcards;

  ratings = [
    { label: 1, value: 30, count: 485 },
    { label: 2, value: 20, count: 215 },
    { label: 3, value: 10, count: 110 },
    { label: 4, value: 60, count: 620 },
    { label: 5, value: 15, count: 160 },
  ];

  constructor(private router: Router) {
    this.product = this.productService.getProduct();

    if (!this.product) {
      console.error('Product not found!');
      // Redirect to another page if the product is not found
      // this.router.navigate(['/apps/product']);
    } else {
      console.log('Received Product:', this.product);

    }
  }

  ngOnDestroy() {
    // Optional: Clear product data when leaving the component
    //this.productService.clearProduct();
  }

  ngAfterViewInit(): void {}

  trackById(index: number, item: any): string {
    return item.id; // Make sure each slide has a unique 'id' property
  }

  increaseQty() {
    this.quantity++;
  }

  decreaseQty() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  getBack() {
    this.router.navigate(['apps/product/product-list']);
  }

  toggleSelected() {
    this.isSelected = !this.isSelected;
  }
  resetToggleValue() {
    this.toggleValue = null;
  }
  getStarClass(index: number, rating?: number): string {
    const safeRating = rating ?? 0; // Fallback if undefined
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
