import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { IconInbox, IconLock } from 'angular-tabler-icons/icons';

import { CeoPageComponent } from './ceo-page.component';
import { DashboardAccessService, DashboardWidget } from '../../services/dashboard-widgets';
import { NavItem, SidebarService } from '../../services/sidebar.service';

describe('CeoPageComponent', () => {
  let fixture: ComponentFixture<CeoPageComponent>;
  const visible = signal<DashboardWidget[]>([]);
  const nav = signal<NavItem[]>([]);

  const accessStub: Partial<DashboardAccessService> = {
    visible: computed(() => visible()),
    can: (id) => visible().some((w) => w.id === id),
    inSection: (s) => visible().filter((w) => w.section === s),
  };

  beforeEach(async () => {
    visible.set([]);
    nav.set([
      { title: 'Units', link: '/d3/units' },
      { title: 'Group', children: [{ title: 'Bookings', link: '/d3/bookings' }] },
      { title: 'Dashboard', link: '/d3/ceo' },
    ]);
    await TestBed.configureTestingModule({
      imports: [CeoPageComponent, TranslateModule.forRoot(), TablerIconsModule.pick({ IconLock, IconInbox })],
      providers: [
        provideRouter([]),
        { provide: DashboardAccessService, useValue: accessStub },
        { provide: SidebarService, useValue: { sidebarItems: nav } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CeoPageComponent);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('with no statistic allowed, shows the no-permission state and the admin\'s own pages', () => {
    expect(el().querySelector('app-dashboard-empty')).not.toBeNull();
    const links = Array.from(el().querySelectorAll('[data-role=shortcut]')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/ar/d3/units', '/ar/d3/bookings']); // the dashboard itself is not offered
  });

  it('never creates a dashboard widget component (so never fetches) when nothing is allowed', () => {
    for (const tag of ['app-cards-top', 'app-dashboard3-chart', 'app-dashboard3-insights', 'app-dashboard3-period-filter']) {
      expect(el().querySelector(tag)).withContext(tag).toBeNull();
    }
  });
});
