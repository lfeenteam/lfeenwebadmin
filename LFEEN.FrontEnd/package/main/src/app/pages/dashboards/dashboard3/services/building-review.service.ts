import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BuildingCardItem } from '../interfaces/building-card.model';

@Injectable({
  providedIn: 'root'
})
export class BuildingReviewService {
  private buildings: BuildingCardItem[] = [
    {
      id: '1',
      title: 'd3.allBuilds.buildingNames.building1',
      host: 'd3.allBuilds.buildingHosts.host1',
      location: 'd3.allBuilds.buildingLocations.location1',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.hotel',
      units: 120,
      occupancy: 85,
      bookings: 42,
      lastUpdate: 'd3.allBuilds.buildingDates.date1',
      tab: 'published'
    },
    {
      id: '2',
      title: 'd3.allBuilds.buildingNames.building2',
      host: 'd3.allBuilds.buildingHosts.host2',
      location: 'd3.allBuilds.buildingLocations.location2',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.apartments',
      units: 45,
      occupancy: 63,
      bookings: 18,
      lastUpdate: 'd3.allBuilds.buildingDates.date2',
      tab: 'published'
    },
    {
      id: '3',
      title: 'd3.allBuilds.buildingNames.building3',
      host: 'd3.allBuilds.buildingHosts.host3',
      location: 'd3.allBuilds.buildingLocations.location3',
      status: 'stopped',
      typeLabel: 'd3.allBuilds.buildings.compounds',
      units: 18,
      occupancy: 0,
      bookings: 0,
      lastUpdate: 'd3.allBuilds.buildingDates.date3',
      tab: 'published'
    },
    {
      id: '7',
      title: 'd3.allBuilds.buildingNames.building7',
      host: 'd3.allBuilds.buildingHosts.host7',
      location: 'd3.allBuilds.buildingLocations.location7',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.compounds',
      units: 80,
      occupancy: 68,
      bookings: 22,
      lastUpdate: 'd3.allBuilds.buildingDates.date7',
      tab: 'underReview'
    },
    {
      id: '8',
      title: 'd3.allBuilds.buildingNames.building8',
      host: 'd3.allBuilds.buildingHosts.host8',
      location: 'd3.allBuilds.buildingLocations.location8',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.hotel',
      units: 95,
      occupancy: 55,
      bookings: 31,
      lastUpdate: 'd3.allBuilds.buildingDates.date8',
      tab: 'underReview'
    }
  ];

  private buildingsSubject = new BehaviorSubject<BuildingCardItem[]>(this.buildings);

  getBuildings(): Observable<BuildingCardItem[]> {
    return this.buildingsSubject.asObservable();
  }

  getBuildingById(id: string): BuildingCardItem | undefined {
    return this.buildings.find(b => b.id === id);
  }

  approveBuilding(id: string): void {
    const building = this.buildings.find(b => b.id === id);
    if (building) {
      building.tab = 'published';
      this.buildingsSubject.next([...this.buildings]);
    }
  }
}
