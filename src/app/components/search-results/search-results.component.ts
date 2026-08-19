import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, switchMap } from 'rxjs';
import { BusService } from '../../services/bus.service';
import { I18nService } from '../../services/i18n.service';
import { ToastService } from '../../services/toast.service';
import { Bus } from '../../models/bus.model';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <!-- Search Bar (compact) -->
    <div class="results-header">
      <div class="container">
        <div class="results-search-bar">
          <div class="rsb-city">
            <div class="rsb-label">{{i18n.t('search.from')}}</div>
            <div class="rsb-val">{{from}}</div>
          </div>
          <div class="rsb-arrow"><i class="fa fa-arrow-right"></i></div>
          <div class="rsb-city">
            <div class="rsb-label">{{i18n.t('search.to')}}</div>
            <div class="rsb-val">{{to}}</div>
          </div>
          <div class="rsb-date">
            <div class="rsb-label">{{i18n.t('search.date')}}</div>
            <div class="rsb-val">{{date | date:'EEE, dd MMM'}}</div>
          </div>
          <button class="rb-btn-primary" style="padding:8px 20px; font-size:13px;" (click)="goHome()">
            <i class="fa fa-edit"></i> {{i18n.t('results.modify')}}
          </button>
        </div>
        <!-- Date selector -->
        <div class="date-tabs">
          <div class="date-tab" *ngFor="let d of dateRange" [class.active]="d.val===date" (click)="changeDate(d.val)">
            <div class="dt-day">{{d.day}}</div>
            <div class="dt-date">{{d.date}}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="container results-layout">
      <!-- Filters Sidebar -->
      <aside class="filters-panel rb-card">
        <div class="filter-header flex-between">
          <span class="fw-700">{{i18n.t('results.filters')}}</span>
          <button class="clear-btn" (click)="clearFilters()">{{i18n.t('results.clearAll')}}</button>
        </div>

        <div class="filter-section">
          <div class="filter-title">{{i18n.t('results.departureTime')}}</div>
          <div class="time-chips">
            <div class="time-chip" [class.active]="filters.times.includes('before6')" (click)="toggleTime('before6')">
              <i class="fa fa-moon"></i><div>{{i18n.t('results.before6')}}</div>
            </div>
            <div class="time-chip" [class.active]="filters.times.includes('6to12')" (click)="toggleTime('6to12')">
              <i class="fa fa-sun"></i><div>{{i18n.t('results.time6to12')}}</div>
            </div>
            <div class="time-chip" [class.active]="filters.times.includes('12to6')" (click)="toggleTime('12to6')">
              <i class="fa fa-cloud-sun"></i><div>{{i18n.t('results.time12to6')}}</div>
            </div>
            <div class="time-chip" [class.active]="filters.times.includes('after6')" (click)="toggleTime('after6')">
              <i class="fa fa-moon"></i><div>{{i18n.t('results.after6')}}</div>
            </div>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">{{i18n.t('results.busType')}}</div>
          <label class="filter-check" *ngFor="let type of busTypes; trackBy: trackByIndex">
            <input type="checkbox" [checked]="filters.types.includes(type)" (change)="toggleType(type)"> {{type}}
          </label>
        </div>

        <div class="filter-section">
          <div class="filter-title">{{i18n.t('results.amenities')}}</div>
          <div class="amenity-chips">
            <div class="rb-chip" *ngFor="let a of amenitiesList; trackBy: trackByIndex" [class.active]="filters.amenities.includes(a.key)" (click)="toggleAmenity(a.key)">
              <i [class]="a.icon"></i> {{i18n.t('amenity.'+a.key)}}
            </div>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-title">{{i18n.t('results.priceRange')}}</div>
          <div class="price-range-labels flex-between" style="margin-bottom:8px;">
            <span class="fs-13 text-grey">₹{{filters.minPrice}}</span>
            <span class="fs-13 text-grey">₹{{filters.maxPrice}}</span>
          </div>
          <input type="range" [(ngModel)]="filters.maxPrice" min="200" max="3000" step="50" class="price-slider" style="width:100%;">
        </div>

        <div class="filter-section">
          <div class="filter-title">{{i18n.t('results.operatorRating')}}</div>
          <label class="filter-check" *ngFor="let r of ratingOptions; trackBy: trackByIndex">
            <input type="checkbox" [checked]="filters.ratings.includes(r.val)" (change)="toggleRating(r.val)">
            <i class="fa fa-star text-yellow"></i> {{i18n.t('results.starsPlus', {n: r.val})}}
          </label>
        </div>
      </aside>

      <!-- Results -->
      <div class="results-main">
        <!-- Sort & Count -->
        <div class="results-toolbar flex-between">
          <span class="results-count" *ngIf="!loading">{{i18n.t('results.busesFound', {count: filteredBuses.length, from, to})}}</span>
          <span class="results-count" *ngIf="loading">{{i18n.t('results.searching', {from, to})}}</span>
          <div class="sort-options flex-center gap-8">
            <span class="fs-13 text-grey">{{i18n.t('results.sortBy')}}</span>
            <button class="sort-btn" role="button" [class.active]="sortBy==='departure'" (click)="setSortBy('departure')">{{i18n.t('results.sortDeparture')}}</button>
            <button class="sort-btn" role="button" [class.active]="sortBy==='price'" (click)="setSortBy('price')">{{i18n.t('results.sortPrice')}}</button>
            <button class="sort-btn" role="button" [class.active]="sortBy==='duration'" (click)="setSortBy('duration')">{{i18n.t('results.sortDuration')}}</button>
            <button class="sort-btn" role="button" [class.active]="sortBy==='rating'" (click)="setSortBy('rating')">{{i18n.t('results.sortRating')}}</button>
            <button class="sort-btn" role="button" [class.active]="sortBy==='seats'" (click)="setSortBy('seats')">{{i18n.t('results.sortSeats')}}</button>
          </div>
        </div>

        <!-- Loading -->
        <div class="loading-state" *ngIf="loading">
          <div class="loading-card rb-card" *ngFor="let i of [1,2,3]">
            <div class="skeleton sk-title"></div>
            <div class="skeleton sk-subtitle"></div>
            <div class="skeleton sk-row"></div>
          </div>
        </div>

        <!-- Empty state -->
        <div class="empty-state rb-card" *ngIf="!loading && filteredBuses.length===0">
          <i class="fa fa-bus fa-3x" style="color:#ddd;"></i>
          <h3>{{i18n.t('results.noBusesFound')}}</h3>
          <p>{{i18n.t('results.tryDifferent')}}</p>
          <button class="rb-btn-primary" (click)="goHome()">{{i18n.t('results.searchAgain')}}</button>
        </div>

        <!-- Bus Cards -->
        <div class="bus-card rb-card" *ngFor="let bus of filteredBuses; trackBy: trackBusId">
          <div class="bus-card-main">
            <div class="bus-operator">
              <div class="op-logo">{{bus.name[0]}}</div>
              <div>
                <div class="op-name">{{bus.name}}</div>
                <div class="op-type fs-12 text-grey">{{bus.type}}</div>
              </div>
            </div>
            <div class="bus-timing">
              <div class="time-big">{{bus.departureTime}}</div>
              <div class="time-from text-grey fs-12">{{bus.from}}</div>
            </div>
            <div class="bus-duration">
              <div class="dur-line">
                <div class="dur-dot"></div>
                <div class="dur-bar"></div>
                <div class="dur-dot"></div>
              </div>
              <div class="dur-text fs-12 text-grey">{{bus.duration}}</div>
            </div>
            <div class="bus-timing">
              <div class="time-big">{{bus.arrivalTime}}</div>
              <div class="time-from text-grey fs-12">{{bus.to}}</div>
              <div class="next-day fs-11 text-grey" *ngIf="isNextDay(bus)">{{i18n.t('results.plusOneDay')}}</div>
            </div>
            <div class="bus-rating">
              <div class="rating-badge" [class.green]="bus.rating>=4" [class.orange]="bus.rating>=3.5&&bus.rating<4" [class.red]="bus.rating<3.5">
                {{bus.rating}} <i class="fa fa-star"></i>
              </div>
              <div class="rating-count fs-11 text-grey">{{i18n.t('results.ratingsCount', {n: bus.reviews})}}</div>
            </div>
            <div class="bus-price">
              <div class="price-main">₹{{bus.price}}</div>
              <div class="price-seats" [class.text-red]="bus.availableSeats<=5">
                <i class="fa fa-fire text-red" *ngIf="bus.availableSeats<=5"></i>
                {{bus.availableSeats<=5 ? i18n.t('results.hurryLeft', {n: bus.availableSeats}) : i18n.t('results.seatsAvailable', {n: bus.availableSeats})}}
              </div>
              <button class="rb-btn-primary view-seats-btn" (click)="selectBus(bus)" [attr.aria-label]="i18n.t('results.selectAriaLabel', {name: bus.name, price: bus.price, seats: bus.availableSeats})" style="margin-top:8px; width:100%;">
                {{i18n.t('results.viewSeats')}}
              </button>
            </div>
          </div>
          <!-- Offer strip -->
          <div class="bus-offer-strip" *ngIf="bus.offers && bus.offers.length">
            <i class="fa fa-tag" style="color:#f47c20;"></i>
            <span>{{bus.offers[0]}}</span>
          </div>
          <!-- Amenities & details -->
          <div class="bus-card-footer">
            <div class="amenities-row">
              <span class="amenity-icon" *ngFor="let a of bus.amenities" [title]="a">
                <i [class]="getAmenityIcon(a)"></i>
              </span>
            </div>
            <div class="flex-center gap-8">
              <a href="#" class="detail-link" (click)="toggleDetails(bus, $event)">
                <i class="fa fa-map-marker-alt"></i> {{i18n.t('results.boardingPoints')}}
              </a>
              <a href="#" class="detail-link" (click)="toggleDetails(bus, $event)">
                <i class="fa fa-info-circle"></i> {{i18n.t('results.busInfo')}}
              </a>
              <span class="cancel-policy fs-11" [class.text-green]="bus.cancellationPolicy.includes('Free')">
                <i class="fa fa-check-circle" *ngIf="bus.cancellationPolicy.includes('Free')"></i>
                {{bus.cancellationPolicy}}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .results-header { background:var(--bg-card); border-bottom:1px solid var(--border); padding:0; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
    .results-search-bar { display:flex; align-items:center; gap:24px; padding:16px 0 0; }
    .rsb-city { }
    .rsb-label { font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:0.5px; }
    .rsb-val { font-size:18px; font-weight:800; color:var(--text-primary); }
    .rsb-arrow { color:#d84e55; font-size:16px; }
    .rsb-date .rsb-val { font-size:16px; font-weight:700; }
    .date-tabs { display:flex; gap:0; margin-top:12px; overflow-x:auto; }
    .date-tab { padding:10px 20px; text-align:center; cursor:pointer; border-bottom:3px solid transparent; transition:all 0.2s; min-width:90px;
      &.active { border-bottom-color:#d84e55; color:#d84e55; }
      &:hover:not(.active) { border-bottom-color:#eee; background:var(--bg-hover); }
    }
    .dt-day { font-size:11px; color:var(--text-muted); text-transform:uppercase; }
    .dt-date { font-size:13px; font-weight:600; }
    .results-layout { display:grid; grid-template-columns:260px 1fr; gap:20px; padding-top:24px; padding-bottom:48px; }
    .filters-panel { padding:0; height:fit-content; position:sticky; top:80px; }
    .filter-header { padding:16px 20px; border-bottom:1px solid var(--border); }
    .clear-btn { background:none; border:none; color:#d84e55; font-size:12px; font-weight:600; cursor:pointer; }
    .filter-section { padding:16px 20px; border-bottom:1px solid var(--border);
      &:last-child { border-bottom:none; }
    }
    .filter-title { font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:12px; }
    .time-chips { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .time-chip { padding:10px 6px; border:1.5px solid #e0e0e0; border-radius:8px; text-align:center; cursor:pointer; font-size:11px; transition:all 0.2s;
      i { font-size:14px; display:block; margin-bottom:4px; color:var(--text-muted); }
      &.active { border-color:#d84e55; color:#d84e55; background:var(--bg-card)0f1; i { color:#d84e55; } }
      &:hover:not(.active) { border-color:#bbb; }
    }
    .filter-check { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-secondary); margin-bottom:8px; cursor:pointer;
      input { accent-color:#d84e55; width:14px; height:14px; }
    }
    .amenity-chips { display:flex; gap:6px; flex-wrap:wrap; }
    .price-slider { accent-color:#d84e55; }
    .text-yellow { color:#f4c430; }
    .results-toolbar { margin-bottom:16px; }
    .results-count { font-size:14px; color:var(--text-secondary); }
    .sort-btn { background:var(--bg-card); border:1.5px solid #e0e0e0; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:500; color:var(--text-secondary); cursor:pointer; transition:all 0.2s;
      &.active, &:hover { border-color:#d84e55; color:#d84e55; background:var(--bg-card)0f1; }
    }
    .loading-card { padding:24px; margin-bottom:12px; }
    .skeleton { background:#f0f0f0; border-radius:4px; animation:pulse 1.5s infinite; }
    .sk-title { height:20px; width:40%; margin-bottom:12px; }
    .sk-subtitle { height:14px; width:60%; margin-bottom:16px; }
    .sk-row { height:14px; width:80%; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .empty-state { padding:60px; text-align:center;
      h3 { font-size:20px; margin:16px 0 8px; }
      p { color:var(--text-muted); margin-bottom:20px; }
    }
    .bus-card { margin-bottom:14px; overflow:hidden; transition:box-shadow 0.2s;
      &:hover { box-shadow:0 4px 16px rgba(0,0,0,0.12); }
    }
    .bus-card-main { display:grid; grid-template-columns:200px 1fr 120px 1fr auto 160px; gap:16px; align-items:center; padding:20px; }
    .bus-operator { display:flex; align-items:center; gap:10px; }
    .op-logo { width:40px; height:40px; background:#d84e55; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-size:18px; font-weight:800; flex-shrink:0; }
    .op-name { font-size:14px; font-weight:700; color:var(--text-primary); }
    .op-type { margin-top:3px; }
    .bus-timing { text-align:center; }
    .time-big { font-size:22px; font-weight:800; color:var(--text-primary); }
    .time-from { margin-top:3px; }
    .next-day { margin-top:2px; }
    .bus-duration { display:flex; flex-direction:column; align-items:center; gap:4px; }
    .dur-line { display:flex; align-items:center; gap:2px; width:100%; }
    .dur-dot { width:8px; height:8px; border-radius:50%; background:#d84e55; flex-shrink:0; }
    .dur-bar { flex:1; height:2px; background:#e0e0e0; position:relative;
      &::after { content:''; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:0; height:0; border-style:solid; border-width:4px 0 4px 6px; border-color:transparent transparent transparent #d84e55; }
    }
    .dur-text { margin-top:4px; }
    .bus-rating { text-align:center; }
    .rating-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:4px; color:white; font-weight:700; font-size:13px;
      &.green { background:#4caf50; }
      &.orange { background:#ff9800; }
      &.red { background:#f44336; }
    }
    .rating-count { margin-top:4px; }
    .bus-price { text-align:center; }
    .price-main { font-size:24px; font-weight:800; color:#d84e55; }
    .price-seats { font-size:12px; color:var(--text-muted); margin-top:3px; }
    .view-seats-btn { font-size:12px; font-weight:700; padding:8px 12px; }
    .bus-offer-strip { background:var(--bg-card)8e1; padding:6px 20px; border-top:1px solid #ffe082; font-size:12px; color:#f57c00; display:flex; align-items:center; gap:6px; font-weight:500; }
    .bus-card-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-top:1px solid #f5f5f5; background:#fafafa; }
    .amenities-row { display:flex; gap:8px; }
    .amenity-icon { color:var(--text-muted); font-size:14px; }
    .detail-link { font-size:12px; color:#d84e55; display:flex; align-items:center; gap:4px; &:hover { text-decoration:underline; } }
    .cancel-policy { color:#4caf50; display:flex; align-items:center; gap:4px; }
  
    @media (max-width: 900px) {
      .results-layout { grid-template-columns: 220px 1fr !important; }
      .bus-card-main { grid-template-columns: 160px 1fr auto 140px !important; }
      .bus-duration { display: none; }
      .bus-rating { display: none; }
    }
    @media (max-width: 768px) {
      .results-layout { grid-template-columns: 1fr !important; }
      .filters-panel { display: none !important; }
      .bus-card-main { grid-template-columns: 1fr 1fr !important; gap: 12px !important; padding: 14px !important; }
      .bus-operator { grid-column: 1/-1; }
      .bus-duration, .bus-rating { display: none !important; }
      .bus-timing { text-align: left; }
      .time-big { font-size: 18px !important; }
      .sort-options { flex-wrap: wrap; gap: 4px; }
      .sort-btn { padding: 4px 10px; font-size: 11px; }
      .results-count { font-size: 12px; }
      .date-tabs { gap: 0; }
      .date-tab { min-width: 70px; padding: 8px 10px; }
      .rsb-date { display: none; }
    }
    @media (max-width: 480px) {
      .bus-card-main { grid-template-columns: 1fr !important; }
      .bus-price { border-top: 1px solid #eee; padding-top: 10px; }
      .view-seats-btn { width: 100%; }
      .sort-options { display: none !important; }
    }
  `]
})
export class SearchResultsComponent implements OnInit {
  from = ''; to = ''; date = ''; passengers = 1;
  buses: Bus[] = []; filteredBuses: Bus[] = [];
  loading = true; sortBy = 'departure';
  dateRange: any[] = [];
  filters = { times: [] as string[], types: [] as string[], amenities: [] as string[], minPrice: 100, maxPrice: 3000, ratings: [] as number[] };
  busTypes = ['AC Sleeper', 'AC Seater', 'Non AC Sleeper', 'Non AC Seater', 'Volvo'];
  amenitiesList = [
    { key:'wifi', icon:'fa fa-wifi', label:'WiFi' },
    { key:'ac', icon:'fa fa-snowflake', label:'A/C' },
    { key:'charging', icon:'fa fa-plug', label:'Charging' },
    { key:'blanket', icon:'fa fa-bed', label:'Blanket' },
    { key:'water', icon:'fa fa-tint', label:'Water' },
  ];
  ratingOptions = [{ val:4, label:'4+ stars'}, {val:3.5, label:'3.5+ stars'}, {val:3, label:'3+ stars'}];

  private destroyRef = inject(DestroyRef);
  constructor(private route: ActivatedRoute, private busService: BusService, private router: Router, public i18n: I18nService, private toast: ToastService) {}

  ngOnInit() {
    // Findings: route.queryParams can emit more than once in quick succession (initial
    // navigation, or whenever Modify/date-tabs/filters trigger router.navigate with new
    // params), and each emission used to fire an independent loadBuses() call with no
    // cancellation of whatever request was already in flight. On a slow backend (e.g. a
    // Render free-tier instance waking from sleep), an earlier request could resolve and
    // render results while a later, still-pending duplicate had already reset `loading`
    // back to true — leaving the skeleton stuck even though correct results were already
    // showing underneath it. switchMap cancels the previous request outright whenever a
    // new one starts, so only the latest query params' request can ever affect the UI.
    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(p => {
        this.from = p['from'] || 'Bangalore';
        this.to = p['to'] || 'Chennai';
        this.date = p['date'] || new Date().toISOString().split('T')[0];
        this.passengers = +p['passengers'] || 1;
        this.buildDateRange();
        this.loading = true;
        return this.busService.searchBuses({ from: this.from, to: this.to, date: this.date })
          .pipe(finalize(() => { this.loading = false; }));
      })
    ).subscribe({
      next: (buses) => {
        this.buses = buses;
        this.applyFilters();
      },
      error: () => {
        this.buses = [];
        this.filteredBuses = [];
        this.toast.error(this.i18n.t('err.network'));
      }
    });
  }

  buildDateRange() {
    const d = new Date(this.date);
    this.dateRange = [];
    for (let i = -1; i <= 4; i++) {
      const nd = new Date(d); nd.setDate(d.getDate() + i);
      this.dateRange.push({ val: nd.toISOString().split('T')[0], day: nd.toLocaleDateString('en-US',{weekday:'short'}), date: nd.toLocaleDateString('en-US',{day:'2-digit',month:'short'}) });
    }
  }

  // Findings: applyFilters() only ever checked maxPrice/ratings/amenities. The Departure
  // Time chips and Bus Type checkboxes both correctly pushed into filters.times/types via
  // toggleTime()/toggleType() and triggered applyFilters() on click — but nothing in
  // applyFilters() ever read those two arrays, so selecting them changed the UI's active/
  // checked state with zero effect on the actual results. Both are wired in now.
  private inTimeWindow(departureTime: string, window: string): boolean {
    const hour = parseInt(departureTime.split(':')[0], 10);
    switch (window) {
      case 'before6': return hour < 6;
      case '6to12': return hour >= 6 && hour < 12;
      case '12to6': return hour >= 12 && hour < 18;
      case 'after6': return hour >= 18;
      default: return true;
    }
  }

  applyFilters() {
    let res = [...this.buses];
    if (this.filters.maxPrice < 3000) res = res.filter(b => b.price <= this.filters.maxPrice);
    if (this.filters.ratings.length) res = res.filter(b => this.filters.ratings.some(r => b.rating >= r));
    if (this.filters.amenities.length) res = res.filter(b => this.filters.amenities.every(a => b.amenities.includes(a)));
    if (this.filters.times.length) res = res.filter(b => this.filters.times.some(t => this.inTimeWindow(b.departureTime, t)));
    if (this.filters.types.length) res = res.filter(b => this.filters.types.includes(b.type));
    this.sortBuses(res);
  }

  sortBuses(buses?: Bus[]) {
    const arr = buses || this.filteredBuses;
    switch(this.sortBy) {
      case 'price': arr.sort((a,b) => a.price-b.price); break;
      case 'rating': arr.sort((a,b) => b.rating-a.rating); break;
      case 'seats': arr.sort((a,b) => b.availableSeats-a.availableSeats); break;
      case 'departure': arr.sort((a,b) => a.departureTime.localeCompare(b.departureTime)); break;
    }
    this.filteredBuses = [...arr];
  }

  setSortBy(s: string) { this.sortBy = s; this.sortBuses(); }
  toggleTime(t: string) { const i = this.filters.times.indexOf(t); i>-1 ? this.filters.times.splice(i,1) : this.filters.times.push(t); this.applyFilters(); }
  toggleType(t: string) { const i = this.filters.types.indexOf(t); i>-1 ? this.filters.types.splice(i,1) : this.filters.types.push(t); this.applyFilters(); }
  toggleAmenity(a: string) { const i = this.filters.amenities.indexOf(a); i>-1 ? this.filters.amenities.splice(i,1) : this.filters.amenities.push(a); this.applyFilters(); }
  toggleRating(r: number) { const i = this.filters.ratings.indexOf(r); i>-1 ? this.filters.ratings.splice(i,1) : this.filters.ratings.push(r); this.applyFilters(); }
  clearFilters() { this.filters = { times:[], types:[], amenities:[], minPrice:100, maxPrice:3000, ratings:[] }; this.applyFilters(); }
  // Navigates with the new date instead of calling searchBuses() directly — this
  // routes through the same queryParams -> switchMap pipeline in ngOnInit, so date-tab
  // clicks get the same request-cancellation guarantee as any other param change
  // (see the race-condition fix note in ngOnInit above) instead of a separate,
  // uncoordinated code path that could race against it.
  changeDate(d: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: d },
      queryParamsHandling: 'merge'
    });
  }
  goHome() { this.router.navigate(['/']); }
  selectBus(bus: Bus) { this.router.navigate(['/seats', bus.id], { queryParams: { from:this.from, to:this.to, date:this.date } }); }
  isNextDay(bus: Bus) { return bus.arrivalTime < bus.departureTime; }
  toggleDetails(bus: Bus, e: Event) { e.preventDefault(); }
  getAmenityIcon(a: string) {
    const map: any = { wifi:'fa fa-wifi', ac:'fa fa-snowflake', charging:'fa fa-plug', water:'fa fa-tint', blanket:'fa fa-bed', snacks:'fa fa-utensils', entertainment:'fa fa-tv' };
    return map[a] || 'fa fa-check';
  }
  trackBusId(index: number, bus: any): string { return bus.id; }
  trackByIndex(index: number): number { return index; }
}
