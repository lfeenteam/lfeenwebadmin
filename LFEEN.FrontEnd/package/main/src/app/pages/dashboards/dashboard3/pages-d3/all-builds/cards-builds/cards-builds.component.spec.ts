import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardsBuildsComponent } from './cards-builds.component';

describe('CardsBuildsComponent', () => {
  let component: CardsBuildsComponent;
  let fixture: ComponentFixture<CardsBuildsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardsBuildsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardsBuildsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
