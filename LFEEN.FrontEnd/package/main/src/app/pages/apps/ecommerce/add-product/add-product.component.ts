import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { IconModule } from 'src/app/icon/icon.module';
import { MaterialModule } from 'src/app/material.module';

import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Router } from '@angular/router';
import { ProductService } from 'src/app/services/apps/product/product.service';
import { debounceTime } from 'rxjs';
import { NgxDropzoneModule } from 'ngx-dropzone';
import { PRODUCT_DATA } from '../ecommerceData';
import {
  NgxEditorComponent,
  NgxEditorMenuComponent,
  Editor,
  Toolbar,
} from 'ngx-editor';
@Component({
  selector: 'app-add-product',
  imports: [
    MaterialModule,
    IconModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxDropzoneModule,
    NgxEditorComponent,
    NgxEditorMenuComponent,
  ],
  templateUrl: './add-product.component.html',
  styleUrl: './add-product.component.scss',
})
export class AddProductComponent implements OnInit {
  private router = inject(Router);
  private productService = inject(ProductService);
  private fb = inject(FormBuilder);

  html = '';
  editor: Editor;
  htmlContent1 = '';
  toolbar: Toolbar = [
    ['bold', 'italic'],
    ['underline'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['link', 'image'],
    ['text_color', 'background_color'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
  ];

  files: File[] = [];
  seasons: string[] = ['No Discount', 'Percentage %', 'Fixed Price'];
  sizes: string[] = ['XS', 'S', 'M', 'L', 'XL'];

  taxClasses: string[] = [
    'Select an option',
    'Tax Free',
    'Taxable Goods',
    'Downloadable Products',
  ];
  categories: string[] = [
    'Computer',
    'Watches',
    'Headphones',
    'Beauty',
    'Fashion',
    'Footwear',
  ];
  templates: string[] = [
    'Default template',
    'Fashion',
    'Office Stationary',
    'Electronics',
  ];

  productStatuses = [
    { label: 'Stock', value: true },
    { label: 'Out of stock', value: false },
  ];
  selectedOption: string = '';
  tags: string[] = []; // Selected tags
  allTags: string[] = ['electronics', 'books', 'clothing', 'music']; // Suggestions
  AddProduct!: FormGroup;

  product: any;
  isEditMode: boolean = false;
  constructor() {
    this.AddProduct = this.fb.group({
      id: [null],
      product_name: ['', Validators.required],
      description: [''],
      size: [''],
      variations: [''],
      base_price: [''],

      discount_type: ['No Discount'],
      set_discount_percentage: [''],
      fixed_discounted_price: [''],
      tax_class: [''],
      VAT_amount: [''],
      status: [''],
      categories: [''],
      default_template: [''],
      tags: this.fb.array([]),

      media: this.fb.array([]),
      Thumbnail: this.fb.array([]),
    });
  }

  get isFormValid() {
    return this.AddProduct.valid;
  }

  get mediaArray() {
    return this.AddProduct.get('media') as FormArray;
  }
  get sizeControl() {
    return this.AddProduct.get('size');
  }
  get Thumbnail(): FormArray {
    return this.AddProduct.get('Thumbnail') as FormArray;
  }
  get tagsArray(): FormArray {
    return this.AddProduct.get('tags') as FormArray;
  }
  ngOnInit(): void {
    this.editor = new Editor();

    const currentUrl = this.router.url;

    if (currentUrl.includes('edit-product')) {
      const product = this.productService.getProduct();
      if (product) {
        // Case: Navigate via button with selected product
        this.isEditMode = true;
        this.populateForm(product);
      } else {
        // Case: Direct navigation to /edit-product with no data
        this.isEditMode = true;
        this.populateForm(PRODUCT_DATA[0]); // fallback product
      }

      this.productService.clearProduct(); // cleanup
    } else if (currentUrl.includes('add-product')) {
      // Case: Add mode
      this.isEditMode = false;
      this.populateForm({}); // empty form
    }
  }
  ngOnDestroy() {
    this.editor.destroy();
    // Optional: Clear product data when leaving the component
    this.productService.clearProduct();
  }

  onChange(event: any) {
    console.log('changed');
  }

  onBlur(event: any) {
    console.log('blur ' + event);
  }
  onSelect(event: any) {
    const files = event.addedFiles; // Getting the selected files

    // Loop through the selected files and add them to the FormArray
    files.forEach((file: any) => {
      this.mediaArray.push(this.fb.control(file)); // Add file to FormArray
    });
  }

  // Method to remove file
  onRemove(file: any, index?: any) {
    index = this.mediaArray.controls.findIndex(
      (control) => control.value === file
    );
    if (index > -1) {
      this.mediaArray.removeAt(index); // Remove file from FormArray
    }
  }
  onSeasonChange(event: any) {
    this.selectedOption = event.value;
  }
  selectTag(tag: string) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  addTagFromInput(event: any) {
    const input = event.input;
    const value = event.value?.trim();

    if (value && !this.tags.includes(value)) {
      this.tags.push(value);
    }

    if (input) input.value = '';
  }

  removeTag(tag: string) {
    this.tags = this.tags.filter((t) => t !== tag);
  }
  getBack() {
    this.router.navigate(['apps/product/product-list']);
  }
  getAddProduct(data: any) {
    const formData = this.AddProduct.getRawValue();
    const imageFilename = formData.media[0]; // e.g., "Spike Nextjs Free.jpg"

    // Store the image filename in localStorage (as a string)
    localStorage.setItem('productImage', imageFilename);
    if (this.isEditMode) {
      if (!formData.id) {
        console.error('Updated product does not have an id:', formData); // Log if id is missing
      }
      this.updateProduct(formData); // Pass formData which should have id
    } else {
      this.addProduct(formData); // Handle adding a new product (no id for new product)
    }
  }

  addProduct(data: any) {
    if (this.AddProduct.valid) {
      // Extract plain text from ngx-editor content
      if (data.description?.content?.length) {
        data.description = this.extractPlainText(data.description);
      } else {
        data.description = '';
      }

      // Handle media
      if (data.media && data.media.length > 0) {
        data.media = data.media.map((file: any) => file.name);
      } else {
        data.media = [];
      }

      // Clean up unnecessary fields
      delete data.size;
      delete data.Thumbnail;
      delete data.VAT_amount;
      delete data.default_template;
      delete data.fixed_discounted_price;
      delete data.tags;
      delete data.tax_class;
      delete data.variations;
      delete data.set_discount_percentage;
      delete data.discount_type;

      this.productService.emitProduct(data);
      this.getBack();
    }
  }
  extractPlainText(doc: any): string {
    let text = '';

    if (!doc?.content) return text;

    doc.content.forEach((node: any) => {
      if (node.content) {
        node.content.forEach((child: any) => {
          if (child.text) {
            text += child.text + ' ';
          }
        });
      }
    });

    return text.trim();
  }

  populateForm(product: any) {
    this.AddProduct.patchValue({
      id: product.id,
      product_name: product.product_name || product.title || '',
      category: product.category,
      base_price: product.base_price || product.price || '',
      status: product.status,
      description: product.description,
      imagePath: product.imagePath,
    });
  }
  updateProduct(data: any) {
    if (this.AddProduct.valid) {
      if (data.media && data.media.length > 0) {
        data.media = data.media.map((file: any) => file.name);
      } else {
        data.media = [];
      }

      // clean up unnecessary fields
      delete data.size;
      delete data.Thumbnail;
      delete data.VAT_amount;
      delete data.default_template;
      delete data.fixed_discounted_price;
      delete data.tags;
      delete data.tax_class;
      delete data.variations;
      delete data.set_discount_percentage;
      delete data.discount_type;
      this.productService.updateProduct(data); // <-- make sure you have this method in service
      this.getBack();
    }
  }
}
