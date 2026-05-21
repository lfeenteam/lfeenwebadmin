import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { CeoPageComponent } from './ceo-page.component';

describe('CeoPageComponent', () => {
  let component: CeoPageComponent;
  let fixture: ComponentFixture<CeoPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeoPageComponent],
      providers: [
        {
          provide: TranslateService,
          useValue: { currentLang: 'ar' }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CeoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
