import { Component } from '@angular/core';
import { MaterialModule } from '../../../../../material.module';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MaterialModule,
    RouterModule,
    TablerIconsModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    TranslateModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  hide = true;
  constructor() {}
}
