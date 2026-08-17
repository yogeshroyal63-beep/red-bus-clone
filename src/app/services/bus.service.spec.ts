import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BusService } from './bus.service';

describe('BusService', () => {
  let service: BusService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [BusService] });
    service = TestBed.inject(BusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return buses for valid route', (done) => {
    service.searchBuses({ from: 'Bangalore', to: 'Chennai', date: '2026-08-15' }).subscribe(buses => {
      expect(buses.length).toBeGreaterThan(0);
      expect(buses.every(b => b.from.toLowerCase().includes('bangalore'))).toBeTrue();
      done();
    });
  });

  it('should return empty array for unknown route', (done) => {
    service.searchBuses({ from: 'Mars', to: 'Venus', date: '2026-08-15' }).subscribe(buses => {
      expect(buses.length).toBe(0);
      done();
    });
  });

  it('should return a specific bus by ID', (done) => {
    service.getBusById('1').subscribe(bus => {
      expect(bus).toBeDefined();
      expect(bus?.id).toBe('1');
      expect(bus?.name).toBeTruthy();
      done();
    });
  });

  it('should return undefined for non-existent bus ID', (done) => {
    service.getBusById('9999').subscribe(bus => {
      expect(bus).toBeUndefined();
      done();
    });
  });

  it('should return popular routes', () => {
    const routes = service.getPopularRoutes();
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].from).toBeTruthy();
    expect(routes[0].to).toBeTruthy();
    expect(routes[0].price).toBeGreaterThan(0);
  });

  it('should return all buses', (done) => {
    service.getAllBuses().subscribe(buses => {
      expect(buses.length).toBeGreaterThan(0);
      buses.forEach(bus => {
        expect(bus.id).toBeTruthy();
        expect(bus.price).toBeGreaterThan(0);
        expect(bus.availableSeats).toBeGreaterThanOrEqual(0);
      });
      done();
    });
  });
});
