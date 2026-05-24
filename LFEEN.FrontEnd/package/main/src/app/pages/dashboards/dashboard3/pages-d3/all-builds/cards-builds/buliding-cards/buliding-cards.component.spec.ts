import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulidingCardsComponent } from './buliding-cards.component';

describe('BulidingCardsComponent', () => {
  let component: BulidingCardsComponent;
  let fixture: ComponentFixture<BulidingCardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulidingCardsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulidingCardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
