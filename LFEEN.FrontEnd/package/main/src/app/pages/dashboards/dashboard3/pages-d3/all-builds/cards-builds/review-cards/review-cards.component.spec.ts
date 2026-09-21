import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewCardsComponent } from './review-cards.component';

describe('ReviewCardsComponent', () => {
  let component: ReviewCardsComponent;
  let fixture: ComponentFixture<ReviewCardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewCardsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReviewCardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
