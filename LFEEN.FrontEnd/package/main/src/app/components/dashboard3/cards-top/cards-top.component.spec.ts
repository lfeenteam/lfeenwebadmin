import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardsTopComponent } from './cards-top.component';

describe('CardsTopComponent', () => {
  let component: CardsTopComponent;
  let fixture: ComponentFixture<CardsTopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardsTopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardsTopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
