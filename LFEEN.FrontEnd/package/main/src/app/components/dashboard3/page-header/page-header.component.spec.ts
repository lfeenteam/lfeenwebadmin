import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let component: PageHeaderComponent;
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeaderComponent);
    component = fixture.componentInstance;
    component.titleKey = 'd3.allBuilds.title';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
