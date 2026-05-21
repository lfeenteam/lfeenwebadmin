import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { BrandingComponent } from '../../../layouts/full/vertical/sidebar/branding.component';

@Component({
  selector: 'app-side-two-steps',
  standalone: true,
  imports: [
    RouterModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    BrandingComponent,
  ],
  templateUrl: './side-two-steps.component.html',
})
export class AppSideTwoStepsComponent {
  options = this.settings.getOptions();

  constructor(private settings: CoreService) {}
}
