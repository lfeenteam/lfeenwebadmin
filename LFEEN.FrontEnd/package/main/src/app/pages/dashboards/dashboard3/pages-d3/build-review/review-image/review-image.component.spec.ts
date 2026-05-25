import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewImageComponent } from './review-image.component';

describe('ReviewImageComponent', () => {
  let component: ReviewImageComponent;
  let fixture: ComponentFixture<ReviewImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewImageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReviewImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
