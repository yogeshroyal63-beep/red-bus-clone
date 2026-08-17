import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent) },
  { path: 'search', loadComponent: () => import('./components/search-results/search-results.component').then(m => m.SearchResultsComponent) },
  { path: 'seats/:id', loadComponent: () => import('./components/seat-selection/seat-selection.component').then(m => m.SeatSelectionComponent) },
  { path: 'confirm', loadComponent: () => import('./components/booking-confirm/booking-confirm.component').then(m => m.BookingConfirmComponent) },
  { path: 'my-bookings', loadComponent: () => import('./components/my-bookings/my-bookings.component').then(m => m.MyBookingsComponent) },
  { path: 'offers', loadComponent: () => import('./components/offers/offers.component').then(m => m.OffersComponent) },
  { path: 'track', loadComponent: () => import('./components/bus-tracking/bus-tracking.component').then(m => m.BusTrackingComponent) },
  { path: 'notifications', loadComponent: () => import('./components/notifications/notifications.component').then(m => m.NotificationsComponent) },
  { path: 'community', loadComponent: () => import('./components/community/community.component').then(m => m.CommunityComponent) },
  { path: 'route-planner', loadComponent: () => import('./components/route-planner/route-planner.component').then(m => m.RoutePlannerComponent) },
  { path: 'profile', loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent) },
  { path: 'login', loadComponent: () => import('./components/auth/auth.component').then(m => m.AuthComponent) },
  { path: '**', redirectTo: '' }
];
