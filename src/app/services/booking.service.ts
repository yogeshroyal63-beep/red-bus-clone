import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError, TimeoutError } from 'rxjs';
import { catchError, tap, map, timeout } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Booking } from '../models/bus.model';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';

/** Trimmed booking shape returned by the public, unauthenticated tracking endpoint —
 *  deliberately excludes passengerDetails/contactEmail/contactPhone/totalAmount/seats,
 *  which stay behind the owner-only getByPnr()/getMyBookings(). */
export type BookingTrackingInfo = Pick<Booking,
  'pnr' | 'busName' | 'from' | 'to' | 'date' | 'departureTime' | 'arrivalTime' |
  'boardingPoint' | 'droppingPoint' | 'status'>;

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = `${environment.apiUrl}/bookings`;

  // Finding V: this cache used to live under one flat key ('rb_bookings_cache') shared
  // by every account that ever used this browser — on a shared/family/library device,
  // if getMyBookings()'s API call failed for any reason, the fallback showed whatever
  // was cached from whoever used the browser last (PNR, passenger names, ages, phone,
  // email, amount), with no ownership check, silently. Scoping the key to the current
  // account (or 'guest') means a failed request can only ever fall back to that same
  // account's own last-known bookings, never someone else's.
  private cacheKey(): string {
    return `rb_bookings_cache_${this.auth.user()?._id || 'guest'}`;
  }
  private get _localCache(): Booking[] {
    try { return JSON.parse(localStorage.getItem(this.cacheKey()) || '[]'); } catch { return []; }
  }
  private set _localCache(bookings: Booking[]) {
    localStorage.setItem(this.cacheKey(), JSON.stringify(bookings.slice(0, 20)));
  }

  constructor(
    private http: HttpClient,
    private notifService: NotificationService,
    private auth: AuthService,
    private i18n: I18nService
  ) {}

  /**
   * Create a real booking via the backend API.
   * On success: fires booking confirmation notification + caches locally.
   * On failure: returns a clear error — does NOT silently fall back.
   */
  createBooking(booking: Omit<Booking, 'id' | 'pnr' | 'status' | 'bookingDate'>): Observable<Booking> {
    return this.http.post<{ success: boolean; data: Booking; pnr: string; message: string }>(
      this.api, booking
    ).pipe(
      map(res => res.data),
      tap(saved => {
        // Update local cache
        this._localCache = [saved, ...this._localCache];

        // Fire booking confirmation notification (localized — title/message re-translate live)
        this.notifService.push({
          type: 'booking',
          title: `Your bus ${saved.from} → ${saved.to} on ${saved.date} is confirmed. PNR: ${saved.pnr}`,
          message: `Your bus ${saved.from} → ${saved.to} on ${saved.date} is confirmed. PNR: ${saved.pnr}`,
          titleKey: 'notif.bookingTitle',
          messageKey: 'notif.bookingMsg',
          params: { from: saved.from, to: saved.to, date: saved.date, pnr: saved.pnr },
          channel: 'push',
          icon: 'fa-check-circle',
          color: '#4caf50',
          action: '/my-bookings'
        });

        // Finding #14: this used to push the "reminder" immediately, right alongside the
        // booking confirmation — the comment claimed "simulated 24h before" but nothing
        // ever delayed it. pushScheduled() actually holds it until 24h before the real
        // departure (or fires now if departure is already under 24h away).
        const departureAt = new Date(`${saved.date}T${(saved.departureTime || '00:00').padStart(5, '0')}:00`);
        this.notifService.pushScheduled({
          type: 'reminder',
          title: `Reminder: Your bus departs at ${saved.departureTime} from ${saved.boardingPoint}. Be there 30 mins early!`,
          message: `Reminder: Your bus departs at ${saved.departureTime} from ${saved.boardingPoint}. Be there 30 mins early!`,
          titleKey: 'notif.reminderTitle',
          messageKey: 'notif.reminderMsg',
          params: { time: saved.departureTime, point: saved.boardingPoint },
          channel: 'email',
          icon: 'fa-bell',
          color: '#ff9800',
          action: '/my-bookings'
        }, departureAt);

        // Finding #13 (partial): "offer"/promotional notifications previously had no
        // real trigger anywhere — the only place that type ever appeared was static seed
        // data. This is a genuine, code-driven trigger (a first-booking welcome offer),
        // not a fabricated marketing campaign engine — see the note in
        // notification.service.ts on why full schedule-change detection isn't
        // implemented here (no schedule-versioning data model exists in this app).
        if (!localStorage.getItem('rb_first_booking_offer_sent')) {
          localStorage.setItem('rb_first_booking_offer_sent', '1');
          this.notifService.push({
            type: 'offer',
            title: 'Welcome aboard! Here\'s 10% off your next trip 🎉',
            message: 'Thanks for your first booking with us. Use code FIRST10 on your next trip — valid for 30 days.',
            // No titleKey/messageKey here (unlike the other pushes in this file) — this
            // is a new notification and adding it to the i18n dictionary is out of scope
            // for this fix; it falls back to the literal English text, same as any
            // legacy notification without an i18n key (see displayTitle/displayMessage).
            channel: 'push',
            icon: 'fa-gift',
            color: '#d84e55',
            action: '/offers'
          });
        }
      }),
      catchError((err: HttpErrorResponse) => {
        // Fail loudly — do NOT silently save to localStorage as a fallback. Req 3 fix:
        // translate via the server's error code when present, otherwise a translated
        // generic message — never the raw err.error?.error/err.message English text.
        return throwError(() => new Error(this.i18n.tErr(err, 'err.bookingFailed')));
      })
    );
  }

  /** Fetch user's bookings from backend; fall back to local cache if API unavailable */
  getMyBookings(): Observable<Booking[]> {
    return this.http.get<{ success: boolean; data: Booking[] }>(`${this.api}/my`).pipe(
      map(res => res.data),
      tap(bookings => { this._localCache = bookings; }),
      catchError(() => {
        // Read-only cache fallback is acceptable — user can still see past bookings
        console.warn('BookingService: API unavailable, showing cached bookings');
        return of(this._localCache);
      })
    );
  }

  /** Get booking by PNR (requires login + ownership — full record) */
  getByPnr(pnr: string): Observable<Booking> {
    return this.http.get<{ success: boolean; data: Booking }>(`${this.api}/pnr/${pnr}`).pipe(
      map(res => res.data),
      catchError((err: HttpErrorResponse) => throwError(() => new Error(this.i18n.tErr(err, 'err.pnrNotFound'))))
    );
  }

  /** Get booking by PNR for the tracking page — no login required, matching how PNR-based
   *  tracking works elsewhere (the PNR is the credential). Returns only the fields a
   *  tracking view needs, never passenger/contact/payment details (see server route). */
  trackByPnr(pnr: string): Observable<BookingTrackingInfo> {
    return this.http.get<{ success: boolean; data: BookingTrackingInfo }>(`${this.api}/pnr/${pnr}/track`).pipe(
      // Backend hosting (e.g. Render's free tier) can take 50s+ to wake from sleep on a
      // cold request — without this, that hang was indistinguishable from the UI just
      // being stuck, with no feedback either way. 20s is generous enough not to false-
      // positive on a slow-but-working request, short enough to not feel broken.
      timeout(20000),
      map(res => res.data),
      // Preserve err.status alongside the translated message — trackByPnr's caller
      // (bus-tracking.component) needs to tell a 400 (invalid PNR format, entered
      // before a real lookup even happens) apart from a 404 (well-formed PNR that
      // genuinely wasn't found) so it can show a toast for the former instead of
      // silently falling into the same "not found" card as the latter.
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) {
          const wrapped: any = new Error(this.i18n.t('err.trackingTimeout'));
          wrapped.status = 0;
          return throwError(() => wrapped);
        }
        const httpErr = err as HttpErrorResponse;
        const wrapped: any = new Error(this.i18n.tErr(httpErr, 'err.pnrNotFound'));
        wrapped.status = httpErr.status;
        return throwError(() => wrapped);
      })
    );
  }

  cancelBooking(id: string): Observable<Booking> {
    return this.http.put<{ success: boolean; data: Booking; message: string }>(
      `${this.api}/${id}/cancel`, {}
    ).pipe(
      map(res => res.data),
      tap(updated => {
        this._localCache = this._localCache.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b);

        this.notifService.push({
          type: 'cancellation',
          title: `Your booking has been cancelled. Refund of ₹${updated.totalAmount} will be processed in 5-7 business days.`,
          message: `Your booking has been cancelled. Refund of ₹${updated.totalAmount} will be processed in 5-7 business days.`,
          titleKey: 'notif.cancelTitle',
          messageKey: 'notif.cancelMsg',
          params: { amount: updated.totalAmount },
          channel: 'email',
          icon: 'fa-times-circle',
          color: '#f44336',
          action: '/my-bookings'
        });
      }),
      catchError((err: HttpErrorResponse) => throwError(() => new Error(this.i18n.tErr(err, 'err.cancelFailed'))))
    );
  }
}
