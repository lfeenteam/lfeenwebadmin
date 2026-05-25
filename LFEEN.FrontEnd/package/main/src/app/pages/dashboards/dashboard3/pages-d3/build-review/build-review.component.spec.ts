import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuildReviewComponent } from './build-review.component';

describe('BuildReviewComponent', () => {
  let component: BuildReviewComponent;
  let fixture: ComponentFixture<BuildReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuildReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuildReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
