import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { ToastService } from '../../services/toast.service';

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
            <input type="text" [(ngModel)]="pnr" [placeholder]="i18n.t('tracking.pnrPlaceholder')" class="track-input">
            <button class="rb-btn-primary" style="padding:14px 32px; font-size:15px;" (click)="trackBus()">
              <i class="fa fa-search"></i> {{i18n.t('tracking.trackBtn')}}
            </button>
          </div>
        </div>
      </div>

      <div class="container" style="padding:32px 16px 64px;" *ngIf="tracked">
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
                <div class="bus-marker" [style.left]="busX+'%'" [style.top]="busY+'%'">
                  <div class="bus-icon-map"><i class="fa fa-bus"></i></div>
                  <div class="bus-pulse"></div>
                </div>
                <div class="city-dot" style="left:15%;top:75%;"><span class="city-label">Bangalore</span></div>
                <div class="city-dot" style="left:80%;top:20%;"><span class="city-label">Chennai</span></div>
              </div>
            </div>
            <div class="map-footer flex-between">
              <div>
                <div class="fs-12 text-grey">{{i18n.t('tracking.currentLocation')}}</div>
                <div class="fw-600 fs-14">Near Krishnagiri, NH48</div>
              </div>
              <div>
                <div class="fs-12 text-grey">{{i18n.t('tracking.etaDestination')}}</div>
                <div class="fw-600 fs-14 text-green">2h 15m</div>
              </div>
              <div>
                <div class="fs-12 text-grey">{{i18n.t('tracking.currentSpeed')}}</div>
                <div class="fw-600 fs-14">72 km/h</div>
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
                    <div class="jp-dot done"></div>
                    <div class="fw-600 fs-13">Bangalore</div>
                    <div class="fs-11 text-grey">{{i18n.t('tracking.departed')}} 21:30</div>
                  </div>
                  <div class="jp-city" style="text-align:center;">
                    <div class="jp-dot current" style="margin:0 auto;"></div>
                    <div class="fw-600 fs-13">Krishnagiri</div>
                    <div class="fs-11 text-grey">{{i18n.t('tracking.inTransit')}}</div>
                  </div>
                  <div class="jp-city" style="text-align:right;">
                    <div class="jp-dot" style="margin-left:auto;"></div>
                    <div class="fw-600 fs-13">Chennai</div>
                    <div class="fs-11 text-grey">{{i18n.t('tracking.eta')}} 06:00</div>
                  </div>
                </div>

                <!-- Stops timeline -->
                <div class="stops-timeline" style="margin-top:24px;">
                  <div class="stop-item" *ngFor="let stop of stops" [class.done]="stop.done" [class.current]="stop.current">
                    <div class="stop-dot"></div>
                    <div class="stop-info">
                      <div class="stop-name fw-600">{{stop.name}}</div>
                      <div class="stop-time fs-12 text-grey">
                        <i class="fa fa-clock"></i>
                        {{stop.done ? (i18n.t('tracking.passedAt') + ' ' + stop.actual) : (i18n.t('tracking.eta') + ' ' + stop.eta)}}
                      </div>
                    </div>
                    <div class="stop-status" *ngIf="stop.done"><i class="fa fa-check-circle text-green"></i></div>
                    <div class="stop-status live-anim" *ngIf="stop.current"><i class="fa fa-circle text-red"></i></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rb-card">
              <div class="card-title-bar fw-700"><i class="fa fa-bus"></i> {{i18n.t('tracking.busDetails')}}</div>
              <div style="padding:16px;">
                <div class="detail-row flex-between" *ngFor="let d of busDetails">
                  <span class="fs-13 text-grey">{{d.label}}</span>
                  <span class="fs-13 fw-600">{{d.value}}</span>
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
  pnr = ''; tracked = false;
  busX = 42; busY = 55; progress = 45;

  stops = [
    { name: 'Majestic Bus Stand, Bangalore', eta: '21:30', actual: '21:28', done: true, current: false },
    { name: 'Hosur Road (Silk Board)', eta: '21:55', actual: '21:52', done: true, current: false },
    { name: 'Hosur Toll Plaza', eta: '22:30', actual: '22:35', done: true, current: false },
    { name: 'Krishnagiri', eta: '00:30', actual: '', done: false, current: true },
    { name: 'Vellore', eta: '02:15', actual: '', done: false, current: false },
    { name: 'Ranipet', eta: '03:30', actual: '', done: false, current: false },
    { name: 'CMBT, Chennai', eta: '06:00', actual: '', done: false, current: false },
  ];

  busDetails = [
    { label: 'Bus Number', value: 'KA 01 AB 1234' },
    { label: 'Operator', value: 'VRL Travels' },
    { label: 'Bus Type', value: 'Multi-Axle Semi Sleeper' },
    { label: 'Driver', value: 'Suresh Kumar' },
    { label: 'Driver Mobile', value: '+91 98765 43210' },
    { label: 'Journey Date', value: new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) },
  ];

  trackBus() {
    if (!this.pnr.trim()) { this.toast.error(this.i18n.t('tracking.invalidPnr')); return; }
    this.tracked = true;
    // Animate bus movement
    let x = 15; let y = 75;
    const interval = setInterval(() => {
      x += 0.8; y -= 0.7;
      this.busX = Math.min(x, 80);
      this.busY = Math.max(y, 20);
      if (x >= 80) clearInterval(interval);
    }, 100);
  }
}
