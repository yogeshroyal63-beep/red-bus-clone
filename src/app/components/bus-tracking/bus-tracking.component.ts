import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { ToastService } from '../../services/toast.service';
import { BookingService } from '../../services/booking.service';
import { Booking } from '../../models/bus.model';

@Component({
  selector: 'app-bus-tracking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tracking-page">
      <div class="tracking-hero">
        <div class="container" style="text-align:center;">
          <h1><i class="fa fa-map-marked-alt"></i> {{i18n.t('tracking.title')}}</h1>
          <p>{{i18n.t('tracking.sub')}}</p>
          <div class="track-input-wrap">
            <input type="text" [(ngModel)]="pnr" [placeholder]="i18n.t('tracking.pnrPlaceholder')" class="track-input" (keyup.enter)="trackBus()">
            <button class="rb-btn-primary" style="padding:14px 32px; font-size:15px;" [disabled]="loading" (click)="trackBus()">
              <i class="fa" [class.fa-search]="!loading" [class.fa-spinner]="loading" [class.fa-spin]="loading"></i> {{i18n.t('tracking.trackBtn')}}
            </button>
          </div>
        </div>
      </div>

      <div class="container" style="padding:32px 16px 0;" *ngIf="notFound">
        <div class="rb-card" style="padding:32px; text-align:center;">
          <i class="fa fa-exclamation-circle fa-2x" style="color:#d84e55;"></i>
          <p style="margin-top:12px; font-weight:600;">{{i18n.t('tracking.pnrNotFound')}}</p>
        </div>
      </div>

      <div class="container" style="padding:32px 16px 64px;" *ngIf="tracked && booking">
        <div class="track-layout">
          <!-- Live Map Placeholder -->
          <div class="map-panel rb-card">
            <div class="map-header flex-between">
              <div class="fw-700"><i class="fa fa-map-marked-alt text-red"></i> {{i18n.t('tracking.liveLocation')}}</div>
              <div class="live-badge"><span class="live-dot"></span> {{i18n.t('tracking.live')}}</div>
            </div>
            <div class="map-placeholder">
              <div class="map-bg">
                <div class="map-road map-road-h"></div>
                <div class="map-road map-road-v"></div>
                <div class="map-road map-road-d"></div>
                <div class="bus-marker" [style.left]="busX+'%'" [style.top]="busY+'%'" *ngIf="stage==='in_transit'">
                  <div class="bus-icon-map"><i class="fa fa-bus"></i></div>
                  <div class="bus-pulse"></div>
                </div>
                <div class="city-dot" style="left:15%;top:75%;"><span class="city-label">{{booking.from}}</span></div>
                <div class="city-dot" style="left:80%;top:20%;"><span class="city-label">{{booking.to}}</span></div>
              </div>
            </div>
            <!-- No live GPS feed exists for this booking — the map above shows the
                 booked route's endpoints only. Everything below is derived from the
                 real booking record (departure/arrival time vs. now), not invented. -->
            <div class="map-footer flex-between">
              <div>
                <div class="fs-12 text-grey">{{i18n.t('tracking.status')}}</div>
                <div class="fw-600 fs-14" [class.text-green]="stage==='in_transit'">{{stageLabel}}</div>
              </div>
              <div>
                <div class="fs-12 text-grey">{{i18n.t('tracking.etaDestination')}}</div>
                <div class="fw-600 fs-14 text-green">{{booking.arrivalTime}}</div>
              </div>
              <div>
                <div class="fs-12 text-grey">{{i18n.t('tracking.pnr')}}</div>
                <div class="fw-600 fs-14">{{booking.pnr}}</div>
              </div>
            </div>
          </div>

          <!-- Journey Progress -->
          <div class="journey-panel">
            <div class="rb-card" style="margin-bottom:16px;">
              <div class="card-title-bar fw-700"><i class="fa fa-route"></i> {{i18n.t('tracking.journeyProgress')}}</div>
              <div class="journey-body">
                <div class="journey-progress-bar">
                  <div class="jpb-fill" [style.width]="progress+'%'"></div>
                  <div class="jpb-bus" [style.left]="progress+'%'"><i class="fa fa-bus"></i></div>
                </div>
                <div class="jp-cities flex-between" style="margin-top:8px;">
                  <div class="jp-city">
                    <div class="jp-dot" [class.done]="stage!=='upcoming'"></div>
                    <div class="fw-600 fs-13">{{booking.from}}</div>
                    <div class="fs-11 text-grey">{{i18n.t('tracking.departed')}} {{booking.departureTime}}</div>
                  </div>
                  <div class="jp-city" style="text-align:center;">
                    <div class="jp-dot" [class.current]="stage==='in_transit'" style="margin:0 auto;"></div>
                    <div class="fw-600 fs-13">{{i18n.t('tracking.inTransit')}}</div>
                    <div class="fs-11 text-grey">{{stageLabel}}</div>
                  </div>
                  <div class="jp-city" style="text-align:right;">
                    <div class="jp-dot" [class.done]="stage==='completed'" style="margin-left:auto;"></div>
                    <div class="fw-600 fs-13">{{booking.to}}</div>
                    <div class="fs-11 text-grey">{{i18n.t('tracking.eta')}} {{booking.arrivalTime}}</div>
                  </div>
                </div>

                <!-- Stops timeline — only the two real stops this app actually knows
                     (boarding/dropping points on the booking). Intermediate waypoints
                     were previously invented city names with no backing data; this app
                     has no live GPS feed, so we don't fabricate a position between them. -->
                <div class="stops-timeline" style="margin-top:24px;">
                  <div class="stop-item" [class.done]="stage!=='upcoming'" [class.current]="stage==='in_transit'">
                    <div class="stop-dot"></div>
                    <div class="stop-info">
                      <div class="stop-name fw-600">{{booking.boardingPoint}}</div>
                      <div class="stop-time fs-12 text-grey"><i class="fa fa-clock"></i> {{i18n.t('tracking.eta')}} {{booking.departureTime}}</div>
                    </div>
                    <div class="stop-status" *ngIf="stage!=='upcoming'"><i class="fa fa-check-circle text-green"></i></div>
                  </div>
                  <div class="stop-item" [class.done]="stage==='completed'">
                    <div class="stop-dot"></div>
                    <div class="stop-info">
                      <div class="stop-name fw-600">{{booking.droppingPoint}}</div>
                      <div class="stop-time fs-12 text-grey"><i class="fa fa-clock"></i> {{i18n.t('tracking.eta')}} {{booking.arrivalTime}}</div>
                    </div>
                    <div class="stop-status" *ngIf="stage==='completed'"><i class="fa fa-check-circle text-green"></i></div>
                    <div class="stop-status live-anim" *ngIf="stage==='in_transit'"><i class="fa fa-circle text-red"></i></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rb-card">
              <div class="card-title-bar fw-700"><i class="fa fa-bus"></i> {{i18n.t('tracking.busDetails')}}</div>
              <div style="padding:16px;">
                <!-- Only fields the booking record actually has. Driver name/mobile and
                     bus registration number used to be fabricated here — this app never
                     collects that data, so we don't display it as if it were real. -->
                <div class="detail-row flex-between">
                  <span class="fs-13 text-grey">{{i18n.t('tracking.operator')}}</span>
                  <span class="fs-13 fw-600">{{booking.busName}}</span>
                </div>
                <div class="detail-row flex-between">
                  <span class="fs-13 text-grey">{{i18n.t('tracking.route')}}</span>
                  <span class="fs-13 fw-600">{{booking.from}} → {{booking.to}}</span>
                </div>
                <div class="detail-row flex-between">
                  <span class="fs-13 text-grey">{{i18n.t('tracking.boardingPoint')}}</span>
                  <span class="fs-13 fw-600">{{booking.boardingPoint}}</span>
                </div>
                <div class="detail-row flex-between">
                  <span class="fs-13 text-grey">{{i18n.t('tracking.droppingPoint')}}</span>
                  <span class="fs-13 fw-600">{{booking.droppingPoint}}</span>
                </div>
                <div class="detail-row flex-between">
                  <span class="fs-13 text-grey">{{i18n.t('search.date')}}</span>
                  <span class="fs-13 fw-600">{{booking.date}}</span>
                </div>
                <div class="detail-row flex-between">
                  <span class="fs-13 text-grey">{{i18n.t('tracking.bookingStatus')}}</span>
                  <span class="fs-13 fw-600">{{booking.status | titlecase}}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tracking-page { min-height:100vh; background:var(--bg-secondary); }
    .tracking-hero { background:linear-gradient(135deg,#1a237e,#283593); padding:48px 0 40px; color:white;
      h1 { font-size:28px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:8px; }
      p { color:rgba(255,255,255,0.8); margin-bottom:28px; }
    }
    .track-input-wrap { display:flex; gap:0; max-width:580px; margin:0 auto; }
    .track-input { flex:1; padding:14px 20px; border:none; border-radius:8px 0 0 8px; font-size:14px; outline:none; }
    .rb-btn-primary { border-radius:0 8px 8px 0; }
    .track-layout { display:grid; grid-template-columns:1fr 340px; gap:20px; }
    .map-panel { overflow:hidden; }
    .map-header { padding:14px 16px; border-bottom:1px solid #eee; }
    .live-badge { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#d84e55; }
    .live-dot { width:8px; height:8px; border-radius:50%; background:#d84e55; animation:blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .map-placeholder { height:300px; position:relative; overflow:hidden; }
    .map-bg { width:100%; height:100%; background:#e8f5e9; position:relative; }
    .map-road { position:absolute; background:#fff9c4; }
    .map-road-h { width:100%; height:12px; top:50%; transform:translateY(-50%); }
    .map-road-v { width:12px; height:100%; left:40%; }
    .map-road-d { width:200%; height:10px; top:30%; left:-50%; transform:rotate(35deg); background:#fff3e0; }
    .bus-marker { position:absolute; transform:translate(-50%,-50%); z-index:10; transition:all 2s linear; }
    .bus-icon-map { width:32px; height:32px; background:#d84e55; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:14px; position:relative; z-index:2; }
    .bus-pulse { position:absolute; width:48px; height:48px; border-radius:50%; background:rgba(216,78,85,0.3); top:50%; left:50%; transform:translate(-50%,-50%); animation:pulse-ring 2s infinite; }
    @keyframes pulse-ring { 0%{transform:translate(-50%,-50%) scale(0.7);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.4);opacity:0} }
    .city-dot { position:absolute; width:12px; height:12px; border-radius:50%; background:#1565c0; border:2px solid white; }
    .city-label { position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-size:10px; font-weight:700; white-space:nowrap; color:#333; }
    .map-footer { padding:14px 16px; border-top:1px solid #eee; background:#fafafa; }
    .card-title-bar { padding:14px 16px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:8px; font-size:14px; }
    .journey-body { padding:20px; }
    .journey-progress-bar { height:8px; background:#e0e0e0; border-radius:4px; position:relative; margin:16px 0; }
    .jpb-fill { height:100%; background:linear-gradient(90deg,#4caf50,#8bc34a); border-radius:4px; transition:width 0.5s; }
    .jpb-bus { position:absolute; top:50%; transform:translate(-50%,-50%); color:#d84e55; font-size:16px; }
    .jp-city { }
    .jp-dot { width:12px; height:12px; border-radius:50%; background:#e0e0e0; border:2px solid #bbb; margin-bottom:6px;
      &.done { background:#4caf50; border-color:#4caf50; }
      &.current { background:#d84e55; border-color:#d84e55; animation:blink 1s infinite; }
    }
    .stops-timeline { border-left:2px solid #eee; padding-left:20px; margin-left:6px; }
    .stop-item { display:flex; align-items:flex-start; gap:10px; padding:10px 0; position:relative;
      &::before { content:''; position:absolute; left:-26px; top:14px; width:10px; height:10px; border-radius:50%; background:#e0e0e0; border:2px solid white; }
      &.done::before { background:#4caf50; }
      &.current::before { background:#d84e55; animation:blink 1s infinite; }
    }
    .stop-name { color:#333; }
    .stop-status { margin-left:auto; }
    .detail-row { padding:8px 0; border-bottom:1px solid #f5f5f5; &:last-child{border:none;} }
  
    @media (max-width: 768px) {
      .track-layout { grid-template-columns: 1fr !important; }
      .track-input-wrap { flex-direction: column !important; }
      .track-input { border-radius: 8px !important; }
      .rb-btn-primary { border-radius: 8px !important; }
      .map-placeholder { height: 220px !important; }
      .journey-panel { margin-top: 16px; }
    }
  `]
})
export class BusTrackingComponent {
  i18n = inject(I18nService);
  private toast = inject(ToastService);
  private bookingService = inject(BookingService);

  pnr = '';
  loading = false;
  tracked = false;
  notFound = false;
  booking: Booking | null = null;
  busX = 15; busY = 75;

  /** 'upcoming' | 'in_transit' | 'completed' | 'cancelled', derived from the real
   *  booking's date/departureTime/arrivalTime vs. the current time — not invented. */
  stage: 'upcoming' | 'in_transit' | 'completed' | 'cancelled' = 'upcoming';
  progress = 0;

  get stageLabel(): string {
    if (this.stage === 'cancelled') return this.i18n.t('tracking.cancelled');
    if (this.stage === 'upcoming') return this.i18n.t('tracking.notDeparted');
    if (this.stage === 'completed') return this.i18n.t('tracking.arrived');
    return this.i18n.t('tracking.inTransit');
  }

  trackBus() {
    const pnr = this.pnr.trim();
    if (!pnr) { this.toast.error(this.i18n.t('tracking.invalidPnr')); return; }

    this.loading = true;
    this.tracked = false;
    this.notFound = false;

    // Findings #31: this used to skip lookup entirely and animate a hardcoded fake
    // bus (fixed Bangalore→Chennai path via "Krishnagiri", driver "Suresh Kumar",
    // etc.) for ANY non-empty input. It now resolves the real booking via the same
    // PNR endpoint the booking-confirmation page uses, and only shows tracking data
    // once a real booking is found.
    this.bookingService.getByPnr(pnr).subscribe({
      next: (booking) => {
        this.loading = false;
        this.booking = booking;
        this.tracked = true;
        this.computeStage(booking);
        if (this.stage === 'in_transit') {
          this.busX = 15 + (this.progress / 100) * 65;
          this.busY = 75 - (this.progress / 100) * 55;
        }
      },
      error: () => {
        this.loading = false;
        this.notFound = true;
      }
    });
  }

  private computeStage(booking: Booking) {
    if (booking.status === 'cancelled') { this.stage = 'cancelled'; this.progress = 0; return; }

    const departure = this.parseDateTime(booking.date, booking.departureTime);
    const arrival = this.parseDateTime(booking.date, booking.arrivalTime);
    // Overnight journeys: arrival time-of-day earlier than departure means next day.
    if (arrival.getTime() <= departure.getTime()) arrival.setDate(arrival.getDate() + 1);

    const now = Date.now();
    if (now < departure.getTime()) {
      this.stage = 'upcoming'; this.progress = 0;
    } else if (now >= arrival.getTime()) {
      this.stage = 'completed'; this.progress = 100;
    } else {
      this.stage = 'in_transit';
      const total = arrival.getTime() - departure.getTime();
      const elapsed = now - departure.getTime();
      this.progress = Math.min(99, Math.max(1, Math.round((elapsed / total) * 100)));
    }
  }

  private parseDateTime(date: string, time: string): Date {
    const d = new Date(date);
    const [h, m] = (time || '00:00').split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }
}
