import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map, catchError } from 'rxjs';
import { Bus, SearchParams, Booking, Seat } from '../models/bus.model';
import { environment } from '../../environments/environment';

// Finding #3: this service used to be a fully hardcoded local array, never wired to
// GET /api/buses at all — so even though reviews.js correctly recomputes Bus.rating and
// Bus.reviews in MongoDB (or the shared mock array, see reviews.js) after every
// create/edit/report, no UI surface ever read it back; search results and bus cards
// showed the same static 4.2/2841 forever regardless of real review activity. This now
// calls the real API, adapting the server's `_id` to the frontend's `id`, and falls back
// to the local mock (kept below, identical ids/names — see routes/buses.js's Finding #30
// note on why the two datasets had to be reconciled first) only if the API is unreachable.
@Injectable({ providedIn: 'root' })
export class BusService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private adapt(raw: any): Bus {
    return { ...raw, id: raw.id || raw._id };
  }

  private buses: Bus[] = [
    {
      id: '1', name: 'VRL Travels', type: 'Multi-Axle Semi Sleeper (2+2)',
      departureTime: '21:30', arrivalTime: '06:00', duration: '8h 30m',
      from: 'Bangalore', to: 'Chennai', price: 650, totalSeats: 40, availableSeats: 22,
      rating: 4.2, reviews: 2841, offers: ['15% off with ICICI card'],
      amenities: ['wifi', 'charging', 'water', 'blanket', 'ac'],
      cancellationPolicy: 'Free cancellation before 24 hrs',
      boardingPoints: [
        { id: 'b1', name: 'Majestic Bus Stand', time: '21:30', address: 'Majestic, Bangalore' },
        { id: 'b2', name: 'Silk Board', time: '21:50', address: 'Silk Board Junction, Bangalore' },
        { id: 'b3', name: 'Hebbal', time: '21:10', address: 'Hebbal Flyover, Bangalore' }
      ],
      droppingPoints: [
        { id: 'd1', name: 'CMBT', time: '05:50', address: 'CMBT, Chennai' },
        { id: 'd2', name: 'Koyambedu', time: '06:00', address: 'Koyambedu, Chennai' },
        { id: 'd3', name: 'Guindy', time: '06:20', address: 'Guindy, Chennai' }
      ],
      seats: generateSeats(40)
    },
    {
      id: '2', name: 'SRS Travels', type: 'Volvo Multi-Axle A/C Sleeper (2+1)',
      departureTime: '20:00', arrivalTime: '05:30', duration: '9h 30m',
      from: 'Bangalore', to: 'Chennai', price: 950, totalSeats: 30, availableSeats: 8,
      rating: 4.5, reviews: 5123, offers: ['10% off on 1st booking'],
      amenities: ['wifi', 'charging', 'water', 'blanket', 'ac', 'snacks', 'entertainment'],
      cancellationPolicy: 'Free cancellation before 12 hrs',
      boardingPoints: [
        { id: 'b1', name: 'Shivajinagar', time: '20:00', address: 'Shivajinagar Bus Stand' },
        { id: 'b2', name: 'Electronic City', time: '20:30', address: 'Electronic City Phase 2' }
      ],
      droppingPoints: [
        { id: 'd1', name: 'CMBT', time: '05:20', address: 'CMBT, Chennai' },
        { id: 'd2', name: 'Koyambedu', time: '05:30', address: 'Koyambedu' }
      ],
      seats: generateSeats(30)
    },
    {
      id: '3', name: 'Orange Tours & Travels', type: 'A/C Seater / Sleeper (2+2)',
      departureTime: '22:45', arrivalTime: '07:15', duration: '8h 30m',
      from: 'Bangalore', to: 'Chennai', price: 750, totalSeats: 44, availableSeats: 30,
      rating: 3.9, reviews: 876,
      amenities: ['charging', 'water', 'ac'],
      cancellationPolicy: 'Free cancellation before 6 hrs',
      boardingPoints: [
        { id: 'b1', name: 'Majestic', time: '22:45', address: 'Majestic Bus Stand' }
      ],
      droppingPoints: [
        { id: 'd1', name: 'CMBT', time: '07:10', address: 'CMBT, Chennai' }
      ],
      seats: generateSeats(44)
    },
    {
      id: '4', name: 'Kallada Travels (G6)', type: 'Volvo Multi Axle A/C Sleeper (2+1)',
      departureTime: '19:30', arrivalTime: '04:45', duration: '9h 15m',
      from: 'Bangalore', to: 'Chennai', price: 1100, totalSeats: 27, availableSeats: 4,
      rating: 4.6, reviews: 7232, offers: ['FIRST10: 10% off'],
      amenities: ['wifi', 'charging', 'water', 'blanket', 'ac', 'entertainment'],
      cancellationPolicy: 'Free cancellation before 24 hrs',
      boardingPoints: [
        { id: 'b1', name: 'Jayanagar', time: '19:30', address: 'Jayanagar 4th Block' },
        { id: 'b2', name: 'Silk Board', time: '19:50', address: 'Silk Board Junction' }
      ],
      droppingPoints: [
        { id: 'd1', name: 'Koyambedu', time: '04:45', address: 'Koyambedu Bus Terminal' },
        { id: 'd2', name: 'Anna Nagar', time: '05:10', address: 'Anna Nagar Tower' }
      ],
      seats: generateSeats(27)
    },
    {
      id: '5', name: 'KSRTC Airavat Club Class', type: 'Volvo Multi Axle A/C Seater (2+2)',
      departureTime: '06:00', arrivalTime: '13:30', duration: '7h 30m',
      from: 'Bangalore', to: 'Chennai', price: 520, totalSeats: 40, availableSeats: 35,
      rating: 4.0, reviews: 3421,
      amenities: ['ac', 'charging'],
      cancellationPolicy: 'Non-refundable',
      boardingPoints: [
        { id: 'b1', name: 'Majestic (Kempegowda Bus Stand)', time: '06:00', address: 'Majestic Bus Stand' }
      ],
      droppingPoints: [
        { id: 'd1', name: 'CMBT', time: '13:30', address: 'CMBT, Chennai' }
      ],
      seats: generateSeats(40)
    },
    {
      id: '6', name: 'Parveen Travels', type: 'A/C Sleeper (2+1)',
      departureTime: '23:59', arrivalTime: '08:30', duration: '8h 31m',
      from: 'Bangalore', to: 'Chennai', price: 880, totalSeats: 24, availableSeats: 12,
      rating: 4.1, reviews: 1543, offers: ['5% off with HDFC card'],
      amenities: ['charging', 'water', 'blanket', 'ac'],
      cancellationPolicy: 'Free cancellation before 6 hrs',
      boardingPoints: [
        { id: 'b1', name: 'Shivajinagar', time: '23:59', address: 'Shivajinagar Bus Stand' }
      ],
      droppingPoints: [
        { id: 'd1', name: 'CMBT', time: '08:30', address: 'CMBT, Chennai' }
      ],
      seats: generateSeats(24)
    }
  ];

  searchBuses(params: SearchParams): Observable<Bus[]> {
    return this.http.get<any>(`${this.apiUrl}/buses/search`, { params: { from: params.from, to: params.to, date: params.date || '' } }).pipe(
      map(res => (res.data || []).map((b: any) => this.adapt(b))),
      catchError(() => {
        // API unreachable — fall back to the local mock so the page still works offline/in dev
        const results = this.buses.filter(b =>
          b.from.toLowerCase().includes(params.from.toLowerCase()) &&
          b.to.toLowerCase().includes(params.to.toLowerCase())
        );
        return of(results).pipe(delay(300));
      })
    );
  }

  getBusById(id: string, date?: string): Observable<Bus | undefined> {
    const params: any = date ? { date } : {};
    return this.http.get<any>(`${this.apiUrl}/buses/${id}`, { params }).pipe(
      map(res => this.adapt(res.data)),
      catchError(() => of(this.buses.find(b => b.id === id)))
    );
  }

  getAllBuses(): Observable<Bus[]> {
    return this.http.get<any>(`${this.apiUrl}/buses`).pipe(
      map(res => (res.data || []).map((b: any) => this.adapt(b))),
      catchError(() => of(this.buses))
    );
  }

  getPopularRoutes() {
    return [
      { from: 'Bangalore', to: 'Chennai', price: 299, buses: 120 },
      { from: 'Mumbai', to: 'Pune', price: 199, buses: 95 },
      { from: 'Delhi', to: 'Agra', price: 250, buses: 80 },
      { from: 'Hyderabad', to: 'Bangalore', price: 350, buses: 110 },
      { from: 'Kolkata', to: 'Bhubaneswar', price: 280, buses: 60 },
      { from: 'Chennai', to: 'Coimbatore', price: 320, buses: 75 },
      { from: 'Ahmedabad', to: 'Surat', price: 180, buses: 88 },
      { from: 'Jaipur', to: 'Delhi', price: 220, buses: 65 },
    ];
  }
}

function generateSeats(count: number): Seat[] {
  const seats: Seat[] = [];
  const statuses: ('available' | 'booked' | 'ladies')[] = ['available', 'booked', 'ladies'];
  for (let i = 1; i <= count; i++) {
    const rand = Math.random();
    const status = rand < 0.5 ? 'available' : rand < 0.85 ? 'booked' : 'ladies';
    seats.push({
      id: `s${i}`,
      number: `${i}`,
      status,
      type: i % 3 === 0 ? 'sleeper' : 'seater',
      price: 650 + (i % 3) * 50,
      deck: i <= count / 2 ? 'lower' : 'upper'
    });
  }
  return seats;
}
