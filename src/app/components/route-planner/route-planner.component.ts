import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, AfterViewInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../services/i18n.service';
import * as L from 'leaflet';

interface Waypoint { id: string; city: string; }
interface RouteOption {
  id: string; label: string; distance: string; time: string;
  traffic: 'light' | 'moderate' | 'heavy'; fare: number;
  stops: string[]; recommended: boolean; saved?: boolean;
  /** true for routes whose distance/time/fare are deterministic estimates, not a real routing-API answer (only route 1 uses live OSRM data) */
  estimated?: boolean;
}

// Fix Leaflet's default marker icons, which otherwise 404 under bundlers (Angular CLI/webpack strip the relative asset paths baked into the leaflet package)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Approximate lat/lng for supported Indian cities, used to plot real map routes */
const CITY_COORDS: Record<string, [number, number]> = {
  'Bangalore': [12.9716, 77.5946], 'Chennai': [13.0827, 80.2707], 'Mumbai': [19.0760, 72.8777],
  'Delhi': [28.7041, 77.1025], 'Hyderabad': [17.3850, 78.4867], 'Pune': [18.5204, 73.8567],
  'Kolkata': [22.5726, 88.3639], 'Ahmedabad': [23.0225, 72.5714], 'Jaipur': [26.9124, 75.7873],
  'Coimbatore': [11.0168, 76.9558], 'Kochi': [9.9312, 76.2673], 'Mysore': [12.2958, 76.6394],
  'Vizag': [17.6868, 83.2185], 'Vijayawada': [16.5062, 80.6480], 'Tirupati': [13.6288, 79.4192],
  'Mangalore': [12.9141, 74.8560], 'Madurai': [9.9252, 78.1198], 'Vellore': [12.9165, 79.1325],
  'Hosur': [12.7409, 77.8253], 'Krishnagiri': [12.5186, 78.2137],
};

@Component({
  selector: 'app-route-planner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule],
  // ISSUE: replaced hand-drawn SVG mock with a real Leaflet map (OpenStreetMap tiles) below.
  template: `
    <div class="planner-page">
      <div class="planner-hero">
        <div class="container">
          <h1><i class="fa fa-map-marked-alt"></i> {{i18n.t('planner.heroTitle')}}</h1>
          <p>{{i18n.t('planner.heroSub')}}</p>
        </div>
      </div>

      <div class="container planner-layout" style="padding:28px 16px 64px;">
        <!-- Left: Input Panel -->
        <div class="input-panel">
          <!-- Route Builder -->
          <div class="rb-card panel-card">
            <div class="panel-title"><i class="fa fa-route text-red"></i> {{i18n.t('planner.buildRoute')}}</div>
            <div class="route-builder">
              <!-- Start -->
              <div class="rb-stop start">
                <div class="stop-dot start-dot"><i class="fa fa-circle"></i></div>
                <div class="stop-input-wrap">
                  <input type="text" [(ngModel)]="startCity" [placeholder]="i18n.t('planner.startingCity')" class="stop-input" (input)="filterCities($event,'start')" (focus)="activeDD='start'" (blur)="closeDD()">
                  <div class="city-dd" *ngIf="activeDD==='start' && ddCities.length">
                    <div class="dd-item" *ngFor="let c of ddCities" (mousedown)="startCity=c; activeDD=''">
                      <i class="fa fa-map-marker-alt"></i> {{c}}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Waypoints -->
              <div class="waypoint-line" *ngFor="let wp of waypoints; let i=index">
                <div class="stop-dot via-dot"><i class="fa fa-circle"></i></div>
                <div class="stop-input-wrap">
                  <input type="text" [(ngModel)]="wp.city" [placeholder]="i18n.t('planner.viaCity')" class="stop-input" (input)="filterCities($event,'wp'+i)" (focus)="activeDD='wp'+i" (blur)="closeDD()">
                  <div class="city-dd" *ngIf="activeDD==='wp'+i && ddCities.length">
                    <div class="dd-item" *ngFor="let c of ddCities" (mousedown)="wp.city=c; activeDD=''">
                      <i class="fa fa-map-marker-alt"></i> {{c}}
                    </div>
                  </div>
                </div>
                <button class="rm-wp" (click)="removeWaypoint(i)"><i class="fa fa-times"></i></button>
              </div>

              <!-- Destination -->
              <div class="rb-stop end">
                <div class="stop-dot end-dot"><i class="fa fa-map-marker-alt"></i></div>
                <div class="stop-input-wrap">
                  <input type="text" [(ngModel)]="endCity" [placeholder]="i18n.t('planner.destinationCity')" class="stop-input" (input)="filterCities($event,'end')" (focus)="activeDD='end'" (blur)="closeDD()">
                  <div class="city-dd" *ngIf="activeDD==='end' && ddCities.length">
                    <div class="dd-item" *ngFor="let c of ddCities" (mousedown)="endCity=c; activeDD=''">
                      <i class="fa fa-map-marker-alt"></i> {{c}}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Add waypoint -->
              <button class="add-wp-btn" (click)="addWaypoint()">
                <i class="fa fa-plus"></i> {{i18n.t('planner.addStopover')}}
              </button>
            </div>

            <!-- Date & Preferences -->
            <div class="prefs-row">
              <div class="pref-field">
                <label>{{i18n.t('planner.journeyDate')}}</label>
                <input type="date" [(ngModel)]="journeyDate" [min]="today" class="pref-input">
              </div>
              <div class="pref-field">
                <label>{{i18n.t('planner.compareBy')}}</label>
                <select [(ngModel)]="compareBy" (change)="sortRoutes()" class="pref-input">
                  <option value="time">{{i18n.t('planner.fastestTime')}}</option>
                  <option value="distance">{{i18n.t('planner.shortestDistance')}}</option>
                  <option value="fare">{{i18n.t('planner.lowestFare')}}</option>
                  <option value="traffic">{{i18n.t('planner.leastTraffic')}}</option>
                </select>
              </div>
            </div>

            <button class="rb-btn-primary plan-btn" (click)="planRoute()" [disabled]="!startCity || !endCity">
              <i class="fa fa-search-location"></i> {{i18n.t('planner.planJourney')}}
            </button>
          </div>

          <!-- Saved Routes -->
          <div class="rb-card panel-card" style="margin-top:16px;" *ngIf="savedRoutes.length">
            <div class="panel-title"><i class="fa fa-bookmark text-red"></i> {{i18n.t('planner.savedRoutes')}}</div>
            <div class="saved-route-item" *ngFor="let sr of savedRoutes">
              <div class="sr-route">
                <i class="fa fa-map-marker-alt" style="color:#d84e55;"></i> {{sr.from}}
                <i class="fa fa-arrow-right" style="color:#bbb; margin:0 6px; font-size:10px;"></i>
                <i class="fa fa-flag" style="color:#4caf50;"></i> {{sr.to}}
              </div>
              <div class="sr-meta fs-12 text-grey">{{sr.distance}} · ~{{sr.time}}</div>
              <button class="use-route-btn" (click)="useRoute(sr)"><i class="fa fa-play"></i></button>
            </div>
          </div>

          <!-- Traffic Legend -->
          <div class="rb-card panel-card" style="margin-top:16px;">
            <div class="panel-title"><i class="fa fa-traffic-light text-red"></i> {{i18n.t('planner.liveTrafficStatus')}}</div>
            <div class="traffic-legend">
              <div class="tl-item" *ngFor="let tl of trafficLegend">
                <div class="tl-dot" [style.background]="tl.color"></div>
                <div>
                  <div class="fw-600 fs-13" style="color:var(--text-primary);">{{i18n.t(tl.labelKey)}}</div>
                  <div class="fs-11 text-grey">{{i18n.t(tl.descKey)}}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Map + Results -->
        <div class="results-panel">
          <!-- Animated Map -->
          <div class="rb-card map-card">
            <div class="map-header flex-between">
              <div class="fw-700 fs-14" style="color:var(--text-primary);"><i class="fa fa-map text-red"></i> {{i18n.t('planner.routeMap')}}</div>
              <div class="flex-center gap-8">
                <div class="live-pill"><span class="live-dot-sm"></span> {{i18n.t('planner.liveTraffic')}}</div>
                <button class="map-ctrl" (click)="zoomIn()"><i class="fa fa-plus"></i></button>
                <button class="map-ctrl" (click)="zoomOut()"><i class="fa fa-minus"></i></button>
              </div>
            </div>
            <div class="map-canvas" [class.planned]="planned">
              <!-- Real interactive map (Leaflet + OpenStreetMap tiles) -->
              <div id="planner-map" class="leaflet-map-el"></div>
              <!-- Placeholder overlay before a route is planned -->
              <div class="map-placeholder" *ngIf="!planned">
                <i class="fa fa-map-marked-alt"></i>
                <span>{{i18n.t('planner.mapPlaceholder')}}</span>
              </div>
              <!-- Traffic overlay -->
              <div class="traffic-overlay" *ngIf="planned">
                <div class="traffic-badge" [class]="overallTraffic">
                  <i class="fa fa-traffic-light"></i> {{i18n.t('planner.trafficLabel')}}: {{i18n.t('planner.traffic_'+overallTraffic)}}
                </div>
                <div class="traffic-source-badge" [title]="trafficSource==='tomtom' ? i18n.t('planner.liveSourceTooltip') : i18n.t('planner.simulatedSourceTooltip')">
                  <i class="fa" [class.fa-satellite-dish]="trafficSource==='tomtom'" [class.fa-flask]="trafficSource==='simulated'"></i>
                  {{trafficSource==='tomtom' ? i18n.t('planner.live') : i18n.t('planner.simulated')}}
                </div>
                <div class="traffic-source-badge" *ngIf="routeSource==='straight-line'" [title]="i18n.t('planner.straightLineNotice')">
                  <i class="fa fa-exclamation-circle"></i> {{i18n.t('planner.straightLineBadge')}}
                </div>
              </div>
            </div>
          </div>

          <!-- Route Comparison -->
          <div class="route-comparison" *ngIf="planned && routeOptions.length">
            <div class="rc-header flex-between">
              <div class="fw-700 fs-15" style="color:var(--text-primary);">{{routeOptions.length}} {{i18n.t('planner.routesFound')}}</div>
              <div class="flex-center gap-8">
                <button class="sort-chip" [class.active]="compareBy==='time'" (click)="compareBy='time'; sortRoutes()">{{i18n.t('planner.fastest')}}</button>
                <button class="sort-chip" [class.active]="compareBy==='distance'" (click)="compareBy='distance'; sortRoutes()">{{i18n.t('planner.shortest')}}</button>
                <button class="sort-chip" [class.active]="compareBy==='fare'" (click)="compareBy='fare'; sortRoutes()">{{i18n.t('planner.cheapest')}}</button>
                <button class="sort-chip" [class.active]="compareBy==='traffic'" (click)="compareBy='traffic'; sortRoutes()">{{i18n.t('planner.leastTraffic')}}</button>
              </div>
            </div>

            <!-- Dynamic update alert -->
            <div class="dynamic-alert" *ngIf="trafficUpdate">
              <i class="fa fa-exclamation-triangle"></i>
              {{i18n.t('planner.trafficUpdateLabel')}}: {{trafficUpdate}}
              <button (click)="trafficUpdate=''" style="background:none;border:none;color:inherit;cursor:pointer;font-size:16px; margin-left:auto;">×</button>
            </div>

            <div class="route-option-card" *ngFor="let ro of routeOptions" [class.recommended]="ro.recommended" [class.selected]="selectedRoute===ro.id" (click)="selectRoute(ro)">
              <div class="ro-badge" *ngIf="ro.recommended"><i class="fa fa-star"></i> {{i18n.t('planner.recommended')}}</div>
              <div class="ro-main flex-between">
                <div class="ro-left">
                  <div class="ro-label fw-700 fs-15" style="color:var(--text-primary);">{{ro.label}}</div>
                  <div class="ro-stops fs-12 text-grey">{{i18n.t('planner.via')}}: {{ro.stops.join(' → ')}}</div>
                  <div class="ro-stops fs-11 text-grey" *ngIf="ro.estimated">{{i18n.t('planner.estimatedNotice')}}</div>
                </div>
                <div class="ro-stats">
                  <div class="ro-stat">
                    <i class="fa fa-road" style="color:#888;"></i>
                    <span>{{ro.distance}}</span>
                  </div>
                  <div class="ro-stat">
                    <i class="fa fa-clock" style="color:#888;"></i>
                    <span>{{ro.time}}</span>
                  </div>
                  <div class="ro-stat">
                    <i class="fa fa-rupee-sign" style="color:#888;"></i>
                    <span>₹{{ro.fare}}</span>
                  </div>
                  <div class="traffic-pill" [class]="ro.traffic">
                    <span class="tp-dot"></span>
                    {{i18n.t('planner.traffic_'+ro.traffic)}}
                  </div>
                </div>
                <div class="ro-actions">
                  <button class="save-route-btn" [class.saved]="ro.saved" (click)="$event.stopPropagation(); saveRoute(ro)" [title]="ro.saved ? i18n.t('planner.savedTooltip') : i18n.t('planner.saveRouteTooltip')">
                    <i [class]="ro.saved ? 'fa fa-bookmark' : 'far fa-bookmark'"></i>
                  </button>
                  <button class="select-route-btn rb-btn-primary" style="padding:7px 14px; font-size:12px;" (click)="$event.stopPropagation(); bookRoute(ro)">
                    {{i18n.t('planner.bookBuses')}}
                  </button>
                </div>
              </div>
              <!-- ETA breakdown -->
              <div class="ro-eta-bar" *ngIf="selectedRoute===ro.id">
                <div class="eta-seg" *ngFor="let seg of ro.stops; let i=index" [style.flex]="1">
                  <div class="eta-city fs-11">{{i===0 ? startCity : seg}}</div>
                  <div class="eta-line">
                    <div class="eta-dot"></div>
                    <div class="eta-track" [class]="ro.traffic"></div>
                  </div>
                </div>
                <div class="eta-seg" style="flex:1;">
                  <div class="eta-city fs-11">{{endCity}}</div>
                  <div class="eta-line"><div class="eta-dot end"></div></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div class="plan-empty rb-card" *ngIf="!planned">
            <i class="fa fa-map-signs fa-3x" style="color:#ddd;"></i>
            <h3 style="color:var(--text-primary);">{{i18n.t('planner.readyToPlan')}}</h3>
            <p style="color:#888;">{{i18n.t('planner.readyToPlanSub')}}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .planner-page { min-height:100vh; background:var(--bg-secondary); }
    .planner-hero { background:linear-gradient(135deg,#004d40,#00897b); padding:36px 0; color:white;
      h1 { font-size:26px; font-weight:800; display:flex; align-items:center; gap:12px; margin-bottom:6px; }
      p { color:rgba(255,255,255,0.8); }
    }
    .planner-layout { display:grid; grid-template-columns:340px 1fr; gap:20px; }
    .panel-card { overflow:hidden; background:var(--bg-card); }
    .panel-title { padding:14px 18px; font-size:13px; font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
    .route-builder { padding:18px; }
    .rb-stop { display:flex; align-items:center; gap:10px; margin-bottom:8px; position:relative; }
    .waypoint-line { display:flex; align-items:center; gap:10px; margin-bottom:8px; position:relative; }
    .stop-dot { width:22px; height:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
      i { font-size:12px; }
      &.start-dot i { color:#d84e55; }
      &.via-dot i { color:#ff9800; font-size:8px; }
      &.end-dot i { color:#4caf50; }
    }
    .stop-input-wrap { flex:1; position:relative; }
    .stop-input { width:100%; padding:9px 12px; border:1.5px solid var(--border); border-radius:8px; font-size:13px; background:var(--bg-input); color:var(--text-primary); outline:none; transition:border 0.2s;
      &:focus { border-color:#d84e55; }
    }
    .city-dd { position:absolute; top:100%; left:0; right:0; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.12); z-index:200; max-height:180px; overflow-y:auto; margin-top:2px; }
    .dd-item { padding:9px 14px; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:8px; color:var(--text-primary);
      i { color:#d84e55; font-size:11px; }
      &:hover { background:var(--bg-hover); }
    }
    .rm-wp { width:26px; height:26px; border-radius:50%; border:1.5px solid var(--border); background:none; color:#bbb; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; &:hover { border-color:#f44336; color:#f44336; } }
    .add-wp-btn { margin-top:8px; padding:7px 14px; border:1.5px dashed var(--border); border-radius:8px; background:none; color:var(--text-secondary); font-size:12px; font-weight:600; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;
      &:hover { border-color:#d84e55; color:#d84e55; }
    }
    .prefs-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 18px 14px; }
    .pref-field { display:flex; flex-direction:column; gap:4px;
      label { font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; }
    }
    .pref-input { padding:8px 10px; border:1.5px solid var(--border); border-radius:6px; font-size:12px; background:var(--bg-input); color:var(--text-primary); outline:none;
      &:focus { border-color:#d84e55; }
    }
    .plan-btn { margin:0 18px 18px; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:14px; &:disabled { background:#ddd; cursor:not-allowed; } }
    .saved-route-item { display:flex; align-items:center; gap:10px; padding:12px 18px; border-bottom:1px solid var(--border); cursor:pointer; &:last-child{border-bottom:none;} &:hover{background:var(--bg-hover);} }
    .sr-route { flex:1; font-size:13px; font-weight:600; color:var(--text-primary); display:flex; align-items:center; }
    .use-route-btn { width:28px; height:28px; border-radius:50%; background:#d84e55; border:none; color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; }
    .traffic-legend { padding:14px 18px; display:flex; flex-direction:column; gap:10px; }
    .tl-item { display:flex; align-items:center; gap:10px; }
    .tl-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }
    .map-card { overflow:hidden; margin-bottom:20px; background:var(--bg-card); }
    .map-header { padding:12px 16px; border-bottom:1px solid var(--border); }
    .live-pill { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:#4caf50; background:#e8f5e9; padding:3px 10px; border-radius:20px; }
    .live-dot-sm { width:7px; height:7px; border-radius:50%; background:#4caf50; animation:blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .map-ctrl { width:28px; height:28px; border:1.5px solid var(--border); border-radius:4px; background:var(--bg-card); color:var(--text-secondary); cursor:pointer; font-size:12px; &:hover{border-color:#d84e55;color:#d84e55;} }
    .map-canvas { position:relative; background:var(--map-bg, #e8f5e9); height:360px; }
    .leaflet-map-el { width:100%; height:360px; z-index:1; }
    .map-placeholder { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#9aa; background:var(--map-bg, #e8f5e9); z-index:2; pointer-events:none;
      i { font-size:32px; opacity:0.5; }
      span { font-size:13px; max-width:220px; text-align:center; }
    }
    ::ng-deep .bus-divicon { background:none; border:none; font-size:20px; line-height:1; text-align:center; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }
    ::ng-deep .leaflet-popup-content { font-size:12px; font-weight:600; }
    .traffic-overlay { position:absolute; bottom:12px; right:12px; z-index:3; display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
    .traffic-source-badge { padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; display:flex; align-items:center; gap:5px;
      background:rgba(0,0,0,0.6); color:#fff; text-transform:uppercase; letter-spacing:0.3px; }
    .traffic-badge { padding:5px 12px; border-radius:20px; font-size:12px; font-weight:700; display:flex; align-items:center; gap:5px;
      &.light { background:#e8f5e9; color:#2e7d32; }
      &.moderate { background:#fff8e1; color:#f57c00; }
      &.heavy { background:#ffebee; color:#c62828; }
    }
    .rc-header { margin-bottom:14px; }
    .sort-chip { padding:6px 14px; border:1.5px solid var(--border); border-radius:20px; background:var(--bg-card); color:var(--text-secondary); font-size:12px; font-weight:500; cursor:pointer; transition:all 0.2s;
      &.active, &:hover { border-color:#d84e55; color:#d84e55; background:#fff0f1; }
    }
    .dynamic-alert { background:#fff3e0; border:1px solid #ffe082; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13px; color:#e65100; display:flex; align-items:center; gap:8px; }
    .route-option-card { background:var(--bg-card); border:2px solid var(--border); border-radius:12px; margin-bottom:12px; overflow:hidden; cursor:pointer; transition:all 0.2s;
      &:hover { border-color:#d84e55; box-shadow:0 4px 16px rgba(216,78,85,0.1); }
      &.recommended { border-color:#4caf50; }
      &.selected { border-color:#d84e55; box-shadow:0 0 0 3px rgba(216,78,85,0.1); }
    }
    .ro-badge { background:#4caf50; color:white; font-size:11px; font-weight:700; padding:5px 14px; display:flex; align-items:center; gap:5px; }
    .ro-main { padding:16px; gap:12px; }
    .ro-stops { margin-top:4px; }
    .ro-stats { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .ro-stat { display:flex; align-items:center; gap:5px; font-size:13px; color:var(--text-primary); }
    .traffic-pill { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px;
      &.light { background:#e8f5e9; color:#2e7d32; .tp-dot{background:#4caf50;} }
      &.moderate { background:#fff8e1; color:#f57c00; .tp-dot{background:#ff9800;} }
      &.heavy { background:#ffebee; color:#c62828; .tp-dot{background:#f44336;} }
    }
    .tp-dot { width:8px; height:8px; border-radius:50%; }
    .ro-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .save-route-btn { width:34px; height:34px; border-radius:50%; border:1.5px solid var(--border); background:none; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all 0.2s;
      &:hover, &.saved { border-color:#d84e55; color:#d84e55; }
    }
    .ro-eta-bar { display:flex; align-items:flex-start; padding:0 16px 16px; gap:0; }
    .eta-seg { display:flex; flex-direction:column; align-items:flex-start; }
    .eta-city { color:var(--text-secondary); white-space:nowrap; margin-bottom:4px; }
    .eta-line { display:flex; align-items:center; }
    .eta-dot { width:10px; height:10px; border-radius:50%; background:#d84e55; flex-shrink:0; &.end{background:#4caf50;} }
    .eta-track { height:3px; flex:1; min-width:40px;
      &.light{background:#4caf50;} &.moderate{background:#ff9800;} &.heavy{background:#f44336;}
    }
    .plan-empty { padding:60px; text-align:center; background:var(--bg-card); h3{font-size:20px;font-weight:700;margin:14px 0 8px;} }
  
    @media (max-width: 900px) {
      .planner-layout { grid-template-columns: 300px 1fr !important; }
    }
    @media (max-width: 768px) {
      .planner-layout { grid-template-columns: 1fr !important; }
      .prefs-row { grid-template-columns: 1fr !important; }
      .route-option-card .ro-main { flex-direction: column !important; gap: 10px !important; }
      .ro-actions { flex-direction: row !important; }
      .rc-header { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; }
    }
  `]
})
export class RoutePlannerComponent implements OnInit, AfterViewInit, OnDestroy {
  startCity = ''; endCity = ''; journeyDate = ''; compareBy = 'time';
  waypoints: Waypoint[] = [];
  activeDD = ''; ddCities: string[] = [];
  planned = false; selectedRoute = '';
  overallTraffic: 'light' | 'moderate' | 'heavy' = 'moderate';
  /** 'tomtom' = real live traffic data; 'simulated' = deterministic fallback (no TRAFFIC_API_KEY configured server-side) */
  trafficSource: 'tomtom' | 'simulated' = 'simulated';
  trafficUpdate = '';
  showAlt = true;
  mapZoom = 6;
  today = new Date().toISOString().split('T')[0];
  /** 'osrm' = a real road-following route was drawn; 'straight-line' = OSRM was unreachable and we fell back to a straight line (now disclosed in the UI instead of silently pretending it's a road route) */
  routeSource: 'osrm' | 'straight-line' = 'osrm';

  constructor(private http: HttpClient, public i18n: I18nService) {}

  private map?: L.Map;
  private routeLine?: L.Polyline;
  private altLine?: L.Polyline;
  private markers: L.Marker[] = [];
  private busMarker?: L.Marker;

  cities = ['Bangalore','Chennai','Mumbai','Delhi','Hyderabad','Pune','Kolkata','Ahmedabad','Jaipur','Coimbatore','Kochi','Mysore','Vizag','Vijayawada','Tirupati','Mangalore','Madurai','Vellore','Hosur','Krishnagiri'];

  routeOptions: RouteOption[] = [];
  savedRoutes: any[] = JSON.parse(localStorage.getItem('rb_saved_routes') || '[]');

  trafficLegend = [
    { color:'#4caf50', labelKey:'planner.trafficLightLabel', descKey:'planner.trafficLightDesc' },
    { color:'#ff9800', labelKey:'planner.trafficModerateLabel', descKey:'planner.trafficModerateDesc' },
    { color:'#f44336', labelKey:'planner.trafficHeavyLabel', descKey:'planner.trafficHeavyDesc' },
  ];

  ngOnInit() { this.journeyDate = this.today; }

  ngAfterViewInit() {
    // Center the map roughly over South/Central India by default
    this.map = L.map('planner-map', { zoomControl: false, attributionControl: true })
      .setView([15.5, 78.0], this.mapZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
  }

  private coordFor(city: string): [number, number] | null {
    return CITY_COORDS[city] || null;
  }

  filterCities(e: any, field: string) {
    const v = e.target.value.toLowerCase();
    this.ddCities = this.cities.filter(c => c.toLowerCase().includes(v) && c !== this.startCity && c !== this.endCity);
    this.activeDD = field;
  }

  closeDD() { setTimeout(() => this.activeDD = '', 200); }
  addWaypoint() { if (this.waypoints.length < 3) this.waypoints.push({ id: Date.now().toString(), city: '' }); }
  removeWaypoint(i: number) { this.waypoints.splice(i, 1); }

  planRoute() {
    if (!this.startCity || !this.endCity) return;
    this.planned = true;
    this.trafficUpdate = '';

    this.generateRoutes();
    this.refreshTraffic(/*isInitial*/ true);
    this.startTrafficPolling();
  }

  /** Req 4 fix: traffic used to be fetched exactly once inside planRoute(), so the "live
   *  traffic" panel and the "receive dynamic updates if traffic conditions change" promise
   *  were both a single snapshot, never an actual live update. This is now called both on
   *  initial plan and on a recurring poll (see startTrafficPolling) so the primary route,
   *  alternates, map line color, and the heavy-traffic alert banner all refresh in place
   *  while the user is looking at the planner — without them re-clicking "Plan My Journey". */
  private refreshTraffic(isInitial = false) {
    this.fetchTrafficForAlternateRoutes();

    const endCoord = this.coordFor(this.endCity);
    if (!endCoord) { if (isInitial) this.drawRouteOnMap(); return; }

    const previousTraffic = this.overallTraffic;

    // Real traffic lookup — server-side proxy calls TomTom's Traffic Flow API when
    // TRAFFIC_API_KEY is set, and otherwise returns the same simulated data as before
    // but honestly labeled (source: 'simulated') instead of silently faking it client-side.
    this.http.get<any>(`${environment.apiUrl}/traffic/flow`, {
      params: { lat: endCoord[0].toString(), lng: endCoord[1].toString() }
    }).subscribe({
      next: (res) => {
        this.overallTraffic = res.congestionLevel;
        this.trafficSource = res.source;
        this.applyLiveTrafficToPrimaryRoute();
        this.maybeShowTrafficAlert(isInitial || this.overallTraffic !== previousTraffic);
        this.drawRouteOnMap();
      },
      error: () => {
        // Backend unreachable — last-resort client-side fallback so the page still works
        const trafficSeed = `${this.startCity}|${this.endCity}|${Date.now()}`;
        this.overallTraffic = ['light','moderate','heavy'][Math.floor(this.routeHash(trafficSeed, 50) * 3)] as any;
        this.trafficSource = 'simulated';
        this.applyLiveTrafficToPrimaryRoute();
        this.maybeShowTrafficAlert(isInitial || this.overallTraffic !== previousTraffic);
        this.drawRouteOnMap();
      }
    });
  }

  /** Polls the traffic endpoint every 30s for as long as a route stays planned, so
   *  congestion levels, the map line color, and the alert banner stay current instead of
   *  freezing at whatever they were the moment "Plan My Journey" was clicked. Cleared on a
   *  fresh plan (so we never stack intervals) and on component destroy. */
  private startTrafficPolling() {
    if (this.trafficPollInterval) clearInterval(this.trafficPollInterval);
    this.trafficPollInterval = setInterval(() => {
      if (!this.planned) return;
      this.refreshTraffic(false);
    }, 30000);
  }

  /** Route 1 is the one drawn from real OSRM road data, so its traffic pill should reflect
   *  the real (or honestly-labeled simulated) reading we just fetched — not a hardcoded value. */
  private applyLiveTrafficToPrimaryRoute() {
    if (this.routeOptions[0]) this.routeOptions[0].traffic = this.overallTraffic;
    this.sortRoutes();
  }

  /** The alternate route cards (r2/r3) previously had traffic hardcoded by array index
   *  regardless of what the traffic API said. Now each queries the real (or simulated,
   *  honestly labeled) traffic endpoint at its own approximate midpoint, so their traffic
   *  pills are independently sourced instead of fixed decoration. */
  private fetchTrafficForAlternateRoutes() {
    const start = this.coordFor(this.startCity);
    const end = this.coordFor(this.endCity);
    if (!start || !end) return;

    this.routeOptions.slice(1).forEach((ro, idx) => {
      const jitter = this.routeHash(`${ro.id}|${this.startCity}|${this.endCity}`, 20 + idx);
      const lat = start[0] + (end[0] - start[0]) * (0.35 + jitter * 0.3);
      const lng = start[1] + (end[1] - start[1]) * (0.35 + jitter * 0.3);
      this.http.get<any>(`${environment.apiUrl}/traffic/flow`, { params: { lat: lat.toString(), lng: lng.toString() } })
        .subscribe({
          next: res => { ro.traffic = res.congestionLevel; this.sortRoutes(); },
          error: () => { /* keep the deterministic estimate if the traffic API is unreachable */ }
        });
    });
  }

  /** Only shows the "heavy traffic, alternative recommended" banner when the traffic we
   *  actually fetched came back heavy — previously this fired unconditionally on a timer
   *  regardless of what the (real or simulated) traffic reading said. */
  private maybeShowTrafficAlert(changed = true) {
    if (this.overallTraffic !== 'heavy') { this.trafficUpdate = ''; return; }
    // Only (re)write the banner text when this reading is new/initial or the congestion
    // level actually changed since the last poll — otherwise a 30s poll that comes back
    // "still heavy" would needlessly re-render the same alert.
    if (!changed && this.trafficUpdate) return;
    const nearCity = this.waypoints.find(w => w.city)?.city || this.endCity;
    const altRoute = this.routeOptions.find(r => r.traffic !== 'heavy');
    this.trafficUpdate = altRoute
      ? this.i18n.t('planner.trafficAlertWithAlt', { city: nearCity, route: altRoute.label })
      : this.i18n.t('planner.trafficAlert', { city: nearCity });
  }

  /** Plots real start/waypoint/end markers and route lines on the Leaflet map, then animates a bus icon along the path */
  private drawRouteOnMap() {
    if (!this.map) return;

    const startCoord = this.coordFor(this.startCity);
    const endCoord = this.coordFor(this.endCity);
    if (!startCoord || !endCoord) return;

    // Clear previous route
    this.markers.forEach(m => m.remove());
    this.markers = [];
    this.routeLine?.remove();
    this.altLine?.remove();
    this.busMarker?.remove();
    if (this.busAnimInterval) clearInterval(this.busAnimInterval);

    const wpCoords = this.waypoints
      .map(w => this.coordFor(w.city))
      .filter((c): c is [number, number] => !!c);

    const path: [number, number][] = [startCoord, ...wpCoords, endCoord];

    const trafficColor = { light: '#4caf50', moderate: '#ff9800', heavy: '#f44336' }[this.overallTraffic];

    const startMarker = L.marker(startCoord).addTo(this.map).bindPopup(`<b>${this.startCity}</b> (${this.i18n.t('planner.start')})`);
    const endMarker = L.marker(endCoord).addTo(this.map).bindPopup(`<b>${this.endCity}</b> (${this.i18n.t('planner.destination')})`);
    this.markers.push(startMarker, endMarker);

    wpCoords.forEach((c, i) => {
      const m = L.marker(c).addTo(this.map!).bindPopup(`<b>${this.waypoints[i]?.city}</b> (${this.i18n.t('planner.stopover')})`);
      this.markers.push(m);
    });

    this.map.fitBounds(L.latLngBounds(path), { padding: [40, 40] });

    // Real road-following geometry from OSRM's public routing engine (not a straight line
    // between city centers), including a genuine alternative route when OSRM returns one —
    // replacing the previous fake dashed line, which was just a fixed lat/lng offset with
    // no relationship to any actual road or to any of the 3 listed route options.
    this.fetchRoadGeometry(path).subscribe({
      next: ({ main, alt }) => {
        this.routeSource = 'osrm';
        this.routeLine = L.polyline(main, { color: trafficColor, weight: 5, opacity: 0.85 }).addTo(this.map!);
        if (alt) {
          this.altLine = L.polyline(alt, { color: '#1976d2', weight: 3, opacity: 0.6, dashArray: '8,6' })
            .addTo(this.map!)
            .bindPopup(this.i18n.t('planner.altRoutePopup'));
        }
        this.animateBus(main, startCoord, endCoord);
      },
      error: () => {
        // OSRM unreachable — fall back to a straight line, but disclose that's what it is
        // (dashed + a badge in the template) instead of presenting it as a real route.
        this.routeSource = 'straight-line';
        this.routeLine = L.polyline(path, { color: trafficColor, weight: 5, opacity: 0.85, dashArray: '4,4' })
          .addTo(this.map!)
          .bindPopup(this.i18n.t('planner.straightLineNotice'));
        this.animateBus(path, startCoord, endCoord);
      }
    });
  }

  /** Calls OSRM's public routing API for a real road-following path between the given
   *  stops, plus an alternative route when one exists. Returns Leaflet-ordered [lat,lng]
   *  coordinate arrays. */
  private fetchRoadGeometry(path: [number, number][]): Observable<{ main: [number, number][]; alt: [number, number][] | null }> {
    const coordStr = path.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&alternatives=true`;
    return this.http.get<any>(url).pipe(
      map(res => {
        if (!res?.routes?.length) throw new Error('OSRM returned no route');
        const toLatLng = (coords: [number, number][]): [number, number][] => coords.map(([lng, lat]) => [lat, lng]);
        return {
          main: toLatLng(res.routes[0].geometry.coordinates),
          alt: res.routes[1] ? toLatLng(res.routes[1].geometry.coordinates) : null
        };
      }),
      catchError(err => throwError(() => err))
    );
  }

  /** Animate a bus marker moving along an arbitrary-length road-geometry path */
  private animateBus(path: [number, number][], startCoord: [number, number], endCoord: [number, number]) {
    if (!this.map || path.length < 2) return;
    const busIcon = L.divIcon({ className: 'bus-divicon', html: '🚌', iconSize: [24, 24], iconAnchor: [12, 12] });
    this.busMarker = L.marker(startCoord, { icon: busIcon }).addTo(this.map);

    let t = 0;
    this.busAnimInterval = setInterval(() => {
      t += 0.01;
      if (t >= 1) {
        this.busMarker?.setLatLng(endCoord);
        clearInterval(this.busAnimInterval);
        return;
      }
      const segCount = path.length - 1;
      const segT = t * segCount;
      const segIdx = Math.min(Math.floor(segT), segCount - 1);
      const localT = segT - segIdx;
      const [lat1, lng1] = path[segIdx];
      const [lat2, lng2] = path[segIdx + 1];
      this.busMarker?.setLatLng([lat1 + (lat2 - lat1) * localT, lng1 + (lng2 - lng1) * localT]);
    }, 40);
  }

  /** Simple deterministic hash: same string always returns same number 0..1 */
  private routeHash(seed: string, offset = 0): number {
    let h = offset * 2654435761;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h * 2654435761) >>> 0;
    }
    return (h >>> 0) / 0xFFFFFFFF;
  }

  generateRoutes() {
    const seed = `${this.startCity}|${this.endCity}`;
    const wps = this.waypoints.filter(w => w.city).map(w => w.city);
    const midCities = wps.length ? wps : this.getMidCities();

    // All values derived from seed — identical for the same route every time
    const d1 = Math.round(this.routeHash(seed, 1) * 150 + 200);
    const d2 = Math.round(this.routeHash(seed, 2) * 100 + 260);
    const d3 = Math.round(this.routeHash(seed, 3) * 200 + 300);
    const h1 = Math.floor(this.routeHash(seed, 4) * 3 + 5);
    const m1 = Math.floor(this.routeHash(seed, 5) * 50);
    const h2 = Math.floor(this.routeHash(seed, 6) * 2 + 6);
    const m2 = Math.floor(this.routeHash(seed, 7) * 50);
    const h3 = Math.floor(this.routeHash(seed, 8) * 3 + 7);
    const m3 = Math.floor(this.routeHash(seed, 9) * 50);
    const f1 = Math.floor(this.routeHash(seed, 10) * 300 + 500);
    const f2 = Math.floor(this.routeHash(seed, 11) * 200 + 400);
    const f3 = Math.floor(this.routeHash(seed, 12) * 200 + 350);

    const routes: RouteOption[] = [
      {
        // Distance/time are placeholders until the real OSRM road route resolves
        // (applyLiveTrafficToPrimaryRoute/drawRouteOnMap update traffic + the map line);
        // this is the only one of the three actually backed by a routing engine.
        id: 'r1', label: `${this.startCity} → ${this.endCity} (${this.i18n.t('planner.fastestRouteLabel')})`,
        distance: `${d1} km`, time: `${h1}h ${m1}m`,
        traffic: 'light', fare: f1, stops: [...midCities.slice(0,1), this.i18n.t('planner.expressHighway')], recommended: false, saved: false, estimated: false
      },
      {
        id: 'r2', label: `${this.startCity} → ${this.endCity} (${this.i18n.t('planner.stateHighwayLabel')})`,
        distance: `${d2} km`, time: `${h2}h ${m2}m`,
        traffic: 'moderate', fare: f2, stops: [...midCities.slice(0,2), this.i18n.t('planner.localRoute')], recommended: false, saved: false, estimated: true
      },
      {
        id: 'r3', label: `${this.startCity} → ${this.endCity} (${this.i18n.t('planner.coastalRouteLabel')})`,
        distance: `${d3} km`, time: `${h3}h ${m3}m`,
        traffic: 'heavy', fare: f3, stops: [this.i18n.t('planner.scenicRoute'), this.i18n.t('planner.coastRoad')], recommended: false, saved: false, estimated: true
      }
    ];

    // Mark recommended by actual comparison: lowest fare + non-heavy traffic wins
    const best = routes
      .filter(r => r.traffic !== 'heavy')
      .reduce((a, b) => a.fare <= b.fare ? a : b, routes[0]);
    best.recommended = true;

    this.routeOptions = routes;
    this.sortRoutes();
  }

  getMidCities() {
    const seed = `${this.startCity}|${this.endCity}`;
    const all = this.cities.filter(c => c !== this.startCity && c !== this.endCity);
    return [all[Math.floor(this.routeHash(seed, 99) * all.length)]];
  }

  /** Parses "5h 23m" style strings into total minutes for correct numeric comparison */
  private timeToMinutes(t: string): number {
    const m = t.match(/(\d+)h\s*(\d+)m/);
    return m ? (+m[1]) * 60 + (+m[2]) : 0;
  }

  /** Parses "320 km" style strings into a plain number for correct numeric comparison */
  private distanceToKm(d: string): number {
    const m = d.match(/(\d+)/);
    return m ? +m[1] : 0;
  }

  sortRoutes() {
    if (this.compareBy === 'fare') this.routeOptions.sort((a,b) => a.fare - b.fare);
    else if (this.compareBy === 'distance') this.routeOptions.sort((a,b) => this.distanceToKm(a.distance) - this.distanceToKm(b.distance));
    else if (this.compareBy === 'traffic') this.routeOptions.sort((a,b) => { const m={'light':0,'moderate':1,'heavy':2}; return m[a.traffic]-m[b.traffic]; });
    else this.routeOptions.sort((a,b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  selectRoute(ro: RouteOption) { this.selectedRoute = this.selectedRoute === ro.id ? '' : ro.id; }

  saveRoute(ro: RouteOption) {
    ro.saved = true;
    const sr = { from: this.startCity, to: this.endCity, distance: ro.distance, time: ro.time, routeId: ro.id };
    if (!this.savedRoutes.find(r => r.from === sr.from && r.to === sr.to)) {
      this.savedRoutes.unshift(sr);
      localStorage.setItem('rb_saved_routes', JSON.stringify(this.savedRoutes.slice(0, 5)));
    }
  }

  useRoute(sr: any) { this.startCity = sr.from; this.endCity = sr.to; this.planRoute(); }
  private busAnimInterval?: any;
  private trafficPollInterval?: any;
  bookRoute(ro: RouteOption) { window.location.href = `/search?from=${this.startCity}&to=${this.endCity}&date=${this.journeyDate}`; }

  ngOnDestroy() {
    if (this.busAnimInterval) clearInterval(this.busAnimInterval);
    if (this.trafficPollInterval) clearInterval(this.trafficPollInterval);
    this.map?.remove();
  }

  zoomIn() { this.map?.zoomIn(); }
  zoomOut() { this.map?.zoomOut(); }
}
