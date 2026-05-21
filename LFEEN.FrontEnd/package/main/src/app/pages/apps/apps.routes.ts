import { Routes } from '@angular/router';

import { AppChatComponent } from './chat/chat.component';
import { AppEmailComponent } from './email/email.component';
import { DetailComponent } from './email/detail/detail.component';
import { AppCoursesComponent } from './courses/courses.component';
import { AppCourseDetailComponent } from './courses/course-detail/course-detail.component';
import { AppEmployeeComponent } from './employee/employee.component';
import { AppBlogsComponent } from './blogs/blogs.component';
import { AppBlogDetailsComponent } from './blogs/details/details.component';
import { AppContactComponent } from './contact/contact.component';
import { AppNotesComponent } from './notes/notes.component';
import { AppTodoComponent } from './todo/todo.component';
import { AppPermissionComponent } from './permission/permission.component';
import { AppKanbanComponent } from './kanban/kanban.component';
import { AppFullcalendarComponent } from './fullcalendar/fullcalendar.component';
import { AppTicketlistComponent } from './tickets/tickets.component';
import { AppInvoiceListComponent } from './invoice/invoice-list/invoice-list.component';
import { AppAddInvoiceComponent } from './invoice/add-invoice/add-invoice.component';
import { AppInvoiceViewComponent } from './invoice/invoice-view/invoice-view.component';
import { AppEditInvoiceComponent } from './invoice/edit-invoice/edit-invoice.component';
import { AppContactListComponent } from './contact-list/contact-list.component';
import { ProfileContentComponent } from './profile-content/profile-content.component';
import { FollowersComponent } from './profile-content/followers/followers.component';
import { GalleryComponent } from './profile-content/gallery/gallery.component';
import { FriendsComponent } from './profile-content/friends/friends.component';
import { ProductComponent } from './ecommerce/ecommerce.component';
import { AddProductComponent } from './ecommerce/add-product/add-product.component';
import { ProductDetailsComponent } from './ecommerce/product-details/product-details.component';
import { ShopComponent } from './ecommerce/shop/shop.component';


export const AppsRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'chat',
        component: AppChatComponent,
        data: {
          title: 'Chat',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Chat' },
          ],
        },
      },
      {
        path: 'calendar',
        component: AppFullcalendarComponent,
        data: {
          title: 'Calendar',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Calendar' },
          ],
        },
      },
      {
        path: 'notes',
        component: AppNotesComponent,
        data: {
          title: 'Notes',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Notes' },
          ],
        },
      },
      { path: 'email', redirectTo: 'email/inbox', pathMatch: 'full' },
      {
        path: 'email/:type',
        component: AppEmailComponent,
        data: {
          title: 'Email',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Email' },
          ],
        },
        children: [
          {
            path: ':id',
            component: DetailComponent,
            data: {
              title: 'Email Detail',
              urls: [
                { title: 'Dashboard', url: '/dashboards/dashboard1' },
                { title: 'Email Detail' },
              ],
            },
          },
        ],
      },
      {
        path: 'permission',
        component: AppPermissionComponent,
        data: {
          title: 'Roll Base Access',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Roll Base Access' },
          ],
        },
      },
      {
        path: 'todo',
        component: AppTodoComponent,
        data: {
          title: 'Todo App',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Todo App' },
          ],
        },
      },
      {
        path: 'kanban',
        component: AppKanbanComponent,
        data: {
          title: 'Kanban',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Kanban' },
          ],
        },
      },
      {
        path: 'tickets',
        component: AppTicketlistComponent,
        data: {
          title: 'Tickets',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Tickets' },
          ],
        },
      },
      {
        path: 'contacts',
        component: AppContactComponent,
        data: {
          title: 'Contacts',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Contacts' },
          ],
        },
      },
      {
        path: 'courses',
        component: AppCoursesComponent,
        data: {
          title: 'Courses',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Courses' },
          ],
        },
      },
      {
        path: 'contact-list',
        component: AppContactListComponent,
        data: {
          title: 'Contact List',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Contact List' },
          ],
        },
      },
      {
        path: 'courses/coursesdetail/:id',
        component: AppCourseDetailComponent,
        data: {
          title: 'Course Detail',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Course Detail' },
          ],
        },
      },
      {
        path: 'blog/post',
        component: AppBlogsComponent,
        data: {
          title: 'Posts',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Posts' },
          ],
        },
      },
      {
        path: 'blog/detail/:id',
        component: AppBlogDetailsComponent,
        data: {
          title: 'Blog Detail',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Blog Detail' },
          ],
        },
      },
      {
        path: 'employee',
        component: AppEmployeeComponent,
        data: {
          title: 'Employee',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Employee' },
          ],
        },
      },
      {
        path: 'invoice/list',
        component: AppInvoiceListComponent,
        data: {
          title: 'Invoice',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Invoice' },
          ],
        },
      },
      {
        path: 'invoice/addInvoice',
        component: AppAddInvoiceComponent,
        data: {
          title: 'Add Invoice',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Add Invoice' },
          ],
        },
      },
      {
        path: 'invoice/viewInvoice/:id',
        component: AppInvoiceViewComponent,
        data: {
          title: 'View Invoice',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'View Invoice' },
          ],
        },
      },
      {
        path: 'invoice/editinvoice/:id',
        component: AppEditInvoiceComponent,
        data: {
          title: 'Edit Invoice',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Edit Invoice' },
          ],
        },
      },
      {
        path: 'profile-details/profile',
        component: ProfileContentComponent,
        data: {
          title: 'User Details',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'User Details' },
          ],
        },
      },
      {
        path: 'profile-details/followers',
        component: FollowersComponent,
        data: {
          title: 'Followers',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Followers' },
          ],
        },
      },
      {
        path: 'profile-details/friends',
        component: FriendsComponent,
        data: {
          title: 'Friends',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Friends' },
          ],
        },
      },
      {
        path: 'profile-details/gallery',
        component: GalleryComponent,
        data: {
          title: 'Gellary',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Gellary' },
          ],
        },
      },
      {
        path: 'product/product-list',
        component: ProductComponent,
        data: {
          title: 'Product List',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Product List' },
          ],
        },
      },
      {
        path: 'product/add-product',
        component: AddProductComponent,
        data: {
          title: 'Add Product',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Add Product' },
          ],
        },
      },
      {
        path: 'product/product-details',
        component: ProductDetailsComponent,
        data: {
          title: 'Product Details',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Product Details' },
          ],
        },
      },
      {
        path: 'product/edit-product',
        component: AddProductComponent,
        data: {
          title: 'Edit Product',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Edit Product' },
          ],
        },
      },
      {
        path: 'product/shop',
        component: ShopComponent,
        data: {
          title: 'Shop',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Shop' },
          ],
        },
      },
    ],
  },
]; 