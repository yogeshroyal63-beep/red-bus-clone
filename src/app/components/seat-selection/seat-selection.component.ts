import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BusService } from '../../services/bus.service';
import { Bus, Seat } from '../../models/bus.model';
import { ReviewsComponent } from '../reviews/reviews.component';
import { I18nService } from '../../services/i18n.service';
import { ReviewService } from '../../services/review.service';

@Component({
  selector: 'app-seat-selection',
  standalone: true,
  imports: [CommonModule, FormsModule, ReviewsComponent],
  template: `
    <div class="seat-page" *ngIf="bus">
      <!-- Trip Summary Header -->
      <div class="trip-header">
        <div class="container">
          <div class="trip-info flex-between">
            <div class="trip-route">
              <span class="city">{{from}}</span>
              <i class="fa fa-long-arrow-alt-right" style="color:#d84e55; margin:0 12px;"></i>
              <span class="city">{{to}}</span>
              <span class="trip-date">· {{date | date:'EEE, dd MMM'}}</span>
            </div>
            <div class="bus-name-header">
              <div class="op-logo-sm">{{bus.name[0]}}</div>
              <div>
                <div class="fw-700">{{bus.name}}</div>
                <div class="fs-12 text-grey">{{bus.type}}</div>
              </div>
            </div>
            <div class="trip-time">
              <span class="dep-time">{{bus.departureTime}}</span>
              <span class="flex-center gap-8" style="color:var(--text-muted); font-size:12px;"><i class="fa fa-clock"></i> {{bus.duration}}</span>
              <span class="arr-time">{{bus.arrivalTime}}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="container seat-layout">
        <!-- Left: Seat Map -->
        <div class="seat-map-section">
          <div class="rb-card">
            <!-- Deck tabs -->
            <div class="deck-tabs" *ngIf="hasSleeper">
              <button class="deck-tab" [class.active]="activeDeck==='lower'" (click)="activeDeck='lower'">{{i18n.t('seat.lowerDeck')}}</button>
              <button class="deck-tab" [class.active]="activeDeck==='upper'" (click)="activeDeck='upper'">{{i18n.t('seat.upperDeck')}}</button>
            </div>
            <div class="seat-legend">
              <div class="leg-item"><div class="seat-sample available"></div> {{i18n.t('seat.available')}}</div>
              <div class="leg-item"><div class="seat-sample selected"></div> {{i18n.t('seat.selected')}}</div>
              <div class="leg-item"><div class="seat-sample booked"></div> {{i18n.t('seat.booked')}}</div>
              <div class="leg-item"><div class="seat-sample ladies"></div> {{i18n.t('seat.ladiesOnly')}}</div>
            </div>
            <!-- Steering wheel -->
            <div class="bus-front">
              <div class="steering"><i class="fa fa-steering-wheel"></i></div>
              <div class="bus-door">🚌 {{i18n.t('seat.driver')}}</div>
            </div>
            <div class="seat-grid">
              <div class="seat-row" *ngFor="let row of seatRows">
                <div *ngFor="let seat of row; let i=index">
                  <div *ngIf="seat" class="seat" [class]="seat.status" (click)="toggleSeat(seat)" [attr.aria-label]="i18n.t('seat.ariaLabel', {number: seat.number, status: seat.status, price: seat.price})" [attr.aria-pressed]="seat.status === 'selected'" role="button">
                    {{seat.number}}
                  </div>
                  <div *ngIf="!seat" class="seat-gap"></div>
                  <div *ngIf="i===1" class="aisle-space"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Middle: Boarding/Dropping -->
        <div class="points-section">
          <div class="rb-card mb-16">
            <div class="card-title-bar">{{i18n.t('seat.boarding')}} <span class="badge-red">{{from}}</span></div>
            <div class="point-list">
              <label class="point-item" *ngFor="let bp of bus.boardingPoints">
                <input type="radio" name="boarding" [(ngModel)]="selectedBoarding" [value]="bp.id" class="point-radio">
                <div class="point-info">
                  <div class="point-name">{{bp.name}}</div>
                  <div class="point-time fs-12 text-grey"><i class="fa fa-clock"></i> {{bp.time}} · {{bp.address}}</div>
                </div>
              </label>
            </div>
          </div>
          <div class="rb-card">
            <div class="card-title-bar">{{i18n.t('seat.dropping')}} <span class="badge-red">{{to}}</span></div>
            <div class="point-list">
              <label class="point-item" *ngFor="let dp of bus.droppingPoints">
                <input type="radio" name="dropping" [(ngModel)]="selectedDropping" [value]="dp.id" class="point-radio">
                <div class="point-info">
                  <div class="point-name">{{dp.name}}</div>
                  <div class="point-time fs-12 text-grey"><i class="fa fa-clock"></i> {{dp.time}} · {{dp.address}}</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Right: Booking Summary -->
        <div class="booking-summary-panel">
          <div class="rb-card">
            <div class="card-title-bar">{{i18n.t('seat.bookingSummary')}}</div>
            <div class="summary-body">
              <div *ngIf="selectedSeats.length===0" class="no-seats">
                <i class="fa fa-couch fa-2x" style="color:#ddd;"></i>
                <p>{{i18n.t('seat.pleaseSelect')}}</p>
              </div>

              <div *ngIf="selectedSeats.length>0">
                <div class="selected-seats-list">
                  <div class="sel-seat-row flex-between" *ngFor="let seat of selectedSeats">
                    <div class="flex-center gap-8">
                      <div class="seat-num-badge">{{seat.number}}</div>
                      <span class="fs-13">{{i18n.t('confirm.seat')}} {{seat.number}}</span>
                    </div>
                    <div class="flex-center gap-8">
                      <span class="fw-600 text-red">₹{{seat.price}}</span>
                      <button class="remove-seat" (click)="toggleSeat(seat)"><i class="fa fa-times"></i></button>
                    </div>
                  </div>
                </div>
                <div class="price-breakdown">
                  <div class="price-row flex-between">
                    <span class="fs-13 text-grey">{{i18n.t('seat.subtotal', {n: selectedSeats.length})}}</span>
                    <span class="fs-13">₹{{subtotal}}</span>
                  </div>
                  <div class="price-row flex-between">
                    <span class="fs-13 text-grey">{{i18n.t('seat.gstTaxes')}}</span>
                    <span class="fs-13">₹{{taxes}}</span>
                  </div>
                  <div class="price-row flex-between">
                    <span class="fs-13 text-grey">{{i18n.t('seat.serviceFee')}}</span>
                    <span class="fs-13 text-green">{{i18n.t('confirm.free')}}</span>
                  </div>
                  <div class="price-total flex-between">
                    <span class="fw-700">{{i18n.t('seat.totalAmount')}}</span>
                    <span class="fw-700 text-red fs-18">₹{{total}}</span>
                  </div>
                </div>
                <div class="cancellation-info" *ngIf="bus.cancellationPolicy.includes('Free')">
                  <i class="fa fa-check-circle text-green"></i>
                  <span class="fs-12">{{bus.cancellationPolicy}}</span>
                </div>
              </div>
            </div>
            <div class="summary-footer">
              <button class="rb-btn-primary" style="width:100%; padding:12px; font-size:15px; font-weight:700;" [disabled]="selectedSeats.length===0 || !selectedBoarding || !selectedDropping" (click)="proceedToBook()">
                {{i18n.t('seat.proceed')}}
                <span *ngIf="selectedSeats.length>0"> (₹{{total}})</span>
              </button>
              <div class="fs-11 text-grey" style="text-align:center; margin-top:8px;">
                <i class="fa fa-lock"></i> {{i18n.t('seat.securePayment')}}
              </div>
            </div>
          </div>

          <!-- Offers -->
          <div class="rb-card" style="margin-top:16px;">
            <div class="card-title-bar">{{i18n.t('seat.availableOffers')}}</div>
            <div class="offer-mini" *ngFor="let offer of bus.offers">
              <i class="fa fa-tag" style="color:#f47c20;"></i>
              <span class="fs-13">{{offer}}</span>
            </div>
            <div class="offer-mini" *ngIf="!bus.offers?.length">
              <span class="fs-13 text-grey">{{i18n.t('seat.noOffers')}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reviews Section -->
    <div class="container" style="padding-bottom:48px;" *ngIf="bus">
      <div class="reviews-container rb-card" style="margin-top:20px;">
        <div class="reviews-header-bar flex-between" style="padding:16px 20px; border-bottom:1px solid var(--border);">
          <div class="fw-700 fs-15" style="color:var(--text-primary);"><i class="fa fa-star" style="color:#f4c430;"></i> {{i18n.t('seat.ratingsFor', {name: bus.name})}}</div>
          <div class="rating-summary flex-center gap-8">
            <span class="big-rating" style="font-size:22px; font-weight:800; color:var(--text-primary);">{{busAvg | number:'1.1-1'}}</span>
            <i class="fa fa-star" style="color:#f4c430; font-size:16px;"></i>
            <span class="fs-12 text-grey">{{i18n.t('results.ratingsCount', {n: busReviewCount})}}</span>
          </div>
        </div>
        <div style="padding:0 20px;">
          <app-reviews [busId]="bus.id"></app-reviews>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div class="loading-full" *ngIf="!bus">
      <div class="spinner"></div>
      <p>{{i18n.t('seat.loading')}}</p>
    </div>
  `,
  styles: [`
    .seat-page { min-height:100vh; background:var(--bg-secondary); }
    .trip-header { background:var(--bg-card); border-bottom:2px solid var(--red); padding:16px 0; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
    .trip-info { gap:24px; }
    .city { font-size:20px; font-weight:800; color:var(--text-primary); }
    .trip-date { font-size:14px; color:var(--text-muted); margin-left:8px; }
    .op-logo-sm { width:36px; height:36px; background:#d84e55; border-radius:6px; display:flex; align-items:center; justify-content:center; color:white; font-size:16px; font-weight:800; flex-shrink:0; margin-right:10px; }
    .bus-name-header { display:flex; align-items:center; }
    .trip-time { display:flex; align-items:center; gap:16px; font-size:18px; font-weight:700; }
    .seat-layout { display:grid; grid-template-columns:1fr 220px 260px; gap:20px; padding-top:24px; padding-bottom:48px; }
    .deck-tabs { display:flex; border-bottom:1px solid var(--border); }
    .deck-tab { flex:1; padding:12px; text-align:center; background:none; border:none; font-size:13px; font-weight:600; color:var(--text-secondary); cursor:pointer; border-bottom:3px solid transparent;
      &.active { color:#d84e55; border-bottom-color:#d84e55; }
    }
    .seat-legend { display:flex; gap:16px; padding:12px 20px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
    .leg-item { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-secondary); }
    .seat-sample { width:24px; height:24px; border-radius:4px 4px 0 0; border:1.5px solid;
      &.available { border-color:#28a745; background:var(--bg-card); }
      &.selected { border-color:#28a745; background:#28a745; }
      &.booked { border-color:#bbb; background:#eee; }
      &.ladies { border-color:#e91e63; background:#fce4ec; }
    }
    .bus-front { display:flex; align-items:center; gap:16px; padding:12px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border); }
    .steering { width:40px; height:40px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:20px; }
    .bus-door { font-size:13px; color:var(--text-muted); }
    .seat-grid { padding:20px; display:flex; flex-direction:column; gap:8px; }
    .seat-row { display:flex; gap:6px; align-items:center; }
    .seat-gap { width:28px; height:28px; }
    .aisle-space { width:20px; }
    .mb-16 { margin-bottom:16px; }
    .card-title-bar { padding:14px 16px; font-size:13px; font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
    .badge-red { background:#d84e55; color:white; font-size:10px; padding:2px 8px; border-radius:20px; font-weight:600; }
    .point-list { padding:8px 0; }
    .point-item { display:flex; align-items:flex-start; gap:10px; padding:10px 16px; cursor:pointer; transition:background 0.15s;
      &:hover { background:var(--bg-hover); }
    }
    .point-radio { margin-top:3px; accent-color:#d84e55; flex-shrink:0; }
    .point-name { font-size:13px; font-weight:600; color:var(--text-primary); }
    .point-time { margin-top:2px; display:flex; align-items:center; gap:4px; }
    .summary-body { padding:16px; min-height:120px; }
    .no-seats { text-align:center; padding:24px; color:#bbb;
      p { margin-top:8px; font-size:13px; }
    }
    .selected-seats-list { margin-bottom:16px; }
    .sel-seat-row { padding:8px 0; border-bottom:1px solid var(--border); }
    .seat-num-badge { width:28px; height:28px; background:#e8f5e9; border:1.5px solid #28a745; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#28a745; }
    .remove-seat { background:none; border:none; color:#bbb; cursor:pointer; font-size:13px; &:hover { color:#d84e55; } }
    .price-breakdown { border-top:1px solid var(--border); padding-top:12px; }
    .price-row { padding:5px 0; }
    .price-total { padding:12px 0 0; border-top:2px solid var(--border); margin-top:8px; }
    .cancellation-info { background:#e8f5e9; border-radius:6px; padding:8px 12px; display:flex; align-items:center; gap:6px; margin-top:12px; }
    .summary-footer { padding:16px; border-top:1px solid var(--border);
      button:disabled { background:#bbb; cursor:not-allowed; }
    }
    .offer-mini { padding:10px 16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid #f5f5f5;
      &:last-child { border-bottom:none; }
    }
    .loading-full { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; gap:16px; color:var(--text-muted); }
    .reviews-toggle-bar { padding:16px 20px; transition:background 0.2s; &:hover { background:var(--bg-hover); } }
    .avg-mini { font-size:20px; font-weight:800; color:#d84e55; display:flex; align-items:center; gap:4px; }
    .spinner { width:40px; height:40px; border:3px solid #f0f0f0; border-top-color:#d84e55; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  
    @media (max-width: 900px) {
      .seat-layout { grid-template-columns: 1fr 200px !important; }
      .booking-summary-panel { display: none; }
    }
    @media (max-width: 768px) {
      .seat-layout { grid-template-columns: 1fr !important; }
      .points-section, .booking-summary-panel { display: block; }
      .trip-info { flex-wrap: wrap; gap: 12px !important; }
      .trip-route { font-size: 14px; }
      .city { font-size: 16px !important; }
      .seat-grid { padding: 12px !important; overflow-x: auto; }
      .seat { width: 26px; height: 26px; font-size: 8px; }
    }
    @media (max-width: 480px) {
      .seat { width: 22px; height: 22px; font-size: 7px; }
      .summary-footer button { font-size: 13px !important; }
    }
  `]
})
export class SeatSelectionComponent implements OnInit {
  bus: Bus | null = null; from=''; to=''; date='';
  selectedSeats: Seat[] = [];
  selectedBoarding = '';
  selectedDropping = '';
  activeDeck: 'lower' | 'upper' = 'lower';
  seatRows: (Seat|null)[][] = [];
  get busAvg() { return this.reviewService ? this.reviewService.getAvgRating(this.bus?.id || '') : 0; }
  get busReviewCount() { return this.reviewService ? this.reviewService.getForBus(this.bus?.id||'').length : 0; }
  get hasSleeper() { return this.bus?.seats.some(s => s.type==='sleeper'); }
  get subtotal() { return this.selectedSeats.reduce((s,seat) => s+seat.price, 0); }
  get taxes() { return Math.round(this.subtotal * 0.05); }
  get total() { return this.subtotal + this.taxes; }

  private readonly destroyRef = inject(DestroyRef);
  private sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  constructor(private route: ActivatedRoute, private busService: BusService, private router: Router, private http: HttpClient, private toast: ToastService, public i18n: I18nService, private reviewService: ReviewService) {}

  ngOnInit() {
    // Previously params and queryParams were subscribed separately, so getBusById(id)
    // could fire before this.date was set from queryParams — even if it hadn't, date
    // was never passed to getBusById at all, which is what actually made seat
    // "booked" status the same for every date (see the fix note in buses.js). Combining
    // both here just guarantees date is known before the bus is fetched; from/to/date
    // are still assigned exactly as before for the rest of the component to read.
    combineLatest([this.route.params, this.route.queryParams])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([p, qp]) => {
        this.from = qp['from'] || '';
        this.to = qp['to'] || '';
        this.date = qp['date'] || '';
        this.busService.getBusById(p['id'], this.date || undefined).subscribe(bus => {
          if (bus) { this.bus = JSON.parse(JSON.stringify(bus)); this.buildSeatGrid(); this.reviewService.loadForBus(bus.id); }
        });
      });
  }

  buildSeatGrid() {
    if (!this.bus) return;
    const seats = this.bus.seats.filter(s => s.deck === this.activeDeck);
    this.seatRows = [];
    for (let i = 0; i < seats.length; i += 4) {
      const row: (Seat|null)[] = [seats[i]||null, seats[i+1]||null, null, seats[i+2]||null, seats[i+3]||null];
      this.seatRows.push(row);
    }
  }

  toggleSeat(seat: Seat) {
    if (seat.status === 'booked') return;
    if (seat.status === 'selected') {
      seat.status = 'available';
      this.selectedSeats = this.selectedSeats.filter(s => s.id !== seat.id);
      // Release server-side lock
      this.releaseSeatLock([seat.number]);
    } else if (this.selectedSeats.length < 6) {
      // Acquire server-side seat lock before selecting
      this.acquireSeatLock(seat);
    } else {
      this.toast.warning(this.i18n.t('seat.maxSeats'));
    }
  }

  private acquireSeatLock(seat: Seat) {
    this.http.post<any>(`${environment.apiUrl}/seats/lock`, {
      busId: this.bus!.id,
      seats: [seat.number],
      sessionId: this.sessionId,
      date: this.date
    }).subscribe({
      next: () => {
        seat.status = 'selected';
        this.selectedSeats.push(seat);
      },
      error: (err) => {
        this.toast.error(err.message || this.i18n.t('seat.seatTaken'));
      }
    });
  }

  private releaseSeatLock(seatNumbers: string[]) {
    this.http.delete<any>(`${environment.apiUrl}/seats/lock`, {
      body: { busId: this.bus!.id, seats: seatNumbers, sessionId: this.sessionId, date: this.date }
    }).subscribe({ error: () => {} }); // silent on release failure
  }

  proceedToBook() {
    if (!this.selectedBoarding || !this.selectedDropping) { this.toast.error(this.i18n.t('seat.selectBoardingDropping')); return; }
    if (!this.selectedSeats.length) { this.toast.error(this.i18n.t('seat.noSeatsSelected')); return; }

    // Per-seat acquireSeatLock() on each click already holds every selected seat
    // individually (giving instant conflict feedback as the user picks), but each of
    // those calls returns its own separate lockToken — booking-confirm needs exactly
    // one token that covers the whole set (see verifyAndConsumeLocks in seats.js,
    // and the existing lockThenBookingPayload test helper, which locks all seats in
    // one call for this reason). Re-locking the full set here — the user already
    // holds these seats, so this just re-affirms the same hold — produces that one
    // consolidated token without changing the per-click UX at all.
    const seatNumbers = this.selectedSeats.map(s => s.number);
    this.http.post<any>(`${environment.apiUrl}/seats/lock`, {
      busId: this.bus!.id, seats: seatNumbers, sessionId: this.sessionId, date: this.date
    }).subscribe({
      next: (res) => {
        const bookingData = {
          busId: this.bus!.id, busName: this.bus!.name, from: this.from, to: this.to, date: this.date,
          departureTime: this.bus!.departureTime, arrivalTime: this.bus!.arrivalTime,
          seats: seatNumbers, totalAmount: this.total,
          boardingPoint: this.selectedBoarding, droppingPoint: this.selectedDropping, status: 'pending',
          sessionId: this.sessionId, lockToken: res.lockToken
        };
        localStorage.setItem('rb_pending_booking', JSON.stringify(bookingData));
        this.router.navigate(['/confirm']);
      },
      error: () => {
        this.toast.error(this.i18n.t('seat.seatTaken'));
      }
    });
  }
}

// Note: ReviewsComponent is used inline on this page via selector
