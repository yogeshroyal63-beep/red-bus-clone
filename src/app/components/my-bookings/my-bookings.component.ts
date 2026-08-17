import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookingService } from '../../services/booking.service';
import { NotificationService } from '../../services/notification.service';
import { I18nService } from '../../services/i18n.service';
import { Booking } from '../../models/bus.model';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mybookings-page">
      <div class="page-hero">
        <div class="container">
          <h1><i class="fa fa-ticket-alt"></i> {{i18n.t('nav.bookings')}}</h1>
          <p>{{i18n.t('mybookings.sub')}}</p>
        </div>
      </div>

      <div class="container" style="padding: 32px 16px 64px;">
        <!-- Tabs -->
        <div class="booking-tabs">
          <button class="btab" [class.active]="activeTab==='upcoming'" (click)="activeTab='upcoming'">
            <i class="fa fa-calendar-alt"></i> {{i18n.t('mybookings.upcoming')}} ({{upcoming.length}})
          </button>
          <button class="btab" [class.active]="activeTab==='completed'" (click)="activeTab='completed'">
            <i class="fa fa-check-circle"></i> {{i18n.t('mybookings.completed')}} ({{completed.length}})
          </button>
          <button class="btab" [class.active]="activeTab==='cancelled'" (click)="activeTab='cancelled'">
            <i class="fa fa-times-circle"></i> {{i18n.t('mybookings.cancelled')}} ({{cancelled.length}})
          </button>
        </div>

        <!-- Empty state -->
        <div class="empty-bookings rb-card" *ngIf="filtered.length===0">
          <i class="fa fa-ticket-alt fa-4x" style="color:#eee;"></i>
          <h3>{{i18n.t('mybookings.noBookings', {tab: i18n.t('mybookings.'+activeTab)})}}</h3>
          <p style="color:#888; margin: 8px 0 20px;">{{i18n.t('mybookings.willAppear')}}</p>
          <button class="rb-btn-primary" (click)="goHome()">
            <i class="fa fa-search"></i> {{i18n.t('mybookings.searchBuses')}}
          </button>
        </div>

        <!-- Booking cards -->
        <div class="booking-card rb-card" *ngFor="let b of filtered; trackBy: trackBookingId">
          <div class="bcard-header flex-between">
            <div class="flex-center gap-12">
              <div class="op-avatar">{{b.busName?.[0] || 'B'}}</div>
              <div>
                <div class="fw-700 fs-15">{{b.busName}}</div>
                <div class="fs-12 text-grey">{{i18n.t('mybookings.bookedOn')}} {{b.bookingDate | date:'dd MMM yyyy'}}</div>
              </div>
            </div>
            <div class="pnr-badge">PNR: <strong>{{b.pnr}}</strong></div>
            <div class="status-badge" [class]="b.status">
              <i class="fa" [class.fa-check-circle]="b.status==='confirmed'" [class.fa-times-circle]="b.status==='cancelled'" [class.fa-clock]="b.status==='pending'"></i>
              {{i18n.t('mybookings.status.'+b.status)}}
            </div>
          </div>
          <div class="bcard-body">
            <div class="trip-timeline">
              <div class="tl-point">
                <div class="tl-time fw-700 fs-18">{{b.departureTime}}</div>
                <div class="tl-city fw-600">{{b.from}}</div>
              </div>
              <div class="tl-middle">
                <div class="tl-dot"></div>
                <div class="tl-line-h"></div>
                <i class="fa fa-bus tl-bus"></i>
                <div class="tl-line-h"></div>
                <div class="tl-dot"></div>
              </div>
              <div class="tl-point">
                <div class="tl-time fw-700 fs-18">{{b.arrivalTime}}</div>
                <div class="tl-city fw-600">{{b.to}}</div>
              </div>
              <div class="tl-date">
                <div class="fs-12 text-grey">{{i18n.t('mybookings.journeyDate')}}</div>
                <div class="fw-600">{{b.date | date:'EEE, dd MMM yyyy'}}</div>
              </div>
              <div class="tl-seats">
                <div class="fs-12 text-grey">{{i18n.t('mybookings.seats')}}</div>
                <div class="seat-tags flex-center gap-4">
                  <span class="stag" *ngFor="let s of b.seats">{{s}}</span>
                </div>
              </div>
              <div class="tl-amount">
                <div class="fs-12 text-grey">{{i18n.t('mybookings.amountPaid')}}</div>
                <div class="fw-700 text-red fs-16">₹{{b.totalAmount}}</div>
              </div>
            </div>
          </div>
          <div class="bcard-footer flex-between">
            <div class="flex-center gap-8">
              <button class="action-btn download" (click)="downloadTicket(b)">
                <i class="fa fa-download"></i> {{i18n.t('mybookings.downloadTicket')}}
              </button>
              <button class="action-btn share">
                <i class="fa fa-share-alt"></i> {{i18n.t('mybookings.share')}}
              </button>
              <button class="action-btn track">
                <i class="fa fa-map-marker-alt"></i> {{i18n.t('mybookings.trackBus')}}
              </button>
            </div>
            <button class="action-btn cancel" *ngIf="b.status==='confirmed'" (click)="cancelBooking(b)">
              <i class="fa fa-times"></i> {{i18n.t('mybookings.cancelTicket')}}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mybookings-page { min-height:100vh; background:var(--bg-secondary); }
    .page-hero { background:linear-gradient(135deg, #d84e55, #922b21); padding:40px 0 32px; color:white;
      h1 { font-size:28px; font-weight:800; display:flex; align-items:center; gap:12px; }
      p { color:rgba(255,255,255,0.8); margin-top:6px; }
    }
    .booking-tabs { display:flex; gap:0; margin-bottom:24px; background:white; border-radius:8px; padding:4px; box-shadow:0 1px 4px rgba(0,0,0,0.08); width:fit-content; }
    .btab { padding:10px 20px; border:none; background:none; font-size:14px; font-weight:500; color:#666; cursor:pointer; border-radius:6px; transition:all 0.2s; display:flex; align-items:center; gap:8px;
      &.active { background:#d84e55; color:white; }
      &:hover:not(.active) { background:#f5f5f5; }
    }
    .empty-bookings { padding:64px; text-align:center; h3 { font-size:20px; font-weight:700; margin-top:16px; } }
    .booking-card { margin-bottom:16px; overflow:hidden; }
    .bcard-header { padding:16px 20px; border-bottom:1px solid #f0f0f0; background:#fafafa; }
    .op-avatar { width:42px; height:42px; background:#d84e55; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-size:18px; font-weight:800; flex-shrink:0; }
    .pnr-badge { background:#e3f2fd; color:#1565c0; padding:6px 14px; border-radius:20px; font-size:13px; border:1px solid #bbdefb; }
    .status-badge { padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; display:flex; align-items:center; gap:6px;
      &.confirmed { background:#e8f5e9; color:#2e7d32; border:1px solid #c8e6c9; }
      &.cancelled { background:#ffebee; color:#c62828; border:1px solid #ffcdd2; }
      &.pending { background:#fff8e1; color:#f57c00; border:1px solid #ffe082; }
    }
    .bcard-body { padding:24px 20px; }
    .trip-timeline { display:grid; grid-template-columns:auto 1fr auto auto auto auto; align-items:center; gap:20px; }
    .tl-middle { display:flex; align-items:center; gap:0; }
    .tl-dot { width:10px; height:10px; border-radius:50%; background:#d84e55; flex-shrink:0; }
    .tl-line-h { flex:1; height:2px; background:#e0e0e0; min-width:20px; }
    .tl-bus { color:#d84e55; font-size:20px; margin:0 8px; }
    .tl-time { color:#1a1a1a; }
    .tl-city { color:#444; margin-top:4px; }
    .tl-date, .tl-seats, .tl-amount { text-align:center; }
    .stag { background:#e8f5e9; color:#2e7d32; font-size:12px; font-weight:700; padding:2px 8px; border-radius:4px; }
    .bcard-footer { padding:12px 20px; border-top:1px solid #f0f0f0; background:#fafafa; }
    .action-btn { padding:7px 14px; border:1.5px solid; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s; background:white;
      &.download { border-color:#1976d2; color:#1976d2; &:hover { background:#1976d2; color:white; } }
      &.share { border-color:#4caf50; color:#4caf50; &:hover { background:#4caf50; color:white; } }
      &.track { border-color:#ff9800; color:#ff9800; &:hover { background:#ff9800; color:white; } }
      &.cancel { border-color:#f44336; color:#f44336; &:hover { background:#f44336; color:white; } }
    }
  
    @media (max-width: 768px) {
      .trip-timeline { grid-template-columns: auto 1fr auto !important; gap: 10px !important; }
      .tl-date, .tl-seats, .tl-amount { display: none !important; }
      .bcard-footer { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
      .bcard-header { flex-wrap: wrap; gap: 8px; }
      .booking-tabs { width: 100%; overflow-x: auto; }
      .btab { font-size: 12px; padding: 8px 12px; }
      .action-btn { font-size: 11px; padding: 5px 10px; }
    }
    @media (max-width: 480px) {
      .tl-middle { display: none !important; }
    }
  `]
})
export class MyBookingsComponent implements OnInit {
  i18n = inject(I18nService);
  bookings: Booking[] = [];
  activeTab: 'upcoming' | 'completed' | 'cancelled' = 'upcoming';

  get upcoming() { return this.bookings.filter(b => b.status === 'confirmed'); }
  get completed() { return this.bookings.filter(b => b.status === 'confirmed' && new Date(b.date) < new Date()); }
  get cancelled() { return this.bookings.filter(b => b.status === 'cancelled'); }
  get filtered() {
    if (this.activeTab === 'cancelled') return this.cancelled;
    if (this.activeTab === 'completed') return this.completed;
    return this.upcoming;
  }

  private destroyRef = inject(DestroyRef);
  constructor(private bookingService: BookingService, private router: Router, private notifService: NotificationService) {}

  ngOnInit() {
    this.bookingService.getMyBookings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(b => {
      // Merge with localStorage bookings (created when no backend is connected)
      let lsBookings: any[] = [];
      try { lsBookings = JSON.parse(localStorage.getItem('rb_bookings') || '[]'); } catch {}
      // Deduplicate by pnr
      const seen = new Set(b.map((x: any) => x.pnr));
      const merged = [...b, ...lsBookings.filter((x: any) => x.pnr && !seen.has(x.pnr))];
      this.bookings = merged as any;
      this.detectScheduleChanges(merged as any);
    });
  }

  /** Finding #13: "schedule change" notifications used to have no real trigger anywhere
   *  in the app — the type only ever appeared in static seed data. This compares each
   *  confirmed booking's departure time against the value the user last saw (stored
   *  locally per-PNR) and fires a real notification, with the real old/new times, when
   *  the server's current value has actually changed since the last visit. */
  private detectScheduleChanges(bookings: Booking[]) {
    const KEY = 'rb_seen_departures';
    let seen: Record<string, string> = {};
    try { seen = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}

    for (const b of bookings) {
      if (!b.pnr || b.status !== 'confirmed') continue;
      const previous = seen[b.pnr];
      if (previous && previous !== b.departureTime) {
        this.notifService.push({
          type: 'schedule',
          title: `Your ${b.busName} bus (PNR: ${b.pnr}) departure changed from ${previous} to ${b.departureTime}.`,
          message: `Your ${b.busName} bus (PNR: ${b.pnr}) departure changed from ${previous} to ${b.departureTime}.`,
          titleKey: 'notif.scheduleChangeTitle',
          messageKey: 'notif.scheduleChangeMsg',
          params: { operator: b.busName, pnr: b.pnr, oldTime: previous, newTime: b.departureTime },
          channel: 'sms',
          icon: 'fa-exclamation-triangle',
          color: '#f44336',
          action: '/my-bookings'
        });
      }
      seen[b.pnr] = b.departureTime;
    }
    try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch {}
  }

  cancelBooking(b: Booking) {
    if (confirm(`Cancel booking PNR ${b.pnr}? Refund will be processed in 5-7 days.`)) {
      this.bookingService.cancelBooking(b.id!).subscribe(() => {
        b.status = 'cancelled';
      });
    }
  }

  downloadTicket(b: Booking) { alert(`Downloading ticket for PNR: ${b.pnr}`); }
  goHome() { this.router.navigate(['/']); }
  trackBookingId(index: number, b: any): string { return b.id || b.pnr || index.toString(); }
}
