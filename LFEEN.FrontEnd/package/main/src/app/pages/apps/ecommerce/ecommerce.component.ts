import { SelectionModel } from '@angular/cdk/collections';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  inject,
  NgZone,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from 'src/app/material.module';

import { CommonModule } from '@angular/common';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { IconModule } from 'src/app/icon/icon.module';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DeleteDialogComponent } from '../delete-dialog/delete-dialog.component';
import { ProductService } from 'src/app/services/apps/product/product.service';
import { Element, PRODUCT_DATA } from './ecommerceData';

@Component({
  selector: 'app-ecommerce',
  imports: [MaterialModule, CommonModule, IconModule],
  templateUrl: './ecommerce.component.html',
  styleUrl: './ecommerce.component.scss',
})
export class ProductComponent implements AfterViewInit, OnInit {
  @ViewChild(MatTable) table!: MatTable<Element>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator =
    Object.create(null);
  private _snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private productService =  inject(ProductService);
  readonly dialog = inject(MatDialog);
  

  displayedColumns: string[] = [
    'select',
    'product_name',
    'date',
    'status',
    'base_price',
  ];
  dataSource = new MatTableDataSource<Element>(PRODUCT_DATA);
  selection = new SelectionModel<Element>(true, []);
  durationInSeconds = 1;
  constructor(
    private breakpointObserver: BreakpointObserver,
    private cdr: ChangeDetectorRef,
  ) {
    this.breakpointObserver
      .observe(['(max-width: 600px)'])
      .subscribe((result: BreakpointState) => {
        this.displayedColumns = result.matches
          ? ['product_name', 'date', 'status', 'base_price']
          : [
              'select',
              'product_name',
              'date',
              'status',
              'base_price',
              'actions',
            ];
      });
  }
  ngOnInit(): void {
    this.getAddedTableData();
    this.productService.productUpdated.subscribe((updatedProduct: any) => {
      // Ensure updatedProduct has an id and dataSource is an array
      if (!updatedProduct.id) {
        console.warn('Updated product does not have an id:', updatedProduct);
        return;
      }

      const productIndex = this.dataSource.data.findIndex(
        (product: any) => product.id === updatedProduct.id
      );
      if (productIndex !== -1) {
        // If the product is found, update it with the new data
        this.dataSource.data[productIndex] = {
          ...this.dataSource.data[productIndex],
          ...updatedProduct,
        };

        // Trigger reactivity by setting the data again
        this.dataSource.data = [...this.dataSource.data];

        // Reset paginator if any
        if (this.paginator) {
          this.paginator.pageIndex = 0;
          this.dataSource.paginator = this.paginator;
        }

        // Trigger table re-render
        setTimeout(() => {
          if (this.table) {
            this.table.renderRows();
          }
        });

        // Run change detection if necessary (for OnPush change detection)
        this.cdr.detectChanges();
        this.openSnackBar('Product updated successfully!');
      } else {
        console.warn('Product not found for update:', updatedProduct);
      }
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
  
    this.dataSource.filterPredicate = (data: Element, filter: string) => {
      return (
        data.product_name.toLowerCase().includes(filter) ||
        data.categories.join(' ').toLowerCase().includes(filter)
      );
    };
  
    this.dataSource.filter = filterValue;

  }
  

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected(): any {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle(): void {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.data.forEach((row) => this.selection.select(row));
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: Element): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${
      row.id + 1
    }`;
  }

  openSnackBar(message: string) {
    this._snackBar.open(message, 'Close', {
      duration: this.durationInSeconds * 1000,
      verticalPosition: 'top',
      horizontalPosition: 'center',
    });
  }

  getDeletedById(id: number) {
    // Remove the record from dataSource by filtering out the one with matching id
    const updatedData = this.dataSource.data.filter((item) => item.id !== id);

    // Update the dataSource with the filtered data
    this.dataSource.data = updatedData;
    if (this.table) {
      this.table.renderRows();
    } else {
      console.error('Table reference is undefined');
    }
    // Refresh table view
    this.dataSource._updateChangeSubscription();
    this.cdr.detectChanges();

    this.openSnackBar('Product deleted successfully!');
  }

  getViewNavigate(element: Element) {
    this.productService.setProduct(element);
    this.router.navigate(['apps/product/product-details']);
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
  
    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'delete') {
        if (Array.isArray(idOrIds)) {
          this.deleteSelectedIds(idOrIds); // ⬅️ Handle multiple deletion
        } else {
          this.getDeletedById(idOrIds); // ⬅️ Handle single deletion
        }
      }
    });
  }

 
  getEditProduct(element?: Element) {
    const productToEdit = element || PRODUCT_DATA[0];
    this.productService.setProduct(productToEdit); // Store product to localStorage/service
    this.router.navigate(['apps/product/edit-product']); // Navigate to edit page
  }
  getAddedTableData() {
    this.productService.productAdded$.subscribe((result: any) => {
      if (result) {
        const newId = this.dataSource.data.length + 1;

        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }).formatToParts(now);

        const weekday = parts.find((p) => p.type === 'weekday')?.value;
        const month = parts.find((p) => p.type === 'month')?.value;
        const day = parts.find((p) => p.type === 'day')?.value;
        const year = parts.find((p) => p.type === 'year')?.value;

        const formattedDate = `${weekday}, ${month} ${day} ${year}`;

        // ✅ Convert HTML description to plain text
        const plainTextDescription =
          new DOMParser().parseFromString(result.description, 'text/html').body
            .textContent || '';


        const storedImage = localStorage.getItem('productImage') || 'assets/images/products/s3.jpg';


        const newProduct: Element = {
          id: newId,
          imagePath:'assets/images/products/s3.jpg',
          product_name: result.product_name,
          categories: [result.categories],
          date: formattedDate,
          status: result.status,
          base_price: Number(result.base_price),
          dealPrice:  Number(result.discounted),
          description: plainTextDescription,
          rating:4.5
        };

        this.dataSource.data.unshift(newProduct);
        this.dataSource.data = [...this.dataSource.data];

        if (this.paginator) {
          this.paginator.pageIndex = 0;
          this.dataSource.paginator = this.paginator;
        }

        setTimeout(() => this.table?.renderRows());

        this.cdr.detectChanges();
        this.openSnackBar('Product added successfully!');
        this.productService.clearEmittedProduct();
      }
    });
  }
  
  deleteSelected(): void {
    const selectedIds = this.selection.selected.map((item) => item.id);
    if (selectedIds.length > 0) {
      this.openDialog(selectedIds); // Open dialog with selected IDs
    }
  }

  deleteSelectedIds(ids: number[]): void {
    this.dataSource.data = this.dataSource.data.filter(item => !ids.includes(item.id));
    this.openSnackBar('Selected products deleted successfully!');
    this.selection.clear(); // Clear selection after deletion
  }
  getAddProductNavigate(){
    this.router.navigate(['apps/product/add-product'])
  }
}
