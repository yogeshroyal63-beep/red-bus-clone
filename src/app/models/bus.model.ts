export interface Bus {
  id: string;
  name: string;
  type: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  from: string;
  to: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  rating: number;
  reviews: number;
  amenities: string[];
  operatorLogo?: string;
  boardingPoints: BoardingPoint[];
  droppingPoints: DroppingPoint[];
  seats: Seat[];
  offers?: string[];
  cancellationPolicy: string;
}

export interface BoardingPoint {
  id: string;
  name: string;
  time: string;
  address: string;
}

export interface DroppingPoint {
  id: string;
  name: string;
  time: string;
  address: string;
}

export interface Seat {
  id: string;
  number: string;
  status: 'available' | 'booked' | 'ladies' | 'selected';
  type: 'seater' | 'sleeper';
  price: number;
  deck: 'lower' | 'upper';
}

export interface SearchParams {
  from: string;
  to: string;
  date: string;
  passengers?: number;
}

export interface Booking {
  id?: string;
  busId: string;
  busName: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  seats: string[];
  passengerDetails: Passenger[];
  totalAmount: number;
  boardingPoint: string;
  droppingPoint: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  bookingDate?: string;
  pnr?: string;
}

export interface Passenger {
  name: string;
  age: number;
  gender: 'M' | 'F';
  seat: string;
}
